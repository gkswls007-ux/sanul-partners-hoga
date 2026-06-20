const state = {
  rows: [],
  filtered: [],
  floorplans: {},
  brokerMap: {},
  basket: [],
  contacts: [],
  selectedCustomerKey: "",
  sort: "priceAsc",
  floors: new Set(["저층", "중층", "고층"]),
  selectedComplexes: new Set(),
  selectedTypes: new Set(),
};

const labels = {
  all: "전체",
};

const el = {
  date: document.querySelector("#dateFilter"),
  complexButton: document.querySelector("#complexFilterButton"),
  complexMenu: document.querySelector("#complexFilterMenu"),
  deal: document.querySelector("#dealFilter"),
  pyeong: document.querySelector("#pyeongFilter"),
  typeButton: document.querySelector("#typeFilterButton"),
  typeMenu: document.querySelector("#typeFilterMenu"),
  search: document.querySelector("#searchInput"),
  topbar: document.querySelector(".topbar"),
  sourceDate: document.querySelector("#sourceDate"),
  sourceCount: document.querySelector("#sourceCount"),
  kpiMinLabel: document.querySelector("#kpiMinLabel"),
  kpiAvgLabel: document.querySelector("#kpiAvgLabel"),
  kpiCount: document.querySelector("#kpiCount"),
  kpiMin: document.querySelector("#kpiMin"),
  kpiAvg: document.querySelector("#kpiAvg"),
  kpiPyeong: document.querySelector("#kpiPyeong"),
  trendAvgLabel: document.querySelector("#trendAvgLabel"),
  trendMinLabel: document.querySelector("#trendMinLabel"),
  trendChart: document.querySelector("#trendChart"),
  convertedDepositNote: document.querySelector("#convertedDepositNote"),
  complexBars: document.querySelector("#complexBars"),
  pyeongCards: document.querySelector("#pyeongCards"),
  listingGrid: document.querySelector("#listingGrid"),
  basketList: document.querySelector("#basketList"),
  contactList: document.querySelector("#contactList"),
  customerName: document.querySelector("#customerNameInput"),
  customerPhone: document.querySelector("#customerPhoneInput"),
  clearBasket: document.querySelector("#clearBasket"),
  clearContacts: document.querySelector("#clearContacts"),
  exportContacts: document.querySelector("#exportContacts"),
  exportCustomerDoc: document.querySelector("#exportCustomerDoc"),
  weeklySummaryBody: document.querySelector("#weeklySummaryBody"),
  areaInventoryBody: document.querySelector("#areaInventoryBody"),
  areaPriceBody: document.querySelector("#areaPriceBody"),
  tabButtons: document.querySelectorAll(".tab-button"),
  summaryTab: document.querySelector("#summaryTab"),
  briefingTab: document.querySelector("#briefingTab"),
  sortButtons: document.querySelectorAll(".sort-button"),
  floorButtons: document.querySelectorAll(".filter-button"),
  floorplanModal: document.querySelector("#floorplanModal"),
  floorplanComplex: document.querySelector("#floorplanComplex"),
  floorplanTitle: document.querySelector("#floorplanTitle"),
  floorplanMeta: document.querySelector("#floorplanMeta"),
  floorplanImages: document.querySelector("#floorplanImages"),
};

init();

async function init() {
  const response = await fetch("./data/listings.json");
  const payload = await response.json();
  state.rows = payload.rows.map(normalizeRow).filter((row) => row.complex);
  state.brokerMap = payload.brokerMap || {};
  state.floorplans = await loadFloorplans();
  loadSavedWork();

  fillFilters();
  bindEvents();
  applyFilters();
}

async function loadFloorplans() {
  try {
    const response = await fetch("./data/floorplans.json");
    if (!response.ok) return {};
    const payload = await response.json();
    return payload.plans || {};
  } catch {
    return {};
  }
}

function normalizeRow(row) {
  return {
    ...row,
    price: toNumber(row.price),
    monthlyRent: toNumber(row.monthlyRent),
    convertedDeposit: toNumber(row.convertedDeposit),
    pyeong: toNumber(row.pyeong),
    exclusiveArea: toNumber(row.exclusiveArea),
    brokerCount: toNumber(row.brokerCount),
    pricePerPyeong: toNumber(row.pricePerPyeong),
    representativeListingId: normalizeListingId(row.representativeListingId),
  };
}

function normalizeListingId(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toNumber(value) {
  if (value === null || value === undefined || value === "" || value === "-") return null;
  const number = Number(String(value).replaceAll(",", ""));
  return Number.isFinite(number) ? number : null;
}

function isMonthlyMode() {
  return el.deal?.value === "월세";
}

function analysisPrice(row) {
  if (isMonthlyMode() && Number.isFinite(row.convertedDeposit)) return row.convertedDeposit;
  return row.price;
}

function analysisPriceForDeal(row, dealType) {
  if (dealType === "월세" && Number.isFinite(row.convertedDeposit)) return row.convertedDeposit;
  return row.price;
}

function analysisPyeongPrice(row) {
  const price = analysisPrice(row);
  if (!Number.isFinite(price) || !Number.isFinite(row.pyeong) || row.pyeong <= 0) return null;
  return price / row.pyeong;
}

function analysisValues(rows) {
  return rows.map(analysisPrice).filter(Number.isFinite);
}

function analysisPyeongValues(rows) {
  return rows.map(analysisPyeongPrice).filter(Number.isFinite);
}

function fillFilters() {
  const dates = unique("surveyDate");
  const latestDate = dates[0] || labels.all;

  setOptions(el.date, dates, latestDate);
  setOptions(el.deal, unique("dealType"), "매매");
  setOptions(el.pyeong, getAvailablePyeongGroups(), labels.all);
  renderMultiSelect("complex", unique("complex"));
  renderMultiSelect("type", getAvailableTypes());
}

function unique(key) {
  return [...new Set(state.rows.map((row) => row[key]).filter(Boolean))].sort(compareKoreanDate);
}

function compareKoreanDate(a, b) {
  const dateA = parseKoreanWeek(a);
  const dateB = parseKoreanWeek(b);
  if (dateA !== dateB) return dateB - dateA;
  return String(a).localeCompare(String(b), "ko");
}

function parseKoreanWeek(value) {
  const match = String(value).match(/(\d+)년\s*(\d+)월\s*(\d+)주차/);
  if (!match) return 0;
  const [, yy, month, week] = match.map(Number);
  return (2000 + yy) * 10000 + month * 100 + week;
}

function setOptions(select, values, selected) {
  select.innerHTML = "";
  const all = document.createElement("option");
  all.value = labels.all;
  all.textContent = labels.all;
  select.append(all);

  values.forEach((value) => {
    const optionValue = typeof value === "object" ? value.value : value;
    const optionLabel = typeof value === "object" ? value.label : value;
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionLabel;
    select.append(option);
  });

  select.value = selected;
}

function renderMultiSelect(name, values) {
  const button = getMultiButton(name);
  const menu = getMultiMenu(name);
  const selected = getMultiSelected(name);
  if (!button || !menu) return;

  const optionValues = values.map((value) => String(typeof value === "object" ? value.value : value));
  [...selected].forEach((value) => {
    if (!optionValues.includes(value)) selected.delete(value);
  });

  const selectedLabels = values
    .filter((value) => selected.has(String(typeof value === "object" ? value.value : value)))
    .map((value) => String(typeof value === "object" ? value.label : value));
  button.textContent = getMultiSelectButtonLabel(selectedLabels);

  menu.innerHTML = [
    `<button type="button" class="multi-option all${selected.size ? "" : " active"}" data-multi-value="${escapeHtml(labels.all)}">
      <span class="multi-check">${selected.size ? "" : "✓"}</span><span>${escapeHtml(labels.all)}</span>
    </button>`,
    ...values.map((value) => {
      const optionValue = String(typeof value === "object" ? value.value : value);
      const optionLabel = String(typeof value === "object" ? value.label : value);
      const active = selected.has(optionValue);
      return `<button type="button" class="multi-option${active ? " active" : ""}" data-multi-value="${escapeHtml(optionValue)}">
        <span class="multi-check">${active ? "✓" : ""}</span><span>${escapeHtml(optionLabel)}</span>
      </button>`;
    }),
  ].join("");
}

function getMultiSelectButtonLabel(selectedLabels) {
  if (!selectedLabels.length) return labels.all;
  if (selectedLabels.length === 1) return selectedLabels[0];
  return `${selectedLabels.length.toLocaleString("ko-KR")}개 선택`;
}

function bindEvents() {
  el.tabButtons.forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  [el.date, el.deal].forEach((control) => {
    control.addEventListener("input", () => {
      refreshPyeongOptions();
      refreshTypeOptions();
      applyFilters();
    });
  });

  bindMultiSelect("complex");
  bindMultiSelect("type");

  el.pyeong.addEventListener("input", () => {
    refreshTypeOptions();
    applyFilters();
  });

  [el.search].forEach((control) => {
    control.addEventListener("input", applyFilters);
  });

  el.sortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.sort = button.dataset.sort;
      el.sortButtons.forEach((item) => item.classList.toggle("active", item === button));
      renderListings();
    });
  });

  el.floorButtons.forEach((button) => {
    button.addEventListener("click", () => {
      toggleFloorFilter(button.dataset.floor);
      renderListings();
    });
  });

  el.listingGrid.addEventListener("click", (event) => {
    const planButton = event.target.closest("[data-plan-key]");
    if (planButton) {
      openFloorplan(planButton.dataset.planKey, planButton.dataset.listingKey);
      return;
    }

    const basketButton = event.target.closest("[data-add-basket]");
    if (basketButton) {
      addBasketItem(basketButton.dataset.addBasket);
    }
  });

  el.basketList?.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-basket]");
    if (removeButton) {
      removeBasketItem(removeButton.dataset.removeBasket);
      return;
    }

    const saveButton = event.target.closest("[data-save-contact]");
    if (saveButton) {
      addContactDraft(saveButton.dataset.saveContact);
    }
  });

  el.contactList?.addEventListener("click", (event) => {
    const customerButton = event.target.closest("[data-select-customer]");
    if (customerButton) {
      state.selectedCustomerKey = customerButton.dataset.selectCustomer;
      renderWorkLists();
      return;
    }

    const removeButton = event.target.closest("[data-remove-contact]");
    if (removeButton) removeContactItem(removeButton.dataset.removeContact);
  });

  el.contactList?.addEventListener("input", (event) => {
    const select = event.target.closest("[data-contact-broker]");
    if (select) updateContactBroker(select.dataset.contactBroker, select.value);
  });

  el.contactList?.addEventListener("change", (event) => {
    const input = event.target.closest("[data-customer-key]");
    if (input) updateContactCustomer(input.dataset.customerKey, input.dataset.customerField, input.value);
  });

  el.contactList?.addEventListener("dragstart", (event) => {
    const item = event.target.closest("[data-contact-id]");
    if (!item || !event.target.closest("[data-drag-contact]")) return;
    event.dataTransfer.setData("text/plain", item.dataset.contactId);
    event.dataTransfer.effectAllowed = "move";
    item.classList.add("dragging");
  });

  el.contactList?.addEventListener("dragover", (event) => {
    const item = event.target.closest("[data-contact-id]");
    if (!item) return;
    event.preventDefault();
    item.classList.add("drag-over");
  });

  el.contactList?.addEventListener("dragleave", (event) => {
    const item = event.target.closest("[data-contact-id]");
    if (item) item.classList.remove("drag-over");
  });

  el.contactList?.addEventListener("drop", (event) => {
    const target = event.target.closest("[data-contact-id]");
    const sourceId = event.dataTransfer.getData("text/plain");
    if (!target || !sourceId) return;
    event.preventDefault();
    reorderContactItem(sourceId, target.dataset.contactId);
  });

  el.contactList?.addEventListener("dragend", () => {
    document.querySelectorAll(".work-item.dragging, .work-item.drag-over").forEach((item) => {
      item.classList.remove("dragging", "drag-over");
    });
  });

  el.clearBasket?.addEventListener("click", () => {
    state.basket = [];
    saveWork();
    renderWorkLists();
  });

  el.clearContacts?.addEventListener("click", () => {
    state.contacts = [];
    saveWork();
    renderWorkLists();
  });

  el.exportContacts?.addEventListener("click", exportContacts);
  el.exportCustomerDoc?.addEventListener("click", exportCustomerDocx);

  document.querySelectorAll("[data-close-floorplan]").forEach((button) => {
    button.addEventListener("click", closeFloorplan);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !el.floorplanModal.hidden) closeFloorplan();
    if (event.key === "Escape") closeMultiSelectMenus();
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".multi-select")) closeMultiSelectMenus();
  });
}

function bindMultiSelect(name) {
  const button = getMultiButton(name);
  const menu = getMultiMenu(name);
  if (!button || !menu) return;

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const nextOpen = menu.hidden;
    closeMultiSelectMenus();
    menu.hidden = !nextOpen;
    button.setAttribute("aria-expanded", String(nextOpen));
  });

  menu.addEventListener("click", (event) => {
    event.stopPropagation();
    const option = event.target.closest("[data-multi-value]");
    if (!option) return;

    const value = option.dataset.multiValue;
    const selected = getMultiSelected(name);
    if (value === labels.all) {
      selected.clear();
    } else if (selected.has(value)) {
      selected.delete(value);
    } else {
      selected.add(value);
    }

    if (name === "complex") {
      refreshPyeongOptions();
      refreshTypeOptions();
    }

    if (name === "type") {
      renderMultiSelect("type", getAvailableTypes());
    }

    applyFilters();
  });
}

function closeMultiSelectMenus() {
  [
    [el.complexButton, el.complexMenu],
    [el.typeButton, el.typeMenu],
  ].forEach(([button, menu]) => {
    if (!button || !menu) return;
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
  });
}

function getMultiSelected(name) {
  return name === "complex" ? state.selectedComplexes : state.selectedTypes;
}

function getMultiButton(name) {
  return name === "complex" ? el.complexButton : el.typeButton;
}

function getMultiMenu(name) {
  return name === "complex" ? el.complexMenu : el.typeMenu;
}

function refreshPyeongOptions() {
  const selected = el.pyeong.value;
  const values = getAvailablePyeongGroups();
  const nextValue = selected === labels.all || values.includes(selected) ? selected : labels.all;
  setOptions(el.pyeong, values, nextValue);
}

function refreshTypeOptions() {
  const values = getAvailableTypes();
  const optionValues = values.map((option) => option.value);
  [...state.selectedTypes].forEach((value) => {
    if (!optionValues.includes(value)) state.selectedTypes.delete(value);
  });
  renderMultiSelect("type", values);
}

function clearFilter(name) {
  if (name === "complex") {
    state.selectedComplexes.clear();
    refreshPyeongOptions();
    refreshTypeOptions();
  }

  if (name === "type") {
    state.selectedTypes.clear();
    refreshTypeOptions();
  }

  applyFilters();
}

function getAvailablePyeongGroups() {
  const rows = state.rows.filter((row) => {
    const matchesDate = el.date.value === labels.all || row.surveyDate === el.date.value;
    const matchesComplex = matchesSelectedComplex(row);
    const matchesDeal = el.deal.value === labels.all || row.dealType === el.deal.value;
    return matchesDate && matchesComplex && matchesDeal && row.pyeongGroup;
  });

  return [...new Set(rows.map((row) => row.pyeongGroup))].sort((a, b) => groupOrder(a) - groupOrder(b));
}

function getAvailableTypes() {
  const rows = state.rows.filter((row) => {
    const matchesDate = el.date.value === labels.all || row.surveyDate === el.date.value;
    const matchesComplex = matchesSelectedComplex(row);
    const matchesDeal = el.deal.value === labels.all || row.dealType === el.deal.value;
    const matchesPyeong = el.pyeong.value === labels.all || row.pyeongGroup === el.pyeong.value;
    return matchesDate && matchesComplex && matchesDeal && matchesPyeong && row.supplyArea;
  });

  const map = new Map();
  rows.forEach((row) => {
    const value = String(row.supplyArea);
    if (!map.has(value)) {
      map.set(value, {
        value,
        label: formatTypeLabel(row),
        pyeong: row.pyeong,
        exclusiveArea: row.exclusiveArea,
      });
    }
  });

  return [...map.values()].sort(compareTypeOptions);
}

function matchesSelectedComplex(row) {
  return !state.selectedComplexes.size || state.selectedComplexes.has(row.complex);
}

function matchesSelectedType(row) {
  return !state.selectedTypes.size || state.selectedTypes.has(String(row.supplyArea));
}

function applyFilters() {
  const query = el.search.value.trim().toLowerCase();
  state.filtered = state.rows.filter((row) => {
    const matchesDate = el.date.value === labels.all || row.surveyDate === el.date.value;
    const matchesComplex = matchesSelectedComplex(row);
    const matchesDeal = el.deal.value === labels.all || row.dealType === el.deal.value;
    const matchesPyeong = el.pyeong.value === labels.all || row.pyeongGroup === el.pyeong.value;
    const matchesType = matchesSelectedType(row);
    const haystack = [row.complex, row.supplyArea, row.building, row.floor, row.features, row.moveIn, row.direction, row.representativeListingId]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return matchesDate && matchesComplex && matchesDeal && matchesPyeong && matchesType && haystack.includes(query);
  });

  render();
}

function render() {
  renderMultiSelect("complex", unique("complex"));
  renderMultiSelect("type", getAvailableTypes());
  const dates = [...new Set(state.filtered.map((row) => row.surveyDate).filter(Boolean))];
  el.sourceDate.textContent = dates.length === 1 ? dates[0] : "선택 조건 기준";
  el.sourceCount.textContent = `${state.filtered.length.toLocaleString("ko-KR")}건`;
  updateHeroImage();
  renderKpis();
  renderOverview();
  renderTrendChart();
  renderComplexBars();
  renderPyeongCards();
  renderListings();
  renderWorkLists();
}

function switchTab(tabName) {
  el.tabButtons.forEach((button) => button.classList.toggle("active", button.dataset.tab === tabName));
  el.summaryTab.hidden = tabName !== "summary";
  el.briefingTab.hidden = tabName !== "briefing";
}

function updateHeroImage() {
  const selectedComplex = [...state.selectedComplexes].join(" ");
  const query = el.search.value.trim();
  const shouldShowComplex5 =
    selectedComplex.includes("산울5단지") ||
    selectedComplex.includes("파밀리에더파크") ||
    query.includes("5단지") ||
    query.includes("파밀리에더파크");

  if (shouldShowComplex5) {
    el.topbar.style.setProperty("--hero-image", 'url("./assets/complex-5.png")');
  } else {
    el.topbar.style.removeProperty("--hero-image");
  }
}

function renderKpis() {
  const monthlyMode = isMonthlyMode();
  const prices = analysisValues(state.filtered);
  const pyeongPrices = analysisPyeongValues(state.filtered);

  el.kpiCount.textContent = `${state.filtered.length.toLocaleString("ko-KR")}건`;
  el.kpiMinLabel.textContent = monthlyMode ? "최저 환산가" : "최저 호가";
  el.kpiAvgLabel.textContent = monthlyMode ? "평균 환산가" : "평균 호가";
  el.trendAvgLabel.textContent = monthlyMode ? "평균 환산가" : "평균 호가";
  el.trendMinLabel.textContent = monthlyMode ? "최저 환산가" : "최저 호가";
  el.convertedDepositNote.hidden = !monthlyMode;
  el.kpiMin.textContent = prices.length ? formatPrice(Math.min(...prices)) : "-";
  el.kpiAvg.textContent = prices.length ? formatPrice(avg(prices)) : "-";
  el.kpiPyeong.textContent = pyeongPrices.length ? Math.round(avg(pyeongPrices)).toLocaleString("ko-KR") : "-";
}

function renderOverview() {
  renderWeeklySummary();
  renderAreaInventory();
  renderAreaPriceRange();
}

function renderWeeklySummary() {
  const grouped = groupBy(getSummaryRows({ ignoreDate: true, ignoreDeal: true }), "surveyDate")
    .map(([date, rows]) => {
      return {
        date,
        counts: countDeals(rows),
      };
    })
    .sort((a, b) => parseKoreanWeek(b.date) - parseKoreanWeek(a.date));

  if (!grouped.length) {
    el.weeklySummaryBody.innerHTML = `<tr><td colspan="4" class="empty-cell">조건에 맞는 주차별 데이터가 없습니다.</td></tr>`;
    return;
  }

  el.weeklySummaryBody.innerHTML = grouped
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.date)}</td>
          <td>${formatCount(item.counts["매매"])}</td>
          <td>${formatCount(item.counts["월세"])}</td>
          <td>${formatCount(item.counts["전세"])}</td>
        </tr>
      `,
    )
    .join("");
}

function renderAreaInventory() {
  const grouped = groupBy(getSummaryRows({ ignoreDeal: true }), areaKey)
    .map(([key, rows]) => {
      const sample = rows[0] || {};
      return {
        key,
        pyeong: sample.pyeong,
        supplyArea: sample.supplyArea,
        exclusiveArea: sample.exclusiveArea,
        counts: countDeals(rows),
      };
    })
    .sort(compareAreaItems);

  el.areaInventoryBody.innerHTML = grouped.length
    ? grouped
        .map(
          (item) => `
            <tr>
              <td>${formatPlainNumber(item.pyeong)}</td>
              <td>${escapeHtml(item.supplyArea ?? "-")}</td>
              <td>${formatPlainNumber(item.exclusiveArea)}</td>
              <td>${formatCount(item.counts["매매"])}</td>
              <td>${formatCount(item.counts["월세"])}</td>
              <td>${formatCount(item.counts["전세"])}</td>
            </tr>
          `,
        )
        .join("")
    : `<tr><td colspan="6" class="empty-cell">조건에 맞는 면적별 데이터가 없습니다.</td></tr>`;
}

function renderAreaPriceRange() {
  const grouped = groupBy(getSummaryRows(), areaKey)
    .map(([key, rows]) => {
      const prices = analysisValues(rows);
      const pricePerPyeong = analysisPyeongValues(rows);
      const sample = rows[0] || {};
      return {
        key,
        pyeong: sample.pyeong,
        supplyArea: sample.supplyArea,
        exclusiveArea: sample.exclusiveArea,
        pyeongGroup: sample.pyeongGroup || "-",
        count: rows.length,
        minPrice: prices.length ? Math.min(...prices) : null,
        maxPrice: prices.length ? Math.max(...prices) : null,
        avgPricePerPyeong: pricePerPyeong.length ? avg(pricePerPyeong) : null,
      };
    })
    .filter((item) => Number.isFinite(item.minPrice))
    .sort(compareAreaItems);

  if (!grouped.length) {
    el.areaPriceBody.innerHTML = `<tr><td colspan="8" class="empty-cell">조건에 맞는 타입별 호가 데이터가 없습니다.</td></tr>`;
    return;
  }

  el.areaPriceBody.innerHTML = grouped
    .map(
      (item) => `
        <tr>
          <td>${formatPlainNumber(item.pyeong)}</td>
          <td>${escapeHtml(item.supplyArea ?? "-")}</td>
          <td>${formatPlainNumber(item.exclusiveArea)}</td>
          <td>${escapeHtml(item.pyeongGroup)}</td>
          <td>${formatPrice(item.minPrice)}</td>
          <td>${formatPrice(item.maxPrice)}</td>
          <td>${formatPlainNumber(item.avgPricePerPyeong)}</td>
          <td>${item.count.toLocaleString("ko-KR")}</td>
        </tr>
      `,
    )
    .join("");
}

function renderTrendChart() {
  const trendRows = getTrendRows();
  const grouped = groupBy(trendRows, "surveyDate")
    .map(([date, rows]) => {
      const prices = analysisValues(rows);
      return {
        date,
        count: rows.length,
        avgPrice: prices.length ? avg(prices) : null,
        minPrice: prices.length ? Math.min(...prices) : null,
      };
    })
    .filter((item) => Number.isFinite(item.avgPrice) && Number.isFinite(item.minPrice))
    .sort((a, b) => parseKoreanWeek(a.date) - parseKoreanWeek(b.date));

  if (grouped.length < 2) {
    el.trendChart.innerHTML = `<div class="empty">추이를 보려면 2개 이상 주차의 데이터가 필요합니다.</div>`;
    return;
  }

  const height = 300;
  const width = Math.max(980, 84 + 24 + (grouped.length - 1) * 92);
  const pad = { top: 22, right: 24, bottom: 58, left: 84 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const prices = grouped.flatMap((item) => [item.avgPrice, item.minPrice]);
  const minPrice = Math.min(...prices) * 0.96;
  const maxPrice = Math.max(...prices) * 1.04;
  const maxCount = Math.max(...grouped.map((item) => item.count), 1);
  const step = chartW / Math.max(grouped.length - 1, 1);
  const barW = Math.min(44, step * 0.46);

  const x = (index) => pad.left + index * step;
  const yPrice = (value) => pad.top + ((maxPrice - value) / (maxPrice - minPrice || 1)) * chartH;
  const yCount = (value) => pad.top + chartH - (value / maxCount) * (chartH * 0.34);
  const avgPoints = grouped.map((item, index) => `${x(index)},${yPrice(item.avgPrice)}`).join(" ");
  const minPoints = grouped.map((item, index) => `${x(index)},${yPrice(item.minPrice)}`).join(" ");
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => maxPrice - (maxPrice - minPrice) * ratio);
  const lastIndex = grouped.length - 1;
  const lastItem = grouped[lastIndex];

  el.trendChart.innerHTML = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="주차별 평균 호가와 최저 호가 추이">
      ${ticks
        .map((tick) => {
          const y = yPrice(tick);
          return `
            <line class="grid-line" x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}"></line>
            <text class="trend-label" x="${pad.left - 12}" y="${y + 4}" text-anchor="end">${formatPrice(tick)}</text>
          `;
        })
        .join("")}
      <line class="axis-line" x1="${pad.left}" y1="${pad.top + chartH}" x2="${width - pad.right}" y2="${pad.top + chartH}"></line>
      ${grouped
        .map((item, index) => {
          const barHeight = pad.top + chartH - yCount(item.count);
          return `
            <rect class="volume-bar" x="${x(index) - barW / 2}" y="${yCount(item.count)}" width="${barW}" height="${barHeight}" rx="4"></rect>
            <text class="trend-label" x="${x(index)}" y="${height - 28}" text-anchor="middle">${escapeHtml(shortWeek(item.date))}</text>
            <text class="trend-label" x="${x(index)}" y="${height - 10}" text-anchor="middle">${item.count.toLocaleString("ko-KR")}건</text>
          `;
        })
        .join("")}
      <polyline class="trend-line-min" points="${minPoints}"></polyline>
      <polyline class="trend-line-avg" points="${avgPoints}"></polyline>
      ${grouped
        .map(
          (item, index) => `
            <circle class="trend-dot-min" cx="${x(index)}" cy="${yPrice(item.minPrice)}" r="4"></circle>
            <circle class="trend-dot-avg" cx="${x(index)}" cy="${yPrice(item.avgPrice)}" r="5"></circle>
            <text class="trend-value" x="${x(index)}" y="${yPrice(item.avgPrice) - 10}" text-anchor="middle">${formatPrice(item.avgPrice)}</text>
          `,
        )
        .join("")}
      <text class="trend-value trend-value-min" x="${x(lastIndex)}" y="${yPrice(lastItem.minPrice) + 18}" text-anchor="end">${formatPrice(lastItem.minPrice)}</text>
    </svg>
  `;
  el.trendChart.scrollLeft = el.trendChart.scrollWidth;
}

function getTrendRows() {
  const query = el.search.value.trim().toLowerCase();
  return state.rows.filter((row) => {
    const matchesComplex = matchesSelectedComplex(row);
    const matchesDeal = el.deal.value === labels.all || row.dealType === el.deal.value;
    const matchesPyeong = el.pyeong.value === labels.all || row.pyeongGroup === el.pyeong.value;
    const matchesType = matchesSelectedType(row);
    const haystack = [row.complex, row.supplyArea, row.building, row.floor, row.features, row.moveIn]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return matchesComplex && matchesDeal && matchesPyeong && matchesType && haystack.includes(query);
  });
}

function getSummaryRows({ ignoreDate = false, ignoreDeal = false } = {}) {
  const query = el.search.value.trim().toLowerCase();
  return state.rows.filter((row) => {
    const matchesDate = ignoreDate || el.date.value === labels.all || row.surveyDate === el.date.value;
    const matchesComplex = matchesSelectedComplex(row);
    const matchesDeal = ignoreDeal || el.deal.value === labels.all || row.dealType === el.deal.value;
    const matchesPyeong = el.pyeong.value === labels.all || row.pyeongGroup === el.pyeong.value;
    const matchesType = matchesSelectedType(row);
    const haystack = [row.complex, row.supplyArea, row.building, row.floor, row.features, row.moveIn]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return matchesDate && matchesComplex && matchesDeal && matchesPyeong && matchesType && haystack.includes(query);
  });
}

function countDeals(rows) {
  return rows.reduce(
    (counts, row) => {
      if (row.dealType in counts) counts[row.dealType] += 1;
      return counts;
    },
    { 매매: 0, 월세: 0, 전세: 0 },
  );
}

function areaKey(row) {
  return [row.pyeong ?? "", row.supplyArea ?? "", row.exclusiveArea ?? "", row.pyeongGroup ?? ""].join("|");
}

function renderComplexBars() {
  const grouped = groupBy(state.filtered, "complex")
    .map(([name, rows]) => ({ name, value: avg(analysisValues(rows)), count: rows.length }))
    .filter((item) => Number.isFinite(item.value))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const max = Math.max(...grouped.map((item) => item.value), 1);

  el.complexBars.innerHTML = grouped.length
    ? grouped
        .map(
          (item) => `
            <div class="bar-row">
              <div class="bar-name" title="${escapeHtml(item.name)}">${escapeHtml(shortName(item.name))}</div>
              <div class="bar-track"><div class="bar-fill" style="width:${Math.max(6, (item.value / max) * 100)}%"></div></div>
              <div class="bar-value">${formatPrice(item.value)}</div>
            </div>
          `,
        )
        .join("")
    : `<div class="empty">조건에 맞는 단지별 데이터가 없습니다.</div>`;
}

function renderPyeongCards() {
  const grouped = groupBy(state.filtered, "pyeongGroup")
    .map(([name, rows]) => {
      const prices = analysisValues(rows);
      return { name, rows, prices };
    })
    .filter((item) => item.prices.length)
    .sort((a, b) => groupOrder(a.name) - groupOrder(b.name));

  el.pyeongCards.innerHTML = grouped.length
    ? grouped
        .map((item) => {
          const min = Math.min(...item.prices);
          const max = Math.max(...item.prices);
          return `
            <div class="mini-card">
              <strong>${escapeHtml(item.name)}</strong>
              <div class="range-line"><span>매물</span><b>${item.rows.length.toLocaleString("ko-KR")}건</b></div>
              <div class="range-line"><span>최저</span><b>${formatPrice(min)}</b></div>
              <div class="range-line"><span>평균</span><b>${formatPrice(avg(item.prices))}</b></div>
              <div class="range-line"><span>최고</span><b>${formatPrice(max)}</b></div>
            </div>
          `;
        })
        .join("")
    : `<div class="empty">조건에 맞는 평형 데이터가 없습니다.</div>`;
}

function renderListings() {
  syncFloorButtons();
  const rows = state.filtered
    .filter((row) => state.floors.has(row.floorGroup))
    .sort(sortListings)
    .slice(0, 24);
  el.listingGrid.innerHTML = rows.length
    ? rows.map(renderListingCard).join("")
    : `<div class="empty">조건에 맞는 매물이 없습니다. 필터를 조금 넓혀보세요.</div>`;
}

function toggleFloorFilter(value) {
  const floors = ["저층", "중층", "고층"];
  if (value === labels.all) {
    state.floors = new Set(floors);
    return;
  }
  if (state.floors.has(value)) {
    state.floors.delete(value);
  } else if (floors.includes(value)) {
    state.floors.add(value);
  }
}

function syncFloorButtons() {
  const floors = ["저층", "중층", "고층"];
  const allSelected = floors.every((floor) => state.floors.has(floor));
  el.floorButtons.forEach((button) => {
    const value = button.dataset.floor;
    const active = value === labels.all ? allSelected : state.floors.has(value);
    button.classList.toggle("active", active);
  });
}

function renderListingCard(row) {
  const detail = [row.supplyArea ? `${row.supplyArea}타입` : "", row.pyeong ? `${row.pyeong}평` : "", row.floorGroup]
    .filter(Boolean)
    .join(" · ");
  const rent = row.dealType === "월세" && row.monthlyRent ? ` / 월 ${row.monthlyRent.toLocaleString("ko-KR")}` : "";
  const planKey = getFloorplanKey(row);
  const plan = state.floorplans[planKey];
  const listingKey = encodeListingKey(row);
  const rowKey = getListingId(row);
  const inBasket = state.basket.some((item) => item.id === rowKey);
  const pyeongPrice = isMonthlyMode() ? analysisPyeongPrice(row) : row.pricePerPyeong;
  const pyeongPriceLabel = isMonthlyMode() ? "환산평당가" : "평당가";

  return `
    <article class="listing-card">
      <div class="listing-top">
        <p class="complex-name">${escapeHtml(shortName(row.complex))}</p>
        <span class="tag">${escapeHtml(row.dealType || "-")}</span>
      </div>
      <div class="price">${formatPrice(row.price)}${rent}</div>
      <div class="facts">
        <div class="fact"><span>타입·평형</span><strong>${escapeHtml(detail || "-")}</strong></div>
        <div class="fact"><span>동·층</span><strong>${escapeHtml([row.building, row.floor].filter(Boolean).join(" ") || "-")}</strong></div>
        <div class="fact"><span>${pyeongPriceLabel}</span><strong>${Number.isFinite(pyeongPrice) ? Math.round(pyeongPrice).toLocaleString("ko-KR") : "-"}</strong></div>
        <div class="fact"><span>중개수</span><strong>${row.brokerCount ? `${row.brokerCount}곳` : "-"}</strong></div>
        <div class="fact"><span>방향</span><strong>${escapeHtml(row.direction || "-")}</strong></div>
        <div class="fact"><span>입주</span><strong>${escapeHtml(formatMoveIn(row.moveIn))}</strong></div>
      </div>
      <div class="features">${escapeHtml(row.features || "특징 정보 없음")}</div>
      <div class="card-actions">
        <button class="basket-button${inBasket ? " saved" : ""}" type="button" data-add-basket="${escapeHtml(rowKey)}">
          ${inBasket ? "담김" : "담기"}
        </button>
        ${
          plan
            ? `<button class="plan-button" type="button" data-plan-key="${escapeHtml(planKey)}" data-listing-key="${escapeHtml(listingKey)}">도면 보기</button>`
            : ""
        }
      </div>
    </article>
  `;
}

function getFloorplanKey(row) {
  return `${row.complex}|${row.supplyArea}`;
}

function getListingId(row) {
  if (row.representativeListingId) return `rep-${row.representativeListingId}`;
  return `listing-${[
    row.surveyDate,
    row.complex,
    row.dealType,
    row.supplyArea,
    row.price,
    row.building,
    row.floor,
    row.features,
  ]
    .map((value) => String(value ?? ""))
    .join("|")}`;
}

function encodeListingKey(row) {
  return encodeURIComponent(
    JSON.stringify({
      complex: row.complex,
      type: row.supplyArea,
      pyeong: row.pyeong,
      exclusiveArea: row.exclusiveArea,
      price: row.price,
      building: row.building,
      floor: row.floor,
      floorGroup: row.floorGroup,
    }),
  );
}

function decodeListingKey(value) {
  try {
    return JSON.parse(decodeURIComponent(value));
  } catch {
    return {};
  }
}

function loadSavedWork() {
  try {
    state.basket = [];
    localStorage.removeItem("hogaBasket");
    state.contacts = JSON.parse(localStorage.getItem("hogaContacts") || "[]");
  } catch {
    state.basket = [];
    state.contacts = [];
  }
}

function saveWork() {
  localStorage.setItem("hogaContacts", JSON.stringify(state.contacts));
}

function addBasketItem(rowId) {
  const row = state.filtered.find((item) => getListingId(item) === rowId) || state.rows.find((item) => getListingId(item) === rowId);
  if (!row) return;
  if (state.basket.some((item) => item.id === rowId)) {
    removeBasketItem(rowId);
    return;
  }
  state.basket.unshift(toSavedListing(row));
  saveWork();
  renderListings();
  renderWorkLists();
}

function removeBasketItem(rowId) {
  state.basket = state.basket.filter((item) => item.id !== rowId);
  saveWork();
  renderListings();
  renderWorkLists();
}

function addContactDraft(rowId) {
  const item = state.basket.find((listing) => listing.id === rowId);
  const customerName = el.customerName?.value.trim() || "";
  const customerPhone = el.customerPhone?.value.trim() || "";
  if (!item) return;
  if (!customerName || !customerPhone) {
    alert("연락 리스트로 옮기기 전에 고객 이름과 핸드폰번호를 입력해주세요.");
    return;
  }
  if (state.contacts.some((contact) => contact.id === rowId && contact.customerName === customerName && contact.customerPhone === customerPhone)) return;
  const contact = {
    ...item,
    contactId: `${item.id}|${Date.now()}`,
    customerName,
    customerPhone,
    brokerName: "",
    individualListingIds: [],
    savedAt: new Date().toLocaleString("ko-KR"),
    status: "미연락",
  };
  state.contacts.unshift(contact);
  saveWork();
  renderWorkLists();
}

function removeContactItem(contactId) {
  state.contacts = state.contacts.filter((item) => item.contactId !== contactId);
  saveWork();
  renderWorkLists();
}

function updateContactBroker(contactId, brokerName) {
  const item = state.contacts.find((contact) => contact.contactId === contactId);
  if (!item) return;
  const broker = getBrokerOptions(item).find((option) => option.brokerName === brokerName);
  item.brokerName = brokerName;
  item.individualListingIds = broker?.individualListingIds || [];
  saveWork();
}

function updateContactCustomer(customerKey, field, value) {
  if (!["customerName", "customerPhone"].includes(field)) return;
  state.contacts
    .filter((item) => getCustomerKey(item) === customerKey)
    .forEach((item) => {
      item[field] = value.trim();
    });
  const updated = state.contacts.find((item) => item[field] === value.trim());
  state.selectedCustomerKey = updated ? getCustomerKey(updated) : "";
  saveWork();
  renderWorkLists();
}

function reorderContactItem(sourceId, targetId) {
  if (sourceId === targetId) return;
  const sourceIndex = state.contacts.findIndex((item) => item.contactId === sourceId);
  const targetIndex = state.contacts.findIndex((item) => item.contactId === targetId);
  if (sourceIndex === -1 || targetIndex === -1) return;

  const source = state.contacts[sourceIndex];
  const target = state.contacts[targetIndex];
  if (getCustomerKey(source) !== getCustomerKey(target)) return;

  const [moved] = state.contacts.splice(sourceIndex, 1);
  const nextTargetIndex = state.contacts.findIndex((item) => item.contactId === targetId);
  state.contacts.splice(nextTargetIndex, 0, moved);
  saveWork();
  renderWorkLists();
}

function toSavedListing(row) {
  return {
    id: getListingId(row),
    surveyDate: row.surveyDate,
    complex: row.complex,
    dealType: row.dealType,
    supplyArea: row.supplyArea,
    exclusiveArea: row.exclusiveArea,
    pyeong: row.pyeong,
    pyeongGroup: row.pyeongGroup,
    building: row.building,
    floor: row.floor,
    floorGroup: row.floorGroup,
    price: row.price,
    monthlyRent: row.monthlyRent,
    pricePerPyeong: row.pricePerPyeong,
    brokerCount: row.brokerCount,
    features: row.features,
    moveIn: row.moveIn,
    direction: row.direction,
    representativeListingId: row.representativeListingId,
  };
}

function renderWorkLists() {
  if (el.basketList) {
    el.basketList.innerHTML = state.basket.length
      ? state.basket.map(renderBasketItem).join("")
      : `<div class="empty compact">담아둔 매물이 없습니다.</div>`;
  }
  if (el.contactList) {
    el.contactList.innerHTML = state.contacts.length
      ? renderContactGroups()
      : `<div class="empty compact">저장된 연락 리스트가 없습니다.</div>`;
  }
}

function renderContactGroups() {
  const groups = groupBy(state.contacts, getCustomerKey);
  if (groups.length === 1) {
    const [customerKey, items] = groups[0];
    state.selectedCustomerKey = customerKey;
    return renderContactGroup(customerKey, items, { showSelector: false });
  }

  if (!groups.some(([customerKey]) => customerKey === state.selectedCustomerKey)) {
    state.selectedCustomerKey = groups[0]?.[0] || "";
  }

  const selector = `
    <div class="customer-selector">
      ${groups
        .map(([customerKey, items]) => {
          const first = items[0] || {};
          const label = [first.customerName || "이름 없음", first.customerPhone].filter(Boolean).join(" · ");
          return `<button type="button" class="${customerKey === state.selectedCustomerKey ? "active" : ""}" data-select-customer="${escapeHtml(customerKey)}">
            <strong>${escapeHtml(label)}</strong>
            <span>${items.length.toLocaleString("ko-KR")}건</span>
          </button>`;
        })
        .join("")}
    </div>
  `;
  const selected = groups.find(([customerKey]) => customerKey === state.selectedCustomerKey) || groups[0];
  return selector + (selected ? renderContactGroup(selected[0], selected[1], { showSelector: true }) : "");
}

function renderContactGroup(customerKey, items, options = {}) {
  const first = items[0] || {};
  return `
    <section class="contact-group${options.showSelector ? " selected" : ""}">
      <div class="customer-head">
        <label>
          이름
          <input type="text" value="${escapeHtml(first.customerName || "")}" data-customer-key="${escapeHtml(customerKey)}" data-customer-field="customerName" />
        </label>
        <label>
          핸드폰
          <input type="text" value="${escapeHtml(first.customerPhone || "")}" data-customer-key="${escapeHtml(customerKey)}" data-customer-field="customerPhone" />
        </label>
        <span>${items.length.toLocaleString("ko-KR")}건</span>
      </div>
      <div class="work-list">${items.map(renderContactItem).join("")}</div>
    </section>
  `;
}

function renderBasketItem(item) {
  const inContacts = state.contacts.some((contact) => contact.id === item.id);
  return `
    <article class="work-item">
      <div>
        <strong>${escapeHtml(shortName(item.complex))}</strong>
        <p>${escapeHtml(formatListingLine(item))}</p>
        <small>${escapeHtml([item.direction, formatMoveIn(item.moveIn), item.features].filter(Boolean).join(" · "))}</small>
      </div>
      <div class="work-controls">
        <button type="button" class="plan-button" data-save-contact="${escapeHtml(item.id)}" ${inContacts ? "disabled" : ""}>${inContacts ? "연락 리스트 담김" : "연락 리스트로"}</button>
        <button type="button" class="ghost-button" data-remove-basket="${escapeHtml(item.id)}">삭제</button>
      </div>
    </article>
  `;
}

function renderContactItem(item) {
  const brokers = getBrokerOptions(item);
  const brokerOptions = [`<option value="">중개사 선택</option>`]
    .concat(
      brokers.map(
        (broker) =>
          `<option value="${escapeHtml(broker.brokerName)}" ${broker.brokerName === item.brokerName ? "selected" : ""}>${escapeHtml(broker.brokerName)}${broker.individualListingIds?.length ? ` (${broker.individualListingIds.length})` : ""}</option>`,
      ),
    )
    .join("");
  return `
    <article class="work-item contact" data-contact-id="${escapeHtml(item.contactId)}">
      <div class="drag-handle" draggable="true" data-drag-contact="${escapeHtml(item.contactId)}" title="순서 이동">↕</div>
      <div>
        <strong>${escapeHtml(shortName(item.complex))}</strong>
        <p>${escapeHtml(formatListingLine(item))}</p>
        <small>${escapeHtml([`대표매물번호 ${item.representativeListingId || "-"}`, item.direction, formatMoveIn(item.moveIn), item.savedAt].filter(Boolean).join(" · "))}</small>
      </div>
      <div class="work-controls">
        <select data-contact-broker="${escapeHtml(item.contactId)}" ${brokers.length ? "" : "disabled"}>${brokerOptions}</select>
        <div class="contact-meta">
        <span>${escapeHtml(item.status || "미연락")}</span>
        <button type="button" class="ghost-button" data-remove-contact="${escapeHtml(item.contactId)}">삭제</button>
        </div>
      </div>
    </article>
  `;
}

function getBrokerOptions(item) {
  if (!item.representativeListingId) return [];
  return state.brokerMap[item.representativeListingId] || [];
}

function getCustomerKey(item) {
  return `${item.customerName || "미지정"}|${item.customerPhone || ""}`;
}

function exportContacts() {
  if (!state.contacts.length) return;
  if (state.contacts.some((item) => !item.brokerName)) {
    alert("연락 리스트의 중개사를 모두 선택한 뒤 엑셀 저장을 눌러주세요.");
    return;
  }
  const headers = [
    "고객명",
    "핸드폰",
    "상태",
    "선택 중개사",
    "선택중개사매물번호",
    "관련 매물번호",
    "단지",
    "거래",
    "호가",
    "월세",
    "타입",
    "평형",
    "동",
    "층",
    "방향",
    "입주가능일",
    "매물특징",
    "저장일시",
  ];
  const excelTextColumns = new Set([1, 4, 5, 12, 13, 17]);
  const rows = state.contacts.map((item) => [
    item.customerName || "",
    item.customerPhone || "",
    item.status || "미연락",
    item.brokerName || "",
    (item.individualListingIds || []).join(", "),
    relatedListingIds(item).join(", "),
    shortName(item.complex),
    item.dealType || "",
    formatPrice(item.price),
    item.dealType === "월세" && Number.isFinite(item.monthlyRent) ? formatPrice(item.monthlyRent) : "",
    item.supplyArea || "",
    item.pyeong ? `${formatPlainNumber(item.pyeong)}평` : "",
    item.building || "",
    item.floor || "",
    item.direction || "",
    formatMoveIn(item.moveIn),
    item.features || "",
    item.savedAt || "",
  ]);
  const html = `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          .text-cell { mso-number-format:"\\@"; }
        </style>
      </head>
      <body>
        <table border="1">
          <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
          <tbody>${rows
            .map((row) => `<tr>${row.map((value, index) => `<td${excelTextColumns.has(index) ? ` class="text-cell" style='mso-number-format:"\\@"'` : ""}>${escapeHtml(value)}</td>`).join("")}</tr>`)
            .join("")}</tbody>
        </table>
      </body>
    </html>
  `;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `연락리스트_${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function relatedListingIds(item) {
  const ids = new Set();
  if (item.representativeListingId) ids.add(item.representativeListingId);
  getBrokerOptions(item).forEach((broker) => {
    (broker.individualListingIds || []).forEach((id) => ids.add(id));
  });
  return [...ids].filter(Boolean);
}

async function exportCustomerDocx() {
  const contacts = getVisibleCustomerContacts();
  if (!contacts.length) return;
  if (!window.docx) {
    alert("워드 파일 생성 모듈을 불러오지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해주세요.");
    return;
  }

  const {
    AlignmentType,
    BorderStyle,
    Document,
    HeadingLevel,
    ImageRun,
    Packer,
    PageBreak,
    Paragraph,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    VerticalAlign,
    WidthType,
  } = window.docx;

  const first = contacts[0];
  const customerName = first.customerName || "고객";
  const customerPhone = first.customerPhone || "";
  const reportDate = new Date().toLocaleDateString("ko-KR");
  const headerImage = await imageToDataUrl("./assets/report-header.png");
  const children = [];
  const reportFont = "페이퍼로지 8 ExtraBold";

  const text = (value, options = {}) => new TextRun({ text: String(value ?? ""), font: reportFont, ...options });
  const paragraph = (value, options = {}) =>
    new Paragraph({
      children: Array.isArray(value) ? value : [text(value, options.textOptions || {})],
      spacing: options.spacing || { after: 120 },
      alignment: options.alignment,
      heading: options.heading,
      border: options.border,
    });
  const cell = (content, options = {}) =>
    new TableCell({
      width: options.width ? { size: options.width, type: WidthType.DXA } : undefined,
      shading: options.shading ? { fill: options.shading } : undefined,
      verticalAlign: VerticalAlign.CENTER,
      margins: options.margins || { top: 120, bottom: 120, left: 120, right: 120 },
      children: Array.isArray(content) ? content : [paragraph(content, { spacing: { after: 0 }, textOptions: options.textOptions || {} })],
    });
  const table = (rows, widths, options = {}) =>
    new Table({
      width: { size: options.width || 9360, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      rows: rows.map(
        (row) =>
          new TableRow({
            children: row.map((item, index) =>
              cell(item.value ?? item, {
                width: widths[index],
                shading: item.header ? "F8FAFC" : item.summary ? "FFF8DF" : undefined,
                textOptions: {
                  ...(options.cellTextOptions || {}),
                  ...(item.header ? { bold: true, color: "334155", ...(options.headerTextOptions || {}) } : {}),
                  ...(item.bold ? { bold: true } : {}),
                  ...(item.textOptions || {}),
                },
                margins: options.cellMargins,
              }),
            ),
          }),
      ),
    });
  const image = (dataUrl, width, height) =>
    new ImageRun({
      data: dataUrlToUint8Array(dataUrl),
      type: "png",
      transformation: { width, height },
    });

  if (headerImage) {
    children.push(
      new Paragraph({
        children: [image(headerImage, 704, 233)],
        spacing: { after: 180 },
      }),
    );
  }

  children.push(
    table(
      [
        [{ value: "고객명", header: true }, `${customerName}${customerPhone ? ` / ${customerPhone}` : ""}`, { value: "제안 매물", header: true }, `${contacts.length.toLocaleString("ko-KR")}건`],
        [{ value: "작성일", header: true }, reportDate, { value: "거래유형", header: true }, formatDealSummary(contacts)],
      ],
      [1500, 3600, 1500, 2760],
    ),
    paragraph("선택 조건별 호가 추이", {
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 220, after: 120 },
      border: { bottom: { color: "235A8F", space: 3, style: BorderStyle.SINGLE, size: 12 } },
    }),
  );

  const trendCharts = await getCustomerTrendChartImages(contacts);
  if (trendCharts.length) {
    trendCharts.forEach((chart, index) => {
      children.push(
        paragraph(chart.title, { spacing: { before: index ? 240 : 80, after: 60 }, textOptions: { bold: true, size: 22 } }),
        new Paragraph({ children: [image(chart.image, 600, 189)], spacing: { after: 40 } }),
        paragraph(chart.note, { spacing: { after: index < trendCharts.length - 1 ? 220 : 140 }, textOptions: { size: 17, color: "64748B" } }),
      );
    });
  } else {
    children.push(paragraph("표시할 추이 조건이 없습니다.", { textOptions: { color: "64748B" } }));
  }

  children.push(
    paragraph("제안 매물 요약", {
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120 },
      border: { bottom: { color: "235A8F", space: 3, style: BorderStyle.SINGLE, size: 12 } },
    }),
    table(
      [
        [
          { value: "단지", header: true, summary: true },
          { value: "거래", header: true, summary: true },
          { value: "호가\n(단위: 만원)", header: true, summary: true },
          { value: "타입/평형", header: true, summary: true },
          { value: "동/층", header: true, summary: true },
          { value: "입주가능일", header: true, summary: true },
        ],
        ...contacts.map((item) => [
          shortName(item.complex),
          item.dealType || "-",
          { value: formatReportPrice(item), bold: true },
          formatAreaDetail(item),
          [item.building, item.floor].filter(Boolean).join(" ") || "-",
          formatMoveIn(item.moveIn),
        ]),
      ],
      [1700, 800, 1100, 2916, 1701, 2268],
      {
        width: 10485,
        cellTextOptions: { size: 16 },
        headerTextOptions: { size: 16 },
        cellMargins: { top: 95, bottom: 95, left: 95, right: 95 },
      },
    ),
    paragraph("※ 본 보고서는 참고용 자료이며, 실제 계약 시 조건은 변동될 수 있습니다.", {
      spacing: { before: 160, after: 120 },
      textOptions: { size: 17, color: "64748B" },
    }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  for (const [index, item] of contacts.entries()) {
    children.push(
      paragraph(`${index + 1}. ${shortName(item.complex)}`, {
        heading: HeadingLevel.HEADING_2,
        spacing: { before: index ? 200 : 0, after: 100 },
        border: { bottom: { color: "235A8F", space: 3, style: BorderStyle.SINGLE, size: 10 } },
      }),
      table(
        [
          [{ value: "거래", header: true }, item.dealType || "-", { value: "호가(단위: 만원)", header: true }, formatReportPrice(item)],
          [{ value: "타입/평형", header: true }, formatAreaDetail(item), { value: "동/층", header: true }, [item.building, item.floor].filter(Boolean).join(" ") || "-"],
          [{ value: "방향", header: true }, item.direction || "-", { value: "입주가능일", header: true }, formatMoveIn(item.moveIn)],
        ],
        [1300, 3380, 1600, 3080],
      ),
      paragraph(item.features || "특징 정보 없음", { spacing: { before: 80, after: 140 } }),
    );

    const plan = state.floorplans[getFloorplanKey(item)];
    if (plan?.images?.length) {
      for (const [imageIndex, src] of plan.images.entries()) {
        const planImage = await imageToDataUrl(src);
        if (!planImage) continue;
        if (plan.images.length > 1) {
          children.push(paragraph(plan.imageLabels?.[imageIndex] || `${imageIndex + 1}F`, { textOptions: { bold: true, color: "235A8F" } }));
        }
        children.push(new Paragraph({ children: [image(planImage, 520, 360)], spacing: { after: 160 }, alignment: AlignmentType.CENTER }));
      }
    }
  }

  const doc = new Document({
    creator: "산울파트너스",
    title: "고객 제안 매물 보고서",
    styles: {
      default: { document: { run: { font: reportFont, size: 20 } } },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `고객제안매물_${safeFilename(customerName)}_${new Date().toISOString().slice(0, 10)}.docx`);
}

async function exportCustomerWord() {
  const contacts = getVisibleCustomerContacts();
  if (!contacts.length) return;

  const first = contacts[0];
  const customerName = first.customerName || "고객";
  const customerPhone = first.customerPhone || "";
  const reportDate = new Date().toLocaleDateString("ko-KR");
  const headerImage = await imageToDataUrl("./assets/report-header.png");
  const dealSummary = formatDealSummary(contacts);
  const trendSections = await renderCustomerTrendSections(contacts);
  const summaryTable = renderCustomerSummaryTable(contacts);
  const cards = await Promise.all(contacts.map(renderCustomerDocListing));
  const html = `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: "Malgun Gothic", Arial, sans-serif; color: #111827; line-height: 1.45; }
          h1 { margin: 0 0 6px; font-size: 24px; }
          h2 { margin: 20px 0 8px; font-size: 18px; border-bottom: 2px solid #235a8f; padding-bottom: 5px; }
          h3 { margin: 16px 0 8px; font-size: 15px; }
          .cover { page-break-after: always; }
          .cover-header { width: 100%; margin: 0 0 18px; }
          .cover-header img { display: block; width: 16cm; height: 5.3cm; border: 0; }
          .meta-grid { width: 100%; border-collapse: collapse; margin: 8px 0 18px; }
          .meta-grid th, .meta-grid td { border: 1px solid #d9e2ec; padding: 8px 10px; font-size: 12px; }
          .meta-grid th { width: 120px; background: #f8fafc; color: #334155; }
          .report-section { margin: 18px 0 20px; }
          .chart-box { margin: 10px 0 14px; padding: 10px; border: 1px solid #d9e2ec; page-break-inside: avoid; }
          .chart-image { display: block; width: 15.87cm; height: 5cm; border: 0; }
          .chart-title { margin: 0 0 6px; font-weight: 800; color: #111827; }
          .chart-note { margin: 4px 0 0; color: #64748b; font-size: 11px; }
          .summary-table th, .summary-table td { font-size: 11px; padding: 5px 6px; }
          .summary-table th { background: #fff8df; text-align: center; }
          .summary-table td { text-align: center; }
          .summary-table .left { text-align: left; }
          .meta { margin-bottom: 16px; color: #4b5563; }
          .listing { page-break-inside: avoid; margin: 0 0 18px; padding: 12px; border: 1px solid #d9e2ec; }
          table { width: 100%; border-collapse: collapse; margin: 6px 0 8px; }
          th, td { border: 1px solid #d9e2ec; padding: 4px 7px; font-size: 12px; line-height: 1.25; text-align: left; vertical-align: middle; }
          th { width: 110px; background: #f1f5f9; }
          .features { margin: 8px 0 12px; line-height: 1.45; }
          .plans { display: block; }
          .plan { margin: 8px 0 16px; }
          .plan-title { margin: 0 0 6px; font-weight: 700; color: #235a8f; }
          img { max-width: 620px; width: auto; height: auto; border: 1px solid #d9e2ec; }
        </style>
      </head>
      <body>
        <section class="cover">
          <div class="cover-header">${headerImage ? `<img src="${headerImage}" width="605" height="200" style="width:16cm;height:5.3cm;border:0;" alt="산울파트너스 고객 제안 매물 보고서" />` : ""}</div>
          <table class="meta-grid">
            <tr><th>고객명</th><td>${escapeHtml(customerName)}${customerPhone ? ` / ${escapeHtml(customerPhone)}` : ""}</td><th>제안 매물</th><td>${contacts.length.toLocaleString("ko-KR")}건</td></tr>
            <tr><th>작성일</th><td>${escapeHtml(reportDate)}</td><th>거래유형</th><td>${escapeHtml(dealSummary)}</td></tr>
          </table>
          <div class="report-section">
            <h2>선택 조건별 호가 추이</h2>
            ${trendSections}
          </div>
          <div class="report-section">
            <h2>제안 매물 요약</h2>
            ${summaryTable}
          </div>
          <p class="chart-note">※ 본 보고서는 참고용 자료이며, 실제 계약 시 조건은 변동될 수 있습니다.</p>
        </section>
        ${cards.join("")}
      </body>
    </html>
  `;
  downloadHtmlFile(html, `고객제안매물_${safeFilename(customerName)}_${new Date().toISOString().slice(0, 10)}.doc`, "application/msword;charset=utf-8");
}

function formatDealSummary(items) {
  const order = ["매매", "전세", "월세"];
  const deals = [...new Set(items.map((item) => item.dealType).filter(Boolean))];
  return deals.sort((a, b) => order.indexOf(a) - order.indexOf(b)).join(" · ") || "-";
}

function renderCustomerSummaryTable(items) {
  return `
    <table class="summary-table">
      <thead>
        <tr>
          <th>단지</th>
          <th>거래</th>
          <th>호가<br />(단위 : 만원)</th>
          <th>타입/평형</th>
          <th>동/층</th>
          <th>입주가능일</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (item) => `
              <tr>
                <td class="left">${escapeHtml(shortName(item.complex))}</td>
                <td>${escapeHtml(item.dealType || "-")}</td>
                <td><strong>${escapeHtml(formatReportPrice(item))}</strong></td>
                <td>${escapeHtml(formatAreaDetail(item))}</td>
                <td>${escapeHtml([item.building, item.floor].filter(Boolean).join(" ") || "-")}</td>
                <td>${escapeHtml(formatMoveIn(item.moveIn))}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function formatReportPrice(item) {
  const price = formatPrice(item.price);
  if (item.dealType === "월세" && Number.isFinite(item.monthlyRent)) return `${price} / 월 ${formatPrice(item.monthlyRent)}`;
  return price;
}

async function renderCustomerTrendSections(items) {
  const selected = getCustomerTrendGroups(items);

  if (!selected.length) return `<p class="chart-note">표시할 추이 조건이 없습니다.</p>`;
  const charts = await Promise.all(selected.map(renderCustomerTrendChart));

  return `
    ${charts.join("")}
  `;
}

function getCustomerTrendGroups(items) {
  return groupBy(items, (item) => JSON.stringify([item.complex || "-", item.dealType || "-", getReportPyeongGroup(item)]))
    .map(([key, rows]) => {
      const [complex, dealType, pyeongGroup] = JSON.parse(key);
      return { complex, dealType, pyeongGroup, count: rows.length };
    })
    .sort(
      (a, b) =>
        String(a.complex).localeCompare(String(b.complex), "ko") ||
        String(a.dealType).localeCompare(String(b.dealType), "ko") ||
        groupOrder(a.pyeongGroup) - groupOrder(b.pyeongGroup) ||
        b.count - a.count,
    );
}

function getCustomerTrendRows(group) {
  return state.rows.filter(
    (row) => row.complex === group.complex && row.dealType === group.dealType && getReportPyeongGroup(row) === group.pyeongGroup,
  );
}

function getCustomerTrendTitle(group) {
  return `${shortName(group.complex)} · ${group.dealType} · ${group.pyeongGroup} ${group.dealType === "월세" ? "환산가" : "호가"} 추이`;
}

function getReportPyeongGroup(item) {
  if (item.pyeongGroup) return item.pyeongGroup;
  if (!Number.isFinite(item.pyeong)) return "기타";
  if (item.pyeong < 20) return "10평대";
  if (item.pyeong < 30) return "20평대";
  if (item.pyeong < 40) return "30평대";
  if (item.pyeong < 50) return "40평대";
  return "50평대";
}

async function renderCustomerTrendChart(group) {
  const rows = getCustomerTrendRows(group);
  const grouped = groupBy(rows, "surveyDate")
    .map(([date, weekRows]) => {
      const prices = weekRows.map((row) => analysisPriceForDeal(row, group.dealType)).filter(Number.isFinite);
      return {
        date,
        count: weekRows.length,
        avgPrice: prices.length ? avg(prices) : null,
        minPrice: prices.length ? Math.min(...prices) : null,
      };
    })
    .filter((item) => Number.isFinite(item.avgPrice) && Number.isFinite(item.minPrice))
    .sort((a, b) => parseKoreanWeek(a.date) - parseKoreanWeek(b.date));

  if (grouped.length < 2) {
    return `
      <div class="chart-box">
        <p class="chart-title">${escapeHtml(getCustomerTrendTitle(group))}</p>
        <p class="chart-note">2개 이상 주차의 데이터가 없어 추이 그래프를 표시하지 않았습니다.</p>
      </div>
    `;
  }

  const width = 660;
  const height = 210;
  const pad = { top: 22, right: 24, bottom: 46, left: 64 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const prices = grouped.flatMap((item) => [item.avgPrice, item.minPrice]);
  const minPrice = Math.min(...prices) * 0.96;
  const maxPrice = Math.max(...prices) * 1.04;
  const maxCount = Math.max(...grouped.map((item) => item.count), 1);
  const step = chartW / Math.max(grouped.length - 1, 1);
  const barW = Math.min(26, step * 0.42);
  const x = (index) => pad.left + index * step;
  const yPrice = (value) => pad.top + ((maxPrice - value) / (maxPrice - minPrice || 1)) * chartH;
  const yCount = (value) => pad.top + chartH - (value / maxCount) * (chartH * 0.32);
  const avgPoints = grouped.map((item, index) => `${x(index)},${yPrice(item.avgPrice)}`).join(" ");
  const minPoints = grouped.map((item, index) => `${x(index)},${yPrice(item.minPrice)}`).join(" ");
  const ticks = [0, 0.5, 1].map((ratio) => maxPrice - (maxPrice - minPrice) * ratio);
  const title = getCustomerTrendTitle(group);
  const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        ${ticks
          .map((tick) => {
            const y = yPrice(tick);
            return `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="#edf1f5" stroke-width="1"></line>
              <text x="${pad.left - 10}" y="${y + 4}" text-anchor="end" font-size="10" font-weight="700" fill="#64748b">${formatPrice(tick)}</text>`;
          })
          .join("")}
        <line x1="${pad.left}" y1="${pad.top + chartH}" x2="${width - pad.right}" y2="${pad.top + chartH}" stroke="#d8e0e7" stroke-width="1"></line>
        ${grouped
          .map((item, index) => {
            const barHeight = pad.top + chartH - yCount(item.count);
            return `<rect x="${x(index) - barW / 2}" y="${yCount(item.count)}" width="${barW}" height="${barHeight}" rx="3" fill="#c7dedf"></rect>
              <text x="${x(index)}" y="${height - 26}" text-anchor="middle" font-size="10" font-weight="700" fill="#64748b">${escapeHtml(shortWeek(item.date))}</text>
              <text x="${x(index)}" y="${height - 10}" text-anchor="middle" font-size="10" font-weight="700" fill="#64748b">${item.count.toLocaleString("ko-KR")}건</text>`;
          })
          .join("")}
        <polyline points="${minPoints}" fill="none" stroke="#b77916" stroke-width="2" stroke-dasharray="5 5"></polyline>
        <polyline points="${avgPoints}" fill="none" stroke="#245f98" stroke-width="2.4"></polyline>
        ${grouped
          .map(
            (item, index) => `<circle cx="${x(index)}" cy="${yPrice(item.minPrice)}" r="3" fill="#b77916"></circle>
              <circle cx="${x(index)}" cy="${yPrice(item.avgPrice)}" r="4" fill="#245f98"></circle>
              <text x="${x(index)}" y="${yPrice(item.avgPrice) - 7}" text-anchor="middle" font-size="10" font-weight="800" fill="#111827">${formatPrice(item.avgPrice)}</text>`,
          )
          .join("")}
      </svg>`;
  const chartImage = await svgToPngDataUrl(svg, width, height);

  return `
    <div class="chart-box">
      <p class="chart-title">${escapeHtml(title)}</p>
      ${chartImage ? `<img class="chart-image" src="${chartImage}" width="600" height="189" style="width:15.87cm;height:5cm;border:0;" alt="${escapeHtml(title)}" />` : svg}
      <p class="chart-note">파란선: 평균 ${group.dealType === "월세" ? "환산가" : "호가"} · 점선: 최저 ${group.dealType === "월세" ? "환산가" : "호가"} · 막대: 매물 수</p>
      ${group.dealType === "월세" ? `<p class="chart-note">환산보증금 : 월세 1만원 당 보증금 200만원 (연6% 전월세 전환율 가정)</p>` : ""}
    </div>
  `;
}

function svgToPngDataUrl(svg, width, height) {
  return new Promise((resolve) => {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      try {
        const scale = 2;
        const canvas = document.createElement("canvas");
        canvas.width = width * scale;
        canvas.height = height * scale;
        const context = canvas.getContext("2d");
        context.scale(scale, scale);
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve("");
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve("");
    };
    image.src = url;
  });
}

async function getCustomerTrendChartImages(items) {
  const groups = getCustomerTrendGroups(items);
  const charts = await Promise.all(groups.map(renderCustomerTrendChartImage));
  return charts.filter((chart) => chart?.image);
}

async function renderCustomerTrendChartImage(group) {
  const rows = getCustomerTrendRows(group);
  const grouped = groupBy(rows, "surveyDate")
    .map(([date, weekRows]) => {
      const prices = weekRows.map((row) => analysisPriceForDeal(row, group.dealType)).filter(Number.isFinite);
      return {
        date,
        count: weekRows.length,
        avgPrice: prices.length ? avg(prices) : null,
        minPrice: prices.length ? Math.min(...prices) : null,
      };
    })
    .filter((item) => Number.isFinite(item.avgPrice) && Number.isFinite(item.minPrice))
    .sort((a, b) => parseKoreanWeek(a.date) - parseKoreanWeek(b.date));

  if (grouped.length < 2) return null;

  const width = 660;
  const height = 210;
  const pad = { top: 22, right: 24, bottom: 46, left: 64 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const prices = grouped.flatMap((item) => [item.avgPrice, item.minPrice]);
  const minPrice = Math.min(...prices) * 0.96;
  const maxPrice = Math.max(...prices) * 1.04;
  const maxCount = Math.max(...grouped.map((item) => item.count), 1);
  const step = chartW / Math.max(grouped.length - 1, 1);
  const barW = Math.min(26, step * 0.42);
  const x = (index) => pad.left + index * step;
  const yPrice = (value) => pad.top + ((maxPrice - value) / (maxPrice - minPrice || 1)) * chartH;
  const yCount = (value) => pad.top + chartH - (value / maxCount) * (chartH * 0.32);
  const avgPoints = grouped.map((item, index) => `${x(index)},${yPrice(item.avgPrice)}`).join(" ");
  const minPoints = grouped.map((item, index) => `${x(index)},${yPrice(item.minPrice)}`).join(" ");
  const ticks = [0, 0.5, 1].map((ratio) => maxPrice - (maxPrice - minPrice) * ratio);
  const title = getCustomerTrendTitle(group);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="#ffffff"></rect>
      ${ticks
        .map((tick) => {
          const y = yPrice(tick);
          return `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="#edf1f5" stroke-width="1"></line>
            <text x="${pad.left - 10}" y="${y + 4}" text-anchor="end" font-size="10" font-weight="700" fill="#64748b">${formatPrice(tick)}</text>`;
        })
        .join("")}
      <line x1="${pad.left}" y1="${pad.top + chartH}" x2="${width - pad.right}" y2="${pad.top + chartH}" stroke="#d8e0e7" stroke-width="1"></line>
      ${grouped
        .map((item, index) => {
          const barHeight = pad.top + chartH - yCount(item.count);
          return `<rect x="${x(index) - barW / 2}" y="${yCount(item.count)}" width="${barW}" height="${barHeight}" rx="3" fill="#c7dedf"></rect>
            <text x="${x(index)}" y="${height - 26}" text-anchor="middle" font-size="10" font-weight="700" fill="#64748b">${escapeHtml(shortWeek(item.date))}</text>
            <text x="${x(index)}" y="${height - 10}" text-anchor="middle" font-size="10" font-weight="700" fill="#64748b">${item.count.toLocaleString("ko-KR")}건</text>`;
        })
        .join("")}
      <polyline points="${minPoints}" fill="none" stroke="#b77916" stroke-width="2" stroke-dasharray="5 5"></polyline>
      <polyline points="${avgPoints}" fill="none" stroke="#245f98" stroke-width="2.4"></polyline>
      ${grouped
        .map(
          (item, index) => `<circle cx="${x(index)}" cy="${yPrice(item.minPrice)}" r="3" fill="#b77916"></circle>
            <circle cx="${x(index)}" cy="${yPrice(item.avgPrice)}" r="4" fill="#245f98"></circle>
            <text x="${x(index)}" y="${yPrice(item.avgPrice) - 7}" text-anchor="middle" font-size="10" font-weight="800" fill="#111827">${formatPrice(item.avgPrice)}</text>`,
        )
        .join("")}
    </svg>`;

  return {
    title,
    image: await svgToPngDataUrl(svg, width, height),
    note: `파란선: 평균 ${group.dealType === "월세" ? "환산가" : "호가"} · 점선: 최저 ${group.dealType === "월세" ? "환산가" : "호가"} · 막대: 매물 수`,
  };
}

function getVisibleCustomerContacts() {
  const groups = groupBy(state.contacts, getCustomerKey);
  if (groups.length <= 1) return state.contacts;
  const selected = groups.find(([customerKey]) => customerKey === state.selectedCustomerKey) || groups[0];
  return selected?.[1] || [];
}

async function renderCustomerDocListing(item, index) {
  const plan = state.floorplans[getFloorplanKey(item)];
  const planImages = plan ? (await Promise.all(plan.images.map((src) => imageToDataUrl(src)))).filter(Boolean) : [];
  return `
    <section class="listing">
      <h2>${index + 1}. ${escapeHtml(shortName(item.complex))}</h2>
      <table>
        <tr><th>거래</th><td>${escapeHtml(item.dealType || "-")}</td><th>호가(단위 : 만원)</th><td>${escapeHtml(formatPrice(item.price))}${item.dealType === "월세" && Number.isFinite(item.monthlyRent) ? ` / 월 ${escapeHtml(formatPrice(item.monthlyRent))}` : ""}</td></tr>
        <tr><th>타입/평형</th><td>${escapeHtml(formatAreaDetail(item))}</td><th>동/층</th><td>${escapeHtml([item.building, item.floor].filter(Boolean).join(" ") || "-")}</td></tr>
        <tr><th>방향</th><td>${escapeHtml(item.direction || "-")}</td><th>입주가능일</th><td>${escapeHtml(formatMoveIn(item.moveIn))}</td></tr>
      </table>
      <div class="features">${escapeHtml(item.features || "특징 정보 없음")}</div>
      ${
        planImages.length
          ? `<div class="plans">${planImages
              .map(
                (src, imageIndex) => `
                  <div class="plan">
                    ${planImages.length > 1 ? `<p class="plan-title">${escapeHtml(plan.imageLabels?.[imageIndex] || `${imageIndex + 1}F`)}</p>` : ""}
                    <img src="${src}" alt="${escapeHtml(item.supplyArea || "")} 도면" />
                  </div>
                `,
              )
              .join("")}</div>`
          : ""
      }
    </section>
  `;
}

async function imageToDataUrl(src) {
  try {
    const response = await fetch(src);
    if (!response.ok) return "";
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result || "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

function downloadHtmlFile(html, filename, type) {
  const blob = new Blob([html], { type });
  downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function dataUrlToUint8Array(dataUrl) {
  const base64 = String(dataUrl).split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function safeFilename(value) {
  return String(value || "고객").replace(/[\\/:*?"<>|]/g, "_").trim() || "고객";
}

function formatAreaDetail(item) {
  const exclusive = Number.isFinite(item.exclusiveArea) ? `전용 ${formatPlainNumber(item.exclusiveArea)}㎡` : "";
  const supply = item.supplyArea ? `공급 ${item.supplyArea}타입` : "";
  const pyeong = Number.isFinite(item.pyeong) ? `${formatPlainNumber(item.pyeong)}평` : "";
  return [exclusive, supply, pyeong].filter(Boolean).join(" / ") || "-";
}

function formatListingLine(item) {
  const rent = item.dealType === "월세" && item.monthlyRent ? ` / 월 ${item.monthlyRent.toLocaleString("ko-KR")}` : "";
  return [
    item.dealType,
    `${formatPrice(item.price)}${rent}`,
    item.supplyArea ? `${item.supplyArea}타입` : "",
    item.pyeong ? `${formatPlainNumber(item.pyeong)}평` : "",
    [item.building, item.floor].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(" · ");
}

function cssEscape(value) {
  if (window.CSS?.escape) return CSS.escape(value);
  return String(value).replaceAll('"', '\\"');
}

function openFloorplan(planKey, listingKey) {
  const plan = state.floorplans[planKey];
  if (!plan) return;
  const listing = decodeListingKey(listingKey);
  const typeLabel = [
    plan.type,
    listing.exclusiveArea ? `전용 ${formatPlainNumber(listing.exclusiveArea)}` : "",
    listing.pyeong ? `${formatPlainNumber(listing.pyeong)}평` : "",
  ]
    .filter(Boolean)
    .join(" / ");

  el.floorplanComplex.textContent = shortName(plan.complex);
  el.floorplanTitle.textContent = typeLabel || `${plan.type} 도면`;
  el.floorplanMeta.innerHTML = [
    ["구조", plan.structure],
    ["세대수", plan.householdCount],
    ["방/욕실", plan.roomsBaths],
    ["매물", listing.price ? `${formatPrice(listing.price)} · ${[listing.building, listing.floor].filter(Boolean).join(" ")}` : ""],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");
  el.floorplanImages.innerHTML = plan.images
    .map(
      (src, index) => `
        <figure>
          ${plan.images.length > 1 ? `<figcaption>${escapeHtml(plan.imageLabels?.[index] || `${index + 1}F`)}</figcaption>` : ""}
          <img src="${escapeHtml(src)}" alt="${escapeHtml(plan.type)} 도면 ${index + 1}" />
        </figure>
      `,
    )
    .join("");
  el.floorplanImages.classList.toggle("duplex", plan.images.length > 1);
  el.floorplanModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeFloorplan() {
  el.floorplanModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function sortListings(a, b) {
  const priceA = analysisPrice(a);
  const priceB = analysisPrice(b);
  if (state.sort === "priceDesc") return nullLast(priceB, priceA);
  if (state.sort === "pyeongPriceAsc") return nullLast(analysisPyeongPrice(a), analysisPyeongPrice(b)) || nullLast(priceA, priceB);
  return nullLast(priceA, priceB);
}

function nullLast(a, b) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function numericValues(rows, key) {
  return rows.map((row) => row[key]).filter((value) => Number.isFinite(value));
}

function avg(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function groupBy(rows, key) {
  const map = new Map();
  rows.forEach((row) => {
    const name = (typeof key === "function" ? key(row) : row[key]) || "기타";
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(row);
  });
  return [...map.entries()];
}

function groupOrder(value) {
  const order = ["10평대", "20평대", "30평대", "40평대", "50평대 이상"];
  const index = order.indexOf(value);
  return index === -1 ? 99 : index;
}

function compareType(a, b) {
  const numberA = parseFloat(String(a).replace(/[^\d.]/g, ""));
  const numberB = parseFloat(String(b).replace(/[^\d.]/g, ""));
  if (Number.isFinite(numberA) && Number.isFinite(numberB) && numberA !== numberB) return numberA - numberB;
  return String(a).localeCompare(String(b), "ko", { numeric: true });
}

function compareTypeOptions(a, b) {
  const pyeongA = Number(a.pyeong);
  const pyeongB = Number(b.pyeong);
  if (Number.isFinite(pyeongA) && Number.isFinite(pyeongB) && pyeongA !== pyeongB) return pyeongA - pyeongB;

  const exclusiveA = Number(a.exclusiveArea);
  const exclusiveB = Number(b.exclusiveArea);
  if (Number.isFinite(exclusiveA) && Number.isFinite(exclusiveB) && exclusiveA !== exclusiveB) {
    return exclusiveA - exclusiveB;
  }

  return compareType(a.value, b.value);
}

function compareAreaItems(a, b) {
  const pyeongA = Number(a.pyeong);
  const pyeongB = Number(b.pyeong);
  if (Number.isFinite(pyeongA) && Number.isFinite(pyeongB) && pyeongA !== pyeongB) return pyeongA - pyeongB;
  if (Number.isFinite(pyeongA) !== Number.isFinite(pyeongB)) return Number.isFinite(pyeongA) ? -1 : 1;

  const exclusiveA = Number(a.exclusiveArea);
  const exclusiveB = Number(b.exclusiveArea);
  if (Number.isFinite(exclusiveA) && Number.isFinite(exclusiveB) && exclusiveA !== exclusiveB) return exclusiveA - exclusiveB;

  return compareType(a.supplyArea ?? "", b.supplyArea ?? "");
}

function shortName(value) {
  return String(value)
    .replace("세종", "")
    .replace("마스터힐스", "마스터힐스")
    .replace("(주상복합)", "");
}

function shortWeek(value) {
  return String(value).replace(/^26년\s*/, "").replace("주차", "주");
}

function formatTypeLabel(row) {
  const plan = state.floorplans[getFloorplanKey(row)];
  const parts = [
    row.supplyArea,
    row.exclusiveArea ? `전용 ${formatPlainNumber(row.exclusiveArea)}` : "",
    row.pyeong ? `${formatPlainNumber(row.pyeong)}평` : "",
    plan?.householdCount || "",
  ].filter(Boolean);
  return parts.join(" / ");
}

function formatPrice(value) {
  if (!Number.isFinite(value)) return "-";
  return Math.round(value).toLocaleString("ko-KR");
}

function formatMoveIn(value) {
  if (!value) return "-";
  return String(value);
}

function formatCount(value) {
  return value ? value.toLocaleString("ko-KR") : "";
}

function formatPlainNumber(value) {
  if (!Number.isFinite(Number(value))) return escapeHtml(value ?? "-");
  return Math.round(Number(value)).toLocaleString("ko-KR");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
