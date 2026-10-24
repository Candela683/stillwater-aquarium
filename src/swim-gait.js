// Per-fish stroke/coast oscillator. Phase and durations differ without frame-rate RNG.
export function createGait(phase) {
  const burst = 0.22 + 0.06 * (0.5 + 0.5 * Math.sin(phase * 1.73));
  const coast = 0.42 + 0.22 * (0.5 + 0.5 * Math.sin(phase * 2.31));
  return {
    burst,
    coast,
    elapsed: ((phase * 0.618) % 1) * (burst + coast),
    cycle: 0,
    drive: 0,
    animationTime: phase * 0.73,
    mode: "coast",
  };
}
export function advanceGait(g, dt, phase) {
  g.elapsed += dt;
  while (g.elapsed >= g.burst + g.coast) {
    g.elapsed -= g.burst + g.coast;
    g.cycle++;
    g.burst =
      0.22 + 0.06 * (0.5 + 0.5 * Math.sin(phase * 1.73 + g.cycle * 1.19));
    g.coast =
      0.42 + 0.22 * (0.5 + 0.5 * Math.sin(phase * 2.31 + g.cycle * 0.83));
  }
  g.mode = g.elapsed < g.burst ? "burst" : "coast";
  g.drive = g.mode === "burst" ? Math.sin((Math.PI * g.elapsed) / g.burst) : 0;
  // The source clip keeps a little fin motion while the fish coasts.
  g.animationTime += dt * (0.12 + 1.8 * g.drive);
  return g;
}
