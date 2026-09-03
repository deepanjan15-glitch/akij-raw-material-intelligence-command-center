// AKIJ AGRO FEED — Raw Material Market Intelligence & Procurement Command Center
// Presentation layer (thin). Analytics are precomputed by engine/run.py; signals from feed-intelligence MCP.

let DATA = {};
let state = { view: "command", role: "ceo", category: "All", source: "All", search: "" };

const ROLE_TITLES = {
  ceo: "Situation → Risk → Opportunity → Action",
  procurement: "Benchmark → Supplier → Landed Cost → Negotiation",
  research: "Market → Statistics → Drivers → Forecast",
  commercial: "Feed Cost → Market Pressure → Scenario",
};

const VIEW_TITLES = {
  command: "Command Center", material: "Material Intelligence", origin: "Origin & Supply",
  supplier: "Supplier Intelligence", procurement: "Procurement Intelligence",
  signals: "Market Signals", import: "Import Intelligence",
  forecast: "Forecast & Scenario", feedcost: "Feed Cost Impact", alerts: "Alert Center",
  quality: "Data Quality & Governance", methodology: "Methodology", settings: "Settings",
};

// section color family per view (maps to [data-section] token overrides in style.css)
const SECTION = {
  command: "command", material: "material", origin: "origin", supplier: "supplier",
  procurement: "procurement", signals: "signals", import: "import", forecast: "forecast",
  feedcost: "feedcost", alerts: "alerts", quality: "quality", methodology: "methodology", settings: "settings",
};

async function load() {
  const files = ["materials", "market-index", "meta", "sources", "suppliers", "feed-cost", "scenario", "market-signals"];
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
  document.body.dataset.section = SECTION[state.view] || "sapphire";
  document.getElementById("viewTitle").textContent = VIEW_TITLES[state.view];
  document.querySelectorAll(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.view === state.view));
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-" + state.view).classList.add("active");
  ({ command: renderCommand, material: renderMaterial, origin: renderOrigin, supplier: renderSupplier,
     procurement: renderProcurement, signals: renderSignals, import: renderImport, forecast: renderForecast,
     feedcost: renderFeedCost, alerts: renderAlerts, quality: renderQuality, methodology: renderMethodology,
     settings: renderSettings }[state.view])();
}

function roleBanner() {
  const names = (["command", "alerts", "procurement", "material", "supplier", "origin", "import", "forecast", "feedcost"]
    .filter(v => [state.view].concat(state.view === "command" ? ["alerts", "procurement"] : [])).map(v => VIEW_TITLES[v])).join(" → ");
  return `<div class="role-emphasis"><strong>${state.role.toUpperCase()}</strong> focus: ${ROLE_TITLES[state.role]}.</div>`;
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

function forecastDir(ms) {
  const dirs = ms.filter(m => m.forecast.direction).map(m => m.forecast.direction);
  if (!dirs.length) return "—";
  const up = dirs.filter(d => d === "up").length, down = dirs.filter(d => d === "down").length;
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
  document.getElementById("view-material").innerHTML = roleBanner() + `
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
  `;
  document.getElementById("modal").classList.add("show");
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
    <div class="panel"><h2>Core price trajectory (6-week)</h2>
      <table><thead><tr><th>Material</th><th class="num">W1</th><th class="num">W2</th><th class="num">W3</th><th class="num">W4</th><th class="num">W5</th><th class="num">W6</th><th>Verdict</th></tr></thead><tbody>
      ${sg.trajectory.map(t => `<tr><td><strong>${t.material}</strong></td>${t.values.map(v => `<td class="num">${v}</td>`).join("")}<td>${t.verdict}</td></tr>`).join("")}
      </tbody></table></div>`;
}

/* ================= Procurement Intelligence ================= */
function renderProcurement() {
  const ms = filtered();
  document.getElementById("view-procurement").innerHTML = roleBanner() + `
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
