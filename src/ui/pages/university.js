/* ================= University ================= */
import { S } from '../../lib/state.js';
import { DAYS, esc, fmtT } from '../../lib/utils.js';
import { ic } from '../icons.js';
import { emptyState, topbar } from '../shell.js';
export function vUni() {
  const ws = Number(S.profile.weekStart ?? 6); const order = [0, 1, 2, 3, 4, 5, 6].map(i => (ws + i) % 7);
  const all = Object.values(S.uni);
  const groups = order.map(d => [d, all.filter(u => Number(u.day) === d).sort((a, b) => a.start.localeCompare(b.start))]).filter(g => g[1].length);
  return topbar('University schedule', 'Your university class times. They appear on the calendar and in clash warnings.', `<button class="btn uni" data-act="new-uni">${ic('plus')}Add university class</button>`)
    + `<div class="panel"><div class="panel-b" style="padding-top:18px">${groups.length ? groups.map(([d, us]) => `<h3 class="day-head">${DAYS[d]}</h3><div class="stack" style="gap:8px">${us.map(u => `<div class="uni-row" data-act="edit-uni" data-id="${esc(u.id)}" role="button" tabindex="0"><span class="num" style="min-width:150px"><b>${fmtT(u.start)}</b> – ${fmtT(u.end)}</span><span style="flex:1"><b>${esc(u.name)}</b>${u.code ? ` <span class="faint">${esc(u.code)}</span>` : ''}${u.room ? ` <span class="faint">· ${esc(u.room)}</span>` : ''}</span>${ic('edit')}</div>`).join('')}</div>`).join('')
      : emptyState('uni', 'No university classes added', 'Add your class times so they show on the calendar and tuition clashes are flagged.', `<button class="btn uni" data-act="new-uni">${ic('plus')}Add university class</button>`, { tone: 'uni' })}</div></div>`;
}

