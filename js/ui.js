const COLORS = ['#3266ad','#c0392b','#0f6e56','#8e44ad','#d35400','#16a085','#2980b9','#e67e22','#27ae60','#f39c12'];

let processes = [];

//entrada_de_archivo_txt
function loadFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  document.getElementById('fileName').textContent = file.name;

  const reader = new FileReader();
  reader.onload = function(ev) {
    const text = ev.target.result.trim();
    const result = parseFile(text);

    if (result.error) {
      document.getElementById('tableArea').innerHTML = `<div class="alert">${result.error}</div>`;
      document.getElementById('btnSim').disabled = true;
      return;
    }

    processes = result.procs;
    renderInputTable(processes);
    document.getElementById('btnSim').disabled = false;
  };
  reader.readAsText(file);
}

function parseFile(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  if (!lines.length) return { error: 'El archivo está vacío.' };

  const n = parseInt(lines[0]);
  if (isNaN(n) || n < 1)
    return { error: 'La primera línea debe ser el número de procesos (1 o más).' };
  if (lines.length < n + 1)
    return { error: `Se esperan ${n} procesos pero solo hay ${lines.length - 1} líneas.` };

  const procs = [];
  for (let i = 1; i <= n; i++) {
    const parts = lines[i].split(/[,;\t ]+/);
    if (parts.length < 3) return { error: `Error en línea ${i + 1}: "${lines[i]}"` };
    const arrival = parseFloat(parts[1]);
    const burst   = parseFloat(parts[2]);
    if (isNaN(arrival) || arrival < 0)
      return { error: `Error en línea ${i + 1}: el Tiempo de Llegada no puede ser negativo ("${parts[1]}").` };
    if (isNaN(burst) || burst <= 0)
      return { error: `Error en línea ${i + 1}: la Duración debe ser mayor a cero ("${parts[2]}").` };
    procs.push({ id: parts[0] || 'P' + (i - 1), arrival, burst, color: COLORS[(i - 1) % COLORS.length] });
  }
  return { procs };
}

function renderInputTable(procs) {
  let html = `<table class="proc-table">
    <thead><tr><th>Proceso</th><th>T. Llegada</th><th>Duración</th></tr></thead><tbody>`;
  procs.forEach(p => {
    html += `<tr>
      <td><span class="dot" style="background:${p.color}"></span>${p.id}</td>
      <td>${p.arrival}</td>
      <td>${p.burst}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  document.getElementById('tableArea').innerHTML = html;
}

let currentTimeline = [];
let currentPolicy = '';
let currentMetrics = [];

function onPolicyChange() {
  const policy = document.getElementById('policy').value;
  const quantumRow = document.getElementById('quantumRow');
  quantumRow.style.display = policy === 'rr' ? 'flex' : 'none';
}

window.addEventListener('load', onPolicyChange);

//boton_simular
function simulate() {
  if (!processes.length) return;

  const policy = document.getElementById('policy').value;
  const quantum = parseInt(document.getElementById('quantumInput').value, 10) || 1;
  const startTime = performance.now();

  let result;
  if (policy === 'fcfs') result = fcfs(processes);
  else if (policy === 'sjf') result = sjf(processes);
  else if (policy === 'srt') result = srt(processes);
  else if (policy === 'rr') result = rr(processes, quantum);
  else result = fcfs(processes);

  const durationMs = performance.now() - startTime;
  const timeline = result.timeline;
  const trace = result.trace || [];
  const metrics = computeMetrics(processes, timeline);
  const util = computeCpuUtilization(timeline);

  currentTimeline = timeline;
  currentPolicy = policy;
  currentMetrics = metrics;

  renderGantt(timeline, policy);
  renderResults(metrics, util);
  renderTrace(trace, policy);
  renderSimulationInfo(util, durationMs, policy, quantum);
}

function computeCpuUtilization(timeline) {
  if (!timeline.length) return {util: 0, busy: 0, total: 0};
  const total = Math.max(...timeline.map(s => s.end));
  const busy = timeline.reduce((sum, slot) => slot.id !== 'IDLE' ? sum + (slot.end - slot.start) : sum, 0);
  const util = total ? (busy / total) * 100 : 0;
  return {util: parseFloat(util.toFixed(2)), busy: parseFloat(busy.toFixed(2)), total: parseFloat(total.toFixed(2))};
}

//diagramaa_gantt
function renderGantt(timeline, policy) {
  const maxT      = Math.max(...timeline.map(s => s.end));
  const pxPerUnit = Math.min(38, Math.max(6, 700 / maxT));
  const ids       = [...new Set(timeline.map(s => s.id))];

  let html = '';
  ids.forEach(id => {
    const slots = timeline.filter(s => s.id === id);
    const color = slots[0].color;
    html += `<div class="gantt-row">
      <div class="gantt-lbl" style="color:${color}">${id}</div>
      <div class="gantt-track" style="min-width:${maxT * pxPerUnit}px">`;
    slots.forEach((s, index) => {
      const w = (s.end - s.start) * pxPerUnit;
      const l = s.start * pxPerUnit;
      html += `<div class="gantt-block" id="block-${id}-${index}" style="left:${l}px;width:${w}px;background:${color};opacity:0;transition:opacity 0.5s;">${s.id}</div>`;
    });
    html += `</div></div>`;
  });

  // Eje tiempo
  html += `<div class="gantt-axis" style="min-width:${maxT * pxPerUnit}px">`;
  for (let t = 0; t <= maxT; t++) {
    const step = maxT > 50 ? 5 : (maxT > 20 ? 2 : 1);
    if (t % step !== 0) continue;
    html += `<div class="gantt-tick" style="left:${t * pxPerUnit}px">${t}</div>`;
  }
  html += '</div>';

  const label = policy === 'fcfs' ? 'FCFS' : policy === 'sjf' ? 'SJF / SPN' : policy === 'srt' ? 'SRT' : 'RR';
  document.getElementById('ganttArea').innerHTML = html + '<div style="text-align: center; margin-top: 10px;"><button class="btn-full" onclick="openFullGantt()">Ver en ventana completa</button></div>';

  // Animar el diagrama
  animateGantt(timeline);
}

// Función para animar el diagrama de Gantt
function animateGantt(timeline) {
  const sortedSlots = timeline.slice().sort((a, b) => a.start - b.start);
  const minStart = Math.min(...timeline.map(s => s.start));
  const ids = [...new Set(timeline.map(s => s.id))];

  sortedSlots.forEach((s, globalIndex) => {
    const id = s.id;
    const slots = timeline.filter(slot => slot.id === id);
    const index = slots.indexOf(s);
    const delay = (s.start - minStart) * 200; // 200ms por unidad de tiempo

    setTimeout(() => {
      const block = document.getElementById(`block-${id}-${index}`);
      if (block) {
        block.style.opacity = '1';
      }
    }, delay);
  });
}

// Función para abrir el diagrama en ventana completa
function openFullGantt() {
  const timeline = currentTimeline;
  const policy = currentPolicy;
  const metrics = currentMetrics;
  const maxT = Math.max(...timeline.map(s => s.end));
  const pxPerUnit = 20; // Tamaño fijo más grande para mejor visibilidad
  const ids = [...new Set(timeline.map(s => s.id))];

  const policyLabel = policy === 'fcfs' ? 'FCFS' : policy === 'sjf' ? 'SJF / SPN' : policy === 'srt' ? 'SRT' : 'RR';
  let html = '<h2 style="text-align: center;">Diagrama de Gantt — ' + policyLabel + '</h2>';
  html += '<div style="overflow-x: auto; padding: 20px;">';

  ids.forEach(id => {
    const slots = timeline.filter(s => s.id === id);
    const color = slots[0].color;
    html += `<div style="display: flex; align-items: center; margin-bottom: 10px;">
      <div style="width: 50px; font-size: 14px; font-weight: bold; text-align: right; padding-right: 10px; color: ${color};">${id}</div>
      <div style="position: relative; height: 40px; min-width: ${maxT * pxPerUnit}px; background: #f0f0f0; border-radius: 5px;">`;
    slots.forEach(s => {
      const w = (s.end - s.start) * pxPerUnit;
      const l = s.start * pxPerUnit;
      html += `<div style="position: absolute; top: 0; left: ${l}px; width: ${w}px; height: 40px; background: ${color}; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; color: #fff;">${s.id}</div>`;
    });
    html += `</div></div>`;
  });

  // Eje tiempo
  html += `<div style="position: relative; margin-left: 60px; height: 20px; min-width: ${maxT * pxPerUnit}px;">`;
  for (let t = 0; t <= maxT; t++) {
    const step = maxT > 100 ? 10 : (maxT > 50 ? 5 : (maxT > 20 ? 2 : 1));
    if (t % step !== 0) continue;
    html += `<div style="position: absolute; left: ${t * pxPerUnit}px; font-size: 10px; color: #666; transform: translateX(-50%);">${t}</div>`;
  }
  html += '</div></div>';

  // Tabla de resultados
  html += '<h3 style="text-align: center; margin-top: 40px;">Resultados</h3>';
  html += '<div style="overflow-x: auto; margin: 20px 0;">';
  html += `<table style="width: 100%; border-collapse: collapse; font-size: 12px; margin: 0 auto;">
    <thead><tr style="background: #ddd;">
      <th style="padding: 8px; border: 1px solid #bbb; text-align: center;">Proceso</th>
      <th style="padding: 8px; border: 1px solid #bbb; text-align: center;">T. Llegada</th>
      <th style="padding: 8px; border: 1px solid #bbb; text-align: center;">Duración</th>
      <th style="padding: 8px; border: 1px solid #bbb; text-align: center;">T. Inicio</th>
      <th style="padding: 8px; border: 1px solid #bbb; text-align: center;">T. Final</th>
      <th style="padding: 8px; border: 1px solid #bbb; text-align: center;">T. Retorno</th>
      <th style="padding: 8px; border: 1px solid #bbb; text-align: center;">T. Espera</th>
    </tr></thead><tbody>`;

  metrics.forEach(m => {
    html += `<tr>
      <td style="padding: 6px; border: 1px solid #ccc; text-align: center; background: #fff;"><span style="display: inline-block; width: 10px; height: 10px; background: ${m.color}; border-radius: 2px; margin-right: 5px;"></span>${m.id}</td>
      <td style="padding: 6px; border: 1px solid #ccc; text-align: center; background: #fff;">${m.arrival}</td>
      <td style="padding: 6px; border: 1px solid #ccc; text-align: center; background: #fff;">${m.burst}</td>
      <td style="padding: 6px; border: 1px solid #ccc; text-align: center; background: #fff;">${m.start}</td>
      <td style="padding: 6px; border: 1px solid #ccc; text-align: center; background: #fff;">${m.end}</td>
      <td style="padding: 6px; border: 1px solid #ccc; text-align: center; background: #fff; font-weight: bold; color: #1a5fb4;">${m.tr}</td>
      <td style="padding: 6px; border: 1px solid #ccc; text-align: center; background: #fff; font-weight: bold; color: #1a5fb4;">${m.te}</td>
    </tr>`;
  });
  html += '</tbody></table></div>';

  const avgTR = (metrics.reduce((a, m) => a + m.tr, 0) / metrics.length).toFixed(2);
  const avgTE = (metrics.reduce((a, m) => a + m.te, 0) / metrics.length).toFixed(2);
  html += `<div style="display: flex; gap: 20px; justify-content: center; margin-top: 20px;">
    <div style="background: #fff; border: 1px solid #ccc; border-radius: 5px; padding: 10px 15px; text-align: center;">
      <div style="font-size: 18px; font-weight: bold; color: #1a5fb4;">${avgTR}</div>
      <div style="font-size: 10px; color: #777;">Prom. T. Retorno</div>
    </div>
    <div style="background: #fff; border: 1px solid #ccc; border-radius: 5px; padding: 10px 15px; text-align: center;">
      <div style="font-size: 18px; font-weight: bold; color: #1a5fb4;">${avgTE}</div>
      <div style="font-size: 10px; color: #777;">Prom. T. Espera</div>
    </div>
  </div>`;

  const newWindow = window.open('', '_blank', 'width=1400,height=1000,scrollbars=yes,resizable=yes');
  newWindow.document.write(`
    <html>
      <head>
        <title>Diagrama de Gantt Completo</title>
        <style>
          body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
          h2, h3 { color: #333; }
          table { border-collapse: collapse; }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `);
  newWindow.document.close();
}

//resultadossss
function renderResults(metrics, util) {
  let html = `<thead><tr>
    <th>Proceso</th><th>T. Llegada</th><th>Duración</th>
    <th>T. Inicio</th><th>T. Final</th>
    <th>T. Retorno</th><th>T. Espera</th>
  </tr></thead><tbody>`;

  metrics.forEach(m => {
    html += `<tr>
      <td><span class="dot" style="background:${m.color}"></span>${m.id}</td>
      <td>${m.arrival}</td><td>${m.burst}</td>
      <td>${m.start}</td><td>${m.end}</td>
      <td class="hi">${m.tr}</td>
      <td class="hi">${m.te}</td>
    </tr>`;
  });
  html += '</tbody>';
  document.getElementById('resultsTable').innerHTML = html;

  const avgTR = (metrics.reduce((a, m) => a + m.tr, 0) / metrics.length).toFixed(2);
  const avgTE = (metrics.reduce((a, m) => a + m.te, 0) / metrics.length).toFixed(2);

  document.getElementById('avgCards').innerHTML = `
    <div class="avg-card"><div class="val">${avgTR}</div><div class="lbl">Prom. T. Retorno</div></div>
    <div class="avg-card"><div class="val">${avgTE}</div><div class="lbl">Prom. T. Espera</div></div>`;

  document.getElementById('cpuUtilization').innerHTML = `
    <div class="info-card"><div class="val">${util.util}%</div><div class="lbl">CPU Utilización</div></div>
    <div class="info-card"><div class="val">${util.busy}</div><div class="lbl">Tiempo ocupado</div></div>
    <div class="info-card"><div class="val">${util.total}</div><div class="lbl">Tiempo total</div></div>`;
}

function renderTrace(trace, policy) {
  const container = document.getElementById('traceArea');
  if (!container) return;
  if (!trace.length) {
    container.innerHTML = '<div class="trace-line trace-placeholder">No hay pasos registrados.</div>';
    return;
  }
  let html = '';
  trace.forEach(line => {
    html += `<div class="trace-line">${line}</div>`;
  });
  container.innerHTML = html;
}

function renderSimulationInfo(util, durationMs, policy, quantum) {
  const info = [];
  info.push({ label: 'Tiempo de cálculo', value: `${durationMs.toFixed(2)} ms` });
  info.push({ label: 'Política', value: policy.toUpperCase() });
  if (policy === 'rr') info.push({ label: 'Quantum', value: quantum });
  info.push({ label: 'Utilización CPU', value: `${util.util}%` });

  const html = info.map(item => `
    <div class="info-card"><div class="val">${item.value}</div><div class="lbl">${item.label}</div></div>`
  ).join('');
  document.getElementById('simulationInfo').innerHTML = html;
}
