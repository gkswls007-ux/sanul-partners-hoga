const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({
  document: { querySelector: () => ({}), querySelectorAll: () => [] },
  localStorage: { getItem: () => null }, window: {}, console,
});
const run = code => vm.runInContext(code, context);
run(fs.readFileSync(path.join(root, 'app.js'), 'utf8').replace(/^init\(\);$/m, ''));
for (const length of [0, 1, 2, 7, 8, 23, 52, 104]) {
  const indices = Array.from(run(`getCustomerTrendLabelIndices(${length}, 572)`));
  assert.equal(indices.length, Math.min(length, 7));
  if (length) {
    assert.equal(indices[0], 0);
    assert.equal(indices.at(-1), length - 1);
  }
  for (let i = 1; i < indices.length; i++) {
    assert.ok((indices[i] - indices[i - 1]) * 572 / (length - 1) > 50);
  }
}
context.rows = JSON.parse(fs.readFileSync(path.join(root, 'data/listings.json'), 'utf8')).rows;
run('state.datasets["세종"] = { rows: rows.map(normalizeRow) }; svgToPngDataUrl = async svg => { globalThis.svg = svg; return ""; };');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 700, height: 780 } });
    const charts = [];
    for (const [dealType, pyeongGroup] of [['매매', '30평대'], ['월세', '30평대'], ['월세', '40평대']]) {
      context.group = { region: '세종', complex: '산울2단지세종자이더시티', dealType, pyeongGroup };
      const weeks = run('new Set(getCustomerTrendRows(group).map(row => row.surveyDate)).size');
      for (const renderer of ['renderCustomerTrendChart', 'renderCustomerTrendChartImage']) {
        await run(`${renderer}(group)`);
        await page.setContent(context.svg);
        assert.equal(await page.locator('circle').count(), weeks * 2);
        assert.equal(await page.locator('rect[fill="#c7dedf"]').count(), weeks);
        assert.equal(await page.locator('text[fill="#111827"]').count(), Math.min(weeks, 7));
        assert.equal(await page.locator('text[fill="#b77916"]').count(), 1);
        const overlaps = await page.locator('text').evaluateAll(nodes => {
          const boxes = nodes.map(node => ({ text: node.textContent, box: node.getBoundingClientRect() }));
          return boxes.flatMap((a, i) => boxes.slice(i + 1).filter(b =>
            a.box.left < b.box.right && a.box.right > b.box.left &&
            a.box.top < b.box.bottom && a.box.bottom > b.box.top
          ).map(b => [a.text, b.text]));
        });
        assert.deepEqual(overlaps, []);
      }
      charts.push(`<h3>${dealType} ${pyeongGroup}</h3>${context.svg}`);
      console.log(`${dealType} ${pyeongGroup}: ${weeks} weeks retained, labels do not overlap`);
    }
    await page.setContent(`<style>body{font-family:Arial,sans-serif}h3{margin:8px}</style>${charts.join('')}`);
    fs.mkdirSync(path.join(root, 'outputs/customer-trend'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'outputs/customer-trend/preview.png'), fullPage: true });
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
