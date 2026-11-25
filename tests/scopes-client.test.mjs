import test from 'node:test';
import assert from 'node:assert/strict';
import { mountClient, text } from './harness.mjs';

const ready = {
  endpoint: 'http://127.0.0.1:9077',
  health: { ok: true, status: 'healthy' },
  banks: [
    { source: { scope: 'project', label: '已绑定项目库', bank: 'project::one' }, ok: true, data: { total_nodes: 12 } },
    { source: { scope: 'global', label: '全局库', bank: 'global' }, ok: false, error: '未创建' },
  ],
  upstream: { available: true, installed: true, version: '0.8.8', entries: [{ enabled: true, phase: 'active' }] },
};

test('setup view renders bound banks and states read-only boundaries', () => {
  const rendered = text(mountClient({ tab: 'setup', diagnostics: { value: ready } }).render());
  assert.match(rendered, /安装与连接检查/);
  assert.match(rendered, /已绑定项目库/);
  assert.match(rendered, /已存在 · 12 条事实/);
  assert.match(rendered, /项目库是显式绑定的配置/);
  assert.match(rendered, /自动采集仍由已安装的 Hindsight 集成负责/);
  assert.match(rendered, /只读/);
});
