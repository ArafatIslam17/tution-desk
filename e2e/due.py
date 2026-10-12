import os, pathlib, tempfile
import asyncio, datetime, json
from playwright.async_api import async_playwright
URL='http://localhost:5173/'
def stu(i,name,fee,start='2026-08-01'):
    return f"S.students['{i}']={{id:'{i}',name:'{name}',status:'active',statusSince:'{start}',startDate:'{start}',subjects:['Math'],fees:[{{from:'{start[:7]}',amount:{fee}}}],schedules:[],noteLog:[],color:'#7657CF'}}; saveStudent('{i}');"
def pay(sid,m,amt,k): return f"month('{m}').payments['{k}']={{id:'{k}',studentId:'{sid}',forMonth:'{m}',amount:{amt},date:'{m}-05',note:''}}; saveMonth('{m}');"
async def run(b, now, setup, label):
    ctx=await b.new_context(viewport={'width':1300,'height':900}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.clock.install(time=now); await pg.goto(URL); await pg.wait_for_timeout(400)
    await pg.evaluate(setup); await pg.wait_for_timeout(400)
    await pg.reload(); await pg.wait_for_timeout(500)
    await pg.goto(URL+'#/'); await pg.wait_for_timeout(300)
    dash=(await pg.inner_text('.kpis .kpi:nth-child(4)')).replace('\n',' / ')
    body=await pg.evaluate("document.body.innerText")
    await pg.goto(URL+'#/student/a'); await pg.wait_for_timeout(300)
    prof=(await pg.inner_text('.kpis .kpi:last-child')).replace('\n',' / '); nk=await pg.locator('.kpis .kpi').count()
    body+=await pg.evaluate("document.body.innerText")
    stored=await pg.evaluate("""(()=>{const db=JSON.parse(localStorage['tuition-desk-local-v1']);const pm=prevMonthOf(curMonth());const p=db['months/'+pm];return {prevMonth:pm, storedPaymentsForPrev:Object.values(p?.payments||{}).map(x=>x.amount)}})()""")
    print(f"== {label}\n   Home Due card : {dash}\n   Profile (a)   : {prof}  [{nk} cards]\n   stored        : {stored}\n   'income' text anywhere on Home/Profile: {'income' in body.lower()}{'  ERR '+str(errs) if errs else ''}")
    await ctx.close()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None)
        base=stu('a','Abdullah',8000)+stu('r','Rahim',9000)+stu('n','Nusrat',8000)
        await run(b, datetime.datetime(2026,10,10,12,0), base+pay('a','2026-09',5000,'p1')+pay('r','2026-09',9000,'p2')+pay('n','2026-09',4000,'p3')+pay('a','2026-10',8000,'p4')+pay('a','2026-08',1000,'p5'),
                  'Oct 2026: Sept fees 25,000; paid A 5,000, R 9,000, N 4,000 (Oct and old Aug dues must be ignored) -> expect ৳7,000 total; Abdullah ৳3,000')
        await run(b, datetime.datetime(2026,11,15,12,0), base+pay('a','2026-10',8000,'q1')+pay('r','2026-10',4500,'q2'),
                  'Nov 2026: Oct fees 25,000; paid A 8,000, R 4,500 -> expect ৳12,500; Abdullah ৳0 paid in full')
        await run(b, datetime.datetime(2027,1,3,12,0), base+pay('a','2026-12',2000,'z1')+pay('a','2027-01',8000,'z2'),
                  'Jan 2027: Dec 2026 fees 25,000; paid A 2,000 -> expect ৳23,000; Abdullah ৳6,000, label December 2026')
        await b.close()
asyncio.run(main())
