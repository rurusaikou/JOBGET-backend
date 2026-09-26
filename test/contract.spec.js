// Companion checkout required: ../JDGET_v2.7.0. No real model calls.
import { env } from 'cloudflare:test';
import { beforeAll, it, expect, vi } from 'vitest';
import worker from '../src/index.js';
import schema from '../sql/schema.sql?raw';
import aggregates from '../sql/event-aggregates.sql?raw';
import { postResponses } from '../../JDGET_v2.7.0/src/shared/ai/client.js';
import { AI_MODULES, USAGE_MODULES } from '../../JDGET_v2.7.0/src/shared/backend/config.js';

beforeAll(async () => {
  for (const sql of schema.split(';').map(s => s.trim()).filter(Boolean)) await env.jobget_metrics.prepare(sql).run();
  await env.jobget_metrics.prepare(aggregates).run();
});
it('routes all real extension AI envelopes through Worker and D1', async () => {
  const id = crypto.randomUUID();
  const previousChrome = globalThis.chrome;
  globalThis.chrome = { runtime: { id: 'test', sendMessage: async () => ({ installation_id: id }) } };
  const modules = [];
  const upstream = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    if (String(url).startsWith('http://localhost:8787')) {
      const envelope = JSON.parse(options.body);
      modules.push(envelope.module);
      expect(envelope.request.model).toBeUndefined();
      return worker.fetch(new Request(url, options), env);
    }
    const body = JSON.parse(options.body);
    expect(body.model).toBe(env.AI_MODEL);
    expect(body.input).toEqual([{ role: 'system', content: 'Return JSON' }, { role: 'user', content: 'sample' }]);
    return Response.json({ status: 'completed', output_text: '{"ok":true}' });
  });
  try {
    for (const label of Object.keys(AI_MODULES)) {
      expect(await postResponses({ label, settings: { provider: 'hosted' }, body: {
        messages: [{ role: 'system', content: 'Return JSON' }, { role: 'user', content: 'sample' }], max_tokens: 40, reasoning_effort: 'none'
      }, errorPrefix: 'test' })).toMatchObject({ status: 'completed' });
    }
    expect(modules).toEqual(Object.values(AI_MODULES));
  } finally { upstream.mockRestore(); globalThis.chrome = previousChrome; }
});
it('accepts every extension usage module using the documented event contract', async () => {
  const events = USAGE_MODULES.map(module => ({ installation_id: crypto.randomUUID(), execution_id: crypto.randomUUID(), module, event: 'success', date: new Date().toISOString().slice(0, 10) }));
  const result = await worker.fetch(new Request('http://localhost/api/events', { method: 'POST', body: JSON.stringify({ events }) }), env);
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({ success: true });
});
