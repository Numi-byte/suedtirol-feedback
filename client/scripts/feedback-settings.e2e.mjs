/** Real public form in Chromium against a synthetic Supabase service. No hosted data. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const appDir = fileURLToPath(new URL("..", import.meta.url));
const pointId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const placeId = "11111111-1111-4111-8111-111111111111";
const cat = (slug, en, active, order) => ({
  slug,
  label_de: `DE ${en}`,
  label_it: `IT ${en}`,
  label_en: en,
  is_active: active,
  sort_order: order,
  icon: null,
});
const custom = cat("custom_issue", "Custom issue", true, 1);
custom.icon = {
  viewBox: [0, 0, 48, 48],
  attrs: { fill: "currentColor" },
  nodes: [{ tag: "path", attrs: { d: "M2 2L40 2L40 40Z" }, children: [] }],
};
const other = cat("constructor", "Updated seating label", true, 2);
const retired = cat("retired", "Retired issue", false, 3);
const config = {
  photos_enabled: true,
  max_photo_bytes: 2097152,
  categories: [custom, other, retired],
};
const reports = [],
  uploads = [],
  registrations = [];
const point = {
  id: pointId,
  stop_place_id: placeId,
  point_number: "1",
  name_de: "Nord",
  name_it: "Nord",
  transport_type: "bus",
  place_name_de: "Test",
  place_name_it: "Test",
  place_name_en: "Test",
  municipality: "Bolzano",
  municipality_de: "Bozen",
  municipality_it: "Bolzano",
  latitude: 46.5,
  longitude: 11.35,
};
const fixture = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const reply = (body, status = 200) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
        "Content-Range": "0-0/1",
      });
      res.end(JSON.stringify(body));
    };
    if (req.method === "OPTIONS") return reply(null);
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (url.pathname.startsWith("/storage/v1/object/feedback-photos/")) {
      uploads.push({
        type: req.headers["content-type"],
        size: Buffer.concat(chunks).length,
      });
      return reply({ Key: url.pathname });
    }
    const body = chunks.length
      ? JSON.parse(Buffer.concat(chunks).toString())
      : {};
    if (url.pathname.endsWith("/get_feedback_form_config"))
      return reply(config);
    if (url.pathname.endsWith("/get_published_stop_point"))
      return reply([point]);
    if (url.pathname.endsWith("/list_published_stop_points"))
      return reply([point]);
    if (url.pathname.endsWith("/list_public_stop_point_threads"))
      return reply([
        {
          feedback_id: pointId,
          submitted_at: "2026-11-01T10:00:00Z",
          category_slugs: ["retired", "custom_issue"],
          reply_body: null,
          replied_at: null,
        },
      ]);
    if (url.pathname.endsWith("/create_stop_point_feedback")) {
      reports.push(body);
      return reply("22222222-2222-4222-8222-222222222222");
    }
    if (url.pathname.endsWith("/register_feedback_photo")) {
      registrations.push(body);
      return reply(null);
    }
    return reply({ message: `Unexpected ${url.pathname}` }, 404);
  } catch (error) {
    res.writeHead(500);
    res.end(JSON.stringify({ message: error.message }));
  }
});
await new Promise((resolve) => fixture.listen(0, "127.0.0.1", resolve));
const fixtureUrl = `http://127.0.0.1:${fixture.address().port}`;
const reserve = createServer();
await new Promise((resolve) => reserve.listen(0, "127.0.0.1", resolve));
const port = reserve.address().port;
await new Promise((resolve) => reserve.close(resolve));
const appUrl = `http://127.0.0.1:${port}`;
let app,
  browser,
  log = "";
try {
  app = spawn(
    process.execPath,
    [
      require.resolve("next/dist/bin/next"),
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: appDir,
      detached: true,
      env: {
        ...process.env,
        NODE_ENV: "development",
        NEXT_TELEMETRY_DISABLED: "1",
        NEXT_PUBLIC_SUPABASE_URL: fixtureUrl,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-public-key",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  for (const stream of [app.stdout, app.stderr])
    stream.on("data", (chunk) => {
      log = (log + chunk).slice(-30000);
    });
  const formUrl = `${appUrl}/feedback?point=${pointId}&lang=en`;
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(formUrl, { signal: AbortSignal.timeout(2000) })).ok)
        break;
    } catch {}
    if (i === 119 || app.exitCode !== null)
      throw new Error("Public app did not become ready");
    await delay(250);
  }
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
    headless: true,
    args: ["--no-sandbox"],
  });
  // The HTTP fixture is deliberately outside the production CSP's HTTPS Supabase allowlist.
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    bypassCSP: true,
  });
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(60000);
  // Suppress external map tiles; every tested API is local.
  await page.route("**/*", (route) => {
    const url = route.request().url();
    return url.startsWith(appUrl) ||
      url.startsWith(fixtureUrl) ||
      url.startsWith("blob:")
      ? route.continue()
      : route.abort();
  });
  const open = async () => {
    await page.goto(formUrl);
    await page.locator(".category-list input[value=custom_issue]").waitFor();
    await page.waitForFunction(
      () =>
        document.querySelector(".feedback-wizard") &&
        document.querySelector(".category-list input").getBoundingClientRect()
          .width >= 0,
    );
  };
  // Stop data deliberately arrives after Leaflet; external map tiles remain blocked.
  let releaseStops;
  const stopsGate=new Promise(resolve=>{releaseStops=resolve;});
  let stopsMode='delayed';
  const stop={id:placeId,name_de:'Test',name_it:'Test',name_en:'Test',municipality:'Bolzano',latitude:46.5,longitude:11.35,is_accessible:false,feedback_count:0};
  await page.route(`${appUrl}/api/stops`,async route=>{
    if(stopsMode==='delayed')await stopsGate;
    await route.fulfill({status:stopsMode==='error'?503:200,contentType:'application/json',body:JSON.stringify(stopsMode==='empty'?[]:stopsMode==='error'?{error:'Synthetic failure'}:[stop])});
  });
  await page.goto(appUrl);
  await page.locator('.map-loading .loading-spinner').waitFor();
  await page.locator('.map-surface.leaflet-container').waitFor();
  assert.equal(await page.locator('.map-loading').isVisible(),true);
  releaseStops();stopsMode='ready';
  await page.locator('.map-loading').waitFor({state:'hidden'});
  await page.locator('.map-surface .stop-marker').first().waitFor();
  stopsMode='error';await page.reload();
  await page.locator('.map-loading.error').waitFor();
  assert.equal(await page.locator('.map-loading .loading-spinner').count(),0);
  stopsMode='ready';await page.locator('.map-loading button').click();
  await page.locator('.map-loading').waitFor({state:'hidden'});
  await page.locator('.map-surface .stop-marker').first().waitFor();
  stopsMode='empty';await page.reload();
  await page.locator('.map-loading button').waitFor();
  assert.equal(await page.locator('.map-loading .loading-spinner').count(),0);
  assert.match(await page.locator('.map-loading').innerText(),/veröffentlicht|published|pubblicate/);
  console.log('PASS: loader remains until stop markers render, succeeds without tiles, handles failed requests/retry and empty data');
  await open();
  assert.equal(await page.locator(".category-list input").count(), 2);
  assert.equal(
    await page.locator(".category-list input[value=retired]").count(),
    0,
  );
  assert.match(
    await page.locator("#feedback-threads").innerText(),
    /Retired issue/,
  );
  assert.match(
    await page.locator(".category-list").innerText(),
    /Updated seating label/,
  );
  const icon = page.locator(".category-list label").first().locator("svg");
  assert.equal(await icon.getAttribute("viewBox"), "0 0 48 48");
  assert.equal(await icon.getAttribute("width"), "24");
  assert.equal(
    await icon.locator("script, image, use, foreignObject").count(),
    0,
  );
  await page.locator("[name=categories][value=custom_issue]").check();
  await page.locator("#photo").setInputFiles({
    name: "too-large.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(2097153),
  });
  await page.getByRole("alert").filter({ hasText: /2/ }).waitFor();
  assert.equal(await page.locator(".review-photo").count(), 0);
  const photo = {
    name: "tiny.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6fAIAAAAASUVORK5CYII=",
      "base64",
    ),
  };
  await page.locator("#photo").setInputFiles(photo);
  await page.getByRole("button", { name: "Remove photo", exact: true }).click();
  await page.locator("#photo").setInputFiles(photo);
  await page.locator(".review-photo").waitFor();
  await page.screenshot({
    path: "/tmp/feedback-public-settings.png",
    fullPage: true,
  });
  // Policy changed while this form was open: require review, then allow resubmission.
  config.photos_enabled = false;
  await page.locator("button[type=submit]").click();
  await page
    .getByRole("alert")
    .filter({ hasText: /changed/ })
    .first()
    .waitFor();
  assert.equal(reports.length, 0);
  assert.equal(await page.locator("#photo").count(), 0);
  await page.locator("button[type=submit]:not(:disabled)").waitFor();
  await page.locator("button[type=submit]").click();
  await page.waitForURL((url) => url.pathname === "/feedback/thanks");
  assert.equal(reports.length, 1);
  assert.equal(reports[0].p_upload_token, null);
  assert.equal(uploads.length, 0);
  assert.match(
    await page.locator(".thanks-summary").innerText(),
    /Custom issue/,
  );
  console.log(
    "PASS: dynamic translated categories/icons, retired history, photo limits/removal, policy-change recovery and no-photo submission",
  );
  await open();
  assert.equal(await page.locator("#photo").count(), 0);
  await page.locator("[name=categories][value=custom_issue]").check();
  custom.is_active = false;
  await page.locator("button[type=submit]").click();
  await page
    .getByRole("alert")
    .filter({ hasText: /changed/ })
    .first()
    .waitFor();
  assert.equal(
    await page.locator(".category-list input[value=custom_issue]").count(),
    0,
  );
  assert.equal(reports.length, 1);
  await page.locator("[name=categories][value=constructor]").check();
  await page.locator("button[type=submit]").click();
  await page.waitForURL((url) => url.pathname === "/feedback/thanks");
  assert.deepEqual(reports.at(-1).p_categories, ["constructor"]);
  assert.match(
    await page.locator(".thanks-summary").innerText(),
    /Updated seating label/,
  );
  console.log(
    "PASS: retired selection cannot submit; user can choose another category and retry with current labels",
  );
  config.photos_enabled = true;
  custom.is_active = true;
  await open();
  await page.locator("[name=categories][value=custom_issue]").check();
  await page.locator("#photo").setInputFiles(photo);
  await page.locator("button[type=submit]").click();
  await page.waitForURL((url) => url.pathname === "/feedback/thanks");
  assert.equal(uploads.length, 1);
  assert.equal(registrations.length, 1);
  assert.equal(uploads[0].type, "image/png");
  assert.equal(uploads[0].size, photo.buffer.length);
  assert.ok(reports.at(-1).p_upload_token);
  assert.equal(reports.at(-1).p_photo_extension, "png");
  console.log(
    "PASS: enabled upload uses one exact MIME/size payload, private capability and registration",
  );
  await open();
  await page.locator("[name=categories][value=custom_issue]").check();
  await page.locator("#photo").setInputFiles({
    name: "within-old-limit.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(1500000),
  });
  await page.locator(".review-photo").waitFor();
  config.max_photo_bytes = 1048576;
  await page.locator("button[type=submit]").click();
  await page
    .getByRole("alert")
    .filter({ hasText: /changed/ })
    .first()
    .waitFor();
  assert.equal(reports.length, 3);
  assert.equal(await page.locator(".review-photo").count(), 0);
  await page.locator("button[type=submit]").click();
  await page.waitForURL((url) => url.pathname === "/feedback/thanks");
  assert.equal(reports.length, 4);
  assert.equal(uploads.length, 1);
  console.log(
    "PASS: lowering the photo limit on an open form requires review and permits a safe retry",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await open();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  console.log("PASS: dynamic public categories remain within mobile viewport");
} catch (error) {
  console.error(log);
  throw error;
} finally {
  await browser?.close();
  if (app?.pid) {
    try {
      process.kill(-app.pid, "SIGTERM");
    } catch {}
  }
  fixture.closeAllConnections();
  await new Promise((resolve) => fixture.close(resolve));
}
