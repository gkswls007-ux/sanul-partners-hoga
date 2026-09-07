const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function app() {
  const nodes = new Map();
  const node = (selector) => {
    if (!nodes.has(selector)) nodes.set(selector, {
      value: "전체", innerHTML: "", textContent: "", hidden: false,
      style: { removeProperty() {}, setProperty() {} },
      classList: { toggle() {} }, querySelector: () => null,
      querySelectorAll: () => [], setAttribute() {},
    });
    return nodes.get(selector);
  };
  node("#searchInput").value = "";
  const storage = new Map();
  const context = vm.createContext({
    document: { querySelector: node, querySelectorAll: () => [] },
    localStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) },
    window: {}, console, alert() {}, confirm: () => true,
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../app.js"), "utf8").replace(/^init\(\);$/m, ""), context);
  return { run: (code) => vm.runInContext(code, context), node, storage };
}

test("same type name in two complexes stays independently selectable", () => {
  const a = app();
  a.run(`state.rows = [
    { complex: "산울2단지", supplyArea: "153A", exclusiveArea: 124, pyeong: 46 },
    { complex: "산울6단지", supplyArea: "153A", exclusiveArea: 112, pyeong: 46 }
  ]; state.selectedTypes.add(typeIdentity(state.rows[0]));`);
  assert.equal(a.run("getAvailableTypes().length"), 2);
  assert.equal(a.run("matchesSelectedType(state.rows[1])"), false);
  assert.match(a.run("getAvailableTypes()[0].label"), /산울/);
});

test("mixed transactions never produce a combined asking-price average", () => {
  const a = app();
  assert.equal(a.run(`analysisValues([{dealType:"매매",price:90000},{dealType:"전세",price:30000}]).length`), 0);
  assert.equal(a.run(`analysisPrice({dealType:"월세",price:5000,convertedDeposit:31000})`), 31000);
  assert.equal(a.run(`analysisPrice({dealType:"월세",price:5000,convertedDeposit:null})`), null);
});

test("listing, trend, summary and date counts share floor and text filters", () => {
  const a = app();
  a.run(`state.rows = [
    {surveyDate:"26년 9월 1주차",complex:"A",floorGroup:"저층",direction:"남향"},
    {surveyDate:"26년 8월 4주차",complex:"A",floorGroup:"저층",direction:"남향"},
    {surveyDate:"26년 9월 1주차",complex:"A",floorGroup:"고층",direction:"남향"}
  ]; state.floors = new Set(["저층"]);`);
  a.node("#searchInput").value = "남향";
  a.node("#dateFilter").value = "26년 9월 1주차";
  assert.equal(a.run("state.rows.filter(row => matchesListingFilters(row)).length"), 1);
  assert.equal(a.run("getSummaryRows().length"), 1);
  assert.equal(a.run("getTrendRows().length"), 2);
  assert.equal(a.run('getDateOptionCounts().get("26년 9월 1주차")'), 1);
});

test("all floors includes records with an unknown floor group", () => {
  assert.equal(app().run('matchesFloor({floorGroup:""})'), true);
});

test("real transaction display groups keep every source row and candidate type", () => {
  const a = app();
  a.run(`state.realTransactions = ["78A", "78A-T1", "78A-S1", "78A-S2"].map(supplyArea => normalizeRealTransaction({
    complex:"해밀1단지", supplyArea, contractDate:"2026-09-02", exclusiveArea:59, floor:7, dealType:"월세", deposit:3000, monthlyRent:100
  }));`);
  assert.equal(a.run("getDisplayRealTransactions().length"), 1);
  assert.equal(a.run("getDisplayRealTransactions()[0].sourceRows.length"), 4);
  a.run("state.selectedTypes.add(typeIdentity(state.realTransactions[0]));");
  assert.equal(a.run("getDisplayRealTransactions()[0].candidateTypes.length"), 4);
  assert.equal(a.run("state.realTransactions.length"), 4);
});

test("incomplete transaction records are never collapsed", () => {
  assert.equal(app().run('groupRealTransactionRows([{complex:"A"}, {complex:"A"}]).length'), 2);
});

test("listing text does not hide otherwise matching real transactions", () => {
  const a = app();
  a.node("#searchInput").value = "남향";
  a.run('state.realTransactions = [{complex:"A"}];');
  assert.equal(a.run("getFilteredRealTransactions({ignoreDate:true}).length"), 1);
});
