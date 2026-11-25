import { createHash } from 'node:crypto';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';

const routes = new WeakSet();
const windows = process.platform === 'win32';
const fail = (code, message) => Object.assign(new Error(message), { code });

function rootIsAbsolute(value) {
  if (typeof value !== 'string' || value.includes('\0')) return false;
  // A Windows path such as \repo or C:repo can depend on the process cwd.
  return windows
    ? /^[A-Z]:[\\/]/i.test(value) || /^[\\/]{2}(?![?.][\\/])[^\\/]+[\\/][^\\/]+(?:[\\/]|$)/u.test(value)
    : path.isAbsolute(value);
}

function snapshot(getProjectIdentity) {
  const value = getProjectIdentity();
  const projectRoot = value?.projectRoot;
  const generation = value?.generation;
  if (!rootIsAbsolute(projectRoot) || !Number.isSafeInteger(generation) || generation < 0) throw new Error('Missing host identity');
  return { projectRoot, generation };
}

async function identify(getProjectIdentity) {
  const { projectRoot, generation } = snapshot(getProjectIdentity);
  const canonicalPath = await realpath(projectRoot);
  if (!rootIsAbsolute(canonicalPath)) throw new Error('Unsupported canonical path');
  const identityPath = windows ? canonicalPath.replace(/^[a-z]:/i, drive => drive.toUpperCase()) : canonicalPath;
  if (identityPath === path.parse(identityPath).root) throw new Error('Filesystem roots are not projects');
  const info = await stat(canonicalPath, { bigint: true });
  if (!info.isDirectory() || info.ino === 0n) throw new Error('No stable directory identity');
  const after = snapshot(getProjectIdentity);
  if (after.generation !== generation || after.projectRoot !== projectRoot) throw new Error('Host identity changed while resolving path');
  return { projectRoot, canonicalPath, identityPath, generation, device: info.dev, inode: info.ino };
}

/**
 * Prototype host seam: call once when an eligible session starts, never from browser
 * input. Provide a synchronous, host-owned snapshot of its approved project root (or
 * null). Its generation must advance whenever project/lifecycle eligibility changes,
 * even if the same root is subsequently restored. Host owns session lifetime/auth.
 * The bank ID is path-based across sessions: renaming a project changes its bank;
 * a new session on a replacement at the same canonical path uses the same bank.
 * Device/inode are session guards, not persistence or migration identifiers.
 */
export async function createProjectRoute({ getProjectIdentity } = {}) {
  if (typeof getProjectIdentity !== 'function') throw fail('PROJECT_UNAVAILABLE', 'Trusted project identity is required');
  let initial;
  try { initial = await identify(getProjectIdentity); }
  catch { throw fail('PROJECT_UNAVAILABLE', 'No eligible project could be verified'); }
  // Let native realpath canonicalize aliases/case. Never lowercase all components: a
  // Windows directory can be case-sensitive. Only the drive designator is folded.
  const digest = createHash('sha256').update(`dsh-project-v1\0${initial.identityPath}`).digest('hex');
  const info = Object.freeze({ bankId: `dsh-project-v1-${digest}`, canonicalPath: initial.canonicalPath });
  let invalid = false;
  function invalidate() {
    invalid = true;
    throw fail('PROJECT_CHANGED', 'Project identity changed or could no longer be verified; start a new session');
  }
  async function checked(run) {
    if (invalid) return invalidate();
    try {
      const current = await identify(getProjectIdentity);
      if (invalid || current.generation !== initial.generation || current.identityPath !== initial.identityPath
          || current.device !== initial.device || current.inode !== initial.inode) return invalidate();
      const latest = snapshot(getProjectIdentity);
      if (latest.generation !== current.generation || latest.projectRoot !== current.projectRoot) return invalidate();
    } catch { return invalidate(); }
    // Dispatch synchronously with the final host snapshot check, with no extra await
    // gap. The trusted port must bind its dispatch to this immutable bank identity.
    return run(info);
  }
  const route = Object.freeze({ assertCurrent: () => checked(value => value), withCurrent: checked });
  routes.add(route);
  return route;
}

export const isProjectRoute = value => routes.has(value);
