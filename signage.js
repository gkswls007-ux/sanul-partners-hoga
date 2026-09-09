(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HogaSignage = api;
})(typeof window === "undefined" ? globalThis : window, function () {
  "use strict";

  const WIDTH = 1080;
  const HEIGHT = 1920;
  const C = { ink: "#172832", muted: "#465a65", blue: "#215b87", teal: "#14766b", red: "#a93e37", yellow: "#f4d565", line: "#cbd7dc", paper: "#ffffff", soft: "#edf4f5" };
  const FONT = '"Malgun Gothic", "Noto Sans KR", "Segoe UI", sans-serif';
  const number = (value) => value === null || value === undefined || value === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null;
  const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const chunks = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
  const unique = (items) => [...new Set(items)];

  function weekKey(value) {
    const match = String(value || "").match(/(\d+)년\s*(\d+)월\s*(\d+)주차/);
    return match ? Number(match[1]) * 10000 + Number(match[2]) * 100 + Number(match[3]) : 0;
  }

  function shortWeek(value) {
    const match = String(value || "").match(/(\d+)월\s*(\d+)주차/);
    return match ? `${match[1]}월 ${match[2]}주` : String(value || "자료 없음");
  }

  function complexName(name) {
    const match = String(name).match(/^(산울|해밀)(\d+)단지/);
    return match ? `${match[1]}${match[2]}단지` : String(name);
  }

  function complexDetail(name) {
    return String(name).replace(/^(산울|해밀)\d+단지/, "").replace(/세종/g, "").replace(/\(주상복합\)/g, "").trim();
  }

  function money(value, approximate = false) {
    if (!Number.isFinite(value)) return "자료 없음";
    const step = approximate ? (value >= 10000 ? 1000 : value >= 1000 ? 100 : 1) : 1;
    const amount = Math.round(value / step) * step;
    const eok = Math.floor(amount / 10000);
    const remainder = amount % 10000;
    let text;
    if (!amount) text = "0원";
    else if (!remainder) text = `${eok}억원`;
    else {
      const rest = remainder % 1000 === 0 ? `${remainder / 1000}천만원` : `${remainder.toLocaleString("ko-KR")}만원`;
      text = eok ? `${eok}억 ${rest}` : rest;
    }
    return `${approximate ? "약 " : ""}${text}`;
  }

  function valueOf(row, deal) {
    const price = number(row.price);
    if (price === null || price < 0) return null;
    if (deal !== "월세") return price > 0 ? price : null;
    const rent = number(row.monthlyRent);
    if (rent === null || rent < 0) return null;
    return price + rent * 200;
  }

  function stats(rows, deal) {
    const priced = rows.filter((row) => Number.isFinite(valueOf(row, deal))).sort((a, b) => valueOf(a, deal) - valueOf(b, deal));
    return { count: rows.length, priced, first: priced[0], min: priced.length ? valueOf(priced[0], deal) : null, avg: mean(priced.map((row) => valueOf(row, deal))) };
  }

  function pyeongGroups(rows, deal) {
    const groups = new Map();
    rows.forEach((row) => {
      const pyeong = number(row.pyeong);
      const key = pyeong !== null && pyeong > 0 ? pyeong : "미확인";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
    return [...groups].map(([pyeong, items]) => ({ pyeong, rows: items, ...stats(items, deal) })).sort((a, b) => (number(a.pyeong) ?? Infinity) - (number(b.pyeong) ?? Infinity));
  }

  function weeklyStats(rows, deal) {
    const dates = unique(rows.map((row) => row.surveyDate).filter((date) => weekKey(date))).sort((a, b) => weekKey(a) - weekKey(b));
    return dates.map((date) => ({ date, ...stats(rows.filter((row) => row.surveyDate === date), deal) })).filter((week) => week.avg !== null);
  }

  function createSlides({ rows, complexes, deal = "매매", pyeong = "전체", screen = "overview", region = "세종 6생활권" }) {
    const latest = unique(rows.map((row) => row.surveyDate).filter((date) => weekKey(date))).sort((a, b) => weekKey(b) - weekKey(a))[0] || "";
    const selected = unique(complexes);
    const matches = (row) => row.dealType === deal && (pyeong === "전체" || row.pyeongGroup === pyeong);
    const base = { screen, deal, pyeong, region, latest };
    const groups = selected.map((name) => {
      const history = rows.filter((row) => row.complex === name && matches(row));
      const current = history.filter((row) => row.surveyDate === latest);
      return { name, rows: current, weeks: weeklyStats(history, deal).slice(-10), ...stats(current, deal) };
    });
    let slides;
    if (screen === "comparison") {
      slides = groups.flatMap((group) => {
        const areas = pyeongGroups(group.rows, deal);
        return (areas.length ? chunks(areas, 3) : [[]]).map((items) => ({ ...base, groups: [group], areas: items }));
      });
    } else if (screen === "trend") {
      slides = groups.map((group) => ({ ...base, groups: [group] }));
    } else {
      slides = chunks(groups, 2).map((items) => ({ ...base, groups: items }));
    }
    return slides.map((slide, index) => ({ ...slide, index, total: slides.length, hasData: slide.groups.some((group) => screen === "trend" ? group.weeks.length : group.priced.length) }));
  }

  function text(ctx, value, x, y, size = 36, color = C.ink, weight = 700, align = "left", width = null) {
    const string = String(value);
    ctx.save();
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    // Wrap rather than shrinking critical lettering to fit a long label.
    if (width && ctx.measureText(string).width > width) {
      let line = "";
      let baseline = y;
      for (const char of string) {
        if (line && ctx.measureText(line + char).width > width) {
          ctx.fillText(line, x, baseline);
          baseline += size * 1.35;
          line = char;
        } else line += char;
      }
      if (line) ctx.fillText(line, x, baseline);
    } else ctx.fillText(string, x, y);
    ctx.restore();
  }

  function rule(ctx, y, color = C.line, x = 64, width = 952, thickness = 2) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, thickness);
  }

  function priceText(ctx, value, x, y, width = 952, size = 98, color = C.blue, approximate = false) {
    const label = money(value, approximate);
    ctx.save();
    ctx.font = `900 ${size}px ${FONT}`;
    while (ctx.measureText(label).width > width && size > 64) {
      size -= 2;
      ctx.font = `900 ${size}px ${FONT}`;
    }
    ctx.restore();
    text(ctx, label, x, y, size, color, 900, "left", width);
  }

  function areaLabel(row) {
    if (!row) return "금액 정보 미확인";
    return [row.pyeong ? `${row.pyeong}평` : "평수 미확인", row.supplyArea ? `${row.supplyArea}타입` : "", row.floorGroup || ""].filter(Boolean).join(" · ");
  }

  function header(ctx, slide) {
    ctx.fillStyle = C.yellow;
    ctx.fillRect(0, 0, WIDTH, 326);
    rule(ctx, 0, C.ink, 0, WIDTH, 14);
    text(ctx, slide.region, 64, 74, 30, C.ink, 800);
    text(ctx, `${slide.latest || "조사 주차 미확인"} 조사`, 1016, 74, 30, C.ink, 700, "right");
    const pyeong = slide.pyeong === "전체" ? "전체 평형" : slide.pyeong;
    const title = slide.screen === "comparison" ? `평수별 ${slide.deal} 호가`
      : slide.screen === "trend" ? (slide.deal === "월세" ? "월세 환산 추이" : `${slide.deal} 호가 흐름`)
      : `${pyeong} ${slide.deal}`;
    text(ctx, title, 64, 191, 84, C.ink, 900, "left", 952);
    const names = slide.groups.map((group) => complexName(group.name)).join(" · ");
    text(ctx, `${names}${slide.screen === "overview" ? "" : `  /  ${pyeong}`}`, 64, 281, 40, C.ink, 800, "left", 952);
  }

  function footer(ctx, slide) {
    const note = slide.deal === "월세" ? "환산보증금 = 보증금 + 월세 × 200 (연 6% 가정)" : "등록 호가 기준 · 실제 거래가와 다를 수 있습니다";
    text(ctx, note, 64, 1694, 28, C.muted, 700, "left", 952);
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, 1740, WIDTH, 180);
    text(ctx, "매물 접수 · 예산별 상담", 64, 1791, 28, C.yellow, 800);
    text(ctx, "010-8253-9659", 64, 1870, 65, C.paper, 900);
    text(ctx, "산울파트너스", 1016, 1800, 31, C.paper, 800, "right");
    text(ctx, "공인중개사사무소", 1016, 1842, 25, C.paper, 700, "right");
    text(ctx, `${slide.index + 1} / ${slide.total}`, 1016, 1887, 26, C.yellow, 800, "right");
  }

  function groupTitle(ctx, group, y) {
    text(ctx, complexName(group.name), 64, y, 54, C.ink, 900, "left", 700);
    text(ctx, `등록 ${group.count}건`, 1016, y - 4, 34, C.muted, 800, "right");
    text(ctx, complexDetail(group.name), 64, y + 48, 29, C.muted, 700, "left", 952);
  }

  function empty(ctx, message, y = 710) {
    text(ctx, message, 64, y, 47, C.muted, 800, "left", 952);
    text(ctx, "등록 자료 확인 후 상담 가능합니다", 64, y + 70, 32, C.muted, 700);
  }

  function rentalPair(ctx, row, y, size = 80) {
    text(ctx, "보증금", 64, y, 32, C.muted, 700);
    text(ctx, "월세", 650, y, 32, C.muted, 700);
    priceText(ctx, number(row.price), 64, y + 96, 535, size, C.blue);
    priceText(ctx, number(row.monthlyRent), 650, y + 96, 366, size, C.teal);
  }

  function overview(ctx, slide) {
    slide.groups.forEach((group, index) => {
      const y = 422 + index * 608;
      if (index) rule(ctx, y - 66, C.ink, 64, 952, 3);
      groupTitle(ctx, group, y);
      if (!group.first) { empty(ctx, "이번 조사에 해당 매물 없음", y + 190); return; }
      if (slide.deal === "월세") {
        text(ctx, "등록 조건 예시 · 환산보증금 낮은 순", 64, y + 125, 30, C.muted);
        rentalPair(ctx, group.first, y + 193);
        text(ctx, areaLabel(group.first), 64, y + 358, 35, C.ink, 800, "left", 952);
        text(ctx, `환산보증금 ${money(group.min)}`, 64, y + 418, 30, C.muted, 700);
      } else {
        text(ctx, "최저 등록 호가", 64, y + 134, 34, C.muted);
        priceText(ctx, group.min, 64, y + 263, 952, 106);
        text(ctx, `최저 조건  ${areaLabel(group.first)}`, 64, y + 333, 34, C.ink, 800, "left", 952);
        text(ctx, `평균 ${money(group.avg, true)}`, 64, y + 415, 42, C.teal, 800);
      }
    });
    if (slide.groups.length === 1 && slide.groups[0].first) {
      const group = slide.groups[0];
      rule(ctx, 959, C.ink, 64, 952, 3);
      text(ctx, slide.deal === "월세" ? "함께 볼 수 있는 등록 조건" : "평수별 등록 매물", 64, 1026, 43, C.ink, 900);
      if (slide.deal === "월세") {
        const alternatives = group.priced.filter((row) => row.price !== group.first.price || row.monthlyRent !== group.first.monthlyRent);
        const second = alternatives[0];
        if (second) {
          rentalPair(ctx, second, 1140, 78);
          text(ctx, areaLabel(second), 64, 1320, 35, C.ink, 800, "left", 952);
        } else text(ctx, "추가로 비교할 등록 조건이 없습니다", 64, 1150, 34, C.muted);
        text(ctx, `현재 조사된 월세 매물 ${group.count}건`, 64, 1500, 39, C.teal, 800);
      } else {
        const areas = pyeongGroups(group.rows, slide.deal).sort((a, b) => b.count - a.count).slice(0, 3).sort((a, b) => a.pyeong - b.pyeong);
        text(ctx, "매물 수 상위 평수 · 최저 등록 호가", 64, 1080, 29, C.muted);
        areas.forEach((area, i) => {
          const y = 1180 + i * 144;
          text(ctx, area.pyeong === "미확인" ? "평수 미확인" : `${area.pyeong}평`, 64, y, 47, C.ink, 900);
          text(ctx, money(area.min), 360, y, 47, C.blue, 900);
          text(ctx, `${area.count}건`, 1016, y, 36, C.muted, 800, "right");
          rule(ctx, y + 43);
        });
      }
    }
  }

  function comparison(ctx, slide) {
    const group = slide.groups[0];
    if (!slide.areas.length) { empty(ctx, "이번 조사에 해당 매물 없음"); return; }
    text(ctx, complexDetail(group.name), 64, 388, 29, C.muted, 700, "left", 952);
    slide.areas.forEach((area, index) => {
      const y = 475 + index * 390;
      if (index) rule(ctx, y - 66, C.ink, 64, 952, 2);
      text(ctx, `${area.pyeong}${area.pyeong === "미확인" ? " 평수" : "평"}`, 64, y, 62, C.ink, 900);
      text(ctx, `등록 ${area.count}건`, 1016, y - 6, 33, C.muted, 800, "right");
      if (!area.first) { text(ctx, "금액 정보 미확인", 64, y + 118, 40, C.muted); return; }
      if (slide.deal === "월세") {
        rentalPair(ctx, area.first, y + 70, 69);
        text(ctx, `등록 조건 예시 · ${area.first.supplyArea || "타입 미확인"} · 환산 ${money(area.min)}`, 64, y + 267, 29, C.muted, 700, "left", 952);
      } else {
        text(ctx, "최저 호가", 64, y + 71, 30, C.muted);
        priceText(ctx, area.min, 64, y + 181, 610, 87);
        text(ctx, `평균 ${money(area.avg, true)}`, 1016, y + 175, 36, C.teal, 800, "right");
        text(ctx, `최저 조건  ${area.first.supplyArea || "타입 미확인"} · 전용 ${area.first.exclusiveArea ?? "미확인"}㎡ · ${area.first.floorGroup || "층 미확인"}`, 64, y + 267, 30, C.muted, 700, "left", 952);
      }
    });
  }

  function trend(ctx, slide) {
    const group = slide.groups[0];
    const weeks = group.weeks;
    if (!weeks.length) { empty(ctx, "비교할 조사 자료가 없습니다"); return; }
    const first = weeks[0];
    const last = weeks.at(-1);
    const current = last.date === slide.latest;
    text(ctx, complexDetail(group.name), 64, 390, 30, C.muted, 700, "left", 952);
    text(ctx, slide.deal === "월세" ? "평균 환산보증금" : "등록 호가 평균", 64, 465, 36, C.muted, 800);
    priceText(ctx, last.avg, 64, 593, 952, 100, C.blue, true);
    const percent = first.avg ? (last.avg - first.avg) / first.avg * 100 : null;
    const change = weeks.length < 2 ? "비교할 이전 조사 자료 없음" : percent === null ? "기준 금액이 없어 변동률 계산 불가" : Math.abs(percent) < 0.05 ? `${shortWeek(first.date)} 대비 평균 변화 0.0%`
      : `${shortWeek(first.date)} 대비 평균 ${percent > 0 ? "상승" : "하락"} ${Math.abs(percent).toFixed(1)}%`;
    text(ctx, change, 64, 677, 41, percent > 0 ? C.red : C.blue, 800, "left", 952);
    if (!current) text(ctx, `주의: 마지막 관측 ${last.date} · 이번 조사 자료 없음`, 64, 735, 29, C.red, 800, "left", 952);
    const plot = { x: 200, y: 820, width: 770, height: 460 };
    const min = Math.min(...weeks.map((week) => week.avg));
    const max = Math.max(...weeks.map((week) => week.avg));
    const padding = Math.max((max - min) * 0.25, max * 0.02, 1);
    const low = Math.max(0, min - padding);
    const high = max + padding;
    const points = weeks.map((week, i) => ({ x: plot.x + (weeks.length === 1 ? plot.width / 2 : i * plot.width / (weeks.length - 1)), y: plot.y + plot.height * (high - week.avg) / (high - low), week }));
    [high, (high + low) / 2, low].forEach((value) => {
      const y = plot.y + plot.height * (high - value) / (high - low);
      rule(ctx, y, C.line, plot.x, plot.width, 2);
      text(ctx, (value / 10000).toFixed(2), 170, y + 10, 29, C.muted, 700, "right");
    });
    text(ctx, "억원", 170, plot.y - 35, 28, C.muted, 700, "right");
    if (points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, plot.y + plot.height);
      points.forEach((point) => ctx.lineTo(point.x, point.y));
      ctx.lineTo(points.at(-1).x, plot.y + plot.height);
      ctx.closePath();
      ctx.fillStyle = "#e7f0f5";
      ctx.fill();
    }
    ctx.beginPath();
    points.forEach((point, i) => i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.strokeStyle = C.blue;
    ctx.lineWidth = 8;
    ctx.stroke();
    points.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = C.blue;
      ctx.fill();
    });
    text(ctx, shortWeek(first.date), plot.x, 1340, 32, C.muted, 800);
    if (weeks.length > 1) text(ctx, shortWeek(last.date), plot.x + plot.width, 1340, 32, C.muted, 800, "right");
    rule(ctx, 1410, C.ink, 64, 952, 3);
    text(ctx, `${shortWeek(first.date)} 등록`, 64, 1484, 30, C.muted);
    text(ctx, `${first.count}건`, 64, 1555, 56, C.ink, 900);
    text(ctx, `${shortWeek(last.date)} 등록`, 630, 1484, 30, C.muted);
    text(ctx, `${last.count}건`, 630, 1555, 56, C.ink, 900);
    text(ctx, "조사된 매물 구성에 따른 평균 · 같은 집의 가격 변동은 아님", 64, 1634, 28, C.muted, 700, "left", 952);
  }

  function render(canvas, slide) {
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    if (!slide) {
      ctx.fillStyle = C.yellow;
      ctx.fillRect(0, 0, WIDTH, 326);
      text(ctx, "표시할 단지 없음", 64, 190, 74, C.ink, 900);
      empty(ctx, "선택된 단지가 없습니다");
      return;
    }
    header(ctx, slide);
    if (slide.screen === "comparison") comparison(ctx, slide);
    else if (slide.screen === "trend") trend(ctx, slide);
    else overview(ctx, slide);
    footer(ctx, slide);
  }

  return { WIDTH, HEIGHT, createSlides, render, money, valueOf, weekKey, shortWeek, complexName, weeklyStats };
});
