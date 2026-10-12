/**
 * Data backends. Every record is a JSON document addressed by (kind, id):
 *   app/app        – profile & preferences
 *   students/<id>  – one per student
 *   uni/<id>       – one per university class
 *   months/<YYYY-MM> – classes, teaching-time records, payments and fee overrides for that month
 *
 * Production uses Supabase (Postgres + row-level security + realtime).
 * `npm run dev` without Supabase variables uses a local, browser-only backend for trying the UI.
 */
import { createClient } from '@supabase/supabase-js';

export const env = import.meta.env || {};
export const config = { url: env.VITE_SUPABASE_URL || '', key: env.VITE_SUPABASE_ANON_KEY || '' };
export const mode = config.url && config.key ? 'supabase' : env.DEV ? 'local' : 'unconfigured';

export let client = null;
export function supa() {
  if (!client) client = createClient(config.url, config.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } });
  return client;
}

export const KINDS = ['app', 'students', 'uni', 'months'];
export const TABLE = 'documents';

/** Normalise any failure into { code } so the store can decide whether to retry. */
export function fail(error) {
  const msg = String(error?.message || error || '');
  if (/fetch|network|timeout|Load failed/i.test(msg) || !error?.code) return { code: 'unavailable', message: msg };
  if (error.code === '42501' || error.code === '23514' || error.code === '22P02') return { code: 'invalid_argument', message: msg };
  if (error.code === '53100' || error.code === '54000') return { code: 'quota_exceeded', message: msg };
  if (error.code === 'PGRST301' || /JWT/i.test(msg)) return { code: 'unauthenticated', message: msg };
  return { code: 'unavailable', message: msg };
}

export function supabaseBackend(user) {
  const db = supa();
  return {
    async loadAll() {
      const rows = []; const page = 1000;
      for (let from = 0; ; from += page) {
        const { data, error } = await db.from(TABLE).select('kind,id,data').order('kind').order('id').range(from, from + page - 1);
        if (error) throw fail(error);
        rows.push(...data);
        if (data.length < page) break;
      }
      return rows;
    },
    subscribe(onChange) {
      const ch = db.channel('documents-' + user.id)
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: `user_id=eq.${user.id}` }, p => {
          if (p.eventType === 'DELETE') { if (p.old?.user_id && p.old.user_id !== user.id) return; onChange({ kind: p.old.kind, id: p.old.id, data: null }); }
          else onChange({ kind: p.new.kind, id: p.new.id, data: p.new.data });
        })
        .subscribe();
      return () => db.removeChannel(ch);
    },
    async put(kind, id, data) {
      const { error } = await db.from(TABLE).upsert({ user_id: user.id, kind, id, data }, { onConflict: 'user_id,kind,id' });
      if (error) throw fail(error);
    },
    async del(kind, id) {
      const { error } = await db.from(TABLE).delete().match({ user_id: user.id, kind, id });
      if (error) throw fail(error);
    },
  };
}

/** Development-only backend: keeps data in this browser so the UI can be tried without Supabase. */
export function localBackend() {
  const KEY = 'tuition-desk-local-v1';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
  const write = o => localStorage.setItem(KEY, JSON.stringify(o));
  return {
    async loadAll() { return Object.entries(read()).map(([k, data]) => { const [kind, ...rest] = k.split('/'); return { kind, id: rest.join('/'), data }; }); },
    subscribe(onChange) {
      const h = e => { if (e.key !== KEY) return; const o = JSON.parse(e.newValue || '{}'), old = JSON.parse(e.oldValue || '{}'); for (const k of new Set([...Object.keys(o), ...Object.keys(old)])) if (JSON.stringify(o[k]) !== JSON.stringify(old[k])) { const [kind, ...rest] = k.split('/'); onChange({ kind, id: rest.join('/'), data: o[k] ?? null }); } };
      addEventListener('storage', h); return () => removeEventListener('storage', h);
    },
    async put(kind, id, data) { const o = read(); o[kind + '/' + id] = data; write(o); },
    async del(kind, id) { const o = read(); delete o[kind + '/' + id]; write(o); },
  };
}

export function makeBackend(user) {
  if (mode === 'supabase') return supabaseBackend(user);
  // The browser-only backend exists for `npm run dev` only; production builds drop it entirely.
  if (import.meta.env.DEV) return localBackend();
  throw new Error('Supabase is not configured for this build.');
}
