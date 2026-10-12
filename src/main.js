/* ================= Boot ================= */
import './styles.css';
import './ui/events.js';
import { mode, supa } from './lib/backend.js';
import { migrateLinkedTimes } from './lib/domain.js';

import { Store } from './lib/store.js';
import { $ } from './lib/utils.js';
import { authScreen } from './ui/auth.js';
import { ic } from './ui/icons.js';
import { toast } from './ui/modal.js';
import { render, scheduleRender } from './ui/shell.js';


let saveErrShown = 0;
function saveFailed(code) {
  const msg = code === 'quota_exceeded' ? 'Storage is full. Export a backup and remove old sample data, then try again.'
    : code === 'unauthenticated' ? 'Your session expired. Sign in again; unsaved changes may be lost.'
      : code === 'invalid_argument' ? 'That change could not be saved (it was rejected). Please try again.'
        : 'A change could not be saved. Check your connection; keep this page open and try again.';
  if (Date.now() - saveErrShown > 4000) { toast(msg, { bad: true, ms: 7000 }); saveErrShown = Date.now(); }
}
Store.onSaveError = saveFailed;
Store.onRemoteChange = () => scheduleRender();

function loadingView() {
  return `<div class="shell"><aside class="side"><div class="brand"><span class="brand-mark">${ic('book')}</span>Tuition Desk</div></aside><main class="main" aria-busy="true"><div class="skel" style="height:44px;width:300px;margin-bottom:24px"></div><div class="skel" style="height:96px;margin-bottom:20px"></div><div class="grid-dash"><div class="skel" style="height:360px"></div><div class="skel" style="height:360px"></div></div><span class="sr">Loading your tuition data</span></main></div>`;
}
function message(title, text) {
  $('#app').innerHTML = `<div class="gate"><div class="panel"><div class="brand" style="justify-content:center"><span class="brand-mark">${ic('book')}</span>Tuition Desk</div><h1 style="font-size:1.4rem;margin-bottom:8px">${title}</h1><p class="muted">${text}</p></div></div>`;
}

let started = false;
async function start(user) {
  if (started) return; started = true;
  $('#app').innerHTML = loadingView();
  try { await Store.init(user); try { migrateLinkedTimes(); } catch (e) { console.error(e); } }
  catch (e) {
    started = false; console.error(e);
    message('Could not load your data', 'Check your internet connection and reload the page. If this keeps happening, check the Supabase setup in the README.');
    return;
  }
  render();
}

// Refresh from the server when the app comes back to the foreground after a while (phones pause realtime connections).
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !Store.backend || Date.now() - Store.loadedAt < 60000) return;
  try { await Store.reload(); scheduleRender(); } catch { /* keep current data; next save retries */ }
});
window.addEventListener('beforeunload', e => { if (Store.pending()) { e.preventDefault(); e.returnValue = ''; } });

(async function boot() {
  if (mode === 'unconfigured') return message('Setup needed', 'This build has no Supabase settings. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see README) and build again.');
  if (mode === 'local') return start({ id: 'local', email: '' });
  $('#app').innerHTML = loadingView();
  const auth = supa().auth;
  auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { started = true; return authScreen('recover'); }
    if (event === 'SIGNED_IN' && session?.user && !started) start(session.user);
    if (event === 'SIGNED_OUT') { Store.stop(); started = false; authScreen('signin'); }
  });
  const { data: { session } } = await auth.getSession();
  if (session?.user) start(session.user); else if (!started) authScreen('signin');
})();

// Development only: expose every module's exports so the browser console and end-to-end tests can inspect state.
if (import.meta.env.DEV) {
  const mods = import.meta.glob(['./lib/*.js', './ui/**/*.js']);
  Promise.all(Object.values(mods).map(load => load())).then(list => Object.assign(window, ...list, { Store }));
}
