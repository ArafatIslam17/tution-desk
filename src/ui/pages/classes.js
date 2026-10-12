/* ================= Classes ================= */
import { classState, isLive, occurrences, plannedMin, rangeFor } from '../../lib/domain.js';
import { S, ui } from '../../lib/state.js';
import { esc, fmtDate, fmtDur, fmtT, parseD, relDay, todayStr } from '../../lib/utils.js';
import { ic } from '../icons.js';
import { classCard, emptyState, stuOptions, topbar } from '../shell.js';
export function vClasses() {
  const f = ui.cls; const [a, b] = rangeFor(f.range, f.from, f.to);
  let list = occurrences(a, b);
  if (f.student) list = list.filter(c => c.studentId === f.student);
  if (f.status) list = list.filter(c => classState(c).k === f.status || (f.status === 'scheduled' && ['up', 'now'].includes(classState(c).k)));
  const subjects = [...new Set(occurrences(a, b).map(c => c.subject).filter(Boolean))].sort();
  if (f.subject) list = list.filter(c => c.subject === f.subject);
  const byDay = {}; list.forEach(c => (byDay[c.date] ||= []).push(c));
  const rchip = (k, l) => `<button class="chip" data-act="cls-range" data-r="${k}" aria-pressed="${f.range === k}">${l}</button>`;
  const live = list.filter(isLive);
  return topbar('Tuition classes', `${live.length} classes, ${fmtDur(live.reduce((x, c) => x + plannedMin(c), 0))} planned in this range`, `<button class="btn pri" data-act="new-class">${ic('plus')}Add class</button>`)
    + `<div class="toolbar"><div class="chips" role="group" aria-label="Date range">${rchip('today', 'Today')}${rchip('week', 'This week')}${rchip('month', 'This month')}${rchip('custom', 'Custom')}</div>
      ${f.range === 'custom' ? `<label class="sr" for="cf-from">From</label><input id="cf-from" type="date" class="input" style="width:auto" value="${esc(f.from || a)}" data-input="cls-from"><label class="sr" for="cf-to">To</label><input id="cf-to" type="date" class="input" style="width:auto" value="${esc(f.to || b)}" data-input="cls-to">` : ''}
      <label class="sr" for="cf-stu">Student</label><select id="cf-stu" class="input" style="width:auto" data-input="cls-student">${stuOptions(f.student, { all: true })}</select>
      <label class="sr" for="cf-st">Status</label><select id="cf-st" class="input" style="width:auto" data-input="cls-status"><option value="">All statuses</option>${[['scheduled', 'Upcoming'], ['miss', 'Not marked'], ['done', 'Completed'], ['cancel', 'Cancelled'], ['resch', 'Rescheduled']].map(([k, l]) => `<option value="${k}" ${k === f.status ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <label class="sr" for="cf-sub">Subject</label><select id="cf-sub" class="input" style="width:auto" data-input="cls-subject"><option value="">All subjects</option>${subjects.map(x => `<option ${x === f.subject ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>`
    + `<div class="panel"><div class="panel-b" style="padding-top:18px">${Object.keys(byDay).length ? Object.entries(byDay).map(([d, cs]) => `<h3 class="day-head ${d === todayStr() ? 'today' : ''}">${esc(relDay(d))}<span class="faint" style="font-weight:500">${d === todayStr() || Math.abs(parseD(d) - parseD(todayStr())) < 2 * 864e5 ? fmtDate(d) : ''}</span></h3><div class="stack" style="gap:8px">${cs.map(c => `<div style="display:grid;grid-template-columns:74px 1fr;gap:10px;align-items:center"><div class="num" style="text-align:right"><b>${fmtT(c.start)}</b><div class="faint" style="font-size:.78rem">${fmtT(c.end)}</div></div>${classCard(c)}</div>`).join('')}</div>`).join('')
      : emptyState('cal', 'No classes in this range', Object.keys(S.students).length ? 'Try another range or add a class.' : 'Add a student with a weekly schedule to get started.', `<button class="btn pri" data-act="new-class">${ic('plus')}Add class</button>`)}</div></div>`;
}

