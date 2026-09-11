import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, setToken } from './api';

function mockFetchOnce(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  });
}

describe('api client', () => {
  beforeEach(() => {
    setToken(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('attaches the bearer token from localStorage to authenticated requests', async () => {
    setToken('a-token');
    const fetchMock = mockFetchOnce(200, []);
    vi.stubGlobal('fetch', fetchMock);

    await api.listEmployees();

    const [, options] = fetchMock.mock.calls[0];
    expect((options.headers as Record<string, string>).Authorization).toBe('Bearer a-token');
  });

  it('omits the Authorization header when there is no token', async () => {
    const fetchMock = mockFetchOnce(200, []);
    vi.stubGlobal('fetch', fetchMock);

    await api.listEmployees();

    const [, options] = fetchMock.mock.calls[0];
    expect((options.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('throws the server-provided error message on a failed request', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(401, { error: 'Email atau password salah.' }));

    await expect(api.login('x@example.com', 'wrong')).rejects.toThrow('Email atau password salah.');
  });

  it('falls back to a generic message when the error body has no `error` field', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(500, {}));

    await expect(api.listEmployees()).rejects.toThrow('Permintaan gagal (500).');
  });
});
