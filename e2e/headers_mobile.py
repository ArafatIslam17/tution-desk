import os, pathlib, tempfile
import asyncio, datetime
from playwright.async_api import async_playwright
URL='http://localhost:5173/'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None)
        pg=await (await b.new_context(viewport={'width':360,'height':700},is_mobile=True,has_touch=True)).new_page()
        await pg.clock.install(time=datetime.datetime(2026,10,10,15,0))
        await pg.goto(URL); await pg.wait_for_timeout(300); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(300)
        await pg.evaluate('loadDemo()'); await pg.wait_for_timeout(400)
        for r in ['','calendar','classes','students','student/demo_nusrat','time','payments','university','settings']:
            await pg.goto(URL+'#/'+r); await pg.wait_for_timeout(250)
            res=await pg.evaluate("""(()=>{const t=document.querySelector('.topbar, .phead'); if(!t) return 'no header'; const W=innerWidth; const bad=[...t.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.right>W-8||r.left<8)}).map(e=>e.tagName+'.'+e.className).slice(0,3);
              const h1=t.querySelector('h1'); const btns=[...t.querySelectorAll('.top-actions .btn')].filter(b=>getComputedStyle(b).display!=='none').map(b=>Math.round(b.getBoundingClientRect().width));
              return {overflowPx:document.documentElement.scrollWidth-W, clipped:bad, h1w:h1?Math.round(h1.getBoundingClientRect().width):null, h1lines:h1?Math.round(h1.getBoundingClientRect().height/parseFloat(getComputedStyle(h1).lineHeight)):null, btnW:btns}})()""")
            print((r or 'home').ljust(22), res)
        await pg.goto(URL+'#/payments'); await pg.wait_for_timeout(200); await pg.screenshot(path='/tmp/hdr_pay.png',clip={'x':0,'y':0,'width':360,'height':200})
        await b.close()
asyncio.run(main())
