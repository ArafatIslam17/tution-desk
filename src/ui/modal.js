/* ================= Toast & dialog ================= */
import { $, $$, esc } from '../lib/utils.js';
import { ic } from './icons.js';
export function toast(msg, { bad = false, ms = 3200, undo = null, action = null } = {}) {
  const el = document.createElement('div'); el.className = 'toast' + (bad ? ' bad' : ''); el.setAttribute('role', bad ? 'alert' : 'status');
  const act = undo ? { label: 'Undo', fn: undo } : action;
  el.innerHTML = `<span>${esc(msg)}</span>${act ? `<button type="button">${esc(act.label)}</button>` : ''}`;
  if (act) { el.querySelector('button').onclick = () => { act.fn(); el.remove(); }; ms = Math.max(ms, 5000); }
  $('#toasts').appendChild(el); setTimeout(() => el.remove(), ms);
}
export const dlg = () => $('#dlg');
export let dlgCleanup = null;
export function closeModal() { const d = dlg(); if (d.open) d.close(); }
/** Opens a modal. body: HTML. onSubmit(form) -> true/undefined closes, false keeps open. */
export function modal({ title, body, submit = 'Save', cls = 'pri', onSubmit, footLeft = '', wide = false, noFooter = false, onOpen }) {
  const d = dlg(); if (d.open) d.close();
  d.className = wide ? 'wide' : '';
  d.innerHTML = `<form class="dlg" method="dialog" novalidate><div class="dlg-h"><h2 id="dlg-title">${title}</h2><button type="button" class="btn icon ghost" data-close aria-label="Close">${ic('x')}</button></div>
    <div class="dlg-b">${body}</div>${noFooter ? '' : `<div class="dlg-f">${footLeft ? `<div class="left">${footLeft}</div>` : ''}<button type="button" class="btn" data-close>Cancel</button>${onSubmit ? `<button type="submit" class="btn ${cls}">${submit}</button>` : ''}</div>`}</form>`;
  const form = d.querySelector('form');
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!onSubmit) return closeModal();
    let r; try { r = onSubmit(form, e.submitter); } catch (err) { console.error(err); toast('Something went wrong. Please try again.', { bad: true }); return; }
    if (r !== false) closeModal();
  });
  form.addEventListener('input', e => { const n = e.target.name; if (n && e.target.getAttribute('aria-invalid') === 'true') setErr(form, n, ''); });
  $$('[data-close]', d).forEach(b => b.onclick = closeModal);
  d.onclick = e => { if (e.target === d) closeModal(); };
  d.showModal();
  const first = form.querySelector('.dlg-b input:not([type=hidden]):not([type=checkbox]),.dlg-b select,.dlg-b textarea');
  if (first && innerWidth > 700) first.focus(); else form.querySelector('[data-close]').focus();
  onOpen && onOpen(form);
  return form;
}
export function confirmBox({ title, text, ok = 'Continue', bad = true, onOk }) {
  modal({ title, body: `<p style="margin:0">${text}</p>`, submit: ok, cls: bad ? 'bad' : 'pri', onSubmit: () => { onOk(); } });
}
export function fv(form, name) { const el = form.elements[name]; return el ? (el.value ?? '').trim() : ''; }
export function setErr(form, name, msg) {
  const el = form.elements[name]; const box = form.querySelector(`[data-err="${name}"]`);
  if (el && el.setAttribute) el.setAttribute('aria-invalid', msg ? 'true' : 'false');
  if (box) box.textContent = msg || '';
  return !msg;
}
export function clearErrs(form) { $$('[data-err]', form).forEach(b => b.textContent = ''); $$('[aria-invalid]', form).forEach(e => e.setAttribute('aria-invalid', 'false')); }
export function focusFirstErr(form) { const el = form.querySelector('[aria-invalid="true"]'); el && el.focus(); }
export const F = (name, label, input, { req = false, hint = '' } = {}) => `<div class="field"><label for="f-${name}">${label}${req ? '<span class="req" aria-hidden="true">*</span>' : ''}</label>${input}${hint ? `<span class="hint">${hint}</span>` : ''}<span class="err" data-err="${name}" id="e-${name}"></span></div>`;
export const I = (name, val = '', attrs = '') => `<input id="f-${name}" name="${name}" class="input" value="${esc(val)}" aria-describedby="e-${name}" ${attrs}>`;

