import test from 'node:test';
import assert from 'node:assert/strict';
import { mountClient, text } from './harness.mjs';

const ready = {
  endpoint: 'http://127.0.0.1:9077',
  health: { ok: true, status: 'healthy' },
  banks: [
    { source: { scope: 'project', label: '已绑定项目库', bank: 'test' }, ok: true, data: { total_nodes: 0 } },
    { source: { scope: 'global', label: '全局库', bank: 'global' }, ok: false, error: '未创建' },
  ],
  upstream: { available: true, installed: true, version: '0.8.8', entries: [{ enabled: true, phase: 'active' }] },
};

const setup = diagnostics => text(mountClient({ tab: 'setup', diagnostics }).render());

test('first-run guide stays visible even when diagnostics fail', () => {
  const rendered = setup({ error: '无法读取诊断' });
  assert.match(rendered, /安装与连接检查/);
  assert.match(rendered, /无法读取诊断/);
  assert.match(rendered, /显式绑定/);
  assert.match(rendered, /本机授权/);
});

test('healthy backend never implies model auth or dual-scope acceptance', () => {
  const rendered = setup({ value: ready });
  assert.match(rendered, /健康（healthy）/);
  assert.match(rendered, /已安装：是/);
  assert.match(rendered, /版本：0\.8\.8/);
  assert.match(rendered, /已存在 · 0 条事实/);
  assert.match(rendered, /未创建/);
});

test('unknown service and duplicate collection both receive actionable status', () => {
  const rendered = setup({ value: { ...ready, health: { ok: true, status: 'unknown' }, upstream: { ...ready.upstream, duplicate: true, entries: [{}, {}] } } });
  assert.match(rendered, /健康（unknown）/);
  assert.match(rendered, /多个上游挂载/);
});
