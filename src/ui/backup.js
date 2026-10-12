/* ================= Backup & restore ================= */
import { buildBackup, validateBackup } from '../lib/backup.js';
import { migrateLinkedTimes } from '../lib/domain.js';
import { DEFAULT_PROFILE, S } from '../lib/state.js';
import { Store } from '../lib/store.js';
import { esc, todayStr } from '../lib/utils.js';
import { closeModal, modal, toast } from './modal.js';
import { scheduleRender } from './shell.js';
export async function exportBackup() {
  const data = JSON.stringify(buildBackup(), null, 2); const name = `tuition-backup-${todayStr()}.json`;
  try {
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Backup downloaded'); return true;
  } catch {
    modal({ title: 'Copy your backup', body: `<p class="muted" style="margin-top:0">The download didn't start. Copy this text into a file named <b>${name}</b>.</p><textarea class="input" rows="10" readonly style="font-size:.78rem">${esc(data)}</textarea>`, submit: 'Copy', onSubmit: () => { navigator.clipboard?.writeText(data).then(() => toast('Copied')); return false; } });
    return false;
  }
}
export function importBackup(file) {
  if (!file) return;
  if (file.size > 20 * 1024 * 1024) return toast('That file is too large to be a backup.', { bad: true });
  const r = new FileReader();
  r.onerror = () => toast('The file could not be read.', { bad: true });
  r.onload = () => {
    let b; try { b = validateBackup(JSON.parse(r.result)); } catch (e) { return toast(e instanceof SyntaxError ? 'The file is not valid JSON.' : e.message, { bad: true, ms: 6000 }); }
    let cls = 0, pay = 0, tm = 0; for (const m of Object.values(b.months)) { cls += Object.keys(m.classes || {}).length; pay += Object.keys(m.payments || {}).length; tm += Object.keys(m.times || {}).length; }
    modal({
      title: 'Restore this backup?', cls: 'bad', submit: 'Replace my data',
      body: `<div class="fgrid"><div class="infobox">Backup from ${esc(new Date(b.exportedAt).toLocaleString('en-GB'))}: ${b.students.length} students, ${cls} class records, ${tm} time records, ${pay} payments, ${b.university.length} university classes.</div>
        <p style="margin:0"><b>This may replace existing data. Continue?</b> Everything currently saved will be replaced by the backup.</p>
        <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="safety" checked> Download a backup of my current data first</label></div>`,
      onSubmit: form => { const safety = form.elements.safety.checked; closeModal(); doRestore(b, safety); },
    });
  };
  r.readAsText(file);
}
export async function doRestore(b, safety) {
  if (safety && (Object.keys(S.students).length || Object.keys(S.months).length)) { const ok = await exportBackup(); if (!ok) { toast('Restore stopped because the safety backup was not saved.', { bad: true, ms: 6000 }); return; } }
  toast('Restoring…', { ms: 6000 });
  await replaceAll({ profile: { ...DEFAULT_PROFILE, ...(b.profile || {}) }, students: Object.fromEntries(b.students.map(s => [s.id, s])), uni: Object.fromEntries(b.university.map(u => [u.id, u])), months: b.months });
  migrateLinkedTimes(); toast('Backup restored'); location.hash = '#/'; scheduleRender();
}
export async function replaceAll(next) {
  const old = { students: Object.keys(S.students), uni: Object.keys(S.uni), months: Object.keys(S.months) };
  S.profile = next.profile; S.students = next.students; S.uni = next.uni; S.months = next.months;
  const jobs = [['app', 'app']];
  for (const k of ['students', 'uni', 'months']) { const ids = new Set([...old[k], ...Object.keys(next[k])]); ids.forEach(id => jobs.push([k, id])); }
  for (let i = 0; i < jobs.length; i += 8) await Promise.all(jobs.slice(i, i + 8).map(([k, id]) => Store.save(k, id)));
  await Store.flush(); scheduleRender();
}

