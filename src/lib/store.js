/* ================= Storage ================= */

import { KINDS, makeBackend } from './backend.js';
import { DEFAULT_PROFILE, S } from './state.js';
import { clone } from './utils.js';
/** Keeps the in-memory state (S) and the backend in sync. Local state is the source of truth while a write is pending. */
export const Store = {
  backend: null, user: null, unsub: null, w: {}, loadedAt: 0,
  async init(user) {
    this.user = user; this.backend = makeBackend(user);
    await this.reload();
    this.unsub = this.backend.subscribe(r => this.apply(r, true));
  },
  async reload() {
    const rows = await this.backend.loadAll();
    const next = { profile: { ...DEFAULT_PROFILE }, students: {}, uni: {}, months: {} };
    for (const r of rows) {
      if (!KINDS.includes(r.kind) || r.data == null) continue;
      if (this.w[r.kind + '/' + r.id]?.busy) continue;
      if (r.kind === 'app') next.profile = { ...DEFAULT_PROFILE, ...r.data };
      else next[r.kind][r.id] = r.data;
    }
    // keep records that are still being written
    for (const k in this.w) { const s = this.w[k]; if (s.busy && s.kind !== 'app') { const v = S[s.kind][s.id]; if (v == null) delete next[s.kind][s.id]; else next[s.kind][s.id] = v; } }
    if (this.w['app/app']?.busy) next.profile = S.profile;
    Object.assign(S, next); S.v++; this.loadedAt = Date.now();
  },
  apply({ kind, id, data }, live) {
    if (!KINDS.includes(kind) || this.w[kind + '/' + id]?.busy) return;
    if (kind === 'app') S.profile = { ...DEFAULT_PROFILE, ...(data || {}) };
    else if (data == null) delete S[kind][id];
    else S[kind][id] = data;
    S.v++;
    if (live && this.onRemoteChange) this.onRemoteChange();
  },
  local(kind, id) { if (kind === 'app') return S.profile; const v = S[kind][id]; return v == null ? null : v; },
  /** Persist the current local value of one document (or delete it if it no longer exists locally). */
  save(kind, id = 'app') {
    S.v++;
    if (!this.backend) return Promise.resolve();
    const p = kind + '/' + id;
    const st = this.w[p] || (this.w[p] = { busy: false, again: false, kind, id });
    if (st.busy) { st.again = true; return st.p; }
    st.busy = true;
    st.p = (async () => {
      do {
        st.again = false;
        const data = this.local(kind, id);
        for (let attempt = 0; attempt < 3; attempt++) {
          try { if (data == null) await this.backend.del(kind, id); else await this.backend.put(kind, id, clone(data)); break; }
          catch (e) {
            if (e?.code === 'unavailable' && attempt < 2) { await sleep(700 * (attempt + 1) + Math.random() * 600); continue; }
            this.onSaveError && this.onSaveError(e?.code); break;
          }
        }
      } while (st.again);
      st.busy = false;
    })();
    return st.p;
  },
  async flush() { await Promise.all(Object.values(this.w).map(s => s.p).filter(Boolean)); },
  pending() { return Object.values(this.w).some(s => s.busy); },
  stop() { this.unsub && this.unsub(); this.unsub = null; this.backend = null; },
};
export const sleep = ms => new Promise(r => setTimeout(r, ms));
