import { describe, it, expect, vi } from 'vitest';
import {
  createFetchTransportAdapter,
  createMemoryTransportAdapter,
} from './serverTransport';

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

describe('fetch transport adapter', () => {
  it('pullAll GETs /data and returns the server sections map', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ th_workouts: { data: { a: 1 }, updatedAt: '2026-01-01' } })
    );
    const transport = createFetchTransportAdapter({ apiBase: '/api', fetchImpl });

    const result = await transport.pullAll();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/data');
    expect(opts?.method ?? 'GET').toBe('GET');
    expect(result).toEqual({
      ok: true,
      sections: { th_workouts: { data: { a: 1 }, updatedAt: '2026-01-01' } },
    });
  });

  it('pullAll reports ok:false on a non-2xx response without throwing', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(null, false, 500));
    const transport = createFetchTransportAdapter({ fetchImpl });
    await expect(transport.pullAll()).resolves.toEqual({ ok: false, sections: {} });
  });

  it('pullAll reports ok:false when the network throws (offline)', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('offline'); });
    const transport = createFetchTransportAdapter({ fetchImpl });
    await expect(transport.pullAll()).resolves.toEqual({ ok: false, sections: {} });
  });

  it('push PUTs a single key with a { data } body', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, true, 200));
    const transport = createFetchTransportAdapter({ apiBase: '/api', fetchImpl });

    const result = await transport.push('th_logs', { x: 1 });

    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/data/th_logs');
    expect(opts.method).toBe('PUT');
    expect(JSON.parse(opts.body)).toEqual({ data: { x: 1 } });
    expect(result).toEqual({ ok: true, status: 200 });
  });

  it('push surfaces the failing status code', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(null, false, 413));
    const transport = createFetchTransportAdapter({ fetchImpl });
    await expect(transport.push('th_logs', {})).resolves.toEqual({ ok: false, status: 413 });
  });

  it('push reports ok:false with null status when the network throws', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('offline'); });
    const transport = createFetchTransportAdapter({ fetchImpl });
    await expect(transport.push('th_logs', {})).resolves.toEqual({ ok: false, status: null });
  });

  it('pushAll PUTs the whole payload map to /data', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, true, 200));
    const transport = createFetchTransportAdapter({ apiBase: '/api', fetchImpl });

    const result = await transport.pushAll({ th_a: { n: 1 }, th_b: null });

    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/data');
    expect(opts.method).toBe('PUT');
    expect(JSON.parse(opts.body)).toEqual({ th_a: { n: 1 }, th_b: null });
    expect(result).toEqual({ ok: true, status: 200 });
  });
});

describe('memory transport fake', () => {
  it('starts empty and returns an empty sections map', async () => {
    const transport = createMemoryTransportAdapter();
    await expect(transport.pullAll()).resolves.toEqual({ ok: true, sections: {} });
  });

  it('records pushes and returns them from pullAll with an updatedAt stamp', async () => {
    const transport = createMemoryTransportAdapter({ clock: () => '2026-07-16T00:00:00Z' });
    await transport.push('th_workouts', { a: 1 });

    const { sections } = await transport.pullAll();
    expect(sections.th_workouts).toEqual({
      data: { a: 1 },
      updatedAt: '2026-07-16T00:00:00Z',
    });
  });

  it('pushAll seeds many sections at once', async () => {
    const transport = createMemoryTransportAdapter({ clock: () => 'T' });
    await transport.pushAll({ th_a: { n: 1 }, th_b: { n: 2 } });
    const { sections } = await transport.pullAll();
    expect(sections.th_a).toEqual({ data: { n: 1 }, updatedAt: 'T' });
    expect(sections.th_b).toEqual({ data: { n: 2 }, updatedAt: 'T' });
  });

  it('records a null push as an intentional deletion (data:null, updatedAt set)', async () => {
    const transport = createMemoryTransportAdapter({ clock: () => 'T' });
    await transport.push('th_logs', null);
    const { sections } = await transport.pullAll();
    expect(sections.th_logs).toEqual({ data: null, updatedAt: 'T' });
  });

  it('simulates an offline server: every call resolves ok:false', async () => {
    const transport = createMemoryTransportAdapter({ online: false });
    await expect(transport.pullAll()).resolves.toEqual({ ok: false, sections: {} });
    await expect(transport.push('th_a', {})).resolves.toEqual({ ok: false, status: null });
    await expect(transport.pushAll({})).resolves.toEqual({ ok: false, status: null });
  });

  it('does not record pushes while offline', async () => {
    const transport = createMemoryTransportAdapter({ online: false, clock: () => 'T' });
    await transport.push('th_a', { n: 1 });
    transport.setOnline(true);
    const { sections } = await transport.pullAll();
    expect(sections).toEqual({});
  });
});
