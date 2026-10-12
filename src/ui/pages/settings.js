/* ================= Settings ================= */


import { mode } from '../../lib/backend.js';

import { S } from '../../lib/state.js';
import { Store } from '../../lib/store.js';
import { DAYS, esc } from '../../lib/utils.js';
import { ic } from '../icons.js';

import { topbar } from '../shell.js';
export function vSettings() {
  const p = S.profile; const hasDemo = Object.values(S.students).some(s => s.demo) || Object.values(S.uni).some(u => u.demo);
  const counts = { students: Object.keys(S.students).length, classes: 0, payments: 0, times: 0 };
  for (const m of Object.values(S.months)) { counts.classes += Object.values(m.classes || {}).filter(c => !c.deleted).length; counts.payments += Object.keys(m.payments || {}).length; counts.times += Object.keys(m.times || {}).length; }
  return topbar('Settings & backup', '')
    + `<div class="grid-dash"><div class="stack">
      <section class="panel"><div class="panel-h"><h2>Preferences</h2></div><form class="panel-b fgrid" id="prefs" data-form="prefs" novalidate>
        <div class="field"><label for="p-name">Your name</label><input id="p-name" name="name" class="input" value="${esc(p.name)}" maxlength="60" placeholder="Used in the greeting"></div>
        <div class="frow"><div class="field"><label for="p-cur">Currency symbol</label><input id="p-cur" name="currency" class="input" value="${esc(p.currency)}" maxlength="4"></div>
        <div class="field"><label for="p-ws">Week starts on</label><select id="p-ws" name="weekStart" class="input">${[6, 0, 1].map(d => `<option value="${d}" ${Number(p.weekStart) === d ? 'selected' : ''}>${DAYS[d]}</option>`).join('')}</select></div></div>
        <div class="frow"><div class="field"><label for="p-due">Payment reminder from day</label><input id="p-due" name="dueDay" type="number" min="1" max="28" class="input" value="${esc(p.dueDay)}"><span class="hint">Due reminders show from this day of each month.</span></div>
        <div class="field"><label for="p-th">Theme</label><select id="p-th" name="theme" class="input">${[['system', 'Match device'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<option value="${k}" ${p.theme === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
        <div><button class="btn pri" type="submit">Save preferences</button></div></form></section>
      <section class="panel"><div class="panel-h"><h2>Account</h2></div><div class="panel-b">
        ${mode === 'local' ? `<p class="muted" style="margin-top:0;font-size:.92rem">Local preview mode: data is kept only in this browser. Configure Supabase (see README) before using the app for real.</p>`
          : `<p style="margin-top:0">Signed in as <b>${esc(Store.user?.email || '')}</b></p><p class="muted" style="font-size:.92rem">Your data is stored in your own account. Database rules only let your login read or change it.</p>
        <div class="toolbar" style="margin:0"><button class="btn" data-act="change-password">Change password</button><button class="btn" data-act="sign-out">Sign out</button></div>`}
      </div></section>
    </div><div class="stack">
      <section class="panel"><div class="panel-h"><h2>Backup & restore</h2></div><div class="panel-b">
        <p class="muted" style="margin-top:0;font-size:.92rem">Your data is saved automatically. A backup file is an extra copy you keep: ${counts.students} students, ${counts.classes} class records, ${counts.times} time records and ${counts.payments} payments right now.</p>
        <div class="toolbar" style="margin:0"><button class="btn pri" data-act="export">${ic('down')}Export backup</button><button class="btn" data-act="import">${ic('up')}Restore from backup</button></div>
        <input type="file" id="import-file" accept=".json,application/json" class="sr" tabindex="-1" aria-hidden="true">
      </div></section>
      <section class="panel"><div class="panel-h"><h2>Sample data</h2></div><div class="panel-b">
        <p class="muted" style="margin-top:0;font-size:.92rem">Sample students (Abdullah, Rahim, Nusrat, Ayan) with classes, times and payments. Everything sample is tagged and can be removed in one step without touching your own data.</p>
        ${hasDemo ? `<button class="btn" data-act="demo-remove">${ic('trash')}Remove sample data</button>` : `<button class="btn" data-act="demo-load">Load sample data</button>`}
      </div></section>
      <section class="panel"><div class="panel-h"><h2>Delete everything</h2></div><div class="panel-b">
        <p class="muted" style="margin-top:0;font-size:.92rem">Permanently removes all students, classes, times, payments and university entries. Export a backup first.</p>
        <button class="btn bad-t" data-act="wipe">${ic('trash')}Delete all data</button></div></section>
    </div></div>`;
}
