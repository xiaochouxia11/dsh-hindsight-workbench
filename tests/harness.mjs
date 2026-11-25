import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/client.js', import.meta.url), 'utf8');

// Mounts the client plugin with a deterministic React stub.
// State order must match the component: scope, tab, q, query, offset, revision,
// overview, data, selected, detail, graph, graphBusy, diagnostics, copied.
export function mountClient(overrides = {}, options = {}) {
  const base = {
    scope: 'project', tab: 'facts', q: '', query: '', offset: 0, revision: 0,
    overview: { loading: true }, data: { loading: true }, selected: null, detail: {},
    graph: null, graphBusy: false, diagnostics: { loading: true }, copied: false,
    banks: [], bank: '', skills: { loading: false },
    ...overrides,
  };
  const order = ['scope', 'tab', 'q', 'query', 'offset', 'revision', 'overview', 'data', 'selected', 'detail', 'graph', 'graphBusy', 'diagnostics', 'copied', 'banks', 'bank', 'skills'];
  const values = order.map(key => base[key]);
  let cursor = 0, plugin, Page;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState() {
      const index = cursor++;
      const set = value => { values[index] = typeof value === 'function' ? value(values[index]) : value; };
      return [values[index], set];
    },
    useEffect() {},
    useRef: value => ({ current: value }),
  };
  const dictionaries = new Map();
  const ctx = {
    effect(fn) { fn(); },
    locale: {
      register(namespace, dicts) { dictionaries.set(namespace, (dicts && dicts.zh) || {}); return () => {}; },
      bind(namespace) { const dictionary = dictionaries.get(namespace) || {}; return key => (dictionary[key] !== undefined ? dictionary[key] : key); },
    },
    layout: { panelInfo: { getSnapshot: () => ({ activePanelId: 'other' }) }, selectPanel() {} },
    slots: { inject(name, fn) { fn(); }, register(options, component) { if (options.name === 'main') Page = component; return () => {}; } },
  };
  vm.runInNewContext(source, {
    window: { __ModuleLoader__: { load(definition) { plugin = definition.factory(() => React); } }, addEventListener() {}, removeEventListener() {} },
    URLSearchParams,
    fetch: options.fetch || (() => { throw new Error('unexpected fetch'); }),
    setTimeout,
    navigator: {},
  });
  plugin.apply(ctx);
  const render = () => { cursor = 0; return Page(); };
  return { render, values };
}

export const walk = node => Array.isArray(node)
  ? node.flatMap(walk)
  : node && typeof node === 'object' ? [node, ...walk(node.children || [])] : [];

export const text = node => walk(node).flatMap(item => item.children.filter(child => typeof child === 'string')).join(' ');
