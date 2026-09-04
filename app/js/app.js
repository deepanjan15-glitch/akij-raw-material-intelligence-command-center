// AKIJ AGRO FEED — Raw Material Market Intelligence & Procurement Command Center
// Presentation layer (thin). Analytics are precomputed by engine/run.py; signals from feed-intelligence MCP.

let DATA = {};
let state = { view: "command", role: "ceo", category: "All", source: "All", search: "", momentumPeriod: "wow", importHs: "10059090", trendRange: 12 };

const ROLE_TITLES = {
  ceo: "Situation → Risk → Opportunity → Action",
  procurement: "Benchmark → Supplier → Landed Cost → Negotiation",
  research: "Market → Statistics → Drivers → Forecast",
  commercial: "Feed Cost → Market Pressure → Scenario",
};

const VIEW_TITLES = {
  command: "Command Center", executive: "Executive Summary", material: "Material Intelligence", origin: "Origin & Supply",
  supplier: "Supplier Intelligence", procurement: "Procurement Intelligence",
  signals: "Market Signals", import: "Import Intelligence", "import-trends": "Import Trends",
  forecast: "Forecast & Scenario", feedcost: "Feed Cost Impact", alerts: "Alert Center",
  quality: "Data Quality & Governance", methodology: "Methodology", settings: "Settings",
};

// section color family per view (maps to [data-section] token overrides in style.css)
const SECTION = {
  command: "command", executive: "command", material: "material", origin: "origin", supplier: "supplier",
  procurement: "procurement", signals: "signals", import: "import", "import-trends": "import",
  forecast: "forecast", feedcost: "feedcost", alerts: "alerts", quality: "quality", methodology: "methodology", settings: "settings",
};

async function load() {
  const files = ["materials", "market-index", "meta", "sources", "suppliers", "feed-cost", "scenario", "market-signals", "import-trends", "origins"];
  const vals = await Promise.all(files.map(f => fetch(`data/${f}.json`).then(r => r.json())));
  DATA = Object.fromEntries(files.map((f, i) => [f, vals[i]]));
  document.getElementById("asOf").textContent = fmtDate(DATA.materials.asOfDate);
  renderHonesty();
  renderFilters();
  render();
}

function renderHonesty() {
  document.getElementById("honestyBanner").innerHTML =
    `<strong>Data honesty:</strong> ${DATA.meta.dataHonesty.notes.join(" · ")}`;
  document.getElementById("honestyBanner").classList.add("show");
}

function renderFilters() {
  const cats = ["All", ...new Set(DATA.materials.materials.map(m => m.category))];
  const srcs = ["All", ...(DATA.sources.sources || []).map(s => s.type)];
  document.getElementById("filters").innerHTML = `
    <div class="filter-row">
      <span class="mono" style="font-size:11px;color:var(--ink-3);align-self:center;">Category:</span>
      ${cats.map(c => `<span class="chip ${state.category === c ? "active" : ""}" data-cat="${c}">${c}</span>`).join("")}
    </div>
    <div class="filter-row">
      <span class="mono" style="font-size:11px;color:var(--ink-3);align-self:center;">Source:</span>
      ${srcs.map(s => `<span class="chip ${state.source === s ? "active" : ""}" data-src="${s}">${s}</span>`).join("")}
    </div>
  `;
  document.querySelectorAll(".chip[data-cat]").forEach(c => c.onclick = () => { state.category = c.dataset.cat; renderFilters(); render(); });
  document.querySelectorAll(".chip[data-src]").forEach(c => c.onclick = () => { state.source = c.dataset.src; renderFilters(); render(); });
}

function filtered() {
  return DATA.materials.materials.filter(m =>
    (state.category === "All" || m.category === state.category) &&
    (state.source === "All" || m.source === state.source) &&
    (!state.search || (m.name + m.category + m.hsCode + m.source).toLowerCase().includes(state.search.toLowerCase()))
  );
}

function render() {
  destroyCharts();
  document.body.dataset.section = SECTION[state.view] || "sapphire";
  document.getElementById("viewTitle").textContent = VIEW_TITLES[state.view];
  document.querySelectorAll(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.view === state.view));
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-" + state.view).classList.add("active");
  ({ command: renderCommand, executive: renderExecutive, material: renderMaterial, origin: renderOrigin, supplier: renderSupplier,
     procurement: renderProcurement, signals: renderSignals, import: renderImport, "import-trends": renderImportTrends,
     forecast: renderForecast, feedcost: renderFeedCost, alerts: renderAlerts, quality: renderQuality, methodology: renderMethodology,
     settings: renderSettings }[state.view])();
}

function roleBanner() {
  const names = (["command", "alerts", "procurement", "material", "supplier", "origin", "import", "forecast", "feedcost"]
    .filter(v => [state.view].concat(state.view === "command" ? ["alerts", "procurement"] : [])).map(v => VIEW_TITLES[v])).join(" → ");
  return `<div class="role-emphasis"><strong>${state.role.toUpperCase()}</strong> focus: ${ROLE_TITLES[state.role]}.</div>`;
}

/* ================= Charts (thin renderer over precomputed analytics) ================= */
let CHARTS = {};
function destroyCharts() { for (const k in CHARTS) { CHARTS[k].destroy(); delete CHARTS[k]; } }
function mountChart(key, cfg) {
  if (CHARTS[key]) { CHARTS[key].destroy(); delete CHARTS[key]; }
  const canvas = document.getElementById("chart-" + key);
  if (!canvas) return null;
  CHARTS[key] = new Chart(canvas.getContext("2d"), cfg);
  return CHARTS[key];
}

const UP_COLOR = "#dc2626", DOWN_COLOR = "#16a34a";
const QUADRANT_COLORS = {
  "Potential Early Procurement Opportunity": "#16a34a",
  "Procurement Pressure": "#dc2626",
  "Monitor / Potential Waiting Zone": "#b45309",
  "Potential Value Zone": "#2563eb",
};
const QUADRANT_ORDER = ["Potential Early Procurement Opportunity", "Procurement Pressure", "Monitor / Potential Waiting Zone", "Potential Value Zone"];

// Dashed zero-axis lines to read the 2x2 opportunity quadrants (drawn only when within range).
const zeroAxesPlugin = {
  id: "zeroAxes",
  afterDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea || !scales.x || !scales.y) return;
    const x0 = scales.x.getPixelForValue(0);
    const y0 = scales.y.getPixelForValue(0);
    ctx.save();
    ctx.strokeStyle = "rgba(15,23,42,0.28)";
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (y0 >= chartArea.top && y0 <= chartArea.bottom) { ctx.moveTo(chartArea.left, y0); ctx.lineTo(chartArea.right, y0); }
    if (x0 >= chartArea.left && x0 <= chartArea.right) { ctx.moveTo(x0, chartArea.top); ctx.lineTo(x0, chartArea.bottom); }
    ctx.stroke();
    ctx.restore();
  },
};

function momentumRows(ms) {
  const key = state.momentumPeriod === "mom" ? "mom" : "wow";
  const prior = state.momentumPeriod === "mom" ? "lastMonth" : "lastWeek";
  const rows = [];
  ms.forEach(m => {
    const v = m.movement[key];
    if (v == null) return;
    rows.push({ name: m.name, v, current: m.benchmark.current, prior: m.benchmark[prior], wow: m.movement.wow, mom: m.movement.mom });
  });
  return rows.sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 15).sort((a, b) => b.v - a.v);
}

function momentumChart(ms) {
  const rows = momentumRows(ms);
  const key = state.momentumPeriod === "mom" ? "mom" : "wow";
  const label = key === "mom" ? "MoM" : "WoW";
  return {
    type: "bar",
    data: {
      labels: rows.map(r => r.name),
      datasets: [{
        label: label + " price change (%)",
        data: rows.map(r => +(r.v * 100).toFixed(1)),
        backgroundColor: rows.map(r => (r.v >= 0 ? UP_COLOR : DOWN_COLOR)),
        borderRadius: 3,
      }],
    },
    options: {
      indexAxis: "y",
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const r = rows[ctx.dataIndex];
              return [
                `${label}: ${pct0(r.v)}`,
                `Current: ${r.current != null ? "$" + fmt(r.current) + "/MT" : "—"}`,
                `${key === "mom" ? "Last month" : "Last week"}: ${r.prior != null ? "$" + fmt(r.prior) + "/MT" : "—"}`,
                `WoW ${pct0(r.wow)} · MoM ${pct0(r.mom)}`,
              ];
            },
          },
        },
      },
      scales: {
        x: { title: { display: true, text: label + " price change (%)" }, grid: { color: "#e5eaf1" } },
        y: { grid: { display: false }, ticks: { font: { size: 11 }, callback: (v) => (v.length > 26 ? v.slice(0, 25) + "…" : v) } },
      },
    },
  };
}

function opportunityChart(ms) {
  const pts = [];
  ms.forEach(m => {
    const o = m.opportunity;
    if (!o || o.status !== "OK") return;
    pts.push({ name: m.name, position: o.positionVs2025, wow: o.momentumWow, quadrant: o.quadrant, current: m.benchmark.current, avg2025: m.benchmark.avg2025, vol: m.importIntelligence?.volumeMt });
  });
  const maxVol = Math.max(0, ...pts.map(p => p.vol || 0));
  const rOf = (p) => (p.vol ? 4 + 9 * Math.sqrt(p.vol) / Math.sqrt(maxVol || 1) : 4);
  const datasets = QUADRANT_ORDER.map(q => {
    const qpts = pts.filter(p => p.quadrant === q);
    return {
      label: q,
      data: qpts.map(p => ({ x: +(p.position * 100).toFixed(1), y: +(p.wow * 100).toFixed(1), r: rOf(p), _p: p })),
      backgroundColor: QUADRANT_COLORS[q] + "99",
      borderColor: QUADRANT_COLORS[q],
      borderWidth: 1,
    };
  });
  return {
    type: "bubble",
    data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 10, boxHeight: 10, font: { size: 10.5 }, padding: 12 } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const p = ctx.raw._p;
              return [
                p.name,
                `Position vs 2025 avg: ${pct0(p.position)}`,
                `WoW: ${pct0(p.wow)}`,
                `Current: ${p.current != null ? "$" + fmt(p.current) + "/MT" : "—"}`,
                `Import volume: ${p.vol ? fmt(p.vol) + " MT" : "—"}`,
              ];
            },
          },
        },
      },
      scales: {
        x: { title: { display: true, text: "Price deviation vs 2025 average (%)" }, grid: { color: "#e5eaf1" } },
        y: { title: { display: true, text: "WoW price change (%)" }, grid: { color: "#e5eaf1" } },
      },
    },
    plugins: [zeroAxesPlugin],
  };
}

const TRAJECTORY_DATES = ["2026-06-17", "2026-07-02", "2026-07-13", "2026-07-22", "2026-08-02", "2026-08-24"];
const TRAJECTORY_LABELS = ["Jun 17", "Jul 2", "Jul 13", "Jul 22", "Aug 2", "Aug 24"];
const LINE_PALETTE = ["#2563eb", "#16a34a", "#dc2626", "#b45309", "#7c3aed", "#0d9488", "#db2777", "#64748b"];

function trajectoryChart(sg) {
  const datasets = sg.trajectory.map((t, i) => {
    const base = t.values[0] || 1;
    return {
      label: t.material,
      data: t.values.map(v => +(v / base * 100).toFixed(1)),
      borderColor: LINE_PALETTE[i % LINE_PALETTE.length],
      backgroundColor: LINE_PALETTE[i % LINE_PALETTE.length],
      borderWidth: 1.5,
      pointRadius: 2.5,
      tension: 0.25,
      _raw: t.values,
    };
  });
  return {
    type: "line",
    data: { labels: TRAJECTORY_LABELS, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 10, boxHeight: 10, font: { size: 10 }, padding: 10 } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: $${fmt(ctx.dataset._raw[ctx.dataIndex])}/MT · index ${ctx.parsed.y}`,
          },
        },
      },
      scales: {
        y: { title: { display: true, text: "Index (100 = first snapshot)" }, grid: { color: "#e5eaf1" } },
        x: { grid: { display: false } },
      },
    },
  };
}

function priceHistoryChart(m) {
  const h = m.priceHistory;
  return {
    type: "line",
    data: {
      labels: h.dates.map(d => d.slice(5)),
      datasets: [{
        label: m.name + " ($/MT)",
        data: h.values,
        borderColor: "#2563eb",
        backgroundColor: "rgba(37,99,235,0.10)",
        borderWidth: 1.5,
        pointRadius: 3,
        fill: true,
        tension: 0.2,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { title: { display: true, text: "$/MT" }, grid: { color: "#e5eaf1" } },
        x: { title: { display: true, text: "Snapshot date (2026)" }, grid: { display: false } },
      },
    },
  };
}

function importTrendChart(g) {
  return {
    type: "bar",
    data: {
      labels: g.months.map(m => m.ym),
      datasets: [
        { label: "Volume (MT)", data: g.months.map(m => m.volumeMt), backgroundColor: "rgba(37,99,235,0.45)", yAxisID: "y", order: 2, borderRadius: 1 },
        { label: "Unit value ($/MT)", type: "line", data: g.months.map(m => m.unitValueUsdMt), borderColor: "#dc2626", backgroundColor: "#dc2626", borderWidth: 1.6, pointRadius: 0, yAxisID: "y1", order: 1, spanGaps: true },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 10, boxHeight: 10, font: { size: 10.5 }, padding: 12 } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const m = g.months[ctx.dataIndex];
              if (ctx.datasetIndex === 0) return `Volume: ${fmt(m.volumeMt)} MT`;
              return `Unit value: ${m.unitValueUsdMt ? "$" + fmt(m.unitValueUsdMt) + "/MT" : "— (no USD value)"}`;
            },
          },
        },
      },
      scales: {
        x: { ticks: { maxTicksLimit: 14, autoSkip: true, font: { size: 10 } }, grid: { display: false } },
        y: { position: "left", title: { display: true, text: "Volume (MT)" }, grid: { color: "#e5eaf1" } },
        y1: { position: "right", title: { display: true, text: "Unit value ($/MT)" }, grid: { drawOnChartArea: false } },
      },
    },
  };
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function seasonalityHeatmap(groups) {
  const rows = groups.filter(g => g.seasonality).map(g => {
    const cells = MONTH_LABELS.map((_, i) => {
      const idx = g.seasonality[i + 1];
      if (idx == null) return '<td class="hm-cell"></td>';
      const dev = idx - 100;
      const alpha = Math.min(0.8, 0.15 + Math.abs(dev) / 60).toFixed(2);
      const color = dev > 0 ? `rgba(220,38,38,${alpha})` : `rgba(22,163,74,${alpha})`;
      return `<td class="hm-cell" style="background:${color}" title="${g.name} · ${MONTH_LABELS[i]} · index ${idx}">${Math.round(idx)}</td>`;
    }).join("");
    return `<tr><td class="hm-row">${g.name}</td>${cells}</tr>`;
  }).join("");
  return `<div class="heatmap-wrap"><table class="heatmap"><thead><tr><th></th>${MONTH_LABELS.map(m => `<th>${m}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

/* ---- Executive Summary ---- */
function marketHealth(ms) {
  const total = ms.length;
  if (!total) return { score: 0, label: "No Data", tone: "neutral" };
  const optimal = ms.filter(m => m.procurement?.riskSignal === "OPTIMAL").length / total;
  const riskShare = ms.filter(m => m.procurement?.riskSignal === "HIGH COST" || m.procurement?.riskSignal === "REVIEW").length / total;
  const wowVals = ms.map(m => m.movement?.wow).filter(v => v != null);
  const avgWow = wowVals.length ? wowVals.reduce((a, b) => a + b, 0) / wowVals.length : 0;
  const single = ms.filter(m => !m.originStats || m.originStats.count === 1).length / total;
  const momentum = Math.max(0, Math.min(100, 50 - avgWow * 250));
  const score = Math.round(optimal * 100 * 0.35 + (1 - riskShare) * 100 * 0.30 + momentum * 0.20 + (1 - single) * 100 * 0.15);
  const clamped = Math.max(0, Math.min(100, score));
  let label, tone;
  if (clamped >= 75) { label = "Excellent"; tone = "success"; }
  else if (clamped >= 55) { label = "Healthy"; tone = "success"; }
  else if (clamped >= 35) { label = "Caution"; tone = "warning"; }
  else { label = "Elevated Risk"; tone = "danger"; }
  return { score: clamped, label, tone };
}

function computeWatchlist(ms) {
  return ms.map(m => {
    let reason = null, weight = 0;
    const sig = m.procurement?.riskSignal;
    if (sig === "HIGH COST" || sig === "REVIEW") { reason = "High sourcing cost risk"; weight += 3; }
    const wow = m.movement?.wow;
    if (wow != null && Math.abs(wow) >= 0.15) { reason = reason || `Sharp ${wow > 0 ? "increase" : "decline"} this week`; weight += 2; }
    if (!m.originStats || m.originStats.count === 1) { weight += 0.5; }
    return { m, reason, weight };
  }).filter(x => x.reason).sort((a, b) => b.weight - a.weight).slice(0, 5);
}

const TREND_ANCHORS = [["avg2024", "2024-07-01"], ["avg2025", "2025-07-01"], ["sixMo", "2026-03-01"], ["lastMonth", "2026-08-01"], ["lastWeek", "2026-08-26"], ["current", "2026-09-02"]];
const TREND_MONTHS = [];
{
  const s = new Date("2024-07-01"), e = new Date("2026-09-01");
  for (let t = new Date(s); t <= e; t.setMonth(t.getMonth() + 1)) TREND_MONTHS.push(t.toISOString().slice(0, 7));
}
function trendSeries(m) {
  const anchors = TREND_ANCHORS.map(([k, d]) => ({ d: new Date(d).getTime(), v: m.benchmark[k] })).filter(a => a.v != null).sort((a, b) => a.d - b.d);
  if (anchors.length < 2) return null;
  return TREND_MONTHS.map(label => {
    const ts = new Date(label + "-01").getTime();
    let v = null;
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i], b = anchors[i + 1];
      if (ts >= a.d && ts <= b.d) { v = a.v + (b.v - a.v) * ((ts - a.d) / (b.d - a.d)); break; }
    }
    if (v == null) v = ts < anchors[0].d ? anchors[0].v : anchors[anchors.length - 1].v;
    return { label, v: v != null ? Math.round(v) : null };
  });
}
function priceTrendChart(ms) {
  const range = state.trendRange;
  const picked = [...ms].sort((a, b) => (b.importIntelligence?.valueUsd || 0) - (a.importIntelligence?.valueUsd || 0))
    .filter(m => trendSeries(m)).slice(0, 6);
  const labels = TREND_MONTHS.slice(-range);
  const datasets = picked.map((m, i) => ({
    label: m.name,
    data: trendSeries(m).slice(-range).map(x => x.v),
    borderColor: LINE_PALETTE[i % LINE_PALETTE.length],
    backgroundColor: LINE_PALETTE[i % LINE_PALETTE.length],
    borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.3, spanGaps: true,
  }));
  return {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 10, boxHeight: 10, font: { size: 10 }, padding: 10 } },
        tooltip: { callbacks: { label: (t) => ` ${t.dataset.label}: ${t.parsed.y != null ? "$" + fmt(t.parsed.y) + "/MT" : "—"}` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: "#e5eaf1" }, ticks: { callback: (v) => "$" + v } },
      },
    },
  };
}
function riskDonutChart(ms) {
  const order = [["HIGH COST", "#dc2626"], ["REVIEW", "#94a3b8"], ["MONITOR", "#f59e0b"], ["ACCEPTABLE", "#2563eb"], ["OPTIMAL", "#16a34a"]];
  const counts = {};
  ms.forEach(m => { const s = m.procurement?.riskSignal || "(unclassified)"; counts[s] = (counts[s] || 0) + 1; });
  const labels = [...order.map(o => o[0]), "(unclassified)"];
  const colors = [...order.map(o => o[1]), "#cbd5e1"];
  return {
    type: "doughnut",
    data: { labels, datasets: [{ data: labels.map(l => counts[l] || 0), backgroundColor: colors, borderWidth: 2, borderColor: "#fff", hoverOffset: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: "66%",
      plugins: { legend: { position: "bottom", labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, padding: 10, font: { size: 10.5 } } } },
    },
  };
}
function sourcingGapChart(ms) {
  const list = ms.filter(m => m.sourcingGap && m.sourcingGap.akijQuotedPrice != null);
  return {
    type: "bar",
    data: {
      labels: list.map(m => m.name),
      datasets: [
        { label: "Akij Sourcing Price", data: list.map(m => m.sourcingGap.akijQuotedPrice), backgroundColor: "#0f766e", borderRadius: 4, maxBarThickness: 18 },
        { label: "Best Buy Price", data: list.map(m => m.sourcingGap.bestBuyPrice), backgroundColor: "#14b8a6", borderRadius: 4, maxBarThickness: 18 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, font: { size: 10.5 }, padding: 10 } },
        tooltip: {
          callbacks: {
            label: (t) => ` ${t.dataset.label}: $${fmt(t.parsed.y)}/MT`,
            afterBody: (items) => {
              const i = items[0].dataIndex, g = list[i].sourcingGap;
              return g.costGapUsdMt != null ? [`Cost gap: +$${fmt(g.costGapUsdMt)}/MT (${pct0(g.costGapPct)})`] : [];
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 45, font: { size: 9.5 } } },
        y: { grid: { color: "#e5eaf1" }, ticks: { callback: (v) => "$" + v } },
      },
    },
  };
}

/* ================= Command Center ================= */
function renderCommand() {
  const ms = filtered();
  const priced = ms.filter(m => m.benchmark.current != null);
  const avgRisk = ms.length ? ms.reduce((a, m) => a + m.risk.composite, 0) / ms.length : null;
  const avgDQ = ms.length ? ms.reduce((a, m) => a + m.dataQuality.score, 0) / ms.length : null;
  const importValue = ms.reduce((a, m) => a + (m.importIntelligence?.valueUsd || 0), 0);
  const totalSaving = ms.reduce((a, m) => a + (m.savings.potentialSavingUsd || 0), 0);
  const savingCount = ms.filter(m => m.savings.status === "ESTIMATE").length;
  const highRisk = ms.filter(m => m.risk.band === "High" || m.risk.band === "Critical").length;
  const dqIssues = ms.reduce((a, m) => a + m.dataQuality.issues.length, 0);
  const fc = DATA["feed-cost"];
  const idx = DATA["market-index"];

  const kpis = [
    ["Market Index", idx.status === "OK" ? idx.index : "—", "Equal-weight · base avg2025", "b-blue"],
    ["Feed-Cost Pressure", fc.status === "ESTIMATE" ? "+" + fc.totalFeedCostPressurePct + "%" : "—", "index +13.9% · CPI +8.32%", "b-amber"],
    ["Procurement Risk", avgRisk != null ? avgRisk.toFixed(0) + "/100" : "—", `${highRisk} materials High/Critical`, avgRisk > 50 ? "b-red" : "b-amber"],
    ["Supply Risk", originDependency(ms) + "%", "single-origin dependency", "b-amber"],
    ["Potential Saving", totalSaving > 0 ? "$" + fmt(totalSaving) : "ESTIMATE", `${savingCount} materials with origin gap`, "b-green"],
    ["Financial Exposure", "$" + fmt(importValue), "tracked import value", "b-blue"],
    ["Forecast Direction", forecastDir(ms), "SAMPLE (low confidence)", "b-purple"],
    ["Data Quality", avgDQ != null ? avgDQ.toFixed(0) + "/100" : "—", `${dqIssues} issues`, avgDQ > 70 ? "b-green" : "b-amber"],
  ];

  const el = document.getElementById("view-command");
  el.innerHTML = roleBanner() + `
    <div class="kpi-grid">${kpis.map(k => `
      <div class="kpi"><div class="kpi-label">${k[0]}</div>
      <div class="kpi-value">${k[1]}</div><div class="kpi-sub">${k[2]}</div></div>`).join("")}
    </div>
    <div class="grid-2">
      <div class="panel"><h2>WHAT HAPPENED / HOW SIGNIFICANT</h2>
        <p class="sub">Factual, no causal claims.</p>
        <div class="kv"><span class="k">Materials tracked</span><span>${DATA.materials.materialsTracked} (${filtered().length} in view)</span></div>
        <div class="kv"><span class="k">Market index</span><span>${idx.status === "OK" ? idx.index + " (base 100)" : idx.status}</span></div>
        <div class="kv"><span class="k">Feed-cost pressure</span><span>+${fc.totalFeedCostPressurePct}% (index ${fc.marketIndexChangePct}% + CPI ${fc.inflationPct}%)</span></div>
        <div class="kv"><span class="k">Risk band distribution</span><span>${bandDist(ms)}</span></div>
        <div class="kv"><span class="k">Confidence (avg)</span><span>${confidenceAvg(ms)}</span></div>
        <div class="kv"><span class="k">Suppliers identified</span><span>${DATA.suppliers.suppliers.length} (from NBR exporters)</span></div>
      </div>
      <div class="panel"><h2>WHY / SO WHAT / NOW WHAT</h2>
        <p class="sub">Observation → interpretation → action, clearly separated.</p>
        ${soWhat(ms)}
      </div>
    </div>`;
}

/* ================= Executive Summary ================= */
function renderExecutive() {
  const ms = filtered();
  const health = marketHealth(ms);
  const toneColor = health.tone === "success" ? "#16a34a" : health.tone === "warning" ? "#b45309" : health.tone === "danger" ? "#dc2626" : "#94a3b8";
  const bestOpp = [...ms].filter(m => m.movement?.wow != null).sort((a, b) => a.movement.wow - b.movement.wow)[0];
  const biggestRisk = [...ms].filter(m => m.risk?.composite != null).sort((a, b) => b.risk.composite - a.risk.composite)[0];
  const priceAlert = [...ms].filter(m => m.movement?.wow != null).sort((a, b) => Math.abs(b.movement.wow) - Math.abs(a.movement.wow))[0];
  const actions = {};
  ms.forEach(m => { const a = m.procurement?.procurementAction; if (a) actions[a] = (actions[a] || 0) + 1; });
  const topAction = Object.entries(actions).sort((a, b) => b[1] - a[1])[0];
  const watchlist = computeWatchlist(ms);
  const origins = (DATA.origins?.countries || []).filter(c => c.country);
  const bestOrigin = origins.slice().sort((a, b) => b.rank1Count - a.rank1Count)[0];
  const worstOrigin = origins.filter(c => c.avgQuotedPrice).sort((a, b) => b.avgQuotedPrice - a.avgQuotedPrice)[0];

  const cards = [
    ["Market Health", `${health.score}/100`, health.label, health.tone],
    ["Biggest Opportunity", bestOpp ? bestOpp.name : "—", bestOpp ? `${pct0(bestOpp.movement.wow)} WoW` : "—", "success"],
    ["Biggest Risk", biggestRisk ? biggestRisk.name : "—", biggestRisk ? `${biggestRisk.risk.band} · ${biggestRisk.procurement?.riskSignal || ""}`.trim() : "—", "danger"],
    ["Best Origin", bestOrigin ? bestOrigin.country : "—", bestOrigin ? `#1 in ${bestOrigin.rank1Count} material(s)` : "—", "info"],
    ["Worst Origin", worstOrigin ? worstOrigin.country : "—", worstOrigin ? `$${fmt(worstOrigin.avgQuotedPrice)}/MT avg` : "—", "warning"],
    ["Price Alert", priceAlert ? priceAlert.name : "—", priceAlert ? `${pct0(priceAlert.movement.wow)} movement` : "—", "danger"],
    ["Procurement Action", topAction ? topAction[0] : "—", topAction ? "Most common this cycle" : "—", "info"],
    ["Watchlist", `${watchlist.length} material(s)`, watchlist[0] ? watchlist[0].m.name : "All clear", "warning"],
  ];

  const el = document.getElementById("view-executive");
  el.innerHTML = roleBanner() + `
    <div class="panel">
      <div class="exec-summary-head">
        <div class="health-gauge" style="--deg:${(health.score / 100) * 360}deg; --tone:${toneColor};">
          <div class="health-gauge-inner"><span class="health-score">${health.score}</span><span class="health-max">/100</span></div>
        </div>
        <div class="health-text">
          <h2>Market Health Score</h2>
          <span class="health-label" style="color:${toneColor};">${health.label}</span>
          <p class="sub">Composite of sourcing signal mix, cost risk share, price momentum and origin dependency across ${ms.length} tracked material(s).</p>
        </div>
      </div>
    </div>
    <div class="summary-grid">${cards.map(c => `
      <div class="summary-card">
        <div class="summary-label">${c[0]}</div>
        <div class="summary-value ${c[3]}">${c[1]}</div>
        <div class="summary-sub">${c[2]}</div>
      </div>`).join("")}
    </div>`;
}

function forecastDir(ms) {
  const dirs = ms.filter(m => m.forecast.direction).map(m => m.forecast.direction);
  if (!dirs.length) return "—";  const up = dirs.filter(d => d === "up").length, down = dirs.filter(d => d === "down").length;
  if (up === down) return "Mixed";
  return up > down ? `Up (${up} of ${dirs.length})` : `Down (${down} of ${dirs.length})`;
}
function bandDist(ms) { const c = {}; ms.forEach(m => c[m.risk.band] = (c[m.risk.band] || 0) + 1); return Object.entries(c).map(([k, v]) => `${k} ${v}`).join(" · ") || "—"; }
function confidenceAvg(ms) { const c = {}; ms.forEach(m => c[m.evidenceConfidence.level] = (c[m.evidenceConfidence.level] || 0) + 1); return Object.entries(c).map(([k, v]) => `${k} ${v}`).join(" · ") || "—"; }
function originDependency(ms) { const s = ms.filter(m => m.originStats && m.originStats.count === 1).length; const o = ms.filter(m => m.originStats).length; return o ? Math.round(s / o * 100) : 0; }
function soWhat(ms) {
  const top = [...ms].sort((a, b) => b.risk.composite - a.risk.composite).slice(0, 4);
  return top.map(m => `<div class="kv"><span class="k">${m.name}</span><span>risk ${m.risk.composite}/100 (${m.risk.band})</span></div>`).join("") || "<p>No materials in view.</p>";
}

/* ================= Material Intelligence ================= */
function renderMaterial() {
  const ms = [...filtered()].sort((a, b) => (a.name < b.name ? -1 : 1));
  const hasMomentum = ms.some(m => (state.momentumPeriod === "mom" ? m.movement.mom : m.movement.wow) != null);
  document.getElementById("view-material").innerHTML = roleBanner() + `
    <div class="panel">
      <h2>Price momentum ranking</h2>
      <p class="sub">Which materials are moving most right now — DERIVED (recomputed) from the benchmark snapshot. Top 15 by magnitude, sorted risers → fallers.</p>
      <div class="chart-toggle">
        <span class="chip ${state.momentumPeriod === "wow" ? "active" : ""}" data-mom="wow">WoW (7-day)</span>
        <span class="chip ${state.momentumPeriod === "mom" ? "active" : ""}" data-mom="mom">MoM (30-day)</span>
      </div>
      ${hasMomentum ? `<div class="chart-box"><canvas id="chart-momentum"></canvas></div>` : `<div class="state-unavailable">No momentum data for the current filter selection.</div>`}
      <div class="chart-meta">Data type: DERIVED · Source: ${state.source === "All" ? "Fastmarkets snapshot 2026-09-02" : state.source} · as of ${fmtDate(DATA.materials.asOfDate)}</div>
    </div>
    <div class="panel">
      <h2>Price trend — selected materials</h2>
      <p class="sub">Monthly trend interpolated across tracked anchor points (avg2024 → current) — DERIVED interpolation, not observed. Top 6 by import value.</p>
      <div class="chart-toggle">
        <span class="chip ${state.trendRange === 12 ? "active" : ""}" data-range="12">12M</span>
        <span class="chip ${state.trendRange === 6 ? "active" : ""}" data-range="6">6M</span>
        <span class="chip ${state.trendRange === 3 ? "active" : ""}" data-range="3">3M</span>
      </div>
      <div class="chart-box"><canvas id="chart-price-trend"></canvas></div>
    </div>
    <div class="grid-2">
      <div class="panel">
        <h2>Risk distribution</h2>
        <p class="sub">Sourcing risk signal mix across materials in view.</p>
        <div class="chart-box"><canvas id="chart-risk-donut"></canvas></div>
      </div>
      <div class="panel">
        <h2>Akij sourcing vs. best buy</h2>
        <p class="sub">Cost gap versus best available origin (USD/MT) — where Akij's sourcing country has a quoted price.</p>
        <div class="chart-box tall"><canvas id="chart-sourcing-gap"></canvas></div>
      </div>
    </div>
    <div class="panel">
      <table><thead><tr>
        <th>Material</th><th>Category</th><th>Source</th><th class="num">Current $/MT</th>
        <th class="num">WoW%</th><th class="num">Forecast</th><th class="num">Landed $/MT</th>
        <th>Risk</th><th>Confidence</th><th>DQ</th>
      </tr></thead><tbody>
      ${ms.map(m => `
        <tr data-id="${m.id}">
          <td><strong>${m.name}</strong></td><td>${m.category}</td><td>${m.source}</td>
          <td class="num">${m.benchmark.current != null ? "$" + fmt(m.benchmark.current) : "—"}</td>
          <td class="num ${m.movement.wow > 0 ? "pos" : "neg"}">${pct0(m.movement.wow)}</td>
          <td class="num">${m.forecast.nextWeek != null ? "$" + fmt(m.forecast.nextWeek) + (m.forecast.direction === "up" ? " ↑" : " ↓") : "—"}</td>
          <td class="num">${m.landedCost.landedCostUsdMt ? "$" + fmt(m.landedCost.landedCostUsdMt) : "—"}</td>
          <td><span class="badge ${riskBadge(m.risk.band)}">${m.risk.band}</span></td>
          <td>${m.evidenceConfidence.level}</td>
          <td class="num">${m.dataQuality.score}</td>
        </tr>`).join("")}
      </tbody></table>
    </div>`;
  document.getElementById("view-material").querySelectorAll("tbody tr").forEach(tr => tr.onclick = () => openMaterial(tr.dataset.id));
  document.querySelectorAll("#view-material .chart-toggle .chip[data-mom]").forEach(c => c.onclick = () => { state.momentumPeriod = c.dataset.mom; render(); });
  document.querySelectorAll("#view-material .chart-toggle .chip[data-range]").forEach(c => c.onclick = () => { state.trendRange = +c.dataset.range; render(); });
  if (hasMomentum) mountChart("momentum", momentumChart(ms));
  mountChart("price-trend", priceTrendChart(ms));
  mountChart("risk-donut", riskDonutChart(ms));
  mountChart("sourcing-gap", sourcingGapChart(ms));
}
function riskBadge(b) { return b === "Critical" || b === "High" ? "b-red" : b === "Moderate" ? "b-amber" : "b-green"; }

function openMaterial(id) {
  const m = DATA.materials.materials.find(x => x.id === id);
  const lc = m.landedCost; const sv = m.savings; const fc = m.forecast;
  const box = document.getElementById("modalBox");
  box.innerHTML = `
    <button class="modal-close" onclick="document.getElementById('modal').classList.remove('show')">✕</button>
    <h2>${m.name} <span class="badge b-blue">${m.source}</span> <span class="badge ${riskBadge(m.risk.band)}">${m.risk.band}</span></h2>
    <p style="color:var(--ink-3);margin-bottom:12px;">HS ${m.hsCode} · ${m.category} · ${m.unit}</p>
    <div class="grid-2">
      <div>
        <h3>Benchmark &amp; movement</h3>
        ${Object.entries(m.benchmark).map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span>${v != null ? "$" + fmt(v) : "—"}</span></div>`).join("")}
        ${Object.entries(m.movement).map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span>${pct0(v)}</span></div>`).join("")}
        ${m.opportunity && m.opportunity.status === "OK" ? `
          <div class="kv"><span class="k">Position vs 2025 avg</span><span>${pct0(m.opportunity.positionVs2025)}</span></div>
          <div class="kv"><span class="k">Opportunity quadrant</span><span>${m.opportunity.quadrant}</span></div>` : ""}
      </div>
      <div>
        <h3>Origin &amp; supply</h3>
        ${m.originStats ? Object.entries(m.originStats).map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span>${Array.isArray(v) ? v.join(", ") : v}</span></div>`).join("") : "<p class='state-unavailable'>No origin observations mapped.</p>"}
        <h3 style="margin-top:12px;">Risk (composite ${m.risk.composite}/100)</h3>
        ${Object.entries(m.risk.dimensions).map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span>${v}</span></div>`).join("")}
      </div>
    </div>
    <h3 style="margin-top:14px;">Forecast — <span class="badge b-purple">${fc.status}</span></h3>
    <div class="kv"><span class="k">Next week</span><span>${fc.nextWeek != null ? "$" + fmt(fc.nextWeek) + " (" + fc.direction + ")" : "—"} · method ${fc.method || "—"}</span></div>
    <div class="kv"><span class="k">Range</span><span>${fc.lower ? "$" + fmt(fc.lower) : "—"} – ${fc.upper ? "$" + fmt(fc.upper) : "—"}</span></div>
    <p style="font-size:11px;color:var(--ink-3);margin-top:4px;">${fc.label || ""}</p>
    <h3 style="margin-top:14px;">Landed cost — <span class="badge ${lc.status === "COMPLETE" ? "b-green" : "b-amber"}">${lc.status}</span></h3>
    ${lc.status === "COMPLETE"
      ? `<div class="kv"><span class="k">Landed (CIF import)</span><span>$${fmt(lc.landedCostUsdMt)}/MT</span></div>
         <div class="kv"><span class="k">Origin FOB</span><span>${lc.originPriceFob ? "$" + fmt(lc.originPriceFob) : "—"}/MT</span></div>
         <div class="kv"><span class="k">Implied logistics premium</span><span>${lc.impliedLogisticsPremium != null ? "$" + fmt(lc.impliedLogisticsPremium) : "—"}/MT</span></div>`
      : `<div class="state-partial">Missing: ${(lc.missingComponents || []).join(", ")}. ${lc.note || ""}</div>`}
    <h3 style="margin-top:14px;">Savings — <span class="badge ${sv.status === "ESTIMATE" ? "b-green" : "b-gray"}">${sv.status}</span></h3>
    ${sv.status === "ESTIMATE"
      ? `<div class="kv"><span class="k">Origin gap</span><span>$${fmt(sv.gapUsdMt)}/MT × ${fmt(sv.volumeMt)} MT</span></div>
         <div class="kv"><span class="k">Potential saving</span><span><strong>$${fmt(sv.potentialSavingUsd)}</strong></span></div>`
      : `<div class="state-unavailable">${sv.reason}</div>`}
    ${m.priceHistory ? `
    <h3 style="margin-top:14px;">Price history <span class="badge b-blue">DERIVED</span></h3>
    <div class="chart-box" style="height:220px;"><canvas id="chart-modal-history"></canvas></div>
    <p style="font-size:11px;color:var(--ink-3,var(--theme-muted));margin-top:4px;">${m.priceHistory.points} snapshots (${m.priceHistory.start} → ${m.priceHistory.end}) · total ${pct0(m.priceHistory.changePct)} · last ${pct0(m.priceHistory.lastChangePct)}${m.priceHistory.returnVolPct != null ? " · return vol " + m.priceHistory.returnVolPct + "%" : ""} · ${m.priceHistory.frequency}</p>` : ""}
  `;
  document.getElementById("modal").classList.add("show");
  if (m.priceHistory) mountChart("modal-history", priceHistoryChart(m));
}

/* ================= Origin & Supply ================= */
function renderOrigin() {
  const ms = filtered();
  const agg = {};
  ms.forEach(m => {
    (m.originStats?.countries || []).forEach(c => { agg[c] = agg[c] || { materials: 0, vol: 0 }; agg[c].materials++; });
    (m.importIntelligence?.origins || []).forEach(o => {
      agg[o.country] = agg[o.country] || { materials: 0, vol: 0 };
      agg[o.country].vol += o.volumeMt || 0;
    });
  });
  const rows = Object.entries(agg).sort((a, b) => (b[1].vol || 0) - (a[1].vol || 0));
  document.getElementById("view-origin").innerHTML = roleBanner() + `
    <div class="panel"><h2>Origin concentration &amp; import footprint (full country names)</h2>
    <table><thead><tr><th>Origin</th><th class="num">Import volume (MT)</th><th class="num">Materials quoted</th></tr></thead><tbody>
    ${rows.map(([c, v]) => `<tr><td>${c}</td><td class="num">${v.vol ? fmt(v.vol) : "—"}</td><td class="num">${v.materials}</td></tr>`).join("")}
    </tbody></table></div>`;
}

/* ================= Supplier Intelligence ================= */
function renderSupplier() {
  const sups = DATA.suppliers.suppliers.slice(0, 60);
  document.getElementById("view-supplier").innerHTML = roleBanner() + `
    <div class="panel"><h2>Supplier intelligence (from NBR exporter records)</h2>
    <p class="sub">Exporter, country, volume, value and implied unit value. Quality/reliability/lead-time not assessed (not in source data).</p>
    <table><thead><tr><th>Exporter</th><th>Country</th><th class="num">Volume MT</th><th class="num">Value USD</th><th class="num">Unit value $/MT</th><th class="num">Shipments</th></tr></thead><tbody>
    ${sups.map(s => `<tr><td><strong>${s.name}</strong></td><td>${s.countryName || s.countryCode}</td><td class="num">${fmt(s.volumeMt)}</td><td class="num">$${fmt(s.valueUsd)}</td><td class="num">${s.unitValueUsdMt ? "$" + fmt(s.unitValueUsdMt) : "—"}</td><td class="num">${s.shipments}</td></tr>`).join("")}
    </tbody></table></div>
    <div class="panel"><h2>Supplier concentration by country</h2>
    <table><thead><tr><th>Country</th><th class="num">Volume MT</th><th class="num">Value USD</th><th class="num">Suppliers</th></tr></thead><tbody>
    ${DATA.suppliers.byCountry.map(c => `<tr><td>${c.country}</td><td class="num">${fmt(c.volumeMt)}</td><td class="num">$${fmt(c.valueUsd)}</td><td class="num">${c.suppliers}</td></tr>`).join("")}
    </tbody></table></div>`;
}

/* ================= Market Signals (MCP) ================= */
function renderSignals() {
  const sg = DATA["market-signals"];
  document.getElementById("view-signals").innerHTML = roleBanner() + `
    <div class="panel"><h2>Market signals <span class="badge b-blue">feed-intelligence MCP</span></h2>
    <p class="sub">${sg.summary}</p>
    <table><thead><tr><th>#</th><th>Signal</th><th>Dimension</th><th>Magnitude</th><th>Severity</th><th>Confidence</th></tr></thead><tbody>
    ${sg.signals.map(s => `<tr><td>${s.rank}</td><td><strong>${s.signal}</strong></td><td>${s.dimension}</td><td>${s.magnitude}</td><td>${s.severity}</td><td>${s.confidence}</td></tr>`).join("")}
    </tbody></table></div>
    <div class="grid-2">
      <div class="panel"><h2>WoW risers / fallers</h2>
        <div class="kv"><span class="k">Risers</span><span>${sg.wowRisers.map(r => `${r.material} ${r.pct}`).join(" · ")}</span></div>
        <div class="kv" style="margin-top:8px;"><span class="k">Fallers</span><span>${sg.wowFallers.map(r => `${r.material} ${r.pct}`).join(" · ")}</span></div>
      </div>
      <div class="panel"><h2>Predictions <span class="badge b-purple">SAMPLE</span></h2>
        ${sg.predictions.map(p => `<div class="kv"><span class="k">${p.signal}</span><span>${p.magnitude} · ${p.confidence}</span></div>`).join("")}
      </div>
    </div>
    <div class="panel"><h2>Core price trajectory (6 snapshots · Jun–Aug 2026)</h2>
      <p class="sub">Indexed to 100 = first snapshot (absolute levels differ ~40× across materials). Source: feed-intelligence MCP.</p>
      <div class="chart-box"><canvas id="chart-trajectory"></canvas></div>
      <table><thead><tr><th>Material</th><th class="num">W1</th><th class="num">W2</th><th class="num">W3</th><th class="num">W4</th><th class="num">W5</th><th class="num">W6</th><th>Verdict</th></tr></thead><tbody>
      ${sg.trajectory.map(t => `<tr><td><strong>${t.material}</strong></td>${t.values.map(v => `<td class="num">${v}</td>`).join("")}<td>${t.verdict}</td></tr>`).join("")}
      </tbody></table></div>`;
  mountChart("trajectory", trajectoryChart(sg));
}

/* ================= Procurement Intelligence ================= */
function renderProcurement() {
  const ms = filtered();
  const oppCount = ms.filter(m => m.opportunity && m.opportunity.status === "OK").length;
  document.getElementById("view-procurement").innerHTML = roleBanner() + `
    <div class="panel">
      <h2>Procurement opportunity matrix</h2>
      <p class="sub">Where Procurement should look first — analytical interpretation, NOT a buy/sell instruction. X = price vs 2025 average (right = expensive) · Y = WoW change (up = rising) · bubble = import volume.</p>
      ${oppCount ? `<div class="chart-box tall"><canvas id="chart-opportunity"></canvas></div>` : `<div class="state-unavailable">Insufficient data for the current filter — needs current price, 2025 average and week-over-week for each material.</div>`}
      <div class="chart-meta">Data type: DERIVED · position = (current − avg2025) / avg2025 · momentum = WoW (7-day) · as of ${fmtDate(DATA.materials.asOfDate)}</div>
    </div>
    <div class="panel"><h2>Benchmark vs landed cost vs savings</h2>
    <p class="sub">Landed cost = actual NBR import (CIF) unit value. Savings = (landed − best origin) × volume (ESTIMATE).</p>
    <table><thead><tr><th>Material</th><th class="num">Benchmark $/MT</th><th class="num">Landed $/MT</th><th class="num">Premium vs best</th><th class="num">Potential saving</th></tr></thead><tbody>
    ${ms.map(m => `
      <tr><td><strong>${m.name}</strong></td>
      <td class="num">${m.benchmark.current != null ? "$" + fmt(m.benchmark.current) : "—"}</td>
      <td class="num">${m.landedCost.landedCostUsdMt ? "$" + fmt(m.landedCost.landedCostUsdMt) : "—"}</td>
      <td class="num ${m.procurement.premiumVsBest > 0 ? "pos" : "neg"}">${pct0(m.procurement.premiumVsBest)}</td>
      <td class="num">${m.savings.potentialSavingUsd ? "$" + fmt(m.savings.potentialSavingUsd) : "—"}</td></tr>`).join("")}
    </tbody></table></div>`;
  if (oppCount) mountChart("opportunity", opportunityChart(ms));
}

/* ================= Import Intelligence ================= */
function renderImport() {
  const ms = filtered().filter(m => m.importIntelligence);
  document.getElementById("view-import").innerHTML = roleBanner() + `
    <div class="panel"><h2>Bangladesh import intelligence</h2>
    <p class="sub">Volume, value, unit value, origin concentration and arbitrage vs benchmark.</p>
    <table><thead><tr><th>Material</th><th class="num">Volume MT</th><th class="num">Value USD</th><th class="num">Unit value $/MT</th><th class="num">Benchmark $/MT</th><th class="num">Arbitrage</th><th class="num">Origin conc.</th><th>Top origin</th></tr></thead><tbody>
    ${ms.map(m => {
      const ii = m.importIntelligence; const bench = m.benchmark.current;
      const arb = bench && ii.unitValueUsdMt ? (ii.unitValueUsdMt - bench) / bench : null;
      return `<tr><td><strong>${m.name}</strong></td>
      <td class="num">${ii.volumeMt ? fmt(ii.volumeMt) : "—"}</td>
      <td class="num">${ii.valueUsd ? "$" + fmt(ii.valueUsd) : "—"}</td>
      <td class="num">${ii.unitValueUsdMt ? "$" + fmt(ii.unitValueUsdMt) : "—"}</td>
      <td class="num">${bench ? "$" + fmt(bench) : "—"}</td>
      <td class="num ${arb > 0 ? "pos" : "neg"}">${pct0(arb)}</td>
      <td class="num">${ii.concentrationPct != null ? ii.concentrationPct + "%" : "—"}</td>
      <td>${ii.topOrigin || "—"}</td></tr>`; }).join("")}
    </tbody></table></div>`;
}

/* ================= Import Trends (multi-year) ================= */
function renderImportTrends() {
  const groups = (DATA["import-trends"]?.groups || []);
  if (!groups.length) {
    document.getElementById("view-import-trends").innerHTML = roleBanner() + `<div class="state-unavailable">Import-trend data unavailable (missing Master_Import_Data files).</div>`;
    return;
  }
  if (!groups.some(g => g.hs === state.importHs)) state.importHs = groups[0].hs;
  const g = groups.find(x => x.hs === state.importHs);
  const yoy = g.yoy;
  const yoyLine = yoy ? `YoY ${yoy.latestYear} vs ${yoy.priorYear}: volume ${pct0(yoy.volumeYoYPct)} · value ${pct0(yoy.valueYoYPct)} (complete-year comparison)` : "YoY — insufficient complete years";
  document.getElementById("view-import-trends").innerHTML = roleBanner() + `
    <div class="panel">
      <h2>Multi-year import trend — ${g.name}</h2>
      <p class="sub">Bangladesh customs import records (2014–2025), deduplicated by Bill of Entry. Unit value = USD invoice value ÷ quantity MT (source "Price In MT" column not trusted).</p>
      <div class="chart-toggle">
        <span class="mono" style="font-size:11px;color:var(--ink-3,var(--theme-muted));align-self:center;">Material:</span>
        <select class="chart-select" id="importTrendSelect">${groups.map(x => `<option value="${x.hs}" ${x.hs === g.hs ? "selected" : ""}>${x.name}</option>`).join("")}</select>
      </div>
      <div class="chart-box tall"><canvas id="chart-import-trend"></canvas></div>
      <div class="chart-meta">${g.records.toLocaleString()} import records · total ${fmt(g.totalVolumeMt)} MT · avg unit value $${fmt(g.avgUnitValueUsdMt)}/MT · ${yoyLine}</div>
      <div class="grid-2" style="margin-top:14px;">
        <div>
          <h3 style="font-size:12px;margin-bottom:6px;">Top origins (by volume)</h3>
          ${g.origins.map(o => `<div class="kv"><span class="k">${o.origin}</span><span>${fmt(o.volumeMt)} MT (${o.sharePct}%)</span></div>`).join("") || "<p class='sub'>No origin data.</p>"}
        </div>
        <div>
          <h3 style="font-size:12px;margin-bottom:6px;">Latest 12 months (unit value $/MT)</h3>
          ${g.months.slice(-12).map(m => `<div class="kv"><span class="k">${m.ym}</span><span>${m.unitValueUsdMt ? "$" + fmt(m.unitValueUsdMt) : "—"}</span></div>`).join("")}
        </div>
      </div>
    </div>
    <div class="panel">
      <h2>Import seasonality (month × material)</h2>
      <p class="sub">Seasonal index = month average ÷ long-term average × 100. Green = below normal, red = above normal. Only materials with ≥24 months of data are shown.</p>
      ${seasonalityHeatmap(groups)}
    </div>`;
  document.getElementById("importTrendSelect").addEventListener("change", e => { state.importHs = e.target.value; render(); });
  mountChart("import-trend", importTrendChart(g));
}

/* ================= Forecast & Scenario ================= */
function renderForecast() {
  const ms = filtered().filter(m => m.forecast.status === "SAMPLE");
  const sc = DATA.scenario;
  document.getElementById("view-forecast").innerHTML = roleBanner() + `
    <div class="panel"><h2>Sample forecast <span class="badge b-purple">SAMPLE — low confidence</span></h2>
    <p class="sub">Built from the 6 available anchor points (avg2024 → current) using Naïve / MA(3) / Exponential Smoothing, with leave-one-out backtest. Not a validated forecast.</p>
    <table><thead><tr><th>Material</th><th class="num">Current $/MT</th><th class="num">Next wk $/MT</th><th>Direction</th><th>Method</th><th class="num">MAPE (backtest)</th></tr></thead><tbody>
    ${ms.map(m => `<tr><td><strong>${m.name}</strong></td><td class="num">${fmt(m.benchmark.current)}</td><td class="num">${fmt(m.forecast.nextWeek)}</td><td>${m.forecast.direction}</td><td>${m.forecast.method}</td><td class="num">${m.forecast.methods[m.forecast.method]?.mape != null ? (m.forecast.methods[m.forecast.method].mape * 100).toFixed(0) + "%" : "—"}</td></tr>`).join("")}
    </tbody></table></div>
    <div class="panel"><h2>Scenario engine <span class="badge b-red">SIMULATION — NOT ACTUAL</span></h2>
    <p class="sub">Sensitivity of the market index (base ${sc.baseIndex}) to ±10% shocks in key inputs. Category weights are indicative; freight is excluded (no freight data).</p>
    <table><thead><tr><th>Input</th><th class="num">Indicative weight</th><th class="num">Shock</th><th class="num">Index impact (pts)</th></tr></thead><tbody>
    ${sc.sensitivities.map(s => `<tr><td>${s.input}</td><td class="num">${s.weight ? (s.weight * 100).toFixed(0) + "%" : "—"}</td><td class="num">+${s.shockPct}%</td><td class="num">${s.indexImpactPts != null ? "+" + s.indexImpactPts : "—"}</td></tr>`).join("")}
    </tbody></table></div>`;
}

/* ================= Feed Cost Impact ================= */
function renderFeedCost() {
  const fc = DATA["feed-cost"];
  document.getElementById("view-feedcost").innerHTML = roleBanner() + `
    <div class="panel"><h2>Feed cost impact <span class="badge b-amber">ESTIMATE</span></h2>
    <p class="sub">Portfolio-level feed-cost pressure using Bangladesh CPI inflation. Per-animal (Broiler/Layer/Fish/Cattle) impact requires formulation data.</p>
    <div class="grid-2">
      <div class="panel"><h2>Components</h2>
        <div class="kv"><span class="k">Market index change</span><span>+${fc.marketIndexChangePct}%</span></div>
        <div class="kv"><span class="k">Bangladesh CPI inflation</span><span>+${fc.inflationPct}% (${fc.inflationSource})</span></div>
        <div class="kv"><span class="k">Total feed-cost pressure</span><span><strong>+${fc.totalFeedCostPressurePct}%</strong></span></div>
      </div>
      <div class="panel"><h2>Interpretation</h2>
        <p>Raw-material prices are up ~${fc.marketIndexChangePct}% vs the 2025 base, and Bangladesh CPI inflation is running at ${fc.inflationPct}% (Jul 2026). Combined, feed-cost pressure is roughly <strong>+${fc.totalFeedCostPressurePct}%</strong> year-over-year — an ESTIMATE, not a formulation-based figure.</p>
      </div>
    </div>`;
}

/* ================= Alert Center ================= */
function renderAlerts() {
  const ms = filtered().filter(m => m.risk.band === "High" || m.risk.band === "Critical" || m.dataQuality.issues.length);
  document.getElementById("view-alerts").innerHTML = roleBanner() + `
    <div class="panel"><h2>Alert Center</h2>
    <p class="sub">Priority = Magnitude × Abnormality × Exposure × Evidence Confidence.</p>
    <table><thead><tr><th>Material</th><th>Risk band</th><th>Composite</th><th>DQ issues</th><th>Confidence</th></tr></thead><tbody>
    ${ms.map(m => `<tr><td><strong>${m.name}</strong></td><td><span class="badge ${riskBadge(m.risk.band)}">${m.risk.band}</span></td><td class="num">${m.risk.composite}/100</td><td>${m.dataQuality.issues.join("; ") || "—"}</td><td>${m.evidenceConfidence.level}</td></tr>`).join("")}
    </tbody></table></div>`;
}

/* ================= Data Quality & Governance ================= */
function renderQuality() {
  const ms = [...filtered()].sort((a, b) => a.dataQuality.score - b.dataQuality.score);
  document.getElementById("view-quality").innerHTML = roleBanner() + `
    <div class="panel"><h2>Data quality score</h2>
    <p class="sub">Completeness · freshness · source coverage · validity. Lowest first.</p>
    <table><thead><tr><th>Material</th><th class="num">DQ</th><th class="num">Completeness</th><th class="num">Freshness</th><th class="num">Coverage</th><th>Issues</th></tr></thead><tbody>
    ${ms.map(m => `<tr><td><strong>${m.name}</strong></td><td class="num">${m.dataQuality.score}</td><td class="num">${m.dataQuality.completeness}</td><td class="num">${m.dataQuality.freshness}</td><td class="num">${m.dataQuality.sourceCoverage}</td><td>${m.dataQuality.issues.join("; ") || "—"}</td></tr>`).join("")}
    </tbody></table></div>`;
}

/* ================= Methodology / Settings ================= */
function renderMethodology() {
  document.getElementById("view-methodology").innerHTML = roleBanner() + `
    <div class="panel"><h2>Methodology center</h2>
    <p class="sub">See docs/METHODOLOGY.md and docs/KPI_DICTIONARY.md.</p>
    <div class="kv"><span class="k">Market Index</span><span>Σ(Current × Weight) / Σ(Base × Weight) × 100 — equal-weight fallback.</span></div>
    <div class="kv"><span class="k">Forecast (SAMPLE)</span><span>Naïve / MA(3) / Exponential Smoothing over 6 anchors, leave-one-out MAPE backtest.</span></div>
    <div class="kv"><span class="k">Landed cost</span><span>Actual NBR import (CIF) unit value where available; implied logistics premium vs FOB origin.</span></div>
    <div class="kv"><span class="k">Savings (ESTIMATE)</span><span>(Landed − best origin) × volume — not Akij-specific (no Akij prices).</span></div>
    <div class="kv"><span class="k">Feed cost (ESTIMATE)</span><span>Index change + Bangladesh CPI (8.32%, Jul 2026).</span></div>
    <div class="kv"><span class="k">Risk</span><span>7 weighted dimensions → 0–30 Low · 31–50 Moderate · 51–70 High · 71–100 Critical.</span></div>
    <div class="kv"><span class="k">Evidence confidence</span><span>source quality + freshness + completeness + cross-source + depth.</span></div></div>`;
}
function renderSettings() {
  const srcs = (DATA.sources.sources || []).map(s =>
    `<div class="kv"><span class="k">${s.name}</span><span>${s.type} · quality ${s.quality} — ${s.notes}</span></div>`).join("");
  document.getElementById("view-settings").innerHTML = roleBanner() + `
    <div class="panel"><h2>Settings</h2>
    <div class="kv"><span class="k">Risk weights</span><span>Price 20% · Momentum 15% · Forecast 15% · Origin 15% · Supplier 10% · Import 10% · Premium 10% · Data 5%</span></div>
    <div class="kv"><span class="k">Risk bands</span><span>0–30 Low · 31–50 Moderate · 51–70 High · 71–100 Critical</span></div>
    <div class="kv"><span class="k">Inflation (BD CPI)</span><span>8.32% — Jul 2026 (Bangladesh Bank / Trading Economics)</span></div>
    <div class="kv"><span class="k">Market index</span><span>Base 100 · equal-weight fallback</span></div></div>
    <div class="panel"><h2>Data sources</h2><p class="sub">Attribution and quality of every data input.</p>${srcs}</div>`;
}

/* ================= helpers ================= */
function fmt(n) { return Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 }); }
function fmtDate(s) { return s ? new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"; }
function pct0(v) { return v == null ? "—" : (v > 0 ? "+" : "") + (v * 100).toFixed(1) + "%"; }

/* ================= wiring ================= */
document.querySelectorAll(".nav-item").forEach(n => n.addEventListener("click", () => { state.view = n.dataset.view; render(); }));
document.querySelectorAll(".role-btn").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll(".role-btn").forEach(x => x.classList.remove("active"));
  b.classList.add("active"); state.role = b.dataset.role; render();
}));
document.getElementById("search").addEventListener("input", e => { state.search = e.target.value; render(); });
document.getElementById("modal").addEventListener("click", e => { if (e.target.id === "modal") e.target.classList.remove("show"); });

load();
