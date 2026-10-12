/* ================= Sign in / sign up / password reset ================= */


import { supa } from '../lib/backend.js';
import { Store } from '../lib/store.js';
import { $, $$, esc } from '../lib/utils.js';
import { ic } from './icons.js';
import { F, I, clearErrs, focusFirstErr, fv, modal, setErr, toast } from './modal.js';

export const authBrand = () => `<div class="brand" style="justify-content:center;padding-bottom:10px"><span class="brand-mark">${ic('book')}</span>Tuition Desk</div>`;
export const MSG = [
  [/invalid login credentials/i, 'Email or password is incorrect.'],
  [/email not confirmed/i, 'Confirm your email first. Check your inbox for the link.'],
  [/already registered|already been registered/i, 'An account with this email already exists. Sign in instead.'],
  [/rate limit|too many/i, 'Too many attempts. Wait a minute and try again.'],
  [/password should be at least|weak password/i, 'Choose a stronger password (at least 8 characters).'],
  [/fetch|network/i, 'Could not reach the server. Check your connection.'],
];
export function authMessage(err) { const m = String(err?.message || err || ''); for (const [re, t] of MSG) if (re.test(m)) return t; return 'Something went wrong. Please try again.'; }

/** view: 'signin' | 'signup' | 'forgot' | 'recover' */
export function authScreen(view = 'signin', note = '') {
  const tabs = view === 'signin' || view === 'signup' ? `<div class="seg" role="group" aria-label="Account" style="width:100%;margin-bottom:16px"><button type="button" data-auth="signin" aria-pressed="${view === 'signin'}" style="flex:1">Sign in</button><button type="button" data-auth="signup" aria-pressed="${view === 'signup'}" style="flex:1">Create account</button></div>` : '';
  const title = { signin: 'Welcome back', signup: 'Create your account', forgot: 'Reset your password', recover: 'Choose a new password' }[view];
  const fields = view === 'recover'
    ? F('password', 'New password', I('password', '', 'type="password" autocomplete="new-password" minlength="8" required'), { req: true, hint: 'At least 8 characters.' })
    : F('email', 'Email', I('email', '', 'type="email" autocomplete="email" required'), { req: true })
      + (view === 'forgot' ? '' : F('password', 'Password', I('password', '', `type="password" autocomplete="${view === 'signup' ? 'new-password' : 'current-password'}" minlength="${view === 'signup' ? 8 : 1}" required`), { req: true, hint: view === 'signup' ? 'At least 8 characters.' : '' }));
  const submit = { signin: 'Sign in', signup: 'Create account', forgot: 'Send reset link', recover: 'Save new password' }[view];
  $('#app').innerHTML = `<div class="gate"><div class="panel" style="width:min(420px,100%);text-align:left">${authBrand()}
    <h1 style="font-size:1.35rem;text-align:center;margin-bottom:16px">${title}</h1>${tabs}
    <form id="auth-form" class="fgrid" novalidate>${fields}
      <div class="${note.startsWith('!') ? 'banner' : 'infobox'}" id="auth-note" role="status" ${note ? '' : 'hidden'}>${esc(note.replace(/^!/, ''))}</div>
      <button class="btn pri" type="submit" style="height:44px">${submit}</button></form>
    <div style="text-align:center;margin-top:14px;font-size:.9rem">${view === 'signin' ? '<button type="button" class="btn ghost sm" data-auth="forgot">Forgot password?</button>' : view === 'forgot' ? '<button type="button" class="btn ghost sm" data-auth="signin">Back to sign in</button>' : ''}</div>
  </div></div>`;
  $$('[data-auth]').forEach(b => b.onclick = () => authScreen(b.dataset.auth));
  const form = $('#auth-form'); const btn = form.querySelector('[type=submit]');
  const say = (t, bad) => { const n = $('#auth-note'); n.hidden = false; n.className = bad ? 'banner' : 'infobox'; n.textContent = t; };
  form.addEventListener('input', e => { if (e.target.getAttribute('aria-invalid') === 'true') setErr(form, e.target.name, ''); });
  form.onsubmit = async e => {
    e.preventDefault(); clearErrs(form); let ok = true;
    const email = form.elements.email ? fv(form, 'email') : ''; const pw = form.elements.password ? form.elements.password.value : '';
    if (form.elements.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ok = setErr(form, 'email', 'Enter a valid email address.') && ok;
    if (form.elements.password && (view === 'signup' || view === 'recover') && pw.length < 8) ok = setErr(form, 'password', 'Use at least 8 characters.') && ok;
    if (form.elements.password && view === 'signin' && !pw) ok = setErr(form, 'password', 'Enter your password.') && ok;
    if (!ok) return focusFirstErr(form);
    btn.disabled = true;
    try {
      const auth = supa().auth; const redirect = location.origin + location.pathname;
      if (view === 'signin') { const { error } = await auth.signInWithPassword({ email, password: pw }); if (error) throw error; }
      else if (view === 'signup') {
        const { data, error } = await auth.signUp({ email, password: pw, options: { emailRedirectTo: redirect } }); if (error) throw error;
        if (!data.session) { authScreen('signin', 'Account created. Check your email and click the confirmation link, then sign in.'); return; }
      } else if (view === 'forgot') { const { error } = await auth.resetPasswordForEmail(email, { redirectTo: redirect }); if (error) throw error; say('If an account exists for this email, a reset link is on its way.'); }
      else if (view === 'recover') { const { error } = await auth.updateUser({ password: pw }); if (error) throw error; toast('Password updated'); location.hash = '#/'; location.reload(); }
    } catch (err) { say(authMessage(err), true); }
    finally { btn.disabled = false; }
  };
}

export async function signOut() {
  if (Store.pending()) await Store.flush();
  await supa().auth.signOut(); location.hash = '#/'; location.reload();
}

export function changePasswordForm() {
  modal({
    title: 'Change password', submit: 'Update password',
    body: `<div class="fgrid">${F('password', 'New password', I('password', '', 'type="password" autocomplete="new-password" minlength="8"'), { hint: 'At least 8 characters.' })}</div>`,
    onSubmit: form => {
      const pw = form.elements.password.value; if (pw.length < 8) { setErr(form, 'password', 'Use at least 8 characters.'); return false; }
      supa().auth.updateUser({ password: pw }).then(({ error }) => error ? toast(authMessage(error), { bad: true }) : toast('Password updated'));
    },
  });
}
