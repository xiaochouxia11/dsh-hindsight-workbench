import { isProjectRoute } from './project-routing.mjs';

const fail = (code, message) => Object.assign(new Error(message), { code });
const invalid = () => fail('INVALID_INPUT', 'Invalid memory operation parameters');
const validText = (value, max) => typeof value === 'string' && value.length <= max && !!value.trim();
const count = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;

function workbenchInput(input) {
  switch (input?.operation) {
    case 'stats': case 'pages': case 'graph': return { operation: input.operation };
    case 'memory': case 'page': {
      const { operation, id } = input;
      if (!validText(id, 256) || ['.', '..'].includes(id) || /[\x00-\x1f\x7f/\\]/.test(id)) throw invalid();
      return { operation, id };
    }
    case 'list': {
      const { query = '', offset = 0, limit = 30 } = input;
      if (typeof query !== 'string' || query.length > 500 || !count(offset, 0, 1_000_000) || !count(limit, 1, 50)) throw invalid();
      return { operation: 'list', query, offset, limit };
    }
    default: throw invalid();
  }
}

function bounded(call, timeoutMs, write = false) {
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(fail(write ? 'RETAIN_OUTCOME_UNKNOWN' : 'BACKEND_TIMEOUT', 'Memory request timed out'));
      controller.abort();
    }, timeoutMs);
  });
  // Still bound the caller's wait if the injected capability ignores cancellation.
  let result;
  try { result = Promise.resolve(call(controller.signal)); }
  catch (error) { result = Promise.reject(error); }
  return Promise.race([
    result.catch(() => { throw fail(write ? 'RETAIN_OUTCOME_UNKNOWN' : 'BACKEND_UNAVAILABLE', 'Memory request did not complete'); }),
    deadline,
  ]).finally(() => clearTimeout(timer));
}

async function recallSource(source, call, limit, timeoutMs) {
  try {
    const result = await bounded(call, timeoutMs);
    if (!Array.isArray(result?.items)) throw new Error('Invalid recall response');
    const items = result.items.slice(0, limit).map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid recall record');
      return { ...item, source };
    });
    return { source, ok: true, items };
  } catch (error) {
    return { source, ok: false, code: error?.code === 'BACKEND_TIMEOUT' ? 'BACKEND_TIMEOUT' : 'BACKEND_UNAVAILABLE' };
  }
}

/**
 * Unwired prototype. Host-owned ports must encapsulate endpoint selection, safe URL
 * encoding, and response size. The global port is a fixed-bank semantic read, not a
 * general client; neither a global writer nor a mutable routing selector is exposed.
 * A future collector may call only retain on this same per-session adapter.
 */
export function createIsolatedMemoryAdapter({ route, project, recallGlobal, timeoutMs = 1000 } = {}) {
  if (!isProjectRoute(route) || !project || typeof recallGlobal !== 'function' || !count(timeoutMs, 1, 12_000)) {
    throw new TypeError('Trusted project route and scoped memory ports are required');
  }
  const { read, recall, retain } = project;
  if ([read, recall, retain].some(port => typeof port !== 'function')) throw new TypeError('Incomplete project memory ports');

  async function routed(operation) {
    return route.withCurrent(async ({ bankId }) => {
      try { return await operation(bankId); }
      finally { await route.assertCurrent(); }
    });
  }

  return Object.freeze({
    async readWorkbench(input) {
      const args = workbenchInput(input);
      return routed(bankId => bounded(signal => read({ ...args, bankId, signal }), timeoutMs));
    },
    async recall(input) {
      const { query, limit = 8 } = input ?? {};
      if (!validText(query, 4000) || !count(limit, 1, 25)) throw invalid();
      return routed(async bankId => {
        const sources = await Promise.all([
          recallSource('project', signal => recall({ bankId, query, limit, signal }), limit, timeoutMs),
          recallSource('global', signal => recallGlobal({ query, limit, signal }), limit, timeoutMs),
        ]);
        // Deterministic source ordering, no cross-bank deduplication or score fusion.
        return {
          items: sources.flatMap(result => result.items ?? []),
          sources: sources.map(({ items: _, ...status }) => status),
          partial: sources.some(result => !result.ok),
        };
      });
    },
    async retain(input) {
      const { content } = input ?? {};
      if (!validText(content, 65_536)) throw invalid();
      return route.withCurrent(async ({ bankId }) => {
        // A request already dispatched to the original bank cannot be undone. Preserve
        // whether the backend acknowledged it, but don't return the old bank's response
        // if the host changed identity. An unknown outcome must not be retried here.
        let response;
        let unknown;
        try { response = await bounded(signal => retain({ bankId, content, signal }), timeoutMs, true); }
        catch (error) { unknown = Object.assign(error, { retainOutcome: 'unknown' }); }
        try { await route.assertCurrent(); }
        catch {
          if (unknown) throw Object.assign(unknown, { projectChanged: true });
          throw Object.assign(fail('PROJECT_CHANGED_AFTER_RETAIN', 'Project changed after retain was acknowledged'), {
            projectChanged: true, retainOutcome: 'acknowledged',
          });
        }
        if (unknown) throw unknown;
        return response;
      });
    },
  });
}
