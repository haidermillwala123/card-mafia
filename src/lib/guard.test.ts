// Security checks with synthetic requests: the body-size cap must hold even when the client hides or lies about its length,
// and the post-sign-in redirect rule must refuse anything that could leave the site.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readJson } from './guard.ts';

const json = (body: BodyInit, headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/x', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body, duplex: 'half' } as RequestInit);

test('a normal JSON body is read', async () => {
  const g = await readJson(json('{"a":1}'));
  assert.equal(g.ok, true);
  assert.deepEqual(g.ok && g.body, { a: 1 });
});

test('a body over the limit is refused even with no Content-Length (chunked upload)', async () => {
  const chunk = new TextEncoder().encode('x'.repeat(4096));
  const stream = new ReadableStream({ start(c) { for (let i = 0; i < 10; i++) c.enqueue(chunk); c.close(); } }); // 40 KB in pieces, no length header
  const g = await readJson(json(stream));
  assert.equal(g.ok, false);
  assert.equal(!g.ok && g.res.status, 413);
});

test('a body that lies about its length is still refused, and a declared big one is refused early', async () => {
  const big = '{"a":"' + 'y'.repeat(20000) + '"}';
  const lied = await readJson(json(big, { 'content-length': '10' }));
  assert.equal(lied.ok, false);
  const declared = await readJson(json('{}', { 'content-length': '999999' }));
  assert.equal(!declared.ok && declared.res.status, 413);
});

test('another site, or a form post, is refused', async () => {
  const cross = await readJson(json('{}', { origin: 'https://evil.example', host: 'card-mafia.vercel.app' }));
  assert.equal(!cross.ok && cross.res.status, 403);
  const form = await readJson(new Request('http://localhost/api/x', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' }));
  assert.equal(!form.ok && form.res.status, 415);
});

// the same rule as nextPath in src/app/start/next.ts (that file reads window, so the rule is repeated here)
const safe = (next: string | null) => (next && /^\/[^/\\]/.test(next) && !/[\u0000-\u001f\u007f\\]/.test(next) ? next : '/home');
test('the redirect after sign-in stays on this site', () => {
  assert.equal(safe('/trips'), '/trips');
  assert.equal(safe('/flights?o=BOM&d=DXB'), '/flights?o=BOM&d=DXB');
  for (const bad of ['//evil.example', '/\\evil.example', '/\t/evil.example', '/\n/evil.example', '/\r/evil.example', 'https://evil.example', 'javascript:alert(1)', '', null]) {
    assert.equal(safe(bad), '/home', `should refuse ${JSON.stringify(bad)}`);
  }
});
