/** Real browser + Next Server Actions, with a synthetic local Supabase fixture.
 * Never connects to or writes to the hosted project. Requires Playwright + Chromium.
 * Run: CHROMIUM_PATH=/usr/bin/chromium node protected/scripts/database-editing.e2e.mjs
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { createServerClient } = require('@supabase/ssr');
const appDir = fileURLToPath(new URL('..', import.meta.url));
const userId = 'bdee91d9-c969-4bd4-b336-8f7e780ead3e';
const idFor = n => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const records = Array.from({ length: 40 }, (_, i) => ({
  id: idFor(i + 1), name_de: `Bozen ${i + 1}`, name_it: `Bolzano ${i + 1}`, name_en: `Stop ${i + 1}`,
  municipality: 'Bolzano', municipality_de: 'Bozen', municipality_it: 'Bolzano',
  stop_code: String(i + 1), latitude: 46.5, longitude: 11.35, created_by: userId,
  is_accessible: false, is_published: i < 25, archived_at: i >= 25 ? '2026-01-01T00:00:00Z' : null,
}));
for (const [index,source] of [[0,'2553'],[1,'3217'],[3,'696'],[25,'6']]) {
  Object.assign(records[index],{municipality_de:'',municipality_it:'',id_version:`(it:apb:StopPlace:it:22021:${source},any)`});
}
Object.assign(records[2],{municipality_de:'',municipality_it:'',id_version:null});
const municipalityFeed={locations:[
 {id:'it:22021:2553',parent:{name:'Merano',type:'locality',properties:{omc:'22021051'}}},
 {id:'it:22021:3217',parent:{name:'Anterselva (Rasun Anterselva)',type:'locality',properties:{omc:'22021071'}}},
 {id:'it:22021:696',parent:{name:'Termeno',type:'locality',properties:{omc:'22021098'}}},
 {id:'it:22021:6',parent:{name:'Resia (Curon Venosta)',type:'locality',properties:{omc:'22021027'}}},
]};
const points = new Map();
const writes = [];
let staff = true;
let currentUserId = userId;
const serverAdminKey = 'synthetic-server-admin-key-not-for-browser';
const accounts = [{ user_id:userId,email:'staff@example.test',is_active:true,can_manage_stops:true,can_manage_database:true,can_view_feedback:true,is_owner:true }];
const formConfig={photos_enabled:true,max_photo_bytes:10485760,categories:[{slug:'seating',label_de:'Sitzplatz fehlt',label_it:'Mancano posti a sedere',label_en:'Seating is missing',is_active:true,sort_order:1,icon:null}]};
const configWrites=[];
const authAdminCalls = [];
const managementEvents = [];
function accessForCurrentUser() {
  if (!staff) return { feedback:false,stops:false,database:false,users:false,feedbackSettings:false };
  if (currentUserId === userId) return { feedback:true,stops:true,database:true,users:true,feedbackSettings:true };
  const account=accounts.find(x=>x.user_id===currentUserId);
  return { users:false,feedbackSettings:false,stops:!!(account?.is_active&&account.can_manage_stops),database:!!(account?.is_active&&account.can_manage_database),feedback:!!(account?.is_active&&account.can_view_feedback) };
}
const user = { id: userId, email: 'staff@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };
const fixture = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const reply = (body, status = 200, count) => {
      res.writeHead(status, { 'Content-Type': 'application/json', ...(count !== undefined ? { 'Content-Range': `0-0/${count}` } : {}) });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify(body));
    };
    if (url.pathname === '/test-efa-stop-list') return reply(municipalityFeed);
    if (url.pathname === '/auth/v1/user') return reply({ ...user,id:currentUserId,user_metadata:{is_owner:true} });
    if (url.pathname === '/rest/v1/rpc/is_portal_staff') return reply(staff);
    if (url.pathname === '/rest/v1/rpc/get_portal_access') return reply(accessForCurrentUser());
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    if(url.pathname==='/rest/v1/rpc/get_feedback_form_config') return reply(formConfig);
    if(['/rest/v1/rpc/set_feedback_photo_settings','/rest/v1/rpc/save_feedback_category'].includes(url.pathname)) {
      if(currentUserId!==userId) return reply({message:'Owner access required',code:'42501'},403);
      configWrites.push(body);
      if(url.pathname.endsWith('set_feedback_photo_settings')) Object.assign(formConfig,{photos_enabled:body.p_enabled,max_photo_bytes:body.p_max_bytes});
      else {
        let category=formConfig.categories.find(x=>x.slug===body.p_slug);
        if(!category){category={slug:body.p_slug,icon:null};formConfig.categories.push(category);}
        Object.assign(category,{label_de:body.p_label_de,label_it:body.p_label_it,label_en:body.p_label_en,is_active:body.p_active,sort_order:body.p_position});
        if(body.p_replace_icon) category.icon=body.p_icon;
      }
      return reply(null);
    }
    if (url.pathname === '/rest/v1/rpc/list_stops_missing_municipality') {
      const rows=records.filter(x=>(!x.municipality_de.trim()||!x.municipality_it.trim())&&(!body.p_after||x.id>body.p_after)).sort((a,b)=>a.id.localeCompare(b.id));
      return reply(rows.slice(0,Math.min(body.p_limit,2)));
    }
    if (url.pathname === '/rest/v1/rpc/fill_missing_stop_municipalities') {
      let updated=0;const details=[];
      for(const row of body.p_rows){
        const record=records.find(x=>x.id===row.id);
        if(!record||record.id_version!==`(it:apb:StopPlace:${row.source_id},any)`) {details.push({id:row.id,reason:'source_changed'});continue;}
        if(record.municipality_de.trim()&&record.municipality_it.trim()){details.push({id:row.id,reason:'already_complete'});continue;}
        if(!record.municipality_de.trim())record.municipality_de=row.municipality_de;
        if(!record.municipality_it.trim())record.municipality_it=row.municipality_it;
        writes.push({kind:'municipality',id:row.id});updated++;
      }
      return reply({updated,details});
    }
    if (url.pathname.startsWith('/auth/v1/admin/users')) {
      assert.equal(req.headers.apikey,serverAdminKey);
      if (req.method === 'POST') {
        if(accounts.some(x=>x.email===body.email)) return reply({msg:'This email is already registered.'},422);
        const account={user_id:idFor(1000+accounts.length),email:body.email,is_active:false,can_manage_stops:false,can_manage_database:false,can_view_feedback:false,is_owner:false};
        accounts.push(account);authAdminCalls.push({kind:'create',id:account.user_id});
        return reply({id:account.user_id,email:account.email});
      }
      const account=accounts.find(x=>x.user_id===url.pathname.split('/').at(-1));
      assert.ok(account); account.email=body.email;
      authAdminCalls.push({kind:'credentials',id:account.user_id,passwordChanged:!!body.password});
      return reply({id:account.user_id,email:account.email});
    }
    if (['/rest/v1/rpc/list_portal_users','/rest/v1/rpc/set_portal_user_access','/rest/v1/rpc/record_portal_user_event'].includes(url.pathname)) {
      if(currentUserId!==userId) return reply({message:'Owner access required',code:'42501'},403);
      if(url.pathname.endsWith('/list_portal_users')) return reply(accounts.filter(x=>x.email.includes(body.p_search??'')));
      if(url.pathname.endsWith('/record_portal_user_event')) { managementEvents.push(body);return reply(null); }
      const account=accounts.find(x=>x.user_id===body.p_user_id);
      assert.ok(account);assert.notEqual(account.user_id,userId);
      Object.assign(account,{is_active:body.p_active,can_manage_stops:body.p_stops,can_manage_database:body.p_database,can_view_feedback:body.p_feedback});
      return reply(null);
    }
    const eq = key => url.searchParams.get(key)?.replace(/^eq\./, '');
    const single = value => req.headers.accept?.includes('vnd.pgrst.object') ? value : [value];
    if (url.pathname === '/rest/v1/bus_stops') {
      if (req.method === 'POST') {
        const record = { ...body, id: idFor(100 + writes.length), archived_at: null };
        records.unshift(record);
        writes.push({ kind: 'create', id: record.id });
        return reply(single({ id: record.id }), 201);
      }
      if (req.method === 'PATCH') {
        if (body.name_it === 'FAIL') return reply({ message: 'Synthetic database error; please retry.', code: '23505' }, 400);
        const record = records.find(x => x.id === eq('id'));
        assert.ok(record);
        Object.assign(record, body);
        writes.push({ kind: 'update', id: record.id, body });
        return reply(single({ id: record.id }));
      }
      let rows = records.filter(x => !eq('id') || x.id === eq('id'));
      if (url.searchParams.get('municipality_names_missing') === 'eq.true') rows=rows.filter(x=>!x.municipality_de.trim()||!x.municipality_it.trim());
      if (url.searchParams.get('archived_at') === 'is.null') rows = rows.filter(x => !x.archived_at);
      if (url.searchParams.get('archived_at') === 'not.is.null') rows = rows.filter(x => x.archived_at);
      const count = rows.length;
      const offset = Number(url.searchParams.get('offset') ?? 0);
      rows = rows.slice(offset, offset + Number(url.searchParams.get('limit') ?? 1000));
      return reply(rows, 200, count);
    }
    if (url.pathname === '/rest/v1/stop_points') {
      const place = eq('stop_place_id');
      if (req.method === 'PATCH') {
        const point = [...points.values()].find(x => x.id === eq('id'));
        assert.ok(point);
        Object.assign(point, body);
        writes.push({ kind: 'point', id: point.id, body });
        return reply(single({ id: point.id }));
      }
      if (!points.has(place)) points.set(place, { id: `22222222-2222-4222-8222-${place.slice(-12)}`, name_de: 'Steig Nord', name_it: 'Banchina nord', point_number: '1', transport_type: 'bus' });
      return reply([points.get(place)], 200, 1);
    }
    return reply({ message: `Unexpected fixture path ${url.pathname}` }, 404);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: error.message }));
  }
});
await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));
const fixtureUrl = `http://127.0.0.1:${fixture.address().port}`;
const portReservation = createServer();
await new Promise(resolve => portReservation.listen(0, '127.0.0.1', resolve));
const appPort = portReservation.address().port;
await new Promise(resolve => portReservation.close(resolve));
const appUrl = `http://127.0.0.1:${appPort}`;
let app, browser, appLog = '';
const hookDirectory = await mkdtemp(join(tmpdir(),'portal-efa-test-'));
const hookPath=join(hookDirectory,'efa-fixture.cjs');
await writeFile(hookPath,`const original=globalThis.fetch;globalThis.fetch=(input,init)=>{const url=String(input instanceof Request?input.url:input);return original(url.startsWith('https://efa.sta.bz.it/apb/XML_STOPLIST_REQUEST?')?'${fixtureUrl}/test-efa-stop-list':input,init)};`);
try {
  app = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', String(appPort)], {
    cwd: appDir, detached: true,
    env: { ...process.env, NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SUPABASE_URL: fixtureUrl, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'synthetic-public-key', SUPABASE_SERVICE_ROLE_KEY: serverAdminKey, NODE_OPTIONS: `--require ${hookPath}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (const stream of [app.stdout, app.stderr]) stream.on('data', chunk => { appLog = (appLog + chunk).slice(-30000); });
  for (let attempt = 0; attempt < 120; attempt++) {
    try { if ((await fetch(appUrl, { signal: AbortSignal.timeout(2000) })).ok) break; } catch { /* wait for compile */ }
    if (attempt === 119 || app.exitCode !== null) throw new Error('Next app did not become ready');
    await delay(250);
  }
  const cookies = new Map();
  const auth = createServerClient(fixtureUrl, 'synthetic-public-key', {
    cookies: { getAll: () => [...cookies.values()], setAll: values => values.forEach(x => cookies.set(x.name, x)) },
  });
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.synthetic-signature`;
  const session = await auth.auth.setSession({ access_token: token, refresh_token: 'synthetic-refresh-token' });
  assert.equal(session.error, null);
  browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addCookies([...cookies.values()].map(x => ({ name: x.name, value: x.value, url: appUrl })));
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(60_000);
  const waitFor = async predicate => {
    for (let i = 0; i < 150; i++) { if (await predicate()) return; await delay(100); }
    throw new Error('Timed out waiting for browser assertion');
  };
  const listContext = () => {
    const url = new URL(page.url());
    assert.equal(url.pathname, '/database');
    assert.equal(url.searchParams.get('q'), 'Bozen');
    assert.equal(url.searchParams.get('page'), '2');
    assert.equal(url.searchParams.get('archivePage'), '2');
  };
  await page.goto(`${appUrl}/stops`);
  await page.getByRole('heading', { name: 'Haltestellendatei importieren', exact: true }).waitFor();
  assert.equal(await page.locator('#stop-editor').count(), 0);
  console.log('PASS: stop management contains imports, with creation moved to Database');

  await page.goto(`${appUrl}/database?q=Bozen&page=2&archivePage=2`);
  await page.locator('.stop-row').first().click();
  await page.locator('.stop-edit-form input[name=id]').waitFor({ state: 'attached' });
  listContext();
  const selectedId = new URL(page.url()).searchParams.get('stop');
  const originalUrl = page.url();
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  const editor = page.locator('.stop-edit-form');
  const pointEditor = page.locator('.point-edit-form').first();
  await editor.locator('[name=name_it]').fill('Bolzano edited');
  await editor.locator('[name=is_published]').uncheck();
  await pointEditor.locator('select').selectOption('train');
  await editor.getByRole('button', { name: 'Änderungen speichern', exact: true }).click();
  await editor.getByRole('status').filter({ hasText: 'Gespeichert.' }).waitFor();
  assert.equal(page.url(), originalUrl);
  assert.equal(await page.evaluate(() => performance.timeOrigin), timeOrigin);
  assert.equal(await editor.locator('[name=name_it]').inputValue(), 'Bolzano edited');
  assert.equal(await editor.locator('[name=is_published]').isChecked(), false);
  assert.equal(await pointEditor.locator('select').inputValue(), 'train');
  assert.equal(await page.locator('[name=q]').inputValue(), 'Bozen');
  listContext();
  console.log('PASS: saving retains URL, search, pages, selection, checkboxes and unsaved point changes without a document reload');

  await editor.locator('[name=name_de]').fill('Unsaved name draft');
  await pointEditor.getByRole('button', { name: 'Änderungen speichern', exact: true }).click();
  await pointEditor.getByRole('status').filter({ hasText: 'Gespeichert.' }).waitFor();
  assert.equal(await editor.locator('[name=name_de]').inputValue(), 'Unsaved name draft');
  assert.equal(page.url(), originalUrl);
  assert.ok(writes.some(x => x.kind === 'point' && x.body.transport_type === 'train'));
  console.log('PASS: point saves preserve unsaved stop fields and current list context');

  await editor.locator('[name=name_it]').fill('FAIL');
  await editor.getByRole('button', { name: 'Änderungen speichern', exact: true }).click();
  await editor.getByRole('alert').waitFor();
  assert.equal(await editor.locator('[name=name_it]').inputValue(), 'FAIL');
  assert.equal(await editor.locator('[name=name_de]').inputValue(), 'Unsaved name draft');
  assert.equal(page.url(), originalUrl);
  await editor.locator('[name=name_it]').fill('Bolzano recovered');
  await editor.getByRole('button', { name: 'Änderungen speichern', exact: true }).click();
  await editor.getByRole('status').filter({ hasText: 'Gespeichert.' }).waitFor();
  console.log('PASS: failed saves retain input and allow an inline retry');

  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Haltestelle archivieren', exact: true }).click();
  assert.equal(records.find(x => x.id === selectedId).archived_at, null);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Haltestelle archivieren', exact: true }).click();
  await waitFor(() => !new URL(page.url()).searchParams.has('stop'));
  listContext();
  assert.ok(records.find(x => x.id === selectedId).archived_at);
  const beforeRestore = writes.length;
  await page.locator('.archived-row .restore').first().click();
  await waitFor(() => writes.length > beforeRestore);
  await page.waitForFunction(() => !document.querySelector('form[aria-busy=true]'));
  listContext();
  console.log('PASS: archive confirmation and restore keep search and both list pages');

  await page.locator('.database-heading').getByRole('link', { name: 'Haltestelle hinzufügen', exact: true }).click();
  await page.getByRole('heading', { name: 'Haltestelle hinzufügen', exact: true }).waitFor();
  for (const [name, value] of Object.entries({ name_de: 'Bozen new', name_it: 'Bolzano new', name_en: 'New stop', municipality_de: 'Bozen', municipality_it: 'Bolzano', latitude: '46.5', longitude: '11.35' })) {
    await editor.locator(`[name=${name}]`).fill(value);
  }
  await editor.getByRole('button', { name: 'Haltestelle speichern', exact: true }).click();
  await page.getByRole('heading', { name: 'Haltestelle bearbeiten', exact: true }).waitFor();
  listContext();
  assert.equal(writes.filter(x => x.kind === 'create').length, 1);
  const createdId = new URL(page.url()).searchParams.get('stop');
  await editor.locator('[name=name_it]').fill('Bolzano new updated');
  await editor.getByRole('button', { name: 'Änderungen speichern', exact: true }).click();
  await editor.getByRole('status').filter({ hasText: 'Gespeichert.' }).waitFor();
  assert.equal(writes.filter(x => x.kind === 'create').length, 1);
  assert.equal(records.find(x => x.id === createdId).name_it, 'Bolzano new updated');
  console.log('PASS: creation selects the new stop; subsequent saves update it rather than creating duplicates');

  await page.goto(`${appUrl}/stops?q=Bozen&page=2&archivePage=2&stop=${createdId}`);
  await page.waitForURL(url => url.pathname === '/database');
  await page.waitForLoadState('networkidle');
  await page.getByRole('heading', { name: 'Haltestelle bearbeiten', exact: true }).waitFor();
  listContext();
  const mobileTimeOrigin = await page.evaluate(() => performance.timeOrigin);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await editor.locator('[name=name_it]').fill('Mobile edit');
  await editor.getByRole('button', { name: 'Änderungen speichern', exact: true }).click();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await editor.getByRole('status').filter({ hasText: 'Gespeichert.' }).waitFor();
  assert.ok(Math.abs((await page.evaluate(() => window.scrollY)) - scrollBefore) < 50);
  assert.equal(await page.evaluate(() => performance.timeOrigin), mobileTimeOrigin);
  listContext();
  console.log('PASS: legacy editor links preserve context; mobile editing has no horizontal overflow or save jump');
  await page.goto(`${appUrl}/database?q=Bozen&page=2&archivePage=2`);
  const fill=page.locator('.municipality-backfill');
  assert.ok((await page.locator('main > section').last().getAttribute('class')).includes('municipality-backfill-card'));
  const fillUrl=page.url();
  await fill.getByRole('button',{name:'Gemeinden aus EFA ergänzen',exact:true}).click();
  await fill.getByRole('status').filter({hasText:'Abgeschlossen.'}).waitFor();
  assert.equal(page.url(),fillUrl);
  assert.equal(records.find(x=>x.id===idFor(1)).municipality_de,'Meran');
  assert.equal(records.find(x=>x.id===idFor(2)).municipality_de,'Rasen-Antholz');
  assert.equal(records.find(x=>x.id===idFor(4)).municipality_de,'Tramin an der Weinstraße');
  assert.equal(records.find(x=>x.id===idFor(26)).municipality_it,'Curon Venosta');
  assert.ok(records.find(x=>x.id===idFor(26)).archived_at);
  assert.equal(writes.filter(x=>x.kind==='municipality').length,4);
  assert.match(await fill.getByRole('status').innerText(),/5 geprüft.*4 ergänzt.*1 zur Prüfung/);
  await page.getByRole('link',{name:'Nur fehlende Gemeinden anzeigen',exact:true}).click();
  await page.waitForURL(url=>url.searchParams.get('missing')==='1');
  await page.waitForFunction(()=>document.querySelectorAll('.stop-row').length===1);
  await fill.getByRole('button',{name:'Gemeinden aus EFA ergänzen',exact:true}).click();
  await fill.getByRole('status').filter({hasText:'Abgeschlossen.'}).waitFor();
  assert.equal(writes.filter(x=>x.kind==='municipality').length,4);
  console.log('PASS: footer municipality fill scans beyond the visible page, includes archives, resolves frazioni, preserves context, filters remaining gaps and safely retries');
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(`${appUrl}/users`);
  await page.getByRole('heading',{name:'Benutzerverwaltung',exact:true}).waitFor();
  let capturedCreate;
  page.on('request',request=>{
    if(request.method()==='POST'&&request.headers()['next-action']&&request.url().includes('/users')&&!capturedCreate) capturedCreate=request;
  });
  const create=page.locator('.user-create');
  assert.equal(await create.locator('[name=feedback]').isChecked(),false);
  await create.locator('[name=email]').fill('operator@example.test');
  await create.locator('[name=password]').fill('Synthetic-password-123');
  await create.locator('[name=database]').uncheck();
  await create.getByRole('button',{name:'Benutzer erstellen',exact:true}).click();
  await create.getByRole('status').filter({hasText:'Gespeichert.'}).waitFor();
  const created=accounts.find(x=>x.email==='operator@example.test');
  assert.ok(created?.is_active&&created.can_manage_stops&&!created.can_manage_database&&!created.can_view_feedback);
  assert.equal(await create.locator('[name=password]').inputValue(),'');
  assert.equal(authAdminCalls.filter(x=>x.kind==='create').length,1);
  let accountCard=page.locator('.managed-user').filter({has:page.getByRole('heading',{name:'operator@example.test',exact:true})});
  await accountCard.waitFor();
  assert.ok(!JSON.stringify(managementEvents).includes('Synthetic-password'));
  assert.ok(!(await page.content()).includes(serverAdminKey));
  console.log('PASS: owner creates Auth accounts with explicit permissions; feedback defaults off and password/key stay out of returned HTML');
  const accessForm=accountCard.locator('form').first();
  await accessForm.locator('[name=active]').uncheck();
  await accessForm.getByRole('button',{name:'Berechtigungen speichern',exact:true}).click();
  await accessForm.getByRole('status').filter({hasText:'Gespeichert.'}).waitFor();
  assert.equal(created.is_active,false);
  await accessForm.locator('[name=active]').check();
  await accessForm.getByRole('button',{name:'Berechtigungen speichern',exact:true}).click();
  await accessForm.getByRole('status').filter({hasText:'Gespeichert.'}).waitFor();
  assert.equal(created.is_active,true);
  await accountCard.locator('summary').click();
  const credentials=accountCard.locator('details form');
  await credentials.locator('[name=email]').fill('changed@example.test');
  await credentials.locator('[name=password]').fill('Different-password-456');
  await credentials.getByRole('button',{name:'Zugangsdaten speichern',exact:true}).click();
  accountCard=page.locator('.managed-user').filter({has:page.getByRole('heading',{name:'changed@example.test',exact:true})});
  await accountCard.locator('details form').getByRole('status').filter({hasText:'Gespeichert.'}).waitFor();
  assert.equal(created.email,'changed@example.test');
  assert.equal(authAdminCalls.at(-1).passwordChanged,true);
  assert.equal(await accountCard.locator('[name=password]').inputValue(),'');
  console.log('PASS: owner can deactivate/reactivate accounts and update email/password without exposing password values');
  await page.goto(`${appUrl}/feedback-settings`);
  await page.getByRole('heading',{name:'Feedback verwalten',exact:true}).waitFor();
  const photoSettings=page.locator('.feedback-photo-settings form');
  let capturedSettings;
  page.on('request',request=>{if(request.method()==='POST'&&request.headers()['next-action']&&request.url().includes('/feedback-settings')&&!capturedSettings)capturedSettings=request;});
  const settingsOrigin=await page.evaluate(()=>performance.timeOrigin);
  await photoSettings.locator('[name=photos_enabled]').uncheck();
  await photoSettings.locator('[name=max_photo_mb]').fill('2');
  await photoSettings.getByRole('button',{name:'Foto-Einstellungen speichern',exact:true}).click();
  await photoSettings.getByRole('status').filter({hasText:'Gespeichert.'}).waitFor();
  assert.equal(formConfig.photos_enabled,false);assert.equal(formConfig.max_photo_bytes,2097152);
  assert.equal(await page.evaluate(()=>performance.timeOrigin),settingsOrigin);
  const categoryCreate=page.locator('.feedback-category-create form');
  await categoryCreate.locator('[name=slug]').fill('custom_issue');
  await categoryCreate.locator('[name=label_de]').fill('Neues Problem');
  await categoryCreate.locator('[name=label_it]').fill('Nuovo problema');
  await categoryCreate.locator('[name=label_en]').fill('New issue');
  await categoryCreate.locator('[name=icon_file]').setInputFiles({name:'unsafe.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg><script>alert(1)</script></svg>')});
  const writesBefore=configWrites.length;
  await categoryCreate.getByRole('button',{name:'Kategorie speichern',exact:true}).click();
  await categoryCreate.getByRole('alert').waitFor();
  assert.equal(configWrites.length,writesBefore);
  assert.equal(await categoryCreate.locator('[name=label_it]').inputValue(),'Nuovo problema');
  await categoryCreate.locator('[name=icon_file]').setInputFiles({name:'safe.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg viewBox="0 0 48 48"><path fill="#ff0000" d="M2 2L40 2L40 40Z"/></svg>')});
  await categoryCreate.getByRole('button',{name:'Kategorie speichern',exact:true}).click();
  await categoryCreate.getByRole('status').filter({hasText:'Gespeichert.'}).waitFor();
  const customCard=page.locator('.feedback-category-editor').filter({has:page.getByRole('heading',{name:'Neues Problem',exact:true})});
  await customCard.waitFor();
  assert.equal(formConfig.categories.at(-1).icon.nodes[0].attrs.fill,'currentColor');
  assert.equal(await customCard.locator('.category-icon-preview svg').getAttribute('viewBox'),'0 0 48 48');
  assert.equal(await categoryCreate.locator('[name=icon_file]').inputValue(),'');
  for(const width of [1440,1600,1920]) {
    await page.setViewportSize({width,height:1000});
    assert.ok(await page.evaluate(()=>{
      const brand=document.querySelector('.portal-brand').getBoundingClientRect();
      const nav=document.querySelector('.portal-desktop-nav').getBoundingClientRect();
      const signout=document.querySelector('.portal-desktop-signout').getBoundingClientRect();
      return brand.right<=nav.left&&nav.right<=signout.left;
    }),`desktop navigation must fit at ${width}px`);
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:'/tmp/feedback-owner-settings.png',fullPage:true});
  await customCard.locator('[name=is_active]').uncheck();
  await customCard.locator('[name=remove_icon]').check();
  await customCard.getByRole('button',{name:'Kategorie speichern',exact:true}).click();
  await customCard.getByRole('status').filter({hasText:'Gespeichert.'}).waitFor();
  assert.equal(formConfig.categories.at(-1).is_active,false);
  assert.equal(formConfig.categories.at(-1).icon,null);
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  await page.setViewportSize({width:1440,height:1000});
  console.log('PASS: owner settings save inline; unsafe SVG rejected before RPC; normalized icon assignment, retirement and removal work on mobile');
  currentUserId=created.user_id;
  await page.goto(`${appUrl}/feedback-settings`);
  await page.waitForURL(url=>url.pathname==='/stops');
  assert.equal(await page.locator('a[href="/feedback-settings"]').count(),0);
  assert.ok(capturedSettings);
  const settingsHeaders=capturedSettings.headers();
  const configCount=configWrites.length;
  const deniedSettings=await context.request.post(`${appUrl}/feedback-settings`,{headers:{'next-action':settingsHeaders['next-action'],'content-type':settingsHeaders['content-type'],origin:appUrl},data:capturedSettings.postDataBuffer()});
  assert.ok((await deniedSettings.text()).includes('Only the owner'));
  assert.equal(configWrites.length,configCount);
  console.log('PASS: non-owner route access and replayed settings action are denied before configuration RPC');
  await page.goto(`${appUrl}/users`);
  await page.waitForURL(url=>url.pathname==='/stops');
  await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('.portal-users').count(),0);
  assert.equal(await page.locator('a[href="/users"]').count(),0);
  assert.equal(await page.locator('a[href="/database"]').count(),0);
  await page.goto(`${appUrl}/database`);
  await page.waitForURL(url=>url.pathname==='/stops');
  await page.waitForLoadState('networkidle');
  const beforeAttack=authAdminCalls.length;
  assert.ok(capturedCreate);
  const headers=capturedCreate.headers();
  const denied=await context.request.post(`${appUrl}/users`,{headers:{'next-action':headers['next-action'],'content-type':headers['content-type'],origin:appUrl},data:capturedCreate.postDataBuffer()});
  assert.equal(authAdminCalls.length,beforeAttack);
  assert.ok((await denied.text()).includes('designated owner'));
  console.log('PASS: non-owner cannot see user management or forbidden sections; replayed owner action is denied before Auth Admin access');
  staff = false;
  await page.goto(`${appUrl}/database?q=Bozen&page=2`);
  await page.locator('.login-form').waitFor();
  assert.equal(await page.locator('.database-workspace').count(), 0);
  console.log('PASS: ordinary authenticated users still cannot access the database workspace');
} catch (error) {
  console.error(appLog);
  throw error;
} finally {
  await browser?.close();
  if (app?.pid) { try { process.kill(-app.pid, 'SIGTERM'); } catch { /* already stopped */ } }
  fixture.closeAllConnections();
  await new Promise(resolve => fixture.close(resolve));
  await rm(hookDirectory,{recursive:true,force:true});
}
