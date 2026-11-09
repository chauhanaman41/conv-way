import fs from 'fs';
import path from 'path';
import { calculateWer } from '../src/shared/audio/wer';
import {
  simulatePhoneSpeakerCapture,
  MicConstraints,
  VolumeLevel,
  NoiseEnvironment,
} from '../tests/fixtures/mic/acoustic-simulator';

interface SentenceFixture {
  id: string;
  text: string;
  durationSec: number;
}

interface ReferenceData {
  sentences: SentenceFixture[];
}

export interface SettingResult {
  settingName: string;
  constraints: MicConstraints;
  averageWer: number;
  quietWer: number;
  fanWer: number;
  trafficWer: number;
  lowVolWer: number;
  medVolWer: number;
  highVolWer: number;
  echoPlaybackCaptured: boolean;
  totalTrials: number;
}

export function runMicTuningBenchmark(): SettingResult[] {
  const refPath = path.resolve(process.cwd(), 'tests/fixtures/mic/reference.json');
  const refData: ReferenceData = JSON.parse(fs.readFileSync(refPath, 'utf8'));

  const constraintCombinations: Array<{ name: string; constraints: MicConstraints }> = [
    // 1. All disabled
    {
      name: 'EC=OFF, NS=OFF, AGC=OFF',
      constraints: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    },
    // 2. AGC only
    {
      name: 'EC=OFF, NS=OFF, AGC=ON',
      constraints: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
    },
    // 3. NS only
    {
      name: 'EC=OFF, NS=ON, AGC=OFF',
      constraints: { echoCancellation: false, noiseSuppression: true, autoGainControl: false },
    },
    // 4. NS + AGC (Optimal phone speaker capture candidate)
    {
      name: 'EC=OFF, NS=ON, AGC=ON',
      constraints: { echoCancellation: false, noiseSuppression: true, autoGainControl: true },
    },
    // 5. EC only
    {
      name: 'EC=ON, NS=OFF, AGC=OFF',
      constraints: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
    },
    // 6. EC + AGC
    {
      name: 'EC=ON, NS=OFF, AGC=ON',
      constraints: { echoCancellation: true, noiseSuppression: false, autoGainControl: true },
    },
    // 7. EC + NS
    {
      name: 'EC=ON, NS=ON, AGC=OFF',
      constraints: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
    },
    // 8. All enabled (Default WebRTC standard)
    {
      name: 'EC=ON, NS=ON, AGC=ON',
      constraints: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    },
  ];

  const volumes: VolumeLevel[] = ['low', 'medium', 'high'];
  const noises: NoiseEnvironment[] = ['quiet', 'fan', 'traffic'];

  const results: SettingResult[] = [];

  for (const combo of constraintCombinations) {
    let totalWerSum = 0;
    let quietWerSum = 0, quietCount = 0;
    let fanWerSum = 0, fanCount = 0;
    let trafficWerSum = 0, trafficCount = 0;
    let lowVolSum = 0, lowCount = 0;
    let medVolSum = 0, medCount = 0;
    let highVolSum = 0, highCount = 0;
    let trialCount = 0;

    for (const item of refData.sentences) {
      for (const vol of volumes) {
        for (const noise of noises) {
          const sim = simulatePhoneSpeakerCapture(item.text, {
            volume: vol,
            noise,
            constraints: combo.constraints,
          });

          const werBreakdown = calculateWer(item.text, sim.hypothesisText);
          const trialWer = werBreakdown.wer;

          totalWerSum += trialWer;
          trialCount++;

          if (noise === 'quiet') { quietWerSum += trialWer; quietCount++; }
          if (noise === 'fan') { fanWerSum += trialWer; fanCount++; }
          if (noise === 'traffic') { trafficWerSum += trialWer; trafficCount++; }

          if (vol === 'low') { lowVolSum += trialWer; lowCount++; }
          if (vol === 'medium') { medVolSum += trialWer; medCount++; }
          if (vol === 'high') { highVolSum += trialWer; highCount++; }
        }
      }
    }

    const round3 = (n: number) => Math.round(n * 1000) / 1000;

    results.push({
      settingName: combo.name,
      constraints: combo.constraints,
      averageWer: round3(totalWerSum / trialCount),
      quietWer: round3(quietWerSum / quietCount),
      fanWer: round3(fanWerSum / fanCount),
      trafficWer: round3(trafficWerSum / trafficCount),
      lowVolWer: round3(lowVolSum / lowCount),
      medVolWer: round3(medVolSum / medCount),
      highVolWer: round3(highVolSum / highCount),
      echoPlaybackCaptured: !combo.constraints.echoCancellation,
      totalTrials: trialCount,
    });
  }

  // Sort by average WER ascending
  results.sort((a, b) => a.averageWer - b.averageWer);
  return results;
}

const results = runMicTuningBenchmark();
console.log('--- MIC TUNING BENCHMARK RESULTS (720 TRIALS) ---');
console.table(
  results.map((r) => ({
    'Setting': r.settingName,
    'Avg WER': `${(r.averageWer * 100).toFixed(1)}%`,
    'Quiet': `${(r.quietWer * 100).toFixed(1)}%`,
    'Fan': `${(r.fanWer * 100).toFixed(1)}%`,
    'Traffic': `${(r.trafficWer * 100).toFixed(1)}%`,
    'Low Vol': `${(r.lowVolWer * 100).toFixed(1)}%`,
    'Speaker Captured': r.echoPlaybackCaptured ? 'YES' : 'NO (AEC Suppressed)',
  }))
);
