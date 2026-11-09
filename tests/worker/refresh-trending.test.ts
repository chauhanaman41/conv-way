import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YouTubeDiscoveryService } from '../../src/worker/youtube/discovery';
import { Env } from '../../src/worker/types';

describe('Admin Refresh Trending & Daily Job Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fails with honest error when YOUTUBE_DATA_API_KEY is not configured', async () => {
    const mockEnv = {
      YOUTUBE_DATA_API_KEY: undefined,
    } as unknown as Env;

    const discovery = new YouTubeDiscoveryService(mockEnv);
    const result = await discovery.refreshTrending();

    expect(result.success).toBe(false);
    expect(result.count).toBe(0);
    expect(result.error).toContain('YOUTUBE_DATA_API_KEY is not configured');
  });

  it('returns failure reason and writes nothing if YouTube API returns an error', async () => {
    const mockEnv = {
      YOUTUBE_DATA_API_KEY: 'mock-key',
      DB: {
        prepare: vi.fn(),
      },
      KV: {
        put: vi.fn(),
      },
    } as unknown as Env;

    // Mock fetch returning HTTP 403
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          error: {
            code: 403,
            message: 'YouTube Data API v3 has not been used in project or it is disabled.',
          },
        })
      ),
    }) as any;

    const discovery = new YouTubeDiscoveryService(mockEnv);
    const result = await discovery.refreshTrending();

    expect(result.success).toBe(false);
    expect(result.count).toBe(0);
    expect(result.error).toContain('YouTube Data API v3 has not been used');
    // Ensure no videos are written to DB or KV
    const calls = (mockEnv.DB?.prepare as any).mock.calls.map((c: any) => c[0]);
    const writeCalls = calls.filter((sql: string) => sql.includes('INSERT INTO videos') || sql.includes('UPDATE videos'));
    expect(writeCalls.length).toBe(0);
    expect(mockEnv.KV?.put).not.toHaveBeenCalled();
  });

  it('fetches real items via YouTube fixture, stores in D1 and KV, and returns item count', async () => {
    const d1Statements: any[] = [];
    let kvStoredData: any = null;

    const mockEnv = {
      YOUTUBE_DATA_API_KEY: 'mock-key',
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({ count_value: 0 }),
            run: vi.fn().mockResolvedValue({ success: true }),
          }),
        }),
      },
      KV: {
        put: vi.fn().mockImplementation((key, val) => {
          kvStoredData = JSON.parse(val);
          return Promise.resolve();
        }),
      },
    } as unknown as Env;

    // Mock search response fixture
    const searchFixture = {
      items: [
        { id: { videoId: 'ep1_test_id1' } },
        { id: { videoId: 'ep2_test_id2' } },
      ],
    };

    // Mock details response fixture
    const detailsFixture = {
      items: [
        {
          id: 'ep1_test_id1',
          snippet: {
            title: 'Episode 1: The Future of Computing',
            channelTitle: 'Tech Talk Channel',
            channelId: 'UC1234567890',
            thumbnails: { high: { url: 'https://img.youtube.com/vi/ep1_test_id1/hqdefault.jpg' } },
            defaultLanguage: 'en',
          },
          contentDetails: { duration: 'PT1H15M30S' },
        },
        {
          id: 'ep2_test_id2',
          snippet: {
            title: 'Episode 2: Scaling Distributed Systems',
            channelTitle: 'Cloud Insights',
            channelId: 'UC0987654321',
            thumbnails: { high: { url: 'https://img.youtube.com/vi/ep2_test_id2/hqdefault.jpg' } },
            defaultLanguage: 'en',
          },
          contentDetails: { duration: 'PT45M12S' },
        },
      ],
    };

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/search?')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(searchFixture),
        });
      }
      if (url.includes('/videos?')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(detailsFixture),
        });
      }
      return Promise.reject(new Error('Unknown URL: ' + url));
    }) as any;

    const discovery = new YouTubeDiscoveryService(mockEnv);
    const result = await discovery.refreshTrending();

    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
    expect(mockEnv.DB?.prepare).toHaveBeenCalled();
    expect(mockEnv.KV?.put).toHaveBeenCalled();
    expect(kvStoredData.videos.length).toBe(2);
    expect(kvStoredData.videos[0].videoId).toBe('ep1_test_id1');
    expect(kvStoredData.videos[0].durationSec).toBe(4530);
    expect(kvStoredData.videos[1].videoId).toBe('ep2_test_id2');
    expect(kvStoredData.videos[1].durationSec).toBe(2712);
  });
});
