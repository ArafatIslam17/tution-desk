/* ================= Dashboard ================= */
import { activeStudents, avatar, classState, isLive, occurrences, payState, plannedMin, prevMonthFinance, rangeFor, stuList, timesIn, totalsBy, uniOn, unreadReminders } from '../../lib/domain.js';
import { S, ui } from '../../lib/state.js';
import { addDays, esc, fmtDate, fmtDur, fmtMonth, fmtT, fromMin, money, nowMin, relDay, toMin, todayStr } from '../../lib/utils.js';
import { ic } from '../icons.js';
import { bellPanel, classCard, emptyState, kpiCard, monthTag, topbar } from '../shell.js';
export function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
export function vDash() {
  const t = todayStr(); const nm = S.profile.name ? `, ${esc(S.profile.name.split(' ')[0])}` : '';
  const today = occurrences(t, t);
  const live = today.filter(isLive);
  const done = live.filter(c => c.status === 'completed').length;
  const tt = totalsBy(timesIn(t, t));
  const planned = live.reduce((a, c) => a + plannedMin(c), 0);
  const act = activeStudents();
  const pf = prevMonthFinance(); const pmLabel = fmtMonth(pf.m);
  const unread = unreadReminders().length;
  const actions = `<div class="bell" style="position:relative"><button class="btn icon" data-act="bell" aria-label="Reminders, ${unread} unread" title="Reminders" aria-expanded="${!!ui.bellOpen}" aria-controls="bellpop">${ic('bell')}${unread ? `<span class="dotn" aria-hidden="true">${unread}</span>` : ''}</button><div id="bellpop">${ui.bellOpen ? bellPanel() : ''}</div></div>
    <button class="btn desk" data-act="new-student">${ic('users')}Add student</button><button class="btn pri desk" data-act="quick">${ic('plus')}Quick add</button>`;
  const noStudents = !Object.keys(S.students).length;

  const strip = `<section class="kpis" aria-label="Today at a glance">
    ${kpiCard('book', 'tui', "Today's tuition", `${live.length} ${live.length === 1 ? 'class' : 'classes'}`, `${done} completed`)}
    ${kpiCard('clock', 'tui', 'Teaching time today', fmtDur(tt.total), `Planned ${fmtDur(planned)}`)}
    ${kpiCard('users', 'stu', 'Active students', act.length, `${Object.keys(S.students).length - act.length} paused or finished`)}
    ${kpiCard('wallet', pf.due ? 'bad' : 'stu', 'Due', money(pf.due), `${monthTag(pf.m)}${pf.due ? `${pf.owing} student${pf.owing > 1 ? 's' : ''} unpaid` : pf.expected ? 'paid in full' : 'no fees'}`, pf.due ? 'bad-t' : '')}
  </section>`;

  // Today rail: tuition + (low-priority) university blocks
  const items = [...today.map(c => ({ k: 'c', start: c.start, end: c.end, c })), ...uniOn(t).map(u => ({ k: 'u', start: u.start, end: u.end, u }))].sort((a, b) => a.start.localeCompare(b.start));
  const n = nowMin(); let nowPlaced = false; let rail = '';
  for (const it of items) {
    if (!nowPlaced && toMin(it.start) > n && items.some(x => toMin(x.start) <= n)) { rail += `<div class="now-marker" aria-hidden="true"><span>${fmtT(fromMin(n))}</span><i></i></div>`; nowPlaced = true; }
    if (it.k === 'u') {
      rail += `<div class="rail-item uni"><div class="rail-time"><b>${fmtT(it.start)}</b><span>${fmtT(it.end)}</span></div><div class="rail-line"><span class="rail-dot"></span></div><div class="rail-body"><div class="uni-row" data-act="edit-uni" data-id="${esc(it.u.id)}" title="University class">${ic('uni')}<span>University</span><b>${esc(it.u.name)}</b></div></div></div>`;
    } else {
      const st = classState(it.c).k;
      rail += `<div class="rail-item ${st === 'done' ? 'done' : ''} ${st === 'cancel' || st === 'resch' ? 'cancel' : ''} ${st === 'now' ? 'now' : ''}"><div class="rail-time"><b>${fmtT(it.start)}</b><span>${fmtT(it.end)}</span></div><div class="rail-line"><span class="rail-dot"></span></div><div class="rail-body">${classCard(it.c)}</div></div>`;
    }
  }
  if (!nowPlaced && items.length && items.every(x => toMin(x.start) <= n) && n < 1440) rail += `<div class="now-marker" aria-hidden="true"><span>${fmtT(fromMin(n))}</span><i></i></div>`;
  const uniToday = uniOn(t).length;
  const todayBody = noStudents
    ? emptyState('users', 'Set up your tuition desk', 'Add a student with their weekly schedule. Their classes then appear here every day.',
      `<button class="btn pri" data-act="new-student">${ic('plus')}Add student</button><button class="btn ghost" data-act="demo-load">Try with sample data</button>`,
      { extra: `<ol class="steps"><li><span><b>Add a student</b>Weekly days, time and monthly fee.</span></li><li><span><b>Add your university timetable</b>Optional. Tuition clashes get flagged.</span></li><li><span><b>Mark classes as Done</b>Teaching time and dues update on their own.</span></li></ol>` })
    : today.length ? `<div class="rail">${rail}</div>`
      : emptyState('check', 'No tuition classes today', uniToday ? `You're free, apart from ${uniToday} university class${uniToday > 1 ? 'es' : ''}.` : "You're free today.", `<button class="btn" data-act="new-class">${ic('plus')}Add a class</button>`, { compact: true });
  const todayPanel = `<section class="panel p-today" aria-labelledby="h-today"><div class="panel-h"><h2 id="h-today">Today's tuition</h2><a class="link" href="#/calendar">Open calendar</a></div><div class="panel-b">${todayBody}</div></section>`;

  const up = occurrences(addDays(t, 1), addDays(t, 7)).filter(c => isLive(c)).slice(0, 6);
  const upPanel = `<section class="panel p-up" aria-labelledby="h-up"><div class="panel-h"><h2 id="h-up">Upcoming tuition</h2><a class="link" href="#/classes">All classes</a></div><div class="panel-b">
    ${up.length ? `<div class="list">${up.map(c => { const s = S.students[c.studentId]; return `<div class="li" data-act="open-class" data-id="${esc(c.id)}" data-date="${c.date}" style="cursor:pointer">${avatar(s)}<div class="li-main"><div class="li-t">${esc(s.name)}</div><div class="li-s">${esc(relDay(c.date))}, ${fmtT(c.start)}${c.subject ? ` · ${esc(c.subject)}` : ''}</div></div><span class="faint num" style="font-size:.85rem">${fmtDur(plannedMin(c))}</span></div>`; }).join('')}</div>`
      : emptyState('cal', 'Nothing in the next 7 days', noStudents ? 'Upcoming classes from your students’ weekly schedules show here.' : 'Set a weekly schedule on a student and classes appear here automatically.', '', { compact: true })}
  </div></section>`;

  const wk = rangeFor('week'); const wt = totalsBy(timesIn(wk[0], wk[1]));
  const maxW = Math.max(1, ...Object.values(wt.by));
  const weekPanel = `<section class="panel p-week" aria-labelledby="h-wk"><div class="panel-h"><h2 id="h-wk">Taught this week</h2><a class="link" href="#/time">Details</a></div><div class="panel-b">
    <div class="durpreview num" style="margin-bottom:${Object.keys(wt.by).length ? 12 : 4}px">${fmtDur(wt.total)}</div>
    ${Object.keys(wt.by).length ? `<div class="bars">${Object.entries(wt.by).sort((a, b) => b[1] - a[1]).map(([sid, m]) => `<div class="bar-row"><div class="n">${avatar(S.students[sid])}<span>${esc(S.students[sid]?.name)}</span></div><div class="bar"><i style="width:${(m / maxW * 100).toFixed(1)}%"></i></div><div class="v">${fmtDur(m)}</div></div>`).join('')}</div>`
      : `<div class="muted" style="font-size:.86rem">No teaching time yet this week. Mark a class as <b>Done</b> and its start-to-end time is counted here.</div>`}
  </div></section>`;

  const dues = stuList().map(s => ({ s, due: payState(s, pf.m).due })).filter(x => x.due > 0).sort((a, b) => b.due - a.due);
  const payPanel = `<section class="panel p-due" aria-labelledby="h-pay"><div class="panel-h"><h2 id="h-pay">Due <span class="lm lg">${esc(pmLabel)}</span></h2><a class="link" href="#/payments" data-act="pay-goto" data-month="${pf.m}">View all</a></div><div class="panel-b">
    ${dues.length ? `<div class="list">${dues.slice(0, 6).map(x => `<div class="li">${avatar(x.s)}<div class="li-main"><div class="li-t">${esc(x.s.name)}</div><div class="li-s">of ${money(payState(x.s, pf.m).fee)} fee</div></div><span class="amt due">${money(x.due)}</span><button class="btn sm" data-act="new-payment" data-sid="${esc(x.s.id)}" data-month="${pf.m}">Record</button></div>`).join('')}</div>${dues.length > 6 ? `<div class="faint" style="font-size:.84rem;padding-top:6px">and ${dues.length - 6} more</div>` : ''}`
      : emptyState('check', pf.expected ? 'All paid' : 'Nothing due', pf.expected ? `Every ${esc(pmLabel)} fee has been paid.` : `No fees were due for ${esc(pmLabel)}.`, '', { compact: true, tone: pf.expected ? 'tui' : 'pay' })}
  </div></section>`;

  return topbar(`${greeting()}${nm}!`, `${fmtDate(t, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}. Here's your tuition for today.`, actions)
    + strip + `<div class="dash"><div class="col c1">${todayPanel}</div><div class="col c2">${upPanel}</div><div class="col c3">${payPanel}${weekPanel}</div></div>`;
}

