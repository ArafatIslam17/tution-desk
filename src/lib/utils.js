/* ================= Utilities ================= */


import { S } from './state.js';
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5);
export const pad = n => String(n).padStart(2, '0');
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return ymd(d); };
export const todayStr = () => ymd(new Date());
export const monthOf = s => s.slice(0, 7);
export const curMonth = () => monthOf(todayStr());
export const addMonths = (m, n) => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
export const monthFirst = m => m + '-01';
export const monthLast = m => { const [y, mo] = m.split('-').map(Number); return ymd(new Date(y, mo, 0)); };
export const monthsBetween = (a, b) => { const out = []; let m = monthOf(a); const e = monthOf(b); let g = 0; while (m <= e && g++ < 600) { out.push(m); m = addMonths(m, 1); } return out; };
export const eachDay = (a, b) => { const out = []; let d = a; let g = 0; while (d <= b && g++ < 4000) { out.push(d); d = addDays(d, 1); } return out; };
export const dow = s => parseD(s).getDay();
export const isTime = t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t || '');
export const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(parseD(s));
export const isMonth = s => /^\d{4}-(0[1-9]|1[0-2])$/.test(s || '');
export const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const fromMin = m => pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60);
export const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAYS3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function fmtT(t) { if (!isTime(t)) return '—'; let [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${pad(m)} ${ap}`; }
export function fmtDur(min) { min = Math.round(min || 0); if (min <= 0) return '0m'; const h = Math.floor(min / 60), m = min % 60; return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`; }
export function fmtDate(s, o = { weekday: 'short', day: 'numeric', month: 'short' }) { return parseD(s).toLocaleDateString('en-GB', o); }
export function fmtMonth(m) { const [y, mo] = m.split('-').map(Number); return `${MONTHS[mo - 1]} ${y}`; }
export function relDay(s) { const t = todayStr(); if (s === t) return 'Today'; if (s === addDays(t, 1)) return 'Tomorrow'; if (s === addDays(t, -1)) return 'Yesterday'; return fmtDate(s, { weekday: 'long', day: 'numeric', month: 'short' }); }
export function money(n) { const c = S.profile.currency || '৳'; const v = Math.round(Number(n) || 0); return c + v.toLocaleString('en-IN'); }
export const overlap = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;
export const AVCOLORS = ['#7657CF', '#0E9B78', '#DB7420', '#3A6BD4', '#C2417A', '#2F8F9D', '#8A6D1E', '#5B6BD6', '#B4513A', '#4D8B31'];

