import { afterEach, expect, it, vi } from 'vitest';
import vfs from './vfs';

afterEach(() => vi.unstubAllGlobals());

it('explicitly requests conflict protection for WebUI transfers', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'source' }) });
    vi.stubGlobal('fetch', fetch);
    await vfs.transfer('move', 'source', '/target');
    const [url, request] = fetch.mock.calls[0];
    expect(url).toBe('/vfs/source?wait=true');
    expect(JSON.parse(request.body)).toEqual({ name: '/target', checkConflict: true });
});
