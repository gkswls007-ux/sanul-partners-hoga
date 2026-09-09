const { chromium } = require("playwright");
const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const assert = require("node:assert/strict");
const JSZip = require("jszip");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "outputs", "signage-redesign-20260909");
const stagedApp = process.env.TEST_STAGED ? execFileSync("git", ["show", ":app.js"], { cwd: root }) : null;
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = path.resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
    if (!file.startsWith(root + path.sep)) throw new Error("Invalid path");
    const data = stagedApp && pathname === "/app.js" ? stagedApp : await fs.readFile(file);
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});

(async () => {
  await fs.mkdir(output, { recursive: true });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, acceptDownloads: true });
    await context.route("**/*", (route) => route.request().url().startsWith("http://127.0.0.1:") ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      const original = CanvasRenderingContext2D.prototype.fillText;
      window.signageText = [];
      CanvasRenderingContext2D.prototype.fillText = function (text, x, y, ...args) {
        if (this.canvas.id === "signageCanvas") {
          const m = this.measureText(text);
          window.signageText.push({ text, font: this.font, left: x - m.actualBoundingBoxLeft, right: x + m.actualBoundingBoxRight, top: y - m.actualBoundingBoxAscent, bottom: y + m.actualBoundingBoxDescent });
        }
        return original.call(this, text, x, y, ...args);
      };
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => typeof state !== "undefined" && state.rows.length > 0);
    await page.locator('[data-tab="signage"]').click();
    const bounds = [];
    const scenarios = [
      ["overview-two", "overview", "매매", "30평대", [2, 5]],
      ["overview-single", "overview", "매매", "30평대", [2]],
      ["comparison", "comparison", "매매", "30평대", [2, 5]],
      ["trend", "trend", "매매", "30평대", [2, 5]],
      ["rental", "overview", "월세", "30평대", [2, 5]],
      ["rental-single", "overview", "월세", "전체", [2]],
      ["rental-comparison", "comparison", "월세", "전체", [2]],
      ["rental-trend", "trend", "월세", "30평대", [2]],
      ["jeonse", "overview", "전세", "전체", [2, 5]],
      ["all-complexes", "overview", "매매", "전체", []],
    ];
    for (const [name, screen, deal, pyeong, ids] of scenarios) {
      const pages = await page.evaluate(({ screen, deal, pyeong, ids }) => {
        state.signage.selectedComplexes = new Set([...new Set(state.rows.map((row) => row.complex))].filter((name) => !ids.length || ids.some((id) => name.startsWith(`산울${id}단지`))));
        state.signage.screen = screen;
        el.signageDeal.value = deal;
        el.signagePyeong.value = pyeong;
        renderSignageComplexOptions();
        renderSignage();
        return getSignageSlides().length;
      }, { screen, deal, pyeong, ids });
      assert.ok(pages > 0, name);
      for (let i = 0; i < pages; i++) {
        const result = await page.evaluate((index) => {
          state.signage.page = index;
          window.signageText = [];
          renderSignage();
          const canvas = el.signageCanvas;
          const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
          let ink = 0;
          for (let i = 0; i < data.length; i += 4) if (data[i] < 100 && data[i + 1] < 150 && data[i + 2] < 180) ink++;
          return { png: canvas.toDataURL(), text: window.signageText, ink };
        }, i);
        assert.ok(result.ink > 80000, `${name} page ${i} is blank`);
        await fs.writeFile(path.join(output, `${name}-${i + 1}.png`), Buffer.from(result.png.split(",")[1], "base64"));
        const overflow = result.text.filter((item) => item.left < 20 || item.right > 1060 || item.top < 14 || item.bottom > 1920);
        const overlaps = result.text.flatMap((a, index) => result.text.slice(index + 1).filter((b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2).map((b) => [a.text, b.text]));
        bounds.push({ name, page: i + 1, overflow, overlaps, text: result.text });
      }
    }
    await fs.writeFile(path.join(output, "text-bounds.json"), JSON.stringify(bounds, null, 2));
    assert.equal(await page.locator("#signagePage option").count(), 4);
    await page.locator('[data-signage-step="-1"]').click();
    assert.equal(await page.locator("#signagePage").inputValue(), "2");
    await page.locator("#signagePage").selectOption("0");
    const pngPromise = page.waitForEvent("download");
    await page.locator("#downloadSignage").click();
    const png = await pngPromise;
    await png.saveAs(path.join(output, "export-current.png"));
    const zipPromise = page.waitForEvent("download");
    await page.locator("#downloadSignageAll").click();
    const zip = await zipPromise;
    const zipPath = path.join(output, "export-all.zip");
    await zip.saveAs(zipPath);
    const archive = await JSZip.loadAsync(await fs.readFile(zipPath));
    assert.equal(Object.keys(archive.files).length, 4);
    for (const file of Object.values(archive.files)) {
      const data = await file.async("nodebuffer");
      assert.equal(data.readUInt32BE(16), 1080);
      assert.equal(data.readUInt32BE(20), 1920);
      assert.ok(data.length > 30000);
    }
    await page.locator('[data-signage-screen="overview"]').click();
    await page.locator("#signagePyeong").selectOption("30평대");
    await page.locator("#signageTab").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, "desktop.png"), fullPage: true });
    for (const width of [390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      const overflow = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
      assert.ok(overflow.scroll <= overflow.width + 1, JSON.stringify(overflow));
      await page.screenshot({ path: path.join(output, `mobile-${width}.png`), fullPage: true });
    }
    await page.locator("#clearSignageComplexes").click();
    assert.ok(await page.locator("#downloadSignage").isDisabled());
    assert.ok(await page.locator("#downloadSignageAll").isDisabled());
    assert.deepEqual(errors, []);
    const issues = bounds.filter((item) => item.overflow.length || item.overlaps.length).map(({ name, page, overflow, overlaps }) => ({ name, page, overflow, overlaps }));
    console.log(JSON.stringify({ rendered: bounds.length, output, issues }, null, 2));
    assert.deepEqual(issues, [], "Signage text must not overlap or leave the canvas");
    await context.close();
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
