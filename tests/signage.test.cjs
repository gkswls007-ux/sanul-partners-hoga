const test = require("node:test");
const assert = require("node:assert/strict");
const signage = require("../signage.js");

const row = (fields = {}) => ({ complex: "산울2단지", surveyDate: "26년 9월 1주차", dealType: "매매", pyeongGroup: "30평대", pyeong: 31, price: 69000, supplyArea: "105A1", ...fields });
const slides = (rows, options = {}) => signage.createSlides({ rows, complexes: ["산울2단지"], ...options });

test("money makes units explicit and rounds only approximate averages", () => {
  assert.equal(signage.money(69000), "6억 9천만원");
  assert.equal(signage.money(60500), "6억 500만원");
  assert.equal(signage.money(89422, true), "약 8억 9천만원");
  assert.equal(signage.money(130), "130만원");
  assert.equal(signage.money(null), "자료 없음");
  assert.equal(signage.money(0), "0원");
  assert.equal(signage.money(300, true), "약 300만원");
  assert.equal(signage.valueOf(row({ price: 0 }), "매매"), null);
});

test("overview paginates all selected complexes in order without four-complex truncation", () => {
  const complexes = Array.from({ length: 7 }, (_, i) => `단지${i}`);
  const result = slides(complexes.map((complex) => row({ complex })), { complexes });
  assert.equal(result.length, 4);
  assert.deepEqual(result.flatMap((slide) => slide.groups.map((group) => group.name)), complexes);
  assert.deepEqual(result.map((slide) => slide.index), [0, 1, 2, 3]);
  assert.ok(result.every((slide) => slide.total === 4));
});

test("current figures share complex, deal, size and latest survey scope without mutating input", () => {
  const rows = [row(), row({ price: 79000 }), row({ surveyDate: "26년 8월 4주차", price: 40000 }), row({ complex: "다른단지" }), row({ dealType: "전세", price: 20000 }), row({ pyeongGroup: "40평대", pyeong: 41 })];
  const before = JSON.stringify(rows);
  const result = slides(rows, { pyeong: "30평대" });
  assert.equal(result[0].groups[0].count, 2);
  assert.equal(result[0].groups[0].min, 69000);
  assert.equal(result[0].groups[0].avg, 74000);
  assert.equal(JSON.stringify(rows), before);
});

test("monthly rental examples preserve real pairs instead of joining unrelated minima", () => {
  const rows = [row({ dealType: "월세", price: 1000, monthlyRent: 140 }), row({ dealType: "월세", price: 20000, monthlyRent: 50 })];
  const result = slides(rows, { deal: "월세" })[0].groups[0];
  assert.equal(result.first.price, 1000);
  assert.equal(result.first.monthlyRent, 140);
  assert.equal(result.min, 29000);
  assert.equal(signage.valueOf(row({ price: null, monthlyRent: 30 }), "월세"), null);
  assert.equal(signage.valueOf(row({ price: 0, monthlyRent: 30 }), "월세"), 6000);
  assert.equal(signage.valueOf(row({ monthlyRent: null }), "월세"), null);
});

test("comparison uses actual sizes and at most three size groups per image", () => {
  const result = slides([31, 32, 37, 38, 40].map((pyeong) => row({ pyeong })), { screen: "comparison" });
  assert.equal(result.length, 2);
  assert.deepEqual(result[0].areas.map((area) => area.pyeong), [31, 32, 37]);
  assert.deepEqual(result[1].areas.map((area) => area.pyeong), [38, 40]);
});

test("missing current data is not silently replaced by old prices", () => {
  const rows = [row({ surveyDate: "26년 8월 1주차" }), row({ complex: "다른단지" })];
  const current = slides(rows)[0];
  assert.equal(current.hasData, false);
  assert.equal(current.groups[0].min, null);
  const trend = slides(rows, { screen: "trend" })[0];
  assert.equal(trend.hasData, true);
  assert.notEqual(trend.groups[0].weeks.at(-1).date, trend.latest);
});

test("trend preserves observed dates, handles year boundaries, and limits to ten observations", () => {
  const rows = Array.from({ length: 12 }, (_, i) => row({ surveyDate: `26년 ${i + 1}월 1주차`, price: 60000 + i * 1000 }));
  rows.push(row({ surveyDate: "27년 1월 1주차", price: 75000 }));
  const result = slides(rows, { screen: "trend" })[0];
  assert.equal(result.latest, "27년 1월 1주차");
  assert.equal(result.groups[0].weeks.length, 10);
  assert.equal(result.groups[0].weeks[0].date, "26년 4월 1주차");
  assert.deepEqual(slides(rows, { complexes: [] }), []);
});
