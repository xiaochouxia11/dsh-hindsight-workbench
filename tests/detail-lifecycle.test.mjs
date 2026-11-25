import test from 'node:test';
import assert from 'node:assert/strict';
import { mountClient, walk, text } from './harness.mjs';

function fixture(overrides = {}) {
  const mounted = mountClient({
    data: { value: { items: [{ id: 'same', text: 'Target row', _source: { scope: 'global' } }], total: 1 } },
    selected: { id: 'same', kind: 'memory', scope: 'project' },
    detail: { value: { id: 'same', text: 'Project-only body' } },
    ...overrides,
  });
  return () => mounted.render();
}

test('closing loaded detail immediately returns to the empty detail state', () => {
  const render = fixture();
  const initial = render();
  assert.match(text(initial), /Project-only body/);
  const close = walk(initial).find(node => node.props && node.props.title === '关闭');
  assert.ok(close, 'expected a close button');
  close.props.onClick();
  const after = text(render());
  assert.doesNotMatch(after, /Project-only body/);
  assert.match(after, /选择一条记忆/);
});

test('selecting the same ID in another bank hides old text before effects run', () => {
  const render = fixture();
  const first = render();
  const card = walk(first).find(node => node.props && node.props.className === 'card');
  assert.ok(card, 'expected a memory card');
  card.props.onClick();
  const after = text(render());
  assert.doesNotMatch(after, /Project-only body/);
});
