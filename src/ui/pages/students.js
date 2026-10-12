/* ================= Students ================= */
import { D, avatar, classState, completedInMonth, currentFee, currentSlots, historyStart, occurrences, payState, paymentsFor, prevMonthOf, stuList, timesIn, totalsBy } from '../../lib/domain.js';
import { S, ui } from '../../lib/state.js';
import { DAYS3, MONTHS, addDays, curMonth, esc, fmtDate, fmtDur, fmtMonth, fmtT, money, monthFirst, monthLast, monthOf, monthsBetween, nowMin, parseD, relDay, toMin, todayStr } from '../../lib/utils.js';
import { ic } from '../icons.js';
import { emptyState, kpiCard, monthTag, payBadge, topbar } from '../shell.js';
export function vStudents() {
  const q = ui.stuQ.trim().toLowerCase(); const f = ui.stuF;
  const all = stuList();
  const list = all.filter(s => (f === 'all' || s.status === f) && (!q || s.name.toLowerCase().includes(q) || (s.subjects || []).join(' ').toLowerCase().includes(q) || (s.grade || '').toLowerCase().includes(q)));
  const counts = { active: 0, paused: 0, finished: 0 }; all.forEach(s => counts[s.status]++);
  const cards = list.map(s => {
    const sl = currentSlots(s); const pmDue = payState(s, prevMonthOf(curMonth())).due; const pmShort = MONTHS[Number(prevMonthOf(curMonth()).slice(5)) - 1].slice(0, 3);
    const sched = sl.length ? `${sl.map(x => DAYS3[x.day]).join(', ')} at ${fmtT(sl[0].start)}` : 'No weekly schedule';
    return `<a class="stu-card" href="#/student/${encodeURIComponent(s.id)}"><div class="stu-top">${avatar(s)}<div style="min-width:0;flex:1"><div class="stu-name">${esc(s.name)}</div><div class="muted" style="font-size:.85rem">${esc([s.grade, (s.subjects || []).join(', ')].filter(Boolean).join(' · ') || 'No class or subjects set')}</div></div><span class="badge b-${s.status}">${s.status[0].toUpperCase() + s.status.slice(1)}</span></div>
      <div class="stu-facts"><span>${ic('cal')}${esc(sched)}</span>${s.location ? `<span>${ic('pin')}${esc(s.location)}</span>` : ''}</div>
      <div class="stu-foot"><span class="amt">${money(currentFee(s))}<span class="muted" style="font-family:var(--font);font-weight:500">/month</span></span>${pmDue > 0 ? `<span class="amt due" title="Unpaid for ${fmtMonth(prevMonthOf(curMonth()))}">${money(pmDue)} due · ${pmShort}</span>` : `<span class="faint">${pmShort} paid</span>`}</div></a>`;
  }).join('');
  const chip = (k, l) => `<button class="chip" data-act="stu-filter" data-f="${k}" aria-pressed="${f === k}">${l}</button>`;
  return topbar('Students', `${counts.active} active, ${counts.paused} paused, ${counts.finished} finished`, `<button class="btn stu" data-act="new-student">${ic('plus')}Add student</button>`)
    + `<div class="toolbar"><div class="search">${ic('search')}<label class="sr" for="stu-q">Search students</label><input id="stu-q" class="input" type="search" placeholder="Search by name, class or subject" value="${esc(ui.stuQ)}" data-input="stu-q"></div>
      <div class="chips" role="group" aria-label="Filter by status">${chip('active', 'Active')}${chip('paused', 'Paused')}${chip('finished', 'Finished')}${chip('all', 'All')}</div></div>`
    + (all.length ? (list.length ? `<div class="stu-grid">${cards}</div>` : emptyState('search', 'No matching students', 'Try a different name or status filter.'))
      : `<div class="panel">${emptyState('users', 'No students yet', 'Add your first student with their weekly schedule and fee. Classes, teaching time and dues follow automatically.', `<button class="btn stu" data-act="new-student">${ic('plus')}Add student</button><button class="btn ghost" data-act="demo-load">Try with sample data</button>`, { tone: 'stu' })}</div>`);
}

export function vStudent(id) {
  const s = S.students[id];
  if (!s) return topbar('Student not found', '') + `<div class="panel">${emptyState('warn', 'This student no longer exists', 'They may have been deleted.', '<a class="btn" href="#/students">Back to students</a>')}</div>`;
  const t = todayStr(); const cm = curMonth(); const pm = prevMonthOf(cm);
  const cmName = MONTHS[Number(cm.slice(5)) - 1];
  const hist = occurrences(historyStart(s), t, { studentId: id }).filter(c => c.date < t || c.status !== 'scheduled' || toMin(c.end) <= nowMin()).reverse();
  const upcoming = occurrences(t, addDays(t, 21), { studentId: id }).filter(c => c.status === 'scheduled' && classState(c).k !== 'miss').slice(0, 5);
  // Stat card data: all by class date / fee month.
  const doneMonth = completedInMonth(id, cm).length;
  const missMonth = occurrences(monthFirst(cm), t, { studentId: id }).filter(c => classState(c).k === 'miss').length;
  const mT = totalsBy(timesIn(monthFirst(cm), monthLast(cm), id)).total;
  const allT = totalsBy(timesIn('0000-01-01', '9999-12-31', id)).total;
  const prev = payState(s, pm);
  const sl = currentSlots(s);

  const kpis = `<section class="kpis three" aria-label="This student at a glance">
    ${kpiCard('check', 'tui', 'Classes completed', doneMonth, `in ${cmName}${missMonth ? ` · <span class="warn-t">${missMonth} not marked</span>` : ''}`)}
    ${kpiCard('clock', 'tui', 'Teaching time', fmtDur(mT), `in ${cmName} · ${fmtDur(allT)} all time`)}
    ${kpiCard('wallet', prev.due ? 'bad' : 'stu', 'Due', money(prev.due), `${monthTag(pm)}${prev.due ? `unpaid of ${money(prev.fee)}` : prev.fee ? 'paid in full' : 'no fee'}`, prev.due ? 'bad-t' : '')}
  </section>`;

  const prow = c => {
    const st = classState(c); const d = parseD(c.date); const rel = c.date === t ? 'Today' : c.date === addDays(t, 1) ? 'Tomorrow' : '';
    const meta = [c.subject ? `<span>${ic('book')}${esc(c.subject)}</span>` : '', `<span>${ic('users')}${esc(s.name)}</span>`, c.location ? `<span>${ic('pin')}${esc(c.location)}</span>` : ''].join('');
    return `<article class="prow" data-act="open-class" data-id="${esc(c.id)}" data-date="${c.date}" tabindex="0" aria-label="${esc(relDay(c.date))}, ${fmtT(c.start)}">
      <div class="pdate ${rel ? 'soon' : ''}" aria-hidden="true"><span>${DAYS3[d.getDay()]}</span><b>${d.getDate()}</b><span>${MONTHS[d.getMonth()].slice(0, 3)}</span></div>
      <div class="pmain"><div class="ptime num">${fmtT(c.start)} – ${fmtT(c.end)}${rel ? `<span class="badge ${st.b}">${st.k === 'now' ? st.label : rel}</span>` : ''}</div><div class="pmeta">${meta}</div></div>
      <div class="pacts"><button class="btn sm" data-act="complete" data-id="${esc(c.id)}" data-date="${c.date}" title="Mark this class as completed">${ic('check')}Done</button><button class="btn sm ghost" data-act="time-class" data-id="${esc(c.id)}" data-date="${c.date}" title="Record when you started and finished">${ic('clock')}Time</button><button class="btn sm icon ghost" data-act="open-class" data-id="${esc(c.id)}" data-date="${c.date}" aria-label="More actions: reschedule, cancel, note, edit" title="More actions">${ic('more')}</button></div>
    </article>`;
  };

  const subjects = [...new Set(hist.map(c => c.subject).filter(Boolean))];
  const hf = hist.filter(c => (!ui.prof.hSubject || c.subject === ui.prof.hSubject) && (!ui.prof.hStatus || classState(c).k === ui.prof.hStatus));
  const byMonth = {}; hf.forEach(c => (byMonth[monthOf(c.date)] ||= []).push(c));
  const histHtml = Object.keys(byMonth).length ? Object.entries(byMonth).map(([m, cs]) => {
    const done = cs.filter(c => c.status === 'completed').length; const mins = cs.reduce((a, c) => a + (D().timeByClass[c.id]?.minutes || 0), 0);
    return `<div class="hmonth"><h3>${fmtMonth(m)}</h3><span>${done} completed${mins ? ` · ${fmtDur(mins)} taught` : ''}</span></div>
      <div class="hlist" role="table" aria-label="${fmtMonth(m)} classes"><div class="hrow hhead" role="row"><span role="columnheader">Date</span><span role="columnheader">Subject</span><span role="columnheader">Time</span><span role="columnheader" class="r">Taught</span><span role="columnheader">Status</span></div>
      ${cs.map(c => { const tm = D().timeByClass[c.id]; const st = classState(c); return `<div class="hrow" role="row" data-act="open-class" data-id="${esc(c.id)}" data-date="${c.date}" tabindex="0"><span role="cell" class="hd">${fmtDate(c.date)}</span><span role="cell" class="hs">${esc(c.subject || '—')}</span><span role="cell" class="ht num">${fmtT(c.start)} – ${fmtT(c.end)}</span><span role="cell" class="r num hm ${tm ? '' : 'faint'}">${tm ? fmtDur(tm.minutes) : '—'}</span><span role="cell"><span class="badge ${st.b}">${st.label}</span></span></div>`; }).join('')}</div>`;
  }).join('') : `<div class="muted" style="padding:8px 0">${hist.length ? 'No classes match these filters.' : 'No past classes yet.'}</div>`;

  const payMonths = monthsBetween(s.startDate || t, monthLast(cm)).reverse().slice(0, 12);
  const payRows = payMonths.map(m => { const p = payState(s, m); if (!p.billable && !p.paid) return ''; const pct = p.fee ? Math.min(100, p.paid / p.fee * 100) : 100;
    return `<div class="payrow"><div class="pm"><b>${fmtMonth(m)}</b><span>Paid ${money(p.paid)} of ${money(p.fee)}</span><div class="pbar" aria-hidden="true"><i style="width:${pct}%"></i></div></div>
      <div class="pr">${p.due ? `<span class="amt due">${money(p.due)}</span><span class="faint">due</span>` : payBadge(p.status)}</div>
      ${p.due ? `<button class="btn sm" data-act="new-payment" data-sid="${esc(id)}" data-month="${m}" aria-label="Record payment for ${fmtMonth(m)}">Record</button>` : '<span class="pspacer"></span>'}</div>`; }).join('');
  const payRecs = Object.keys(S.months).flatMap(m => paymentsFor(m, id)).sort((a, b) => b.date.localeCompare(a.date));

  const notes = (s.noteLog || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const classNotes = hist.filter(c => c.note).slice(0, 8);
  const group = (title, rows) => { const r = rows.filter(x => x[1]); return r.length ? `<div class="dgroup"><h3>${title}</h3><dl class="dl">${r.map(([k, val, raw]) => `<dt>${k}</dt><dd>${raw ? val : esc(val)}</dd>`).join('')}</dl></div>` : ''; };
  const details = group('Tuition', [
      ['Subjects', (s.subjects || []).join(', ')],
      ['Monthly fee', money(currentFee(s))],
      ['Weekly schedule', sl.length ? `${sl.map(x => DAYS3[x.day]).join(', ')} · ${fmtT(sl[0].start)} for ${fmtDur(sl[0].duration)}` : 'No weekly schedule'],
      ['Started', s.startDate ? fmtDate(s.startDate, { day: 'numeric', month: 'short', year: 'numeric' }) : ''],
      ['Location', s.location]])
    + group('School', [['Class / grade', s.grade], ['School / college', s.school]])
    + group('Guardian', [['Name', s.guardianName], ['Phone', s.guardianPhone ? `<a href="tel:${esc(s.guardianPhone)}">${esc(s.guardianPhone)}</a>` : '', true]]);

  return `<a href="#/students" class="btn ghost sm back">${ic('left')}Students</a>`
    + `<header class="phead">${avatar(s, 'lg')}<div class="phead-main"><h1>${esc(s.name)}</h1><div class="tags">${s.grade ? `<span class="tag">${esc(s.grade)}</span>` : ''}${(s.subjects || []).map(x => `<span class="tag">${esc(x)}</span>`).join('')}<span class="badge b-${s.status}">${s.status[0].toUpperCase() + s.status.slice(1)}</span></div></div>
      <div class="phead-acts"><button class="btn" data-act="edit-student" data-id="${esc(id)}">${ic('edit')}Edit</button><button class="btn icon" data-act="student-menu" data-id="${esc(id)}" aria-label="More: pause, finish or delete student" title="Pause, finish or delete">${ic('more')}</button></div></header>`
    + kpis
    + `<div class="pactions" role="group" aria-label="Add for ${esc(s.name)}"><button class="btn pri" data-act="new-class" data-sid="${esc(id)}">${ic('plus')}Add class</button><button class="btn" data-act="new-payment" data-sid="${esc(id)}">${ic('wallet')}Add payment</button><button class="btn" data-act="new-time" data-sid="${esc(id)}">${ic('clock')}Add time</button><button class="btn" data-act="new-note" data-sid="${esc(id)}">${ic('note')}Add note</button></div>`
    + `<div class="grid-dash"><div class="stack">
      <section class="panel" aria-labelledby="p-up"><div class="panel-h"><h2 id="p-up">Upcoming classes</h2><span class="faint" style="font-size:.85rem">Next 3 weeks</span></div><div class="panel-b"><div class="plist">${upcoming.length ? upcoming.map(prow).join('') : `<div class="muted">No upcoming classes. ${sl.length ? '' : 'Add a weekly schedule to generate them automatically.'}</div>`}</div></div></section>
      <section class="panel" aria-labelledby="p-hist"><div class="panel-h wrap"><h2 id="p-hist">Class history</h2><div class="chips"><label class="sr" for="h-sub">Subject</label><select id="h-sub" class="input sm" data-input="h-sub"><option value="">All subjects</option>${subjects.map(x => `<option ${x === ui.prof.hSubject ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select><label class="sr" for="h-st">Status</label><select id="h-st" class="input sm" data-input="h-st"><option value="">All statuses</option>${[['done', 'Completed'], ['cancel', 'Cancelled'], ['resch', 'Rescheduled'], ['miss', 'Not marked']].map(([k, l]) => `<option value="${k}" ${k === ui.prof.hStatus ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div><div class="panel-b">${histHtml}</div></section>
    </div><div class="stack">
      <section class="panel" aria-labelledby="p-det"><div class="panel-h"><h2 id="p-det">Details</h2><button class="btn sm ghost" data-act="edit-student" data-id="${esc(id)}">${ic('edit')}Edit</button></div><div class="panel-b">${details}</div></section>
      <section class="panel" aria-labelledby="p-pay"><div class="panel-h"><h2 id="p-pay">Payments</h2></div><div class="panel-b">
        ${payRows ? `<div class="paylist">${payRows}</div>` : '<div class="muted">No fee months yet.</div>'}
        ${payRecs.length ? `<h3 class="subh">Payment history</h3><div class="list">${payRecs.map(p => `<div class="li"><div class="li-main"><div class="li-t num">${money(p.amount)}</div><div class="li-s">For ${fmtMonth(p.forMonth)}, paid ${fmtDate(p.date)}${p.note ? ` · ${esc(p.note)}` : ''}</div></div><button class="btn sm icon ghost" data-act="edit-payment" data-id="${esc(p.id)}" data-month="${p.forMonth}" aria-label="Edit payment of ${money(p.amount)}" title="Edit payment">${ic('edit')}</button></div>`).join('')}</div>` : ''}
      </div></section>
      <section class="panel" aria-labelledby="p-notes"><div class="panel-h"><h2 id="p-notes">Notes</h2><button class="btn sm ghost" data-act="new-note" data-sid="${esc(id)}">${ic('plus')}Add</button></div><div class="panel-b stack" style="gap:8px">
        ${s.notes ? `<div class="note"><small><span>General</span></small>${esc(s.notes)}</div>` : ''}
        ${notes.map(n => `<div class="note"><small><span>${fmtDate(n.date, { day: 'numeric', month: 'short', year: 'numeric' })}</span><span><button class="btn sm icon ghost" data-act="edit-note" data-sid="${esc(id)}" data-id="${esc(n.id)}" aria-label="Edit note" title="Edit note">${ic('edit')}</button></span></small>${esc(n.text)}</div>`).join('')}
        ${classNotes.map(c => `<div class="note"><small><span>Class note, ${fmtDate(c.date)}</span></small>${esc(c.note)}</div>`).join('')}
        ${!s.notes && !notes.length && !classNotes.length ? '<div class="muted">No notes yet.</div>' : ''}</div></section>
    </div></div>`;
}

