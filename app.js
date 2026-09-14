// ---------- storage ----------
const STORE_SETTINGS = "ct_settings";
const STORE_RECORDS = "ct_records";

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORE_SETTINGS)) || { tomtomKey: "", work: null, homes: [] };
  } catch {
    return { tomtomKey: "", work: null, homes: [] };
  }
}
function saveSettings(s) {
  localStorage.setItem(STORE_SETTINGS, JSON.stringify(s));
}
function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORE_RECORDS)) || [];
  } catch {
    return [];
  }
}
function saveRecords(r) {
  localStorage.setItem(STORE_RECORDS, JSON.stringify(r));
}

let settings = loadSettings();
let records = loadRecords();

// ---------- toast ----------
function toast(msg, kind = "ok") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ---------- TomTom API ----------
async function geocode(query) {
  const key = settings.tomtomKey;
  if (!key) throw new Error("Configure a chave da API primeiro.");
  const url = `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(query)}.json?key=${encodeURIComponent(key)}&limit=1&countrySet=BR`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erro ao buscar endereço (HTTP ${res.status})`);
  const data = await res.json();
  const r = data.results && data.results[0];
  if (!r) throw new Error("Endereço não encontrado.");
  return {
    lat: r.position.lat,
    lon: r.position.lon,
    formatted: r.address.freeformAddress,
  };
}

async function routeTime(origin, dest) {
  const key = settings.tomtomKey;
  const url = `https://api.tomtom.com/routing/1/calculateRoute/${origin.lat},${origin.lon}:${dest.lat},${dest.lon}/json?key=${encodeURIComponent(key)}&traffic=true&travelMode=car&computeTravelTimeFor=all`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erro na rota (HTTP ${res.status})`);
  const data = await res.json();
  const route = data.routes && data.routes[0];
  if (!route) throw new Error("Rota não encontrada.");
  const s = route.summary;
  return {
    distanceM: s.lengthInMeters,
    travelTimeSec: s.travelTimeInSeconds,
    noTrafficTimeSec: s.noTrafficTravelTimeInSeconds ?? null,
    historicTimeSec: s.historicTrafficTravelTimeInSeconds ?? null,
    trafficDelaySec: s.trafficDelayInSeconds ?? null,
  };
}

// ---------- tabs ----------
const views = { home: "view-home", history: "view-history", config: "view-config" };
document.querySelectorAll(".tabbtn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tabbtn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    Object.values(views).forEach((id) => document.getElementById(id).classList.add("hidden"));
    document.getElementById(views[btn.dataset.view]).classList.remove("hidden");
    if (btn.dataset.view === "history") renderHistory();
    if (btn.dataset.view === "config") renderConfig();
  });
});

// ---------- config view ----------
function renderConfig() {
  document.getElementById("apiKeyInput").value = settings.tomtomKey || "";

  const workDisplay = document.getElementById("workDisplay");
  workDisplay.textContent = settings.work
    ? `✅ ${settings.work.label} (${settings.work.lat.toFixed(5)}, ${settings.work.lon.toFixed(5)})`
    : "Nenhum endereço configurado.";

  const list = document.getElementById("homesList");
  list.innerHTML = "";
  if (settings.homes.length === 0) {
    list.innerHTML = `<p class="muted">Nenhum endereço candidato ainda.</p>`;
  }
  settings.homes.forEach((h) => {
    const row = document.createElement("div");
    row.className = "home-row";
    row.innerHTML = `<span>${h.label}<br><span class="muted">${h.formatted}</span></span>`;
    const del = document.createElement("button");
    del.textContent = "🗑";
    del.addEventListener("click", () => {
      settings.homes = settings.homes.filter((x) => x.id !== h.id);
      saveSettings(settings);
      renderConfig();
    });
    row.appendChild(del);
    list.appendChild(row);
  });
}

document.getElementById("saveKeyBtn").addEventListener("click", () => {
  settings.tomtomKey = document.getElementById("apiKeyInput").value.trim();
  saveSettings(settings);
  toast("Chave salva.");
});

document.getElementById("workSaveBtn").addEventListener("click", async () => {
  const addr = document.getElementById("workInput").value.trim();
  if (!addr) return toast("Digite um endereço.", "error");
  try {
    const g = await geocode(addr);
    settings.work = { label: addr, address: addr, lat: g.lat, lon: g.lon, formatted: g.formatted };
    saveSettings(settings);
    document.getElementById("workInput").value = "";
    renderConfig();
    toast(`Trabalho salvo: ${g.formatted}`);
  } catch (e) {
    toast(e.message, "error");
  }
});

document.getElementById("homeAddBtn").addEventListener("click", async () => {
  const label = document.getElementById("homeLabelInput").value.trim();
  const addr = document.getElementById("homeAddrInput").value.trim();
  if (!label || !addr) return toast("Preencha apelido e endereço.", "error");
  try {
    const g = await geocode(addr);
    settings.homes.push({
      id: crypto.randomUUID(),
      label,
      address: addr,
      lat: g.lat,
      lon: g.lon,
      formatted: g.formatted,
    });
    saveSettings(settings);
    document.getElementById("homeLabelInput").value = "";
    document.getElementById("homeAddrInput").value = "";
    renderConfig();
    toast(`Adicionado: ${g.formatted}`);
  } catch (e) {
    toast(e.message, "error");
  }
});

document.getElementById("exportBtn").addEventListener("click", () => {
  if (records.length === 0) return toast("Sem registros ainda.", "error");
  const header = "id,timestamp,direction,homeId,homeLabel,distanceM,travelTimeSec,noTrafficTimeSec,historicTimeSec,trafficDelaySec\n";
  const rows = records.map((r) =>
    [r.id, r.ts, r.direction, r.homeId, JSON.stringify(r.homeLabel), r.distanceM, r.travelTimeSec, r.noTrafficTimeSec, r.historicTimeSec, r.trafficDelaySec].join(",")
  );
  downloadFile("trajeto-historico.csv", header + rows.join("\n"), "text/csv");
});

document.getElementById("exportJsonBtn").addEventListener("click", () => {
  if (records.length === 0) return toast("Sem registros ainda.", "error");
  downloadFile("trajeto-historico.json", JSON.stringify(records, null, 2), "application/json");
});

document.getElementById("wipeBtn").addEventListener("click", () => {
  if (!confirm("Apagar TODO o histórico? Isso não pode ser desfeito.")) return;
  records = [];
  saveRecords(records);
  toast("Histórico apagado.");
});

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- home view: recording trips ----------
async function recordTrip(direction) {
  if (!settings.tomtomKey) return toast("Configure a chave da API na aba Config.", "error");
  if (!settings.work) return toast("Configure o endereço do trabalho na aba Config.", "error");
  if (settings.homes.length === 0) return toast("Adicione ao menos um endereço candidato.", "error");

  const btnHome = document.getElementById("btnLeaveHome");
  const btnWork = document.getElementById("btnLeaveWork");
  btnHome.disabled = true;
  btnWork.disabled = true;
  document.getElementById("statusLine").textContent = "Consultando trânsito em tempo real...";

  const resultsBox = document.getElementById("resultsBox");
  const resultsList = document.getElementById("resultsList");
  resultsList.innerHTML = "";
  resultsBox.classList.remove("hidden");
  document.getElementById("resultsTitle").textContent =
    direction === "toWork" ? "🏠→💼 Saindo de casa agora" : "💼→🏠 Saindo do trabalho agora";

  const now = new Date().toISOString();
  const newRecords = [];

  for (const home of settings.homes) {
    const origin = direction === "toWork" ? home : settings.work;
    const dest = direction === "toWork" ? settings.work : home;
    const row = document.createElement("div");
    row.className = "result-row";
    row.innerHTML = `<span>${home.label}</span><span class="muted">consultando...</span>`;
    resultsList.appendChild(row);
    try {
      const rt = await routeTime(origin, dest);
      const min = Math.round(rt.travelTimeSec / 60);
      const delayMin = rt.trafficDelaySec != null ? Math.round(rt.trafficDelaySec / 60) : null;
      row.innerHTML = `<span>${home.label}</span><span class="result-time">${min} min${delayMin ? ` <span class="result-delay">(+${delayMin} min trânsito)</span>` : ""}</span>`;
      newRecords.push({
        id: crypto.randomUUID(),
        ts: now,
        direction,
        homeId: home.id,
        homeLabel: home.label,
        distanceM: rt.distanceM,
        travelTimeSec: rt.travelTimeSec,
        noTrafficTimeSec: rt.noTrafficTimeSec,
        historicTimeSec: rt.historicTimeSec,
        trafficDelaySec: rt.trafficDelaySec,
      });
    } catch (e) {
      row.innerHTML = `<span>${home.label}</span><span class="muted">erro: ${e.message}</span>`;
    }
  }

  records = records.concat(newRecords);
  saveRecords(records);

  document.getElementById("statusLine").textContent = `Última consulta: ${new Date(now).toLocaleString("pt-BR")}`;
  btnHome.disabled = false;
  btnWork.disabled = false;
}

document.getElementById("btnLeaveHome").addEventListener("click", () => recordTrip("toWork"));
document.getElementById("btnLeaveWork").addEventListener("click", () => recordTrip("toHome"));

// ---------- history view ----------
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAY_COLORS = ["#f87171", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#06b6d4", "#f97316"];

function renderHistory() {
  const filterHome = document.getElementById("filterHome");
  const prevVal = filterHome.value;
  filterHome.innerHTML = `<option value="all">Todos os endereços</option>` +
    settings.homes.map((h) => `<option value="${h.id}">${h.label}</option>`).join("");
  if (prevVal) filterHome.value = prevVal;

  filterHome.onchange = doRenderHistory;
  document.getElementById("filterDir").onchange = doRenderHistory;
  doRenderHistory();
}

function doRenderHistory() {
  const homeFilter = document.getElementById("filterHome").value;
  const dirFilter = document.getElementById("filterDir").value;

  let filtered = records.filter((r) => {
    if (homeFilter !== "all" && r.homeId !== homeFilter) return false;
    if (dirFilter !== "all" && r.direction !== dirFilter) return false;
    return true;
  });
  filtered.sort((a, b) => new Date(a.ts) - new Date(b.ts));

  renderStats(filtered);
  renderChart(filtered);
  renderTable(filtered);
}

function renderStats(list) {
  const box = document.getElementById("statsBox");
  if (list.length === 0) {
    box.innerHTML = `<p class="muted">Sem registros para este filtro.</p>`;
    return;
  }
  const mins = list.map((r) => r.travelTimeSec / 60);
  const avg = mins.reduce((a, b) => a + b, 0) / mins.length;
  const min = Math.min(...mins);
  const max = Math.max(...mins);
  box.innerHTML = `
    <div class="stat-grid">
      <div class="stat-tile"><div class="val">${list.length}</div><div class="lbl">registros</div></div>
      <div class="stat-tile"><div class="val">${avg.toFixed(0)} min</div><div class="lbl">média</div></div>
      <div class="stat-tile"><div class="val">${min.toFixed(0)} min</div><div class="lbl">melhor</div></div>
      <div class="stat-tile"><div class="val">${max.toFixed(0)} min</div><div class="lbl">pior</div></div>
    </div>`;
}

function renderChart(list) {
  const box = document.getElementById("chartBox");
  if (list.length === 0) {
    box.innerHTML = `<p class="muted">Sem dados para o gráfico.</p>`;
    return;
  }
  const w = box.clientWidth || 320;
  const h = 220;
  const pad = 32;
  const times = list.map((r) => new Date(r.ts).getTime());
  const mins = list.map((r) => r.travelTimeSec / 60);
  const tMin = Math.min(...times), tMax = Math.max(...times);
  const vMin = 0, vMax = Math.max(...mins) * 1.15;

  const x = (t) => pad + ((t - tMin) / (tMax - tMin || 1)) * (w - 2 * pad);
  const y = (v) => h - pad - ((v - vMin) / (vMax - vMin || 1)) * (h - 2 * pad);

  let svg = `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" xmlns="http://www.w3.org/2000/svg">`;
  // gridlines
  for (let i = 0; i <= 4; i++) {
    const gy = pad + (i * (h - 2 * pad)) / 4;
    const val = vMax - (i * vMax) / 4;
    svg += `<line x1="${pad}" y1="${gy}" x2="${w - pad}" y2="${gy}" stroke="#334155" stroke-width="1"/>`;
    svg += `<text x="4" y="${gy + 4}" font-size="10" fill="#94a3b8">${val.toFixed(0)}</text>`;
  }
  // points
  list.forEach((r) => {
    const d = new Date(r.ts);
    const cx = x(d.getTime());
    const cy = y(r.travelTimeSec / 60);
    const color = WEEKDAY_COLORS[d.getDay()];
    svg += `<circle cx="${cx}" cy="${cy}" r="4" fill="${color}" stroke="#0f172a" stroke-width="1"/>`;
  });
  svg += `</svg>`;

  const legend = WEEKDAYS.map((d, i) => `<span style="color:${WEEKDAY_COLORS[i]}; margin-right:8px;">● ${d}</span>`).join("");
  box.innerHTML = svg + `<div class="muted" style="margin-top:6px; font-size:0.75rem;">${legend}</div>`;
}

function renderTable(list) {
  const box = document.getElementById("tableBox");
  if (list.length === 0) {
    box.innerHTML = `<p class="muted">Sem registros.</p>`;
    return;
  }
  const rows = list
    .slice()
    .reverse()
    .slice(0, 100)
    .map((r) => {
      const d = new Date(r.ts);
      const dir = r.direction === "toWork" ? "→ Trabalho" : "→ Casa";
      const min = Math.round(r.travelTimeSec / 60);
      return `<tr><td>${d.toLocaleDateString("pt-BR")}</td><td>${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td><td>${WEEKDAYS[d.getDay()]}</td><td>${r.homeLabel}</td><td>${dir}</td><td>${min} min</td></tr>`;
    })
    .join("");
  box.innerHTML = `<table><thead><tr><th>Data</th><th>Hora</th><th>Dia</th><th>Endereço</th><th>Sentido</th><th>Tempo</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ---------- init ----------
renderConfig();

// ---------- PWA service worker ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
