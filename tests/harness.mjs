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
    banks: [], bank: '', skills: { loading: false }, evolution: null,
    ...overrides,
  };
  const order = ['scope', 'tab', 'q', 'query', 'offset', 'revision', 'overview', 'data', 'selected', 'detail', 'graph', 'graphBusy', 'diagnostics', 'copied', 'banks', 'bank', 'skills', 'evolution'];
  const values = order.map(key => base[key]);
  let cursor = 0, plugin, Page;
  let mountedChild;
  const effects = [];
  const childState = [];
  const childRefs = [];
  let refCursor = 0;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initial) {
      const index = cursor++;
      const state = mountedChild ? childState : values;
      if (mountedChild && !(index in state)) state[index] = initial;
      const set = value => { state[index] = typeof value === 'function' ? value(state[index]) : value; };
      return [state[index], set];
    },
    useEffect(callback) { if (mountedChild && effects.length === 0) effects.push(callback); },
    useRef(value) { return mountedChild ? (childRefs[refCursor++] ??= { current: value }) : { current: value }; },
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
    URLSearchParams, AbortController, AbortSignal, crypto, TextDecoder,
    fetch: options.fetch || (() => { throw new Error('unexpected fetch'); }),
    setTimeout,
    navigator: {},
  });
  plugin.apply(ctx);
  const render = () => { cursor = 0; return Page(); };
  const mountChild = component => {
    const rerender = () => {
      cursor = 0; refCursor = 0;
      mountedChild = true;
      try { return component.type(component.props); }
      finally { mountedChild = false; }
    };
    return { rerender, effects };
  };
  return { render, values, mountChild };
}

export const walk = node => Array.isArray(node)
  ? node.flatMap(walk)
  : node && typeof node === 'object' ? [node, ...walk(node.children || [])] : [];

export const text = node => walk(node).flatMap(item => item.children.filter(child => typeof child === 'string')).join(' ');
