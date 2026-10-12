/* ================= Calendar ================= */
import { isLive, occurrences, uniOn, weekStartOf } from '../../lib/domain.js';
import { S, ui } from '../../lib/state.js';
import { DAYS3, addDays, dow, eachDay, esc, fmtDate, fmtMonth, fmtT, monthFirst, monthLast, monthOf, nowMin, pad, toMin, todayStr } from '../../lib/utils.js';
import { ic } from '../icons.js';
import { topbar } from '../shell.js';
export function vCal() {
  const c = ui.cal; c.view ||= (innerWidth < 700 ? 'day' : 'week'); c.date ||= todayStr();
  const d = c.date; let title, body, a, b;
  if (c.view === 'month') { const m = monthOf(d); title = fmtMonth(m); a = weekStartOf(monthFirst(m)); b = addDays(weekStartOf(monthLast(m)), 6); body = calMonth(m, a, b); }
  else if (c.view === 'week') { a = weekStartOf(d); b = addDays(a, 6); title = `${fmtDate(a, { day: 'numeric', month: 'short' })} – ${fmtDate(b, { day: 'numeric', month: 'short', year: 'numeric' })}`; body = calGrid(eachDay(a, b)); }
  else { title = fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' }); body = calGrid([d]); }
  const t0 = todayStr(); const onToday = c.view === 'day' ? d === t0 : c.view === 'week' ? t0 >= a && t0 <= b : monthOf(d) === monthOf(t0);
  const vb = (k, l) => `<button data-act="cal-view" data-v="${k}" aria-pressed="${c.view === k}">${l}</button>`;
  return topbar('Calendar', '', `<button class="btn pri" data-act="new-class" data-date="${d}">${ic('plus')}Add class</button>`)
    + `<div class="cal-bar"><div class="navgrp" role="group" aria-label="Move through the calendar"><button class="btn icon" data-act="cal-nav" data-d="-1" aria-label="Previous ${c.view}" title="Previous ${c.view}">${ic('left')}</button><button class="btn" data-act="cal-nav" data-d="0" ${onToday ? 'aria-disabled="true" title="You are viewing today"' : `title="Jump to today"`}>Today</button><button class="btn icon" data-act="cal-nav" data-d="1" aria-label="Next ${c.view}" title="Next ${c.view}">${ic('right')}</button></div>
      <div class="cal-title" aria-live="polite">${title}</div><div class="seg" role="group" aria-label="Calendar view">${vb('month', 'Month')}${vb('week', 'Week')}${vb('day', 'Day')}</div>
      <div class="legend"><span><i></i>Tuition</span><span><i class="u"></i>University</span></div></div>` + body;
}
export function calMonth(m, a, b) {
  const occ = occurrences(a, b).filter(c => c.status !== 'rescheduled'); const by = {}; occ.forEach(c => (by[c.date] ||= []).push(c));
  const ws = Number(S.profile.weekStart ?? 6); const heads = [0, 1, 2, 3, 4, 5, 6].map(i => DAYS3[(ws + i) % 7]);
  const t = todayStr();
  return `<div class="month" role="grid">${heads.map(h => `<div class="dow" role="columnheader">${h}</div>`).join('')}${eachDay(a, b).map(d => {
    const cs = by[d] || []; const u = uniOn(d).length;
    return `<div class="mcell ${monthOf(d) !== m ? 'out' : ''} ${d === t ? 'today' : ''}" role="gridcell" tabindex="0" data-act="cal-day" data-date="${d}" aria-label="${fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}: ${cs.filter(isLive).length} tuition classes${u ? `, ${u} university` : ''}"><span class="mnum">${Number(d.slice(8))}</span>${cs.slice(0, 3).map(c => `<div class="mev ${c.status === 'completed' ? 'done' : c.status === 'cancelled' ? 'cancel' : ''}${ui.flash === c.id ? ' entering' : ''}" data-id="${esc(c.id)}">${fmtT(c.start).replace(':00', '').replace(' ', '').toLowerCase()} ${esc(S.students[c.studentId]?.name.split(' ')[0])}</div>`).join('')}${cs.length > 3 ? `<div class="mev more">+${cs.length - 3} more</div>` : ''}${u ? '<div class="muni" title="University classes"></div>' : ''}</div>`;
  }).join('')}</div>`;
}
export function lanes(evs) {
  evs.sort((x, y) => x.s - y.s || y.e - x.e); const ends = [];
  for (const e of evs) { let l = ends.findIndex(v => v <= e.s); if (l < 0) { l = ends.length; ends.push(0); } ends[l] = e.e; e.lane = l; }
  for (const e of evs) e.n = Math.max(...evs.filter(o => o.s < e.e && e.s < o.e).map(o => o.lane)) + 1;
  return evs;
}
export function calGrid(days) {
  const occ = occurrences(days[0], days[days.length - 1]).filter(c => c.status !== 'rescheduled');
  let h0 = 8, h1 = 22;
  for (const c of occ) { h0 = Math.min(h0, Math.floor(toMin(c.start) / 60)); h1 = Math.max(h1, Math.ceil(toMin(c.end) / 60)); }
  for (const d of days) for (const u of uniOn(d)) { h0 = Math.min(h0, Math.floor(toMin(u.start) / 60)); h1 = Math.max(h1, Math.ceil(toMin(u.end) / 60)); }
  // Keep the hour range stable while the same days are on screen: deleting the earliest/latest class
  // must not shrink the grid and shift every other event. It resets when you navigate.
  const key = days[0] + '/' + days.length;
  const hr = ui.cal.hr;
  if (hr && hr.key === key) { h0 = Math.min(h0, hr.h0); h1 = Math.max(h1, hr.h1); }
  ui.cal.hr = { key, h0, h1 };
  const H = 52, t = todayStr(), n = nowMin();
  const cols = `56px repeat(${days.length},minmax(0,1fr))`;
  const head = `<div class="wk-head" style="grid-template-columns:${cols}"><div></div>${days.map(d => `<div class="${d === t ? 'today' : ''}" data-act="cal-day" data-date="${d}" role="button" tabindex="0">${DAYS3[dow(d)]}<b>${Number(d.slice(8))}</b></div>`).join('')}</div>`;
  const hours = []; for (let h = h0; h < h1; h++) hours.push(`<div>${h === h0 ? '' : fmtT(pad(h) + ':00').replace(':00', '')}</div>`);
  const colsHtml = days.map(d => {
    const evs = [...occ.filter(c => c.date === d).map(c => ({ k: 'c', c, s: toMin(c.start), e: toMin(c.end) })), ...uniOn(d).map(u => ({ k: 'u', u, s: toMin(u.start), e: toMin(u.end) }))];
    lanes(evs);
    const html = evs.map(e => {
      const top = (e.s - h0 * 60) / 60 * H, ht = Math.max(22, (e.e - e.s) / 60 * H - 2);
      const w = 100 / e.n, left = e.lane * w;
      const pos = `top:${top}px;height:${ht}px;left:calc(${left}% + 3px);width:calc(${w}% - 6px);right:auto`;
      if (e.k === 'u') return `<div class="ev u" style="${pos}" data-act="edit-uni" data-id="${esc(e.u.id)}" role="button" tabindex="0" title="University: ${esc(e.u.name)}"><b>${esc(e.u.name)}</b>${fmtT(e.u.start)}</div>`;
      const s = S.students[e.c.studentId];
      return `<div class="ev ${e.c.status === 'completed' ? 'done' : e.c.status === 'cancelled' ? 'cancel' : ''}${ui.flash === e.c.id ? ' entering' : ''}" style="${pos}" data-act="open-class" data-id="${esc(e.c.id)}" data-date="${d}" role="button" tabindex="0"><b>${esc(s?.name)}</b>${fmtT(e.c.start)}${e.c.subject ? ` · ${esc(e.c.subject)}` : ''}</div>`;
    }).join('');
    const now = d === t && n >= h0 * 60 && n <= h1 * 60 ? `<div class="nowline" style="top:${(n - h0 * 60) / 60 * H}px"></div>` : '';
    return `<div class="wk-col" style="height:${(h1 - h0) * H}px">${html}${now}</div>`;
  }).join('');
  return `<div class="wk ${days.length === 1 ? 'single' : ''}" data-key="${key}"><div class="wk-inner">${head}<div class="wk-body" style="grid-template-columns:${cols}"><div class="wk-hours">${hours.join('')}</div>${colsHtml}</div></div></div>`;
}

