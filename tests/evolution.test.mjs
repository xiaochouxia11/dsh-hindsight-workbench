import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createEvolutionHandler, EVOLUTION_ROUTE } from '../dist/index.js';

test('draft survives remount, rejects conflicting writes and can be cleared', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'hbm-evolution-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'storage', 'draft.json');
  const url = 'http://desktop.test' + EVOLUTION_ROUTE;
  const headers = { 'content-type': 'application/json', 'x-hindsight-workbench': '1' };
  const post = (revision, draft, override = {}) => new Request(url, {
    method: 'POST', headers: { ...headers, ...override }, body: JSON.stringify({ revision, draft }),
  });
  const draft = {
    evidence: { id: 'test-memory', scopeLabel: '项目库', text: '中文依据' },
    name: 'test-skill', description: '简介', body: '# 正文', includeEvidence: true,
  };
  const handler = createEvolutionHandler(file);
  assert.deepEqual((await (await handler(new Request(url))).json()).data, { revision: null, draft: null });
  assert.equal((await handler(post(null, draft, { origin: 'https://other.example' }))).status, 403);
  assert.equal((await handler(post(null, draft, { 'sec-fetch-site': 'cross-site' }))).status, 403);
  assert.equal((await handler(post(null, { ...draft, body: 123 }))).status, 400);
  const sameOrigin = { origin: 'http://browser.test', 'sec-fetch-site': 'same-origin' };
  const results = await Promise.all([handler(post(null, draft, sameOrigin)), handler(post(null, draft, sameOrigin))]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
  const reopened = createEvolutionHandler(file);
  const current = (await (await reopened(new Request(url))).json()).data;
  assert.deepEqual(current.draft, draft);
  assert.equal((await reopened(post(current.revision, null))).status, 200);
  assert.equal((await (await reopened(new Request(url))).json()).data.draft, null);
});
