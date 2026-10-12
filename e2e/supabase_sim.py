"""Production build + simulated Supabase (Auth + PostgREST with per-user row filtering).
Proves the client side: auth flows, writes tagged with the signed-in user's id, persistence across reloads/sessions,
restore of an artifact backup, retries and error surfacing. Real RLS can only be proven against a real project."""
import os, pathlib, tempfile
import asyncio, base64, datetime, json, re, time, urllib.parse as up
from playwright.async_api import async_playwright
EXE = os.environ.get('CHROMIUM_PATH') or None
URL = 'http://localhost:4319/'
DB = {}                      # (user_id, kind, id) -> data
USERS = {'a@test.dev': ('aaaaaaaa-0000-4000-8000-000000000001', 'correct-horse'), 'b@test.dev': ('bbbbbbbb-0000-4000-8000-000000000002', 'other-horse-9')}
FAIL = {'upsert': 0}
WRITES = []
b64 = lambda o: base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip('=')
def token(uid): return f"{b64({'alg':'HS256','typ':'JWT'})}.{b64({'sub':uid,'role':'authenticated','exp':int(time.time())+3600})}.sig"
def uid_from(req):
    a = req.headers.get('authorization', '')
    try: return json.loads(base64.urlsafe_b64decode(a.split('.')[1] + '==')).get('sub')
    except Exception: return None
def user(email): uid = USERS[email][0]; return {"id": uid, "aud": "authenticated", "role": "authenticated", "email": email, "email_confirmed_at": "2026-09-01T00:00:00Z", "app_metadata": {"provider": "email"}, "user_metadata": {}, "created_at": "2026-09-01T00:00:00Z"}
def session(email): return {"access_token": token(USERS[email][0]), "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "refresh_token": "r_" + email, "user": user(email)}
async def handler(route):
    req = route.request; u = up.urlparse(req.url); q = up.parse_qs(u.query); path = u.path; m = req.method
    if path == '/auth/v1/token':
        body = json.loads(req.post_data or '{}')
        if q.get('grant_type') == ['password']:
            e = body.get('email')
            if e not in USERS or USERS[e][1] != body.get('password'): return await route.fulfill(status=400, json={"code": 400, "error_code": "invalid_credentials", "msg": "Invalid login credentials"})
            return await route.fulfill(json=session(e))
        e = (body.get('refresh_token') or 'r_a@test.dev')[2:]; return await route.fulfill(json=session(e if e in USERS else 'a@test.dev'))
    if path == '/auth/v1/signup': return await route.fulfill(json={**user('a@test.dev'), 'email_confirmed_at': None})
    if path == '/auth/v1/user':
        uid = uid_from(req); e = next((k for k, v in USERS.items() if v[0] == uid), None)
        return await route.fulfill(json=user(e)) if e else await route.fulfill(status=401, json={"msg": "invalid"})
    if path == '/auth/v1/logout': return await route.fulfill(status=204, body='')
    if path == '/auth/v1/recover': return await route.fulfill(json={})
    if path == '/rest/v1/documents':
        uid = uid_from(req)
        if not uid: return await route.fulfill(status=401, json={"code": "PGRST301", "message": "JWT required"})
        if m == 'GET':
            rows = [{"kind": k, "id": i, "data": d} for (o, k, i), d in sorted(DB.items()) if o == uid]   # row-level filter
            off = int(q.get('offset', ['0'])[0]); lim = int(q.get('limit', ['1000'])[0])
            return await route.fulfill(json=rows[off:off + lim])
        if m == 'POST':
            if FAIL['upsert'] > 0: FAIL['upsert'] -= 1; return await route.abort('failed')
            body = json.loads(req.post_data); body = body if isinstance(body, list) else [body]
            for r in body:
                if r.get('user_id') != uid: return await route.fulfill(status=403, json={"code": "42501", "message": "new row violates row-level security policy"})
            for r in body: DB[(r['user_id'], r['kind'], r['id'])] = r['data']; WRITES.append((r['kind'], r['id']))
            return await route.fulfill(status=201, body='')
        if m == 'DELETE':
            k = (q['user_id'][0][3:], q['kind'][0][3:], q['id'][0][3:])
            if k[0] != uid: return await route.fulfill(status=204, body='')
            DB.pop(k, None); return await route.fulfill(status=204, body='')
    return await route.fulfill(status=404, json={})
def rows(uid, kind=None): return {(k, i): d for (o, k, i), d in DB.items() if o == uid and (kind is None or k == kind)}
async def new_page(b, mobile=False):
    ctx = await b.new_context(viewport={'width': 390, 'height': 844} if mobile else {'width': 1300, 'height': 900}, is_mobile=mobile, has_touch=mobile)
    await ctx.route(re.compile(r'https://test\.supabase\.co/.*'), handler)
    pg = await ctx.new_page(); pg.errs = []; pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    await pg.clock.install(time=datetime.datetime(2026, 10, 13, 12, 0))
    return ctx, pg
async def sign_in(pg, email, pw):
    await pg.goto(URL); await pg.wait_for_timeout(700)
    await pg.fill('#f-email', email); await pg.fill('#f-password', pw); await pg.click('#auth-form button[type=submit]'); await pg.wait_for_timeout(1500)
R = []
def check(name, ok, detail=''): R.append(ok); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail else ''))
async def main():
    A, B = USERS['a@test.dev'][0], USERS['b@test.dev'][0]
    bk = json.load(open(str(pathlib.Path(__file__).parent / 'fixtures' / 'demo-export.json')))
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=EXE)
        ctx, pg = await new_page(b)
        await pg.goto(URL); await pg.wait_for_timeout(700)
        check('signed-out visitor sees the sign-in screen, not the app', await pg.inner_text('h1') == 'Welcome back' and await pg.locator('.shell').count() == 0)
        await pg.click('#auth-form button[type=submit]'); check('email validation', 'valid email' in await pg.inner_text('#e-email'))
        await pg.click('[data-auth=signup]'); await pg.fill('#f-email', 'a@test.dev'); await pg.fill('#f-password', 'short'); await pg.click('#auth-form button[type=submit]')
        check('sign-up password rule', '8 characters' in await pg.inner_text('#e-password'))
        await pg.fill('#f-password', 'correct-horse'); await pg.click('#auth-form button[type=submit]'); await pg.wait_for_timeout(600)
        check('sign-up asks for email confirmation', 'confirmation link' in await pg.inner_text('#auth-note'))
        await pg.fill('#f-email', 'a@test.dev'); await pg.fill('#f-password', 'wrong-pass1'); await pg.click('#auth-form button[type=submit]'); await pg.wait_for_timeout(600)
        check('wrong password message', 'incorrect' in await pg.inner_text('#auth-note'))
        await pg.click('[data-auth=forgot]'); await pg.fill('#f-email', 'a@test.dev'); await pg.click('#auth-form button[type=submit]'); await pg.wait_for_timeout(500)
        check('password reset request', 'reset link' in await pg.inner_text('#auth-note'))
        await pg.click('[data-auth=signin]'); await pg.fill('#f-email', 'a@test.dev'); await pg.fill('#f-password', 'correct-horse'); await pg.click('#auth-form button[type=submit]'); await pg.wait_for_timeout(1500)
        check('sign in opens dashboard with account email', 'a@test.dev' in await pg.inner_text('.side-foot'))
        # ---- restore the live-app backup
        await pg.goto(URL + '#/settings'); await pg.wait_for_timeout(300)
        async with pg.expect_file_chooser() as fc: await pg.click('button[data-act=import]')
        await (await fc.value).set_files(str(pathlib.Path(__file__).parent / 'fixtures' / 'demo-export.json')); await pg.wait_for_timeout(400)
        await pg.uncheck('input[name=safety]'); await pg.click('dialog button[type=submit]'); await pg.wait_for_timeout(3500)
        nclasses = sum(len(d.get('classes', {})) for (k, i), d in rows(A, 'months').items())
        npay = sum(len(d.get('payments', {})) for (k, i), d in rows(A, 'months').items())
        check('restore wrote every record to the database under this user', len(rows(A, 'students')) == len(bk['students']) and len(rows(A, 'uni')) == len(bk['university']) and npay == sum(len(m.get('payments', {})) for m in bk['months'].values()),
              f"students {len(rows(A,'students'))}/{len(bk['students'])}, uni {len(rows(A,'uni'))}/{len(bk['university'])}, payments {npay}, classes {nclasses}")
        sep = rows(A, 'months').get(('months', '2026-09'), {})
        check('older linked time record upgraded onto its class', sep.get('classes', {}).get('LEG', {}).get('end') == '19:20' and 'legacy1' not in sep.get('times', {}))
        await pg.reload(); await pg.wait_for_timeout(1500)
        totals = await pg.evaluate("document.body.innerText")
        await pg.goto(URL + '#/'); await pg.wait_for_timeout(400)
        due = await pg.inner_text('.kpis .kpi:nth-child(4) .kpi-v')
        await pg.evaluate("1"); await pg.goto(URL + '#/time'); await pg.wait_for_timeout(300)
        await pg.click('button[data-r=custom]') if await pg.locator('button[data-r=custom]').count() else None
        await pg.wait_for_timeout(200)
        await pg.fill('#tf-from', '2020-01-01'); await pg.fill('#tf-to', '2030-12-31'); await pg.wait_for_timeout(400)
        alltime = await pg.inner_text('.durpreview')
        check('after reload (data from server): Due and all-time teaching time match the export (+20m upgraded record)', due == '৳1,500' and alltime == '66h 10m', f'Due {due}, time {alltime}')
        # ---- CRUD
        await pg.goto(URL + '#/students'); await pg.wait_for_timeout(300)
        await pg.click('button[data-act=new-student] >> nth=0'); await pg.fill('#f-name', 'Server Test'); await pg.fill('#f-fee', '4500'); await pg.click('dialog button[type=submit]'); await pg.wait_for_timeout(1000)
        sid = next((i for (k, i), d in rows(A, 'students').items() if d['name'] == 'Server Test'), None)
        check('new student saved to database', bool(sid))
        await pg.click('button[data-act=new-class] >> nth=0'); await pg.wait_for_timeout(200)
        await pg.fill('#f-date', '2026-08-20'); await pg.fill('#f-start', '17:00'); await pg.fill('#f-end', '18:45'); await pg.select_option('#f-status', 'completed'); await pg.click('dialog button[type=submit]'); await pg.wait_for_timeout(1000)
        aug = rows(A, 'months').get(('months', '2026-08'), {}).get('classes', {})
        check('historical completed class saved (Aug 20, 5:00–6:45 PM)', any(c['studentId'] == sid and c['end'] == '18:45' and c['status'] == 'completed' for c in aug.values()))
        await pg.click('button[data-act=new-payment] >> nth=0'); await pg.wait_for_timeout(200); await pg.fill('#f-amount', '2000'); await pg.fill('#f-forMonth', '2026-09'); await pg.click('dialog button[type=submit]'); await pg.wait_for_timeout(1000)
        check('payment saved', any(p['studentId'] == sid for p in rows(A, 'months').get(('months', '2026-09'), {}).get('payments', {}).values()))
        FAIL['upsert'] = 2; await pg.goto(URL + '#/settings'); await pg.wait_for_timeout(300); await pg.fill('#p-name', 'Taieba'); await pg.click('#prefs button[type=submit]'); await pg.wait_for_timeout(4000)
        check('write retried after network drop', rows(A, 'app').get(('app', 'app'), {}).get('name') == 'Taieba')
        FAIL['upsert'] = 5; await pg.fill('#p-name', 'X'); await pg.click('#prefs button[type=submit]'); await pg.wait_for_timeout(5500); FAIL['upsert'] = 0
        check('persistent failure is shown, not hidden', 'could not be saved' in await pg.inner_text('#toasts'))
        await pg.goto(URL + f'#/student/{sid}'); await pg.wait_for_timeout(300); await pg.click('button[data-act=student-menu]'); await pg.click('[data-sm=delete]'); await pg.click('dialog button[type=submit]'); await pg.wait_for_timeout(1200)
        check('delete removes student and its records from database', not any(d['name'] == 'Server Test' for d in rows(A, 'students').values()) and not any(c.get('studentId') == sid for d in rows(A, 'months').values() for c in list(d.get('classes', {}).values()) + list(d.get('payments', {}).values())))
        a_before = json.dumps(sorted((k, i) for (k, i) in rows(A)))
        await pg.click('.side-foot button[data-act=sign-out]'); await pg.wait_for_timeout(1200)
        check('sign out returns to sign-in and clears the session', await pg.inner_text('h1') == 'Welcome back' and not await pg.evaluate("Object.keys(localStorage).some(k=>k.includes('auth-token'))"))
        await pg.reload(); await pg.wait_for_timeout(800); check('reload stays signed out', await pg.inner_text('h1') == 'Welcome back')
        print('page errors (A):', pg.errs); await ctx.close()
        # ---- second user cannot see A's data
        ctx, pg = await new_page(b); await sign_in(pg, 'b@test.dev', 'other-horse-9')
        await pg.goto(URL + '#/students'); await pg.wait_for_timeout(400)
        check('another account sees none of the first account\'s data', await pg.locator('.stu-card').count() == 0 and 'No students yet' in await pg.inner_text('main'))
        check("first account's rows untouched", json.dumps(sorted((k, i) for (k, i) in rows(A))) == a_before)
        await ctx.close()
        # ---- new browser session for A: data comes back from the server; mobile viewport
        ctx, pg = await new_page(b, mobile=True); await sign_in(pg, 'a@test.dev', 'correct-horse')
        await pg.goto(URL + '#/students'); await pg.wait_for_timeout(400)
        cards = await pg.locator('.stu-card').count()
        await pg.goto(URL + '#/'); await pg.wait_for_timeout(400)
        await pg.click('[data-act=bell]'); await pg.wait_for_timeout(300)
        inside = await pg.evaluate("(()=>{const p=document.querySelector('#bellpop .pop').getBoundingClientRect();return p.left>=0&&p.right<=innerWidth&&p.bottom<=document.querySelector('.bnav').getBoundingClientRect().top})()")
        overflow = await pg.evaluate("document.documentElement.scrollWidth-innerWidth")
        check('new browser session (mobile): data restored from server, reminders panel fits, no sideways scroll', cards == 4 and inside and overflow == 0, f'{cards} students')
        print('page errors (mobile):', pg.errs); await ctx.close(); await b.close()
    print(f'\n{sum(R)}/{len(R)} checks passed')
asyncio.run(main())
