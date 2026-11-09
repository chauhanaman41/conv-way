import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { WindowBuilder } from '../src/worker/transcript/window-builder';
import { SupadataProvider } from '../src/worker/transcript/supadata';
import { TranscriptApiProvider } from '../src/worker/transcript/transcript-api';
import { YouTubeDiscoveryService } from '../src/worker/youtube/discovery';

function readSecret(name: string): string {
  try {
    const content = fs.readFileSync('.dev.vars', 'utf8');
    const match = content.match(new RegExp(`^${name}=(.*)$`, 'm'));
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : '';
  } catch {
    return '';
  }
}

async function seed() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: npm run seed -- <videoId_or_url>');
    process.exit(1);
  }

  const videoId = YouTubeDiscoveryService.extractVideoId(arg);
  if (!videoId) {
    console.error(`Invalid YouTube video ID or URL: "${arg}"`);
    process.exit(1);
  }

  console.log(`[Seed] Ingesting real transcript for YouTube Video: ${videoId}...`);

  // 1. Resolve metadata via YouTube oEmbed
  let title = `YouTube Video ${videoId}`;
  let channelTitle = 'YouTube Creator';
  let thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  try {
    const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (oembedRes.ok) {
      const oembedData = (await oembedRes.json()) as any;
      title = oembedData.title || title;
      channelTitle = oembedData.author_name || channelTitle;
      thumbnailUrl = oembedData.thumbnail_url || thumbnailUrl;
    }
  } catch (e: any) {
    console.warn('[Seed] oEmbed resolution note:', e.message);
  }

  console.log(`[Seed] Title: "${title}" | Channel: "${channelTitle}"`);

  // 2. Fetch real transcript
  const supadataKey = readSecret('SUPADATA_API_KEY');
  const transcriptApiKey = readSecret('TRANSCRIPT_API_FALLBACK_KEY');

  const supadata = new SupadataProvider(supadataKey);
  const transcriptApi = new TranscriptApiProvider(transcriptApiKey);

  let cues: any[] = [];
  let provider = 'NONE';

  try {
    console.log('[Seed] Fetching via primary provider (Supadata)...');
    const res = await supadata.fetchTranscript(videoId, 'en');
    cues = res.cues;
    provider = 'SUPADATA';
  } catch (err: any) {
    console.warn(`[Seed] Supadata failed (${err.message}). Trying fallback (TranscriptAPI)...`);
    try {
      const res = await transcriptApi.fetchTranscript(videoId, 'en');
      cues = res.cues;
      provider = 'TRANSCRIPT_API';
    } catch (fallbackErr: any) {
      console.error(`[Seed] Both providers failed: ${fallbackErr.message}`);
      process.exit(1);
    }
  }

  console.log(`[Seed] Fetched ${cues.length} cues via ${provider}.`);

  // 3. Build speech windows
  const lastCue = cues[cues.length - 1];
  const durationSec = Math.ceil(lastCue ? lastCue.start + lastCue.duration : 0);
  const windows = WindowBuilder.buildWindows(cues, durationSec);
  console.log(`[Seed] Segmented into ${windows.length} speech windows.`);

  // 4. Generate SQL batch file
  const tmpSqlPath = path.resolve('.wrangler', 'tmp_seed.sql');
  const sqlStatements: string[] = [];

  const escapeSql = (str: string) => str.replace(/'/g, "''");

  sqlStatements.push(
    `INSERT INTO videos (video_id, title, channel_title, thumbnail_url, duration_sec, language, caption_status, transcript_provider, window_count, last_accessed_at)
     VALUES ('${escapeSql(videoId)}', '${escapeSql(title)}', '${escapeSql(channelTitle)}', '${escapeSql(thumbnailUrl)}', ${durationSec}, 'en', 'READY', '${provider}', ${windows.length}, (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))
     ON CONFLICT(video_id) DO UPDATE SET title = '${escapeSql(title)}', channel_title = '${escapeSql(channelTitle)}', caption_status = 'READY', transcript_provider = '${provider}', window_count = ${windows.length}, last_accessed_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));`
  );

  for (const w of windows) {
    sqlStatements.push(
      `INSERT INTO transcript_windows (video_id, window_index, start_sec, end_sec, word_count, plain_text, cues_json)
       VALUES ('${escapeSql(videoId)}', ${w.windowIndex}, ${w.startSec}, ${w.endSec}, ${w.wordCount}, '${escapeSql(w.plainText)}', '${escapeSql(w.cuesJson)}')
       ON CONFLICT(video_id, window_index) DO UPDATE SET plain_text = '${escapeSql(w.plainText)}', cues_json = '${escapeSql(w.cuesJson)}';`
    );
  }

  fs.writeFileSync(tmpSqlPath, sqlStatements.join('\n'), 'utf8');

  // 5. Execute against local D1
  console.log('[Seed] Applying SQL batch to local D1 database...');
  try {
    execSync(`npx wrangler d1 execute conv-way-db --local --file "${tmpSqlPath}"`, {
      stdio: 'inherit',
    });
    console.log(`\n[Seed SUCCESS] Video "${videoId}" successfully ingested into local D1!`);
    console.log(`  • Title: ${title}`);
    console.log(`  • Windows Stored: ${windows.length}`);
    console.log(`  • Duration: ${durationSec}s (${Math.floor(durationSec / 60)}m ${durationSec % 60}s)`);
    console.log(`  • First Window: 0.0s - ${windows[0]?.endSec}s`);
    console.log(`  • Last Window: ${windows[windows.length - 1]?.startSec}s - ${windows[windows.length - 1]?.endSec}s`);
  } finally {
    if (fs.existsSync(tmpSqlPath)) {
      fs.unlinkSync(tmpSqlPath);
    }
  }
}

seed().catch((err) => {
  console.error('[Seed Error]', err);
  process.exit(1);
});

