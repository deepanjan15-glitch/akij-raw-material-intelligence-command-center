// AKIJ AGRO FEED — Raw Material Market Intelligence & Procurement Command Center
// Presentation layer (thin). All heavy analytics are precomputed by engine/run.py.

let DATA = {};
let state = { view: "command", role: "ceo", category: "All", source: "All", search: "" };

const ROLE_TITLES = {
  ceo: "Situation → Risk → Opportunity → Action",
  procurement: "Benchmark → Supplier → Landed Cost → Negotiation",
  research: "Market → Statistics → Drivers → Forecast",
  commercial: "Feed Cost → Market Pressure → Scenario",
};

const ROLE_MODULES = {
  ceo: ["command", "alerts", "procurement", "material"],
  procurement: ["procurement", "material", "import", "origin"],
  research: ["material", "origin", "forecast", "import"],
  commercial: ["feedcost", "forecast", "command", "material"],
};

const VIEW_TITLES = {
  command: "Command Center", material: "Material Intelligence", origin: "Origin & Supply",
  procurement: "Procurement Intelligence", import: "Import Intelligence",
  forecast: "Forecast & Scenario", feedcost: "Feed Cost Impact", alerts: "Alert Center",
  quality: "Data Quality & Governance", methodology: "Methodology", settings: "Settings",
};

async function load() {
  const [materials, index, meta, sources] = await Promise.all([
    fetch("data/materials.json").then(r => r.json()),
    fetch("data/market-index.json").then(r => r.json()),
    fetch("data/meta.json").then(r => r.json()),
    fetch("data/sources.json").then(r => r.json()),
  ]);
  DATA = { materials, index, meta, sources };
  document.getElementById("asOf").textContent = fmtDate(materials.asOfDate);
  renderHonesty();
  renderFilters();
  render();
}

function renderHonesty() {
  const notes = DATA.meta.dataHonesty.notes;
  const partial = notes.filter(n => n.includes("PARTIAL") || n.includes("UNAVAILABLE"));
  document.getElementById("honestyBanner").innerHTML =
    `<strong>Data honesty:</strong> ${partial.join(" · ")}`;
  document.getElementById("honestyBanner").classList.add("show");
}

function renderFilters() {
  const cats = ["All", ...new Set(DATA.materials.materials.map(m => m.category))];
  const srcs = ["All", ...new Set(DATA.materials.materials.map(m => m.source))];
  document.getElementById("filters").innerHTML = `
    <span class="mono" style="font-size:11px;color:var(--ink-3);align-self:center;">Category:</span>
    ${cats.map(c => `<span class="chip ${state.category === c ? "active" : ""}" data-cat="${c}">${c}</span>`).join("")}
    <span class="mono" style="font-size:11px;color:var(--ink-3);align-self:center;margin-left:10px;">Source:</span>
    ${srcs.map(s => `<span class="chip ${state.source === s ? "active" : ""}" data-src="${s}">${s}</span>`).join("")}
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
  document.getElementById("viewTitle").textContent = VIEW_TITLES[state.view];
  document.querySelectorAll(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.view === state.view));
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-" + state.view).classList.add("active");
  const fn = { command: renderCommand, material: renderMaterial, origin: renderOrigin,
    procurement: renderProcurement, import: renderImport, forecast: renderForecast,
    feedcost: renderFeedCost, alerts: renderAlerts, quality: renderQuality,
    methodology: renderMethodology, settings: renderSettings }[state.view];
  fn();
}

function roleBanner() {
  const list = ROLE_MODULES[state.role] || [];
  const names = list.map(v => VIEW_TITLES[v]).join(" → ");
  return `<div class="role-emphasis"><strong>${state.role.toUpperCase()}</strong> focus: ${ROLE_TITLES[state.role]}. Relevant modules: <strong>${names}</strong>.</div>`;
}

/* ================= Command Center ================= */
function renderCommand() {
  const ms = filtered();
  const priced = ms.filter(m => m.benchmark.current != null);
  const avgPrice = priced.length ? priced.reduce((a, m) => a + m.benchmark.current, 0) / priced.length : null;
  const avgRisk = ms.length ? ms.reduce((a, m) => a + m.risk.composite, 0) / ms.length : null;
  const avgDQ = ms.length ? ms.reduce((a, m) => a + m.dataQuality.score, 0) / ms.length : null;
  const importValue = ms.reduce((a, m) => a + (m.importIntelligence?.valueUsd || 0), 0);
  const highRisk = ms.filter(m => m.risk.band === "High" || m.risk.band === "Critical").length;
  const dqIssues = ms.reduce((a, m) => a + m.dataQuality.issues.length, 0);

  const kpis = [
    ["Market Index", DATA.index.status === "OK" ? DATA.index.index : "—", "Equal-weight fallback · base avg2025", DATA.index.status === "OK" ? "b-blue" : "b-gray"],
    ["Market Inflation", DATA.index.status === "OK" ? pct1(DATA.index.index - 100) : "—", "vs 2025 base", "b-blue"],
    ["Procurement Risk", avgRisk != null ? avgRisk.toFixed(0) + "/100" : "—", `${highRisk} materials High/Critical`, avgRisk > 50 ? "b-red" : "b-amber"],
    ["Supply Risk", originDependency(ms) + "%", "single-origin dependency", "b-amber"],
    ["Potential Saving", "UNAVAILABLE", "Akij prices not provided", "b-gray"],
    ["Financial Exposure", "$" + fmt(importValue), "tracked import value", "b-blue"],
    ["Forecast Direction", "UNAVAILABLE", "no time series", "b-gray"],
    ["Data Quality", avgDQ != null ? avgDQ.toFixed(0) + "/100" : "—", `${dqIssues} issues`, avgDQ > 70 ? "b-green" : "b-amber"],
    ["Data Freshness", fmtDate(DATA.materials.asOfDate), "as-of date", "b-green"],
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
        <div class="kv"><span class="k">Average current price</span><span>${avgPrice != null ? "$" + fmt(avgPrice) + "/MT" : "—"}</span></div>
        <div class="kv"><span class="k">Market index</span><span>${DATA.index.status === "OK" ? DATA.index.index + " (base 100)" : DATA.index.status}</span></div>
        <div class="kv"><span class="k">Risk band distribution</span><span>${bandDist(ms)}</span></div>
        <div class="kv"><span class="k">Confidence (avg)</span><span>${confidenceAvg(ms)}</span></div>
      </div>
      <div class="panel"><h2>WHY / SO WHAT / NOW WHAT</h2>
        <p class="sub">Observation → interpretation → action, clearly separated.</p>
        ${soWhat(ms)}
      </div>
    </div>`;
}

function bandDist(ms) {
  const c = {}; ms.forEach(m => c[m.risk.band] = (c[m.risk.band] || 0) + 1);
  return Object.entries(c).map(([k, v]) => `${k} ${v}`).join(" · ") || "—";
}
function confidenceAvg(ms) {
  const c = {}; ms.forEach(m => c[m.evidenceConfidence.level] = (c[m.evidenceConfidence.level] || 0) + 1);
  return Object.entries(c).map(([k, v]) => `${k} ${v}`).join(" · ") || "—";
}
function originDependency(ms) {
  const single = ms.filter(m => m.originStats && m.originStats.count === 1).length;
  const withOrigins = ms.filter(m => m.originStats).length;
  return withOrigins ? Math.round(single / withOrigins * 100) : 0;
}
function soWhat(ms) {
  const top = [...ms].sort((a, b) => b.risk.composite - a.risk.composite).slice(0, 3);
  const li = top.map(m => `<div class="kv"><span class="k">${m.name}</span><span>risk ${m.risk.composite}/100 (${m.risk.band}) — ${m.risk.dimensions.originConcentration > 50 ? "concentrated origin" : m.risk.dimensions.price > 30 ? "elevated price move" : "data uncertainty"}</span></div>`).join("");
  return `<p>Top risk exposures in view:</p>${li || "<p>No materials in view.</p>"}`;
}

/* ================= Material Intelligence ================= */
function renderMaterial() {
  const ms = [...filtered()].sort((a, b) => (a.name < b.name ? -1 : 1));
  const el = document.getElementById("view-material");
  el.innerHTML = roleBanner() + `
    <div class="panel">
      <table><thead><tr>
        <th>Material</th><th>Category</th><th>Source</th><th class="num">Current $/MT</th>
        <th class="num">WoW%</th><th class="num">MoM%</th><th class="num">Origin spread</th>
        <th>Risk</th><th>Confidence</th><th>DQ</th>
      </tr></thead><tbody>
      ${ms.map(m => `
        <tr data-id="${m.id}">
          <td><strong>${m.name}</strong></td><td>${m.category}</td><td>${m.source}</td>
          <td class="num">${m.benchmark.current != null ? "$" + fmt(m.benchmark.current) : "—"}</td>
          <td class="num ${m.movement.wow > 0 ? "pos" : "neg"}">${pct0(m.movement.wow)}</td>
          <td class="num ${m.movement.mom > 0 ? "pos" : "neg"}">${pct0(m.movement.mom)}</td>
          <td class="num">${m.originStats ? pct0(m.originStats.spreadPct / 100) : "—"}</td>
          <td><span class="badge ${riskBadge(m.risk.band)}">${m.risk.band}</span></td>
          <td>${m.evidenceConfidence.level} (${m.evidenceConfidence.score})</td>
          <td class="num">${m.dataQuality.score}</td>
        </tr>`).join("")}
      </tbody></table>
    </div>`;
  el.querySelectorAll("tbody tr").forEach(tr => tr.onclick = () => openMaterial(tr.dataset.id));
}

function riskBadge(b) { return b === "Critical" || b === "High" ? "b-red" : b === "Moderate" ? "b-amber" : "b-green"; }

function openMaterial(id) {
  const m = DATA.materials.materials.find(x => x.id === id);
  const box = document.getElementById("modalBox");
  const lc = m.landedCost;
  box.innerHTML = `
    <button class="modal-close" onclick="document.getElementById('modal').classList.remove('show')">✕</button>
    <h2>${m.name} <span class="badge b-blue">${m.source}</span> <span class="badge ${riskBadge(m.risk.band)}">${m.risk.band}</span></h2>
    <p style="color:var(--ink-3);margin-bottom:12px;">HS ${m.hsCode} · ${m.category} · ${m.unit}</p>
    <div class="grid-2">
      <div><h3>Benchmark</h3>
        ${Object.entries(m.benchmark).map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span>${v != null ? "$" + fmt(v) : "—"}</span></div>`).join("")}
        <h3 style="margin-top:12px;">Movement</h3>
        ${Object.entries(m.movement).map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span>${pct0(v)}</span></div>`).join("")}
      </div>
      <div><h3>Origin & supply</h3>
        ${m.originStats ? Object.entries(m.originStats).map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span>${Array.isArray(v) ? v.join(", ") : v}</span></div>`).join("") : "<p class='state-unavailable'>No origin observations mapped.</p>"}
        <h3 style="margin-top:12px;">Risk (composite ${m.risk.composite}/100)</h3>
        ${Object.entries(m.risk.dimensions).map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span>${v}</span></div>`).join("")}
      </div>
    </div>
    <h3 style="margin-top:14px;">Landed cost — <span class="badge ${lc.status === "PARTIAL" ? "b-amber" : "b-gray"}">${lc.status}</span></h3>
    ${lc.status === "PARTIAL" ? `<div class="state-partial">Missing: ${lc.missingComponents.join(", ")}. ${lc.note}</div>` : `<div class="state-unavailable">${lc.reason || ""}</div>`}
    <h3 style="margin-top:14px;">Savings — <span class="badge b-gray">${m.savings.status}</span></h3>
    <div class="state-unavailable">${m.savings.reason}</div>
  `;
  document.getElementById("modal").classList.add("show");
}

/* ================= Origin & Supply ================= */
function renderOrigin() {
  const ms = filtered();
  const agg = {};
  ms.forEach(m => {
    (m.originStats?.countries || []).forEach(c => { agg[c] = agg[c] || { materials: 0 }; agg[c].materials++; });
    (m.importIntelligence?.origins || []).forEach(o => {
      agg[o.country] = agg[o.country] || { materials: 0, vol: 0 };
      agg[o.country].vol = (agg[o.country].vol || 0) + (o.volumeMt || 0);
    });
  });
  const rows = Object.entries(agg).sort((a, b) => (b[1].vol || 0) - (a[1].vol || 0));
  const el = document.getElementById("view-origin");
  el.innerHTML = roleBanner() + `
    <div class="panel"><h2>Origin concentration &amp; import footprint</h2>
    <table><thead><tr><th>Origin</th><th class="num">Import volume (MT)</th><th class="num">Materials quoted</th></tr></thead><tbody>
    ${rows.map(([c, v]) => `<tr><td>${c}</td><td class="num">${v.vol ? fmt(v.vol) : "—"}</td><td class="num">${v.materials}</td></tr>`).join("")}
    </tbody></table></div>`;
}

/* ================= Procurement Intelligence ================= */
function renderProcurement() {
  const ms = filtered();
  const el = document.getElementById("view-procurement");
  el.innerHTML = roleBanner() + `
    <div class="panel"><h2>Benchmark vs landed cost vs Akij</h2>
    <p class="sub">Akij procurement price is not provided — savings and negotiation targets are UNAVAILABLE. Landed cost is PARTIAL (freight/insurance/duty/handling/LC missing).</p>
    <table><thead><tr><th>Material</th><th class="num">Benchmark $/MT</th><th class="num">Import unit value $/MT</th><th class="num">Premium vs best origin</th><th>Landed</th><th>Savings</th></tr></thead><tbody>
    ${ms.map(m => `
      <tr><td><strong>${m.name}</strong></td>
      <td class="num">${m.benchmark.current != null ? "$" + fmt(m.benchmark.current) : "—"}</td>
      <td class="num">${m.importIntelligence?.unitValueUsdMt ? "$" + fmt(m.importIntelligence.unitValueUsdMt) : "—"}</td>
      <td class="num ${m.procurement.premiumVsBest > 0 ? "pos" : "neg"}">${pct0(m.procurement.premiumVsBest)}</td>
      <td><span class="badge ${m.landedCost.status === "PARTIAL" ? "b-amber" : "b-gray"}">${m.landedCost.status}</span></td>
      <td><span class="badge b-gray">${m.savings.status}</span></td></tr>`).join("")}
    </tbody></table></div>`;
}

/* ================= Import Intelligence ================= */
function renderImport() {
  const ms = filtered().filter(m => m.importIntelligence);
  const el = document.getElementById("view-import");
  el.innerHTML = roleBanner() + `
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

/* ================= Forecast / Scenario / Feed Cost (honest UNAVAILABLE) ================= */
function renderForecast() {
  const el = document.getElementById("view-forecast");
  el.innerHTML = roleBanner() + `
    <div class="panel"><h2>Forecast &amp; Scenario</h2>
    <div class="state-unavailable">Forecasting is UNAVAILABLE — the engine has no historical time series (only a price snapshot and a 6-week import window). Per methodology, forecasts require sufficient history and are only enabled with backtesting (Naïve / MA / ES / ARIMA, with MAE / RMSE / MAPE / Bias).</div>
    <div class="state-unavailable" style="margin-top:10px;">Scenario engine is UNAVAILABLE — feed formulations and FX/freight inputs are not provided. All scenario output will be labelled <strong>SIMULATION — NOT ACTUAL</strong>.</div></div>`;
}
function renderFeedCost() {
  const el = document.getElementById("view-feedcost");
  el.innerHTML = roleBanner() + `
    <div class="panel"><h2>Feed Cost Impact</h2>
    <div class="state-unavailable">UNAVAILABLE — formulation / inclusion-rate data for Broiler, Layer, Fish and Cattle is not provided. Impact = Raw Material Price Change × Inclusion Rate cannot be computed without it.</div></div>`;
}

/* ================= Alert Center ================= */
function renderAlerts() {
  const ms = filtered().filter(m => m.risk.band === "High" || m.risk.band === "Critical" || m.dataQuality.issues.length);
  const el = document.getElementById("view-alerts");
  el.innerHTML = roleBanner() + `
    <div class="panel"><h2>Alert Center</h2>
    <p class="sub">Priority = Magnitude × Abnormality × Exposure × Evidence Confidence (risk-composite + DQ issues shown; full alert weighting is configurable in Settings).</p>
    <table><thead><tr><th>Material</th><th>Risk band</th><th>Composite</th><th>DQ issues</th><th>Confidence</th></tr></thead><tbody>
    ${ms.map(m => `<tr><td><strong>${m.name}</strong></td><td><span class="badge ${riskBadge(m.risk.band)}">${m.risk.band}</span></td><td class="num">${m.risk.composite}/100</td><td>${m.dataQuality.issues.join("; ") || "—"}</td><td>${m.evidenceConfidence.level}</td></tr>`).join("")}
    </tbody></table></div>`;
}

/* ================= Data Quality & Governance ================= */
function renderQuality() {
  const ms = [...filtered()].sort((a, b) => a.dataQuality.score - b.dataQuality.score);
  const el = document.getElementById("view-quality");
  el.innerHTML = roleBanner() + `
    <div class="panel"><h2>Data quality score</h2>
    <p class="sub">Completeness · freshness · source coverage · validity. Lowest-scoring materials first.</p>
    <table><thead><tr><th>Material</th><th class="num">DQ score</th><th class="num">Completeness</th><th class="num">Freshness</th><th class="num">Source coverage</th><th>Issues</th></tr></thead><tbody>
    ${ms.map(m => `<tr><td><strong>${m.name}</strong></td><td class="num">${m.dataQuality.score}</td><td class="num">${m.dataQuality.completeness}</td><td class="num">${m.dataQuality.freshness}</td><td class="num">${m.dataQuality.sourceCoverage}</td><td>${m.dataQuality.issues.join("; ") || "—"}</td></tr>`).join("")}
    </tbody></table></div>`;
}

/* ================= Methodology ================= */
function renderMethodology() {
  const el = document.getElementById("view-methodology");
  el.innerHTML = roleBanner() + `
    <div class="panel"><h2>Methodology center</h2>
    <p class="sub">Definition, formula, data requirement, interpretation and limitation for every major KPI (see docs/METHODOLOGY.md, docs/KPI_DICTIONARY.md).</p>
    <div class="kv"><span class="k">Market Index</span><span>Σ(Current × Weight) / Σ(Base × Weight) × 100 — equal-weight fallback (no spend weights).</span></div>
    <div class="kv"><span class="k">Movement</span><span>WoW/MoM/YoY/YTD = (new − old)/old, guarded for missing/zero denominators.</span></div>
    <div class="kv"><span class="k">Origin spread</span><span>cross-sectional std/CV of origin prices (NOT time-series volatility).</span></div>
    <div class="kv"><span class="k">Risk</span><span>7 weighted dimensions (Price/Momentum/Forecast/Origin/Supplier/Import/Premium/Data) → 0–30 Low · 31–50 Moderate · 51–70 High · 71–100 Critical.</span></div>
    <div class="kv"><span class="k">Evidence confidence</span><span>source quality + freshness + completeness + cross-source agreement + observation depth (replaces "AI confidence").</span></div>
    <div class="kv"><span class="k">Landed cost</span><span>Origin + Freight + Insurance + Duty/Tax + Handling + Finance/LC + Other — PARTIAL when components missing (never assumed zero).</span></div>
    <div class="kv"><span class="k">Forecast</span><span>Enabled only with sufficient history + backtesting (Naïve/MA/ES/ARIMA; MAE/RMSE/MAPE/Bias).</span></div></div>`;
}

/* ================= Settings ================= */
function renderSettings() {
  const el = document.getElementById("view-settings");
  el.innerHTML = roleBanner() + `
    <div class="panel"><h2>Settings</h2>
    <p class="sub">Configurable risk weights (starting values — not immutable truth) and risk bands.</p>
    <div class="kv"><span class="k">Risk weights</span><span>Price 20% · Momentum 15% · Forecast 15% · Origin conc. 15% · Supplier conc. 10% · Import dependency 10% · Procurement premium 10% · Data uncertainty 5%</span></div>
    <div class="kv"><span class="k">Risk bands</span><span>0–30 Low · 31–50 Moderate · 51–70 High · 71–100 Critical</span></div>
    <div class="kv"><span class="k">Market index</span><span>Base 100 · equal-weight fallback (configurable when spend/volume weights provided)</span></div></div>`;
}

/* ================= helpers ================= */
function fmt(n) { return Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 }); }
function fmtDate(s) { return s ? new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"; }
function pct0(v) { return v == null ? "—" : (v > 0 ? "+" : "") + (v * 100).toFixed(1) + "%"; }
function pct1(v) { return (v > 0 ? "+" : "") + v.toFixed(1) + "%"; }

/* ================= wiring ================= */
document.querySelectorAll(".nav-item").forEach(n => n.addEventListener("click", () => { state.view = n.dataset.view; render(); }));
document.querySelectorAll(".role-btn").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll(".role-btn").forEach(x => x.classList.remove("active"));
  b.classList.add("active"); state.role = b.dataset.role; render();
}));
document.getElementById("search").addEventListener("input", e => { state.search = e.target.value; render(); });
document.getElementById("modal").addEventListener("click", e => { if (e.target.id === "modal") e.target.classList.remove("show"); });

load();
