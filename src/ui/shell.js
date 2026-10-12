/* ================= Router & shell ================= */
import { mode } from '../lib/backend.js';
import { D, PAYLABEL, avatar, classState, isReminderRead, reminders, stuList } from '../lib/domain.js';
import { S, ui } from '../lib/state.js';
import { Store } from '../lib/store.js';
import { $, $$, esc, fmtDate, fmtDur, fmtMonth, fmtT, relDay } from '../lib/utils.js';
import { ic } from './icons.js';
import { vCal } from './pages/calendar.js';
import { vClasses } from './pages/classes.js';
import { vDash } from './pages/dashboard.js';
import { vPayments } from './pages/payments.js';
import { vSettings } from './pages/settings.js';
import { vStudent, vStudents } from './pages/students.js';
import { vTime } from './pages/time.js';
import { vUni } from './pages/university.js';
export const NAV = [
  ['', 'home', 'Home', 'tui'], ['calendar', 'cal', 'Calendar', 'tui'], ['classes', 'book', 'Tuition classes', 'tui'], ['students', 'users', 'Students', 'stu'],
  ['time', 'clock', 'Teaching time', 'tui'], ['payments', 'wallet', 'Payments', 'pay'], null, ['university', 'uni', 'University', 'uni'], ['settings', 'gear', 'Settings & backup', 'tui'],
];
export function route() { const h = (location.hash || '#/').slice(2).split('/'); return { page: h[0] || '', arg: decodeURIComponent(h[1] || '') }; }
export let rq = 0;
export function scheduleRender() { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; render(); }); }

export function shell(content) {
  const r = route(); const pg = r.page === 'student' ? 'students' : r.page;
  const nav = NAV.map(n => n ? `<a href="#/${n[0]}" data-sec="${n[3]}" ${pg === n[0] ? 'aria-current="page"' : ''}>${ic(n[1])}${n[2]}</a>` : '<hr>').join('');
  const bn = [['', 'home', 'Home'], ['calendar', 'cal', 'Calendar'], ['students', 'users', 'Students'], ['payments', 'wallet', 'Payments']];
  const moreActive = ['classes', 'time', 'university', 'settings'].includes(pg);
  return `<div class="shell">
  <aside class="side" aria-label="Main navigation">
    <div class="brand"><span class="brand-mark">${ic('book')}</span>Tuition Desk</div>
    <nav class="nav">${nav}</nav>
    <div class="side-foot">${mode === 'local' ? 'Local preview mode' : esc(Store.user?.email || '')}${mode === 'local' ? '' : '<br><button type="button" class="btn sm ghost" data-act="sign-out" style="margin:6px 0 0 -10px">Sign out</button>'}</div>
  </aside>
  <main class="main" id="main" tabindex="-1">${content}</main>
  <nav class="bnav" aria-label="Main navigation">${bn.map(b => `<a href="#/${b[0]}" ${pg === b[0] ? 'aria-current="page"' : ''}>${ic(b[1])}${b[2]}</a>`).join('')}
    <button type="button" data-act="more-sheet" ${moreActive ? 'aria-current="page"' : ''}>${ic('menu')}More</button></nav>
  <button class="fab" type="button" data-act="quick" aria-label="Quick add">${ic('plus')}</button>
  </div>`;
}
export let bannerMsg = '';
export function banner(m) { bannerMsg = m; scheduleRender(); }

export function topbar(title, sub, actions = '') {
  return `<header class="topbar"><div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div><div class="top-actions">${actions}</div></header>${bannerMsg ? `<div class="banner" role="alert">${esc(bannerMsg)}</div>` : ''}`;
}
export function emptyState(em, title, text, btn = '') { return `<div class="empty"><div class="em" aria-hidden="true">${em}</div><b>${title}</b><div>${text}</div>${btn}</div>`; }

export function render() {
  const app = $('#app');
  if (!Store.backend) return;
  applyTheme();
  const r = route();
  const views = { '': vDash, calendar: vCal, classes: vClasses, students: vStudents, student: vStudent, time: vTime, payments: vPayments, university: vUni, settings: vSettings };
  const fn = views[r.page] || vDash;
  const y = window.scrollY; const focusId = document.activeElement?.id; const selStart = document.activeElement?.selectionStart;
  const wkOld = $('.wk'); const wkKey = wkOld?.dataset.key; const wkTop = wkOld ? wkOld.scrollTop : 0;
  app.innerHTML = shell(fn(r.arg));
  const wkNew = $('.wk');
  if (wkNew) { if (wkKey && wkKey === wkNew.dataset.key) wkNew.scrollTop = wkTop; else scrollGridToFocus(wkNew); }
  ui.flash = null; // one-shot "just changed" highlight; never replays on later renders
  if (lastPage === location.hash) { window.scrollTo(0, y); if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); try { if (selStart != null) el.setSelectionRange(selStart, selStart); } catch { } } } }
  else { window.scrollTo(0, 0); lastPage = location.hash; }
  afterRender();
}
export let lastPage = '';
export function afterRender() { }
/** Fade the class's on-screen element(s) out briefly, then apply the change. Only that element moves; nothing else is re-laid-out first. */
export function removeAnimated(id, apply) {
  const els = $$(`.ev[data-id="${CSS.escape(id)}"],.mev[data-id="${CSS.escape(id)}"]`);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!els.length || reduce) return apply();
  els.forEach(e => e.classList.add('leaving'));
  setTimeout(apply, 160);
}
/** First time a week/day grid is shown (or after moving to another date/view): bring "now", or else the first event, into view.
 *  Scrolls only the grid itself, never the page. */
export function scrollGridToFocus(wk) {
  const target = wk.querySelector('.nowline') || wk.querySelector('.ev:not(.u)') || wk.querySelector('.ev');
  if (!target) return;
  const head = wk.querySelector('.wk-head')?.offsetHeight || 0;
  wk.scrollTop = Math.max(0, target.offsetTop + head - wk.clientHeight / 3);
}
export function applyTheme() { const t = S.profile.theme; if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }

/* ================= Shared components ================= */
export function classCard(c, { showDate = false, compact = false } = {}) {
  const s = S.students[c.studentId]; const st = classState(c); const t = D().timeByClass[c.id];
  const meta = [];
  if (showDate) meta.push(`<span>${ic('cal')}${esc(relDay(c.date))}, ${fmtT(c.start)}</span>`);
  if (c.subject) meta.push(`<span>${ic('book')}${esc(c.subject)}</span>`);
  if (c.location) meta.push(`<span>${ic('pin')}${esc(c.location)}</span>`);
  const dur = t ? `<span class="dur" title="Teaching time (${fmtT(c.start)}–${fmtT(c.end)})">${ic('clock')}${fmtDur(t.minutes)}</span>` : '';
  let acts = '';
  if (!compact) {
    if (c.status === 'scheduled') acts = `<button class="btn sm" data-act="complete" data-id="${esc(c.id)}" data-date="${c.date}">${ic('check')}Done</button><button class="btn sm ghost" data-act="time-class" data-id="${esc(c.id)}" data-date="${c.date}">${ic('clock')}Time</button>`;
    acts += `<button class="btn sm icon ghost" data-act="open-class" data-id="${esc(c.id)}" data-date="${c.date}" aria-label="More actions for ${esc(s?.name)}'s class" title="More actions">${ic('more')}</button>`;
  }
  const resch = c.status === 'rescheduled' && c.rescheduledToDate ? ` to ${fmtDate(c.rescheduledToDate)}` : '';
  return `<article class="cls st-${c.status}" data-act="open-class" data-id="${esc(c.id)}" data-date="${c.date}">
    <div class="cls-main"><div class="cls-who">${avatar(s)}<span>${esc(s?.name)}</span></div>${meta.length ? `<div class="cls-meta">${meta.join('')}</div>` : ''}</div>
    <div class="cls-acts"><span class="badge ${st.b}">${st.label}${esc(resch)}</span>${dur}${acts}</div></article>`;
}
export function stuOptions(sel, { all = false, activeOnly = false } = {}) {
  const list = stuList().filter(s => !activeOnly || s.status === 'active' || s.id === sel);
  return (all ? `<option value="">All students</option>` : `<option value="">Choose a student</option>`) + list.map(s => `<option value="${esc(s.id)}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)}${s.status !== 'active' ? ` (${s.status})` : ''}</option>`).join('');
}
export function payBadge(st) { const [l, b] = PAYLABEL[st]; return `<span class="badge ${b}">${l}</span>`; }

/* ================= Summary card ================= */
export const kpiCard = (icon, tone, label, value, sub, valueCls = '') => `<div class="kpi" style="--k:var(--${tone});--k-soft:var(--${tone}-soft)"><div class="kpi-h"><span class="kpi-ic">${ic(icon)}</span>${label}</div><div class="kpi-v num ${valueCls}">${value}</div><div class="kpi-s">${sub}</div></div>`;
export const monthTag = m => `<span class="lm">${esc(fmtMonth(m))}</span>`;

/* ================= Reminders panel ================= */
export function bellPanel() {
  const all = reminders(); const unread = all.filter(x => !isReminderRead(x)).length;
  const col = { class: 'tui', unmarked: 'pay', tomorrow: 'tui', due: 'pay' }; const icn = { class: 'clock', unmarked: 'warn', tomorrow: 'cal', due: 'wallet' };
  return `<div class="pop-scrim" data-act="bell-close" aria-hidden="true"></div><div class="panel pop" role="dialog" aria-label="Reminders">
    <div class="pop-h"><b>Reminders</b><span class="faint" style="font-size:.8rem">${unread ? `${unread} unread` : 'All read'}</span>
      <button type="button" class="btn sm ghost" data-act="rem-read-all" ${unread ? '' : 'disabled'}>${ic('check')}Mark all as read</button>
      <button type="button" class="btn sm icon ghost pop-x" data-act="bell-close" aria-label="Close reminders" title="Close">${ic('x')}</button></div>
    <div class="pop-list">${all.length ? all.map(x => `<div class="li rem ${isReminderRead(x) ? 'read' : 'unread'}" data-act="rem-open" data-key="${esc(x.key)}" tabindex="0" role="button"><span class="ric" style="background:var(--${col[x.kind]}-soft);color:var(--${col[x.kind]}-ink)">${ic(icn[x.kind])}</span><div class="li-main"><div class="li-t">${esc(x.text)}</div><div class="li-s">${esc(x.sub)}</div></div>${isReminderRead(x) ? '' : '<span class="udot" aria-label="Unread"></span>'}</div>`).join('')
      : `<div class="empty" style="padding:18px"><b>You're all caught up</b><div>No reminders right now.</div></div>`}</div></div>`;
}

