function fcfs(procs) {
  const sorted = [...procs].sort((a, b) => a.arrival - b.arrival);
  let t = 0;
  const timeline = [];
  const trace = [];

  sorted.forEach(p => {
    if (t < p.arrival) {
      trace.push(`CPU idle desde ${t} hasta ${p.arrival}`);
      timeline.push({ id: 'IDLE', start: t, end: p.arrival, color: '#999' });
      t = p.arrival;
    }
    trace.push(`t=${t}: inicia ${p.id} y ejecuta ${p.burst} unidades`);
    timeline.push({ id: p.id, start: t, end: t + p.burst, color: p.color });
    t += p.burst;
  });

  return { timeline, trace };
}

function sjf(procs) {
  let t = 0;
  const done = new Set();
  const timeline = [];
  const trace = [];
  const total = procs.length;

  while (done.size < total) {
    const available = procs.filter(p => !done.has(p.id) && p.arrival <= t);
    if (!available.length) {
      const next = procs
        .filter(p => !done.has(p.id))
        .sort((a, b) => a.arrival - b.arrival)[0];
      if (t < next.arrival) {
        trace.push(`CPU idle desde ${t} hasta ${next.arrival}`);
        timeline.push({ id: 'IDLE', start: t, end: next.arrival, color: '#999' });
      }
      t = next.arrival;
      continue;
    }

    available.sort((a, b) => a.burst - b.burst || a.arrival - b.arrival);
    const p = available[0];
    trace.push(`t=${t}: elige ${p.id} con duración ${p.burst}`);
    timeline.push({ id: p.id, start: t, end: t + p.burst, color: p.color });
    t += p.burst;
    done.add(p.id);
  }

  return { timeline, trace };
}

function srt(procs) {
  const tasks = procs.map(p => ({ ...p, remaining: p.burst }));
  const timeline = [];
  const trace = [];
  let t = 0;
  const completed = new Set();
  const total = tasks.length;

  while (completed.size < total) {
    const available = tasks.filter(p => !completed.has(p.id) && p.arrival <= t);
    if (!available.length) {
      const next = tasks.filter(p => !completed.has(p.id)).sort((a, b) => a.arrival - b.arrival)[0];
      if (t < next.arrival) {
        trace.push(`t=${t}: CPU idle hasta ${next.arrival}`);
        timeline.push({ id: 'IDLE', start: t, end: next.arrival, color: '#999' });
      }
      t = next.arrival;
      continue;
    }

    available.sort((a, b) => a.remaining - b.remaining || a.arrival - b.arrival);
    const current = available[0];
    const future = tasks.filter(p => !completed.has(p.id) && p.arrival > t).sort((a, b) => a.arrival - b.arrival);
    const nextArrival = future.length ? future[0].arrival : Infinity;
    const duration = Math.min(current.remaining, nextArrival - t);
    trace.push(`t=${t}: ejecuta ${current.id} (${current.remaining} restante) por ${duration} unidades`);
    timeline.push({ id: current.id, start: t, end: t + duration, color: current.color });
    current.remaining -= duration;
    t += duration;
    if (current.remaining <= 0) {
      trace.push(`${current.id} termina en t=${t}`);
      completed.add(current.id);
    }
  }

  return { timeline: mergeTimeline(timeline), trace };
}

function rr(procs, quantum) {
  const tasks = procs.map(p => ({ ...p, remaining: p.burst }));
  const timeline = [];
  const trace = [];
  const queue = [];
  let t = 0;
  const completed = new Set();
  const total = tasks.length;

  while (completed.size < total) {
    tasks.filter(p => p.arrival <= t && !queue.includes(p) && !completed.has(p.id)).forEach(p => queue.push(p));
    if (!queue.length) {
      const next = tasks.filter(p => !completed.has(p.id)).sort((a, b) => a.arrival - b.arrival)[0];
      if (t < next.arrival) {
        trace.push(`t=${t}: CPU idle hasta ${next.arrival}`);
        timeline.push({ id: 'IDLE', start: t, end: next.arrival, color: '#999' });
      }
      t = next.arrival;
      tasks.filter(p => p.arrival <= t && !queue.includes(p) && !completed.has(p.id)).forEach(p => queue.push(p));
      continue;
    }

    const current = queue.shift();
    const duration = Math.min(current.remaining, quantum);
    trace.push(`t=${t}: ejecuta ${current.id} por ${duration} unidades (restan ${current.remaining - duration})`);
    timeline.push({ id: current.id, start: t, end: t + duration, color: current.color });
    current.remaining -= duration;
    t += duration;

    tasks.filter(p => p.arrival <= t && !queue.includes(p) && !completed.has(p.id) && p.id !== current.id).forEach(p => queue.push(p));
    if (current.remaining > 0) {
      queue.push(current);
    } else {
      trace.push(`${current.id} termina en t=${t}`);
      completed.add(current.id);
    }

    const queueIds = queue.map(p => p.id).join(', ') || 'vacía';
    trace.push(`Cola RR: [${queueIds}]`);
  }

  return { timeline: mergeTimeline(timeline), trace };
}

function mergeTimeline(timeline) {
  if (!timeline.length) return timeline;
  const merged = [ { ...timeline[0] } ];

  for (let i = 1; i < timeline.length; i++) {
    const current = timeline[i];
    const last = merged[merged.length - 1];
    if (current.id === last.id && current.color === last.color && Math.abs(current.start - last.end) < 1e-9) {
      last.end = current.end;
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

function computeMetrics(procs, timeline) {
  return procs.map(p => {
    const slots = timeline.filter(s => s.id === p.id);
    const start = slots.length ? Math.min(...slots.map(s => s.start)) : p.arrival;
    const end = slots.length ? Math.max(...slots.map(s => s.end)) : p.arrival;
    const tr = parseFloat((end - p.arrival).toFixed(2));
    const te = parseFloat((end - p.arrival - p.burst).toFixed(2));
    return { ...p, start, end, tr, te };
  });
}
