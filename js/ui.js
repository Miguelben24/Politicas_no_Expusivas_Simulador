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
  if (isNaN(n) || n < 1 || n > 10)
    return { error: 'La primera línea debe ser el número de procesos (1-10).' };
  if (lines.length < n + 1)
    return { error: `Se esperan ${n} procesos pero solo hay ${lines.length - 1} líneas.` };

  const procs = [];
  for (let i = 1; i <= n; i++) {
    const parts = lines[i].split(/[,;\t ]+/);
    if (parts.length < 3) return { error: `Error en línea ${i + 1}: "${lines[i]}"` };
    const arrival = parseFloat(parts[1]);
    const burst   = parseFloat(parts[2]);
    if (isNaN(arrival) || isNaN(burst) || burst <= 0)
      return { error: `Datos inválidos en la línea ${i + 1}.` };
    procs.push({ id: parts[0] || 'P' + (i - 1), arrival, burst, color: COLORS[i - 1] });
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

//boton_simular
function simulate() {
  if (!processes.length) return;

  const policy   = document.getElementById('policy').value;
  const timeline = policy === 'fcfs' ? fcfs(processes) : sjf(processes);
  const metrics  = computeMetrics(processes, timeline);

  renderGantt(timeline, policy);
  renderResults(metrics);
}

//diagramaa_gantt
function renderGantt(timeline, policy) {
  const maxT      = Math.max(...timeline.map(s => s.end));
  const pxPerUnit = Math.min(38, Math.max(18, 500 / maxT));
  const ids       = [...new Set(timeline.map(s => s.id))];

  let html = '';
  ids.forEach(id => {
    const slots = timeline.filter(s => s.id === id);
    const color = slots[0].color;
    html += `<div class="gantt-row">
      <div class="gantt-lbl" style="color:${color}">${id}</div>
      <div class="gantt-track" style="min-width:${maxT * pxPerUnit}px">`;
    slots.forEach(s => {
      const w = (s.end - s.start) * pxPerUnit;
      const l = s.start * pxPerUnit;
      html += `<div class="gantt-block" style="left:${l}px;width:${w}px;background:${color}">${s.id}</div>`;
    });
    html += `</div></div>`;
  });

  // Eje tiempo
  html += `<div class="gantt-axis" style="min-width:${maxT * pxPerUnit}px">`;
  for (let t = 0; t <= maxT; t++) {
    if (maxT > 20 && t % 2 !== 0) continue;
    html += `<div class="gantt-tick" style="left:${t * pxPerUnit}px">${t}</div>`;
  }
  html += '</div>';

  const label = policy === 'fcfs' ? 'FCFS' : 'SJF / SPN';
  document.getElementById('ganttTitle').textContent = `Diagrama de Gantt — ${label}`;
  document.getElementById('ganttArea').innerHTML = html;
}

//resultadossss
function renderResults(metrics) {
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
}
