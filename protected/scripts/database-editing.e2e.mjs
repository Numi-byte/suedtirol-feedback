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
const points = new Map();
const writes = [];
let staff = true;
const user = { id: userId, email: 'staff@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };
const fixture = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const reply = (body, status = 200, count) => {
      res.writeHead(status, { 'Content-Type': 'application/json', ...(count !== undefined ? { 'Content-Range': `0-0/${count}` } : {}) });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify(body));
    };
    if (url.pathname === '/auth/v1/user') return reply(user);
    if (url.pathname === '/rest/v1/rpc/is_portal_staff') return reply(staff);
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
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
try {
  app = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', String(appPort)], {
    cwd: appDir, detached: true,
    env: { ...process.env, NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SUPABASE_URL: fixtureUrl, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'synthetic-public-key' },
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
}
