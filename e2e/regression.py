import os, pathlib, tempfile
import asyncio, datetime, json
from playwright.async_api import async_playwright
URL='http://localhost:5173/'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None)
        ctx=await b.new_context(viewport={'width':1300,'height':900}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.clock.install(time=datetime.datetime(2026,10,10,12,0))
        await pg.goto(URL); await pg.wait_for_timeout(300); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(300)
        ok=lambda name,v: print(('PASS ' if v else 'FAIL ')+name)
        # students
        await pg.goto(URL+'#/students'); await pg.wait_for_timeout(200)
        await pg.click('button[data-act=new-student] >> nth=0'); await pg.click('dialog button[type=submit]'); await pg.wait_for_timeout(100)
        ok('student name required', 'name' in (await pg.inner_text('#e-name')).lower())
        await pg.fill('#f-name','Test Student'); await pg.fill('#f-fee','6000'); await pg.fill('#f-subjects','Math, Physics'); await pg.fill('#f-startDate','2026-09-01')
        await pg.check('input[name=day][value="1"]',force=True); await pg.fill('#f-start','17:00'); await pg.click('dialog button[type=submit]'); await pg.wait_for_timeout(400)
        sid=await pg.evaluate("Object.values(S.students).find(s=>s.name==='Test Student').id"); ok('student created + profile opened', sid in pg.url)
        await pg.click('button[data-act=edit-student] >> nth=0'); await pg.fill('#f-name','Test Student B'); await pg.click('dialog button[type=submit]'); await pg.wait_for_timeout(300)
        ok('student edited', await pg.evaluate(f"S.students['{sid}'].name")=='Test Student B')
        await pg.goto(URL+'#/students'); await pg.wait_for_timeout(200); await pg.fill('#stu-q','B'); await pg.wait_for_timeout(200)
        ok('search', await pg.locator('.stu-card').count()==1)
        # recurring classes + history + time
        n=await pg.evaluate(f"occurrences('2026-09-01','2026-10-10',{{studentId:'{sid}'}}).length"); ok(f'recurring Mondays generated ({n}; 7,14,21,28 Sep + 5 Oct)', n==5)
        await pg.evaluate(f"setStatus(occurrences('2026-10-05','2026-10-05',{{studentId:'{sid}'}})[0].id,'2026-10-05','completed')"); await pg.wait_for_timeout(300)
        ok('completed class counts End-Start (1h30)', await pg.evaluate(f"fmtDur(totalsBy(timesIn('2026-10-01','2026-10-31','{sid}')).total)")=='1h 30m')
        await pg.goto(URL+f'#/student/{sid}'); await pg.wait_for_timeout(300)
        ok('class history shows it', '1h 30m' in await pg.inner_text('#p-hist + .panel-b, section[aria-labelledby=p-hist]'))
        ok('profile classes completed = 1', (await pg.inner_text('.kpis .kpi:first-child .kpi-v'))=='1')
        # payments
        await pg.click('button[data-act=new-payment] >> nth=0'); await pg.wait_for_timeout(200); await pg.fill('#f-amount','2000'); await pg.fill('#f-forMonth','2026-09'); await pg.click('dialog button[type=submit]'); await pg.wait_for_timeout(300)
        ok('payment saved; Sept due 4,000 on profile Due card', '4,000' in await pg.inner_text('.kpis .kpi:last-child'))
        await pg.evaluate("ui.pay.month='2026-09'"); await pg.goto(URL+'#/payments'); await pg.wait_for_timeout(300)
        ok('payments page shows partial', 'Partially paid' in await pg.inner_text('.tbl'))
        ok('payment history intact', await pg.evaluate("Object.values(S.months['2026-09'].payments).length")==1)
        # university
        await pg.goto(URL+'#/university'); await pg.wait_for_timeout(200); await pg.click('button[data-act=new-uni] >> nth=0'); await pg.fill('#f-name','DSP'); await pg.select_option('#f-day','1'); await pg.fill('#f-start','16:30'); await pg.fill('#f-end','18:00'); await pg.wait_for_timeout(100)
        ok('university form warns about tuition clash', 'Test Student B' in await pg.inner_text('#uni-warn'))
        await pg.click('dialog button[type=submit]'); await pg.wait_for_timeout(300); ok('university saved', await pg.locator('.uni-row').count()==1)
        ok('no "unavailable" wording on university page', 'unavailable' not in (await pg.inner_text('main')).lower())
        # backup
        await pg.goto(URL+'#/settings'); await pg.wait_for_timeout(200)
        async with pg.expect_download() as di: await pg.click('button[data-act=export]')
        d=await di.value; await d.save_as(str(pathlib.Path(tempfile.gettempdir()) / 'td-e2e-backup.json')); bk=json.load(open(str(pathlib.Path(tempfile.gettempdir()) / 'td-e2e-backup.json'))); ok('backup export has data', len(bk['students'])==1 and len(bk['university'])==1)
        open(str(pathlib.Path(tempfile.gettempdir()) / 'td-e2e-backup.json'),'w').write(json.dumps(bk))
        await pg.evaluate(f"delete S.students['{sid}']; saveStudent('{sid}')"); await pg.wait_for_timeout(300)
        async with pg.expect_file_chooser() as fc: await pg.click('button[data-act=import]')
        await (await fc.value).set_files(str(pathlib.Path(tempfile.gettempdir()) / 'td-e2e-backup.json')); await pg.wait_for_timeout(300)
        await pg.uncheck('input[name=safety]'); await pg.click('dialog button[type=submit]'); await pg.wait_for_timeout(1200)
        ok('restore brings student back', sid in await pg.evaluate("Object.keys(S.students)"))
        await pg.reload(); await pg.wait_for_timeout(600); ok('persists after refresh', sid in await pg.evaluate("Object.keys(S.students)"))
        # delete student
        await pg.goto(URL+f'#/student/{sid}'); await pg.wait_for_timeout(300); await pg.click('button[data-act=student-menu]'); await pg.click('[data-sm=delete]'); await pg.click('dialog button[type=submit]'); await pg.wait_for_timeout(400)
        ok('student deleted with records', sid not in await pg.evaluate("Object.keys(S.students)") and not await pg.evaluate(f"Object.values(S.months).some(m=>Object.values(m.payments).some(p=>p.studentId==='{sid}'))"))
        print('errors:', errs); await ctx.close()
        # mobile nav
        ctx=await b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True); pg=await ctx.new_page()
        await pg.goto(URL); await pg.wait_for_timeout(400)
        await pg.click('.bnav a[href="#/calendar"]'); await pg.wait_for_timeout(200); c1='calendar' in pg.url
        await pg.click('.bnav [data-act=more-sheet]'); await pg.wait_for_timeout(200); await pg.click('dialog a[href="#/time"]'); await pg.wait_for_timeout(300)
        ok('mobile bottom nav + More sheet', c1 and 'time' in pg.url)
        await ctx.close(); await b.close()
asyncio.run(main())
