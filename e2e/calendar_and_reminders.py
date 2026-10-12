import os, pathlib, tempfile
import asyncio, datetime, json
from playwright.async_api import async_playwright
URL='http://localhost:5173/'
EXE=os.environ.get('CHROMIUM_PATH') or None
SNAP="""(()=>{const wk=document.querySelector('.wk'); const evs={}; document.querySelectorAll('.wk .ev[data-id]').forEach(e=>{evs[e.dataset.id]=e.style.top+'|'+e.style.left+'|'+e.style.width}); return {sc:wk?Math.round(wk.scrollTop):null, win:Math.round(scrollY), h:document.querySelector('.wk-col')?.offsetHeight, view:ui.cal.view, date:ui.cal.date, evs}})()"""
def cmp(a,b,changed):
    moved=[k for k in b['evs'] if k in a['evs'] and a['evs'][k]!=b['evs'][k] and k not in changed]
    return f"scroll {a['sc']}->{b['sc']} | grid h {a['h']}->{b['h']} | view {a['view']} {a['date']}->{b['view']} {b['date']} | other events moved: {len(moved)}"
async def click(pg,sel): await pg.evaluate(f"document.querySelector({json.dumps(sel)}).click()"); await pg.wait_for_timeout(200)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=EXE)
        ctx=await b.new_context(viewport={'width':1300,'height':800},color_scheme='dark'); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.clock.install(time=datetime.datetime(2026,10,10,15,0))
        await pg.goto(URL); await pg.wait_for_timeout(300); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(300)
        await pg.evaluate('loadDemo()'); await pg.wait_for_timeout(500)
        await pg.goto(URL+'#/calendar'); await pg.wait_for_timeout(400); await click(pg,'button[data-v=week]')
        await pg.evaluate("document.querySelector('.wk').scrollTop=260"); await pg.wait_for_timeout(100)
        print('== CALENDAR (week view)')
        # ADD via toolbar button
        a=await pg.evaluate(SNAP); await click(pg,'button[data-act=new-class]')
        await pg.select_option('#f-studentId','demo_ayan'); await pg.fill('#f-date','2026-10-13'); await pg.fill('#f-start','11:00'); await pg.fill('#f-end','12:00')
        await pg.click('dialog button[type=submit]'); await pg.wait_for_timeout(400); b2=await pg.evaluate(SNAP)
        newid=[k for k in b2['evs'] if k not in a['evs']]
        print(' add      :', cmp(a,b2,newid), '| new event shown:', len(newid)==1, '| fade-in class:', await pg.evaluate(f"document.querySelector('.ev[data-id=\"{newid[0]}\"]').classList.contains('entering')"))
        # EDIT it
        a=b2; await click(pg,f'.ev[data-id="{newid[0]}"]'); await click(pg,'dialog button[data-act=edit-class]')
        await pg.fill('#f-end','12:30'); await pg.click('dialog button[type=submit]'); await pg.wait_for_timeout(400); b2=await pg.evaluate(SNAP)
        print(' edit     :', cmp(a,b2,newid), '| height changed for edited only:', a['evs'][newid[0]]!=b2['evs'][newid[0]])
        # after another render, animation must not replay
        await pg.clock.run_for(61000); await pg.wait_for_timeout(200)
        print(' no replay after clock refresh:', not await pg.evaluate("!!document.querySelector('.ev.entering')"), '| scroll still', await pg.evaluate("document.querySelector('.wk').scrollTop"))
        # COMPLETE a scheduled one
        sid=await pg.evaluate("[...document.querySelectorAll('.wk .ev[data-id]:not(.u):not(.done):not(.cancel)')].map(e=>e.dataset.id).find(id=>id!=='%s')"%newid[0])
        a=await pg.evaluate(SNAP); await click(pg,f'.ev[data-id="{sid}"]'); await click(pg,'dialog button[data-act=complete]'); await pg.wait_for_timeout(300); b2=await pg.evaluate(SNAP)
        print(' complete :', cmp(a,b2,[sid]), '| now done:', await pg.evaluate(f"document.querySelector('.ev[data-id=\"{sid}\"]').classList.contains('done')"))
        # CANCEL
        cid=await pg.evaluate("[...document.querySelectorAll('.wk .ev[data-id]:not(.u):not(.done):not(.cancel)')].map(e=>e.dataset.id)[0]")
        a=await pg.evaluate(SNAP); await click(pg,f'.ev[data-id="{cid}"]'); await click(pg,'dialog button[data-act=cancel-class]'); await pg.wait_for_timeout(300); b2=await pg.evaluate(SNAP)
        print(' cancel   :', cmp(a,b2,[cid]))
        # RESCHEDULE within the week
        rid=await pg.evaluate("[...document.querySelectorAll('.wk .ev[data-id]:not(.u):not(.done):not(.cancel)')].map(e=>e.dataset.id).find(id=>id.startsWith('r_')&&id.includes('2026-10-1'))")
        a=await pg.evaluate(SNAP); await click(pg,f'.ev[data-id="{rid}"]'); await click(pg,'dialog button[data-act=reschedule]')
        await pg.fill('#f-date','2026-10-15'); await pg.fill('#f-start','08:00'); await pg.fill('#f-end','09:00'); await pg.click('dialog button[type=submit]'); await pg.wait_for_timeout(400); b2=await pg.evaluate(SNAP)
        newk=[k for k in b2['evs'] if k not in a['evs']]; mv=[(k,a['evs'][k],b2['evs'][k]) for k in b2['evs'] if k in a['evs'] and a['evs'][k]!=b2['evs'][k]]
        print('   moved detail:', mv, '| original:', rid, a['evs'].get(rid))
        print(' resched  :', cmp(a,b2,[rid]+[k for k in b2['evs'] if k not in a['evs']]), '| original gone, new shown:', rid not in b2['evs'], len([k for k in b2['evs'] if k not in a['evs']])==1)
        # DELETE
        did=await pg.evaluate("[...document.querySelectorAll('.wk .ev[data-id]:not(.u)')].map(e=>e.dataset.id)[1]")
        a=await pg.evaluate(SNAP); await click(pg,f'.ev[data-id="{did}"]'); await click(pg,'dialog button[data-act=delete-class]')
        await pg.click('dialog button[type=submit]'); await pg.wait_for_timeout(60); leaving=await pg.evaluate(f"!!document.querySelector('.ev[data-id=\"{did}\"].leaving')")
        await pg.wait_for_timeout(400); b2=await pg.evaluate(SNAP)
        print(' delete   :', cmp(a,b2,[did]), '| faded out first:', leaving, '| removed:', did not in b2['evs'])
        # VIEW SWITCHING keeps date
        await click(pg,'button[data-act=cal-nav][data-d="1"]'); d=await pg.evaluate("ui.cal.date")
        await click(pg,'button[data-v=month]'); m=await pg.evaluate("ui.cal.view+' '+ui.cal.date"); await click(pg,'button[data-v=day]'); dd=await pg.evaluate("ui.cal.view+' '+ui.cal.date")
        print(' views    : next week ->', d, '| month:', m, '| day:', dd)
        # day view now-line focus on first entry
        await click(pg,'button[data-act=cal-nav][data-d="0"]'); print(' day view shows now-line in grid viewport:', await pg.evaluate("(()=>{const wk=document.querySelector('.wk'),n=wk.querySelector('.nowline');const t=n.offsetTop+wk.querySelector('.wk-head').offsetHeight-wk.scrollTop;return t>0&&t<wk.clientHeight})()"))
        # month view delete: no layout jump of page
        await click(pg,'button[data-v=month]'); y0=await pg.evaluate("scrollY")
        legend=await pg.inner_text('.legend'); print('== LEGEND:', legend.replace('\n',' | '))
        # conflict detection with university still works
        await pg.evaluate("classForm({sid:'demo_abdullah',date:todayStr()})"); await pg.wait_for_timeout(150)
        await pg.fill('#f-start','10:15'); await pg.fill('#f-end','11:00'); await pg.wait_for_timeout(100)
        print('== CONFLICT with university:', (await pg.inner_text('#cls-warn')).replace('\n',' ')[:110]); await pg.keyboard.press('Escape')
        print('errors:', errs); await ctx.close()

        print('\n== NOTIFICATIONS')
        for w,h,mob in [(1300,800,False),(390,844,True),(360,640,True),(820,1180,True)]:
            ctx=await b.new_context(viewport={'width':w,'height':h},is_mobile=mob,has_touch=mob,color_scheme='dark'); pg=await ctx.new_page()
            await pg.clock.install(time=datetime.datetime(2026,10,10,15,0))
            await pg.goto(URL); await pg.wait_for_timeout(300); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(300)
            await pg.evaluate('loadDemo()'); await pg.wait_for_timeout(400); await pg.evaluate("document.getElementById('toasts').innerHTML=''")
            # many reminders: add unmarked classes to make list long
            await pg.goto(URL+'#/'); await pg.wait_for_timeout(300)
            badge0=await pg.evaluate("document.querySelector('[data-act=bell] .dotn')?.textContent||'0'")
            await pg.click('[data-act=bell]'); await pg.wait_for_timeout(300)
            r=await pg.evaluate("""(()=>{const p=document.querySelector('#bellpop .pop').getBoundingClientRect(),b=document.querySelector('[data-act=rem-read-all]').getBoundingClientRect(),nav=document.querySelector('.bnav');const nb=nav&&getComputedStyle(nav).display!=='none'?nav.getBoundingClientRect().top:innerHeight;
              const top=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);
              return {inside:p.left>=0&&p.right<=innerWidth&&p.top>=0&&p.bottom<=nb, markAllVisibleAndOnTop:top&&top.closest('[data-act=rem-read-all]')!=null, listScrolls:getComputedStyle(document.querySelector('.pop-list')).overflowY}})()""")
            await pg.screenshot(path=f'/tmp/bell_{w}.png')
            await pg.click('[data-act=rem-read-all]'); await pg.wait_for_timeout(300)
            badge1=await pg.evaluate("document.querySelector('[data-act=bell] .dotn')?.textContent||'0'")
            unreadRows=await pg.locator('#bellpop .rem.unread').count(); disabled=await pg.is_disabled('[data-act=rem-read-all]')
            stored=len(await pg.evaluate("JSON.parse(localStorage['tuition-desk-local-v1'])['app/app'].readReminders||{}"))
            await pg.reload(); await pg.wait_for_timeout(500); await pg.goto(URL+'#/'); await pg.wait_for_timeout(300)
            badge2=await pg.evaluate("document.querySelector('[data-act=bell] .dotn')?.textContent||'0'")
            await pg.click('[data-act=bell]'); await pg.wait_for_timeout(200)
            closed=None
            if mob:
                await pg.mouse.click(w//2,40); await pg.wait_for_timeout(250); closed=await pg.locator('#bellpop .pop').count()==0
            print(f' {w}px: {r} | badge {badge0} -> {badge1} | unread rows {unreadRows} | button disabled {disabled} | saved keys {stored} | after refresh badge {badge2}'+(f' | tap outside closes {closed}' if mob else ''))
            await ctx.close()
        await b.close()
asyncio.run(main())
