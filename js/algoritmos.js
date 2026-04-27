function fcfs(procs) {
  const sorted = [...procs].sort((a, b) => a.arrival - b.arrival);
  let t = 0;
  const timeline = [];

  sorted.forEach(p => {
    if (t < p.arrival) t = p.arrival; // CPU idle hasta que llega el proceso
    timeline.push({ id: p.id, start: t, end: t + p.burst, color: p.color });
    t += p.burst;
  });

  return timeline;
}


function sjf(procs) {
  let t = 0;
  const done = new Set();
  const timeline = [];
  const total = procs.length;

  while (done.size < total) {
    // Procesos que ya llegaron y no han sido ejecutados
    const available = procs.filter(p => !done.has(p.id) && p.arrival <= t);

    if (!available.length) {
      // CPU idle: saltar al siguiente proceso que llegue
      const next = procs
        .filter(p => !done.has(p.id))
        .sort((a, b) => a.arrival - b.arrival)[0];
      t = next.arrival;
      continue;
    }

    // Ordenar por duración (menor primero); empate → el que llegó antes
    available.sort((a, b) => a.burst - b.burst || a.arrival - b.arrival);
    const p = available[0];

    timeline.push({ id: p.id, start: t, end: t + p.burst, color: p.color });
    t += p.burst;
    done.add(p.id);
  }

  return timeline;
}


function computeMetrics(procs, timeline) {
  return procs.map(p => {
    const slot = timeline.find(s => s.id === p.id);
    const tf   = slot.end;
    const ti   = slot.start;
    const tr   = tf - p.arrival;   
    const te   = ti - p.arrival;   
    return { ...p, start: ti, end: tf, tr, te };
  });
}
