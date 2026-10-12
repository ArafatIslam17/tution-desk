"""Responsive layout harness. Usage: python e2e/layout.py <outdir> [--shots]
Needs `npm run dev` (local preview mode) on port 5173. For every test width, in the empty state and with the built-in
sample data, it measures the shell and fails on: horizontal overflow, sidebar/content overlap, content not using the
available width, cards outside the viewport, content hidden under the mobile bar, and reminders/dialogs not fitting."""
import asyncio, datetime, json, os, sys
from playwright.async_api import async_playwright
URL = 'http://localhost:5173/'
WIDTHS = [(320, 640), (360, 740), (390, 844), (430, 932), (768, 1024), (1024, 768), (1280, 800), (1440, 900), (1763, 832), (1920, 1080), (2560, 1440)]
PAGES = ['', 'calendar', 'classes', 'students', 'student/demo_abdullah', 'time', 'payments', 'university', 'settings']
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/layout'
SHOTS = '--shots' in sys.argv
PROBE = """() => {
  const r = e => { if (!e) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), w: Math.round(b.width) }; };
  const vw = document.documentElement.clientWidth, vh = innerHeight;
  const side = document.querySelector('.side'); const sideOn = side && getComputedStyle(side).display !== 'none';
  const main = document.querySelector('.main'); const inner = main && (main.querySelector(':scope > .page') || main);
  const kids = inner ? [...inner.children].filter(e => getComputedStyle(e).display !== 'none') : [];
  const contentRight = Math.max(0, ...kids.map(k => k.getBoundingClientRect().right));
  const contentLeft = Math.min(vw, ...kids.map(k => k.getBoundingClientRect().left));
  const areaL = sideOn ? side.getBoundingClientRect().right : 0;
  const nav = document.querySelector('.bnav'); const navOn = nav && getComputedStyle(nav).display !== 'none';
  const offscreen = [...document.querySelectorAll('.kpi, .panel, .stu-card, .btn')].filter(e => { const b = e.getBoundingClientRect(); return b.width && (b.left < -1 || b.right > vw + 1); }).map(e => e.className.slice(0, 40));
  return { vw, overflow: document.documentElement.scrollWidth - vw, side: sideOn ? r(side) : null, main: r(main),
    contentLeft: Math.round(contentLeft), contentRight: Math.round(contentRight), leftGap: Math.round(contentLeft - areaL), rightGap: Math.round(vw - contentRight),
    overlap: sideOn && main ? Math.max(0, side.getBoundingClientRect().right - main.getBoundingClientRect().left) : 0,
    kpiCols: new Set([...document.querySelectorAll('.kpis .kpi')].map(k => Math.round(k.getBoundingClientRect().left))).size,
    navTop: navOn ? Math.round(nav.getBoundingClientRect().top) : null, mainPadBottom: main ? parseFloat(getComputedStyle(main).paddingBottom) : 0, navH: navOn ? nav.offsetHeight : 0,
    offscreen,
    smallTargets: matchMedia('(pointer: coarse)').matches ? [...document.querySelectorAll('.btn, .bnav a, .bnav button, .fab, .nav a')].filter(e => { const b = e.getBoundingClientRect(); return b.width && b.height && b.top < vh && b.bottom > 0 && (b.height < 40 || b.width < 40); }).map(e => (e.textContent.trim() || e.getAttribute('aria-label') || e.className).slice(0, 30)) : [] };
}"""
async def main():
    os.makedirs(OUT, exist_ok=True); problems = []; report = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None)
        for w, h in WIDTHS:
            mobile = w <= 1024  # phones and tablets are touch devices (pointer: coarse)
            ctx = await b.new_context(viewport={'width': w, 'height': h}, color_scheme='dark', is_mobile=mobile, has_touch=mobile)
            pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.clock.install(time=datetime.datetime(2026, 10, 13, 15, 0))
            await pg.goto(URL); await pg.wait_for_timeout(500); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(600)
            for state in ['empty', 'sample']:
                if state == 'sample':
                    await pg.evaluate('loadDemo()'); await pg.wait_for_timeout(500); await pg.evaluate("document.getElementById('toasts').innerHTML=''")
                for page in (PAGES if state == 'sample' else ['', 'students', 'payments', 'time']):
                    await pg.goto(URL + '#/' + page); await pg.wait_for_timeout(350)
                    m = await pg.evaluate(PROBE); key = f'{w}/{state}/{page or "home"}'; report[key] = m
                    avail = m['vw'] - (m['side']['r'] if m['side'] else 0)
                    if m['overflow'] > 0: problems.append(f'{key}: horizontal overflow {m["overflow"]}px')
                    if m['overlap'] > 0: problems.append(f'{key}: sidebar overlaps content')
                    if m['offscreen']: problems.append(f'{key}: outside viewport {m["offscreen"][:3]}')
                    if abs(m['rightGap'] - m['leftGap']) > 48: problems.append(f'{key}: lopsided margins (left {m["leftGap"]}px, right {m["rightGap"]}px)')
                    if m['smallTargets']: problems.append(f'{key}: touch targets under 40px {m["smallTargets"][:4]}')
                    if m['navTop'] and m['mainPadBottom'] < m['navH']: problems.append(f'{key}: content can hide under bottom bar')
                    if SHOTS and page in ('', 'calendar', 'student/demo_abdullah', 'payments') and w in (390, 1024, 1440, 1763, 2560):
                        await pg.screenshot(path=f'{OUT}/{state}-{(page or "home").replace("/", "_")}-{w}.png')
            # reminders panel + a form dialog must fit
            await pg.goto(URL + '#/'); await pg.wait_for_timeout(300)
            await pg.click('[data-act=bell]'); await pg.wait_for_timeout(300)
            fits = await pg.evaluate("(()=>{const p=document.querySelector('#bellpop .pop');if(!p)return false;const b=p.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&b.top>=0&&b.bottom<=innerHeight})()")
            if not fits: problems.append(f'{w}: reminders panel does not fit')
            await pg.keyboard.press('Escape'); await pg.goto(URL + '#/students'); await pg.wait_for_timeout(300)
            await pg.click('button[data-act=new-student] >> nth=0'); await pg.wait_for_timeout(300)
            dlg = await pg.evaluate("(()=>{const d=document.getElementById('dlg').getBoundingClientRect(),s=document.querySelector('#dlg [type=submit]').getBoundingClientRect();return {fits:d.left>=0&&d.right<=innerWidth&&d.top>=0&&d.bottom<=innerHeight+1, submitVisible:s.bottom<=innerHeight&&s.top>=0}})()")
            if not (dlg['fits'] and dlg['submitVisible']): problems.append(f'{w}: dialog {dlg}')
            await pg.keyboard.press('Escape')
            if errs: problems.append(f'{w}: page errors {errs[:2]}')
            await ctx.close()
        await b.close()
    json.dump(report, open(f'{OUT}/metrics.json', 'w'), indent=1)
    for w, _ in WIDTHS:
        m = report[f'{w}/sample/home']
        print(f"{w:>5}px  side {m['side']['w'] if m['side'] else '—':>4}  content {m['contentLeft']:>4}→{m['contentRight']:<4}  left gap {m['leftGap']:>4}  right gap {m['rightGap']:>4}  KPI cols {m['kpiCols']}  overflow {m['overflow']}")
    print(f'\n{len(problems)} problem(s)'); [print('  -', x) for x in problems[:60]]
    sys.exit(1 if problems else 0)
asyncio.run(main())
