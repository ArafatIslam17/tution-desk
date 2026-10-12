/* ================= Teaching time ================= */
import { avatar, rangeFor, timesIn, totalsBy } from '../../lib/domain.js';
import { S, ui } from '../../lib/state.js';
import { eachDay, esc, fmtDate, fmtDur, fmtT } from '../../lib/utils.js';
import { ic } from '../icons.js';
import { emptyState, stuOptions, topbar } from '../shell.js';
export function vTime() {
  const f = ui.time; const [a, b] = rangeFor(f.range, f.from, f.to);
  const times = timesIn(a, b, f.student).sort((x, y) => (y.date + (y.start || '')).localeCompare(x.date + (x.start || '')));
  const tot = totalsBy(times); const max = Math.max(1, ...Object.values(tot.by));
  const rchip = (k, l) => `<button class="chip" data-act="time-range" data-r="${k}" aria-pressed="${f.range === k}">${l}</button>`;
  const days = eachDay(a, b); const perDay = {}; times.forEach(t => perDay[t.date] = (perDay[t.date] || 0) + Number(t.minutes));
  const showDays = days.length > 1 && days.length <= 31;
  const maxD = Math.max(1, ...Object.values(perDay));
  return topbar('Teaching time', `${fmtDate(a, { day: 'numeric', month: 'short' })} to ${fmtDate(b, { day: 'numeric', month: 'short', year: 'numeric' })}`, `<button class="btn pri" data-act="new-time">${ic('plus')}Add teaching time</button>`)
    + `<div class="toolbar"><div class="chips" role="group" aria-label="Date range">${rchip('today', 'Today')}${rchip('week', 'This week')}${rchip('month', 'This month')}${rchip('custom', 'Custom')}</div>
      ${f.range === 'custom' ? `<label class="sr" for="tf-from">From</label><input id="tf-from" type="date" class="input" style="width:auto" value="${esc(f.from || a)}" data-input="time-from"><label class="sr" for="tf-to">To</label><input id="tf-to" type="date" class="input" style="width:auto" value="${esc(f.to || b)}" data-input="time-to">` : ''}
      <label class="sr" for="tf-stu">Student</label><select id="tf-stu" class="input" style="width:auto" data-input="time-student">${stuOptions(f.student, { all: true })}</select></div>`
    + `<div class="grid-dash"><div class="stack">
      <section class="panel"><div class="panel-h"><h2>Total teaching time</h2></div><div class="panel-b">
        <div class="durpreview num" style="font-size:2.4rem">${fmtDur(tot.total)}</div><div class="muted">${times.length} recorded session${times.length === 1 ? '' : 's'}</div>
        <div class="faint" style="font-size:.8rem;margin-top:4px">Calculated from each completed class's start and end time.</div>
        ${showDays ? `<div style="display:flex;align-items:flex-end;gap:3px;height:90px;margin-top:18px" role="img" aria-label="Teaching time per day">${days.map(d => `<div title="${fmtDate(d)}: ${fmtDur(perDay[d] || 0)}" style="flex:1;min-width:3px;height:${Math.max(3, (perDay[d] || 0) / maxD * 100)}%;border-radius:4px 4px 2px 2px;background:${perDay[d] ? 'var(--tui)' : 'var(--line2)'}"></div>`).join('')}</div><div class="faint" style="display:flex;justify-content:space-between;font-size:.74rem;margin-top:4px"><span>${fmtDate(a, { day: 'numeric', month: 'short' })}</span><span>${fmtDate(b, { day: 'numeric', month: 'short' })}</span></div>` : ''}
      </div></section>
      <section class="panel"><div class="panel-h"><h2>Sessions</h2></div><div class="panel-b">${times.length ? `<div class="list">${times.map(t => { const s = S.students[t.studentId]; return `<div class="li" style="cursor:pointer" ${t.classId ? `data-act="time-class" data-id="${esc(t.classId)}"` : `data-act="edit-time" data-id="${esc(t.id)}"`} data-date="${t.date}">${avatar(s)}<div class="li-main"><div class="li-t">${esc(s?.name)}</div><div class="li-s">${fmtDate(t.date)}${t.start && t.end ? `, ${fmtT(t.start)}–${fmtT(t.end)}` : ''}${t.classId ? '' : ' · extra session'}${t.note ? ` · ${esc(t.note)}` : ''}</div></div><span class="dur">${fmtDur(t.minutes)}</span></div>`; }).join('')}</div>`
      : emptyState('⏱️', 'No teaching time yet', 'Mark classes as completed and their start-to-end time is counted here automatically.', `<button class="btn pri" data-act="new-time">${ic('plus')}Add teaching time</button>`)}</div></section>
    </div><div class="stack">
      <section class="panel"><div class="panel-h"><h2>By student</h2></div><div class="panel-b">${Object.keys(tot.by).length ? `<div class="bars">${Object.entries(tot.by).sort((x, y) => y[1] - x[1]).map(([sid, m]) => `<div class="bar-row"><div class="n">${avatar(S.students[sid])}<span>${esc(S.students[sid]?.name)}</span></div><div class="bar"><i style="width:${(m / max * 100).toFixed(1)}%"></i></div><div class="v">${fmtDur(m)}</div></div>`).join('')}</div>` : '<div class="muted">Nothing recorded in this range.</div>'}</div></section>
    </div></div>`;
}

