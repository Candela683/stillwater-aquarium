// Local trailing wakes plus a damped elastic response, in world-space x/z.
export function sampleFishFlow(point, fish, time) {
  let x = 0,
    z = 0;
  for (const f of fish) {
    const speed = Math.hypot(f.v.x, f.v.z);
    if (speed < 0.025) continue;
    const dx = f.v.x / speed,
      dz = f.v.z / speed;
    const rx = point.x - f.p.x,
      rz = point.z - f.p.z,
      dy = point.y - f.p.y;
    const along = rx * dx + rz * dz,
      across = -rx * dz + rz * dx;
    if (along < -0.7 || along > 0.2 || Math.abs(dy) > 0.3) continue;
    const spread = 0.17 + Math.max(0, -along) * 0.1;
    const distance =
      (across * across) / (spread * spread) +
      (dy * dy) / 0.09 +
      (along * along) / (along < 0 ? 0.49 : 0.04);
    if (distance >= 1) continue;
    const influence = (1 - distance) * (1 - distance) * 0.32;
    const swirl = Math.sin(time * 15 + f.phase + along * 5) * 0.22;
    x += influence * speed * (dx - dz * swirl);
    z += influence * speed * (dz + dx * swirl);
  }
  const magnitude = Math.hypot(x, z),
    limit = 0.24;
  if (magnitude > limit) {
    x *= limit / magnitude;
    z *= limit / magnitude;
  }
  return { x, z };
}
export function advancePlant(state, flow, dt) {
  // Substeps keep the spring stable on slow frames.
  const count = Math.max(1, Math.ceil(dt / 0.016)),
    step = dt / count;
  for (let i = 0; i < count; i++) {
    state.vx += (flow.x * 2.4 - state.x * 7 - state.vx * 4.2) * step;
    state.vz += (flow.z * 2.4 - state.z * 7 - state.vz * 4.2) * step;
    state.x += state.vx * step;
    state.z += state.vz * step;
    const n = Math.hypot(state.x, state.z);
    if (n > 0.42) {
      state.x *= 0.42 / n;
      state.z *= 0.42 / n;
    }
  }
  return state;
}
