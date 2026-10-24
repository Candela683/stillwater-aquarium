// Two smooth cantilever bending modes; no simulated joints or per-node hinges.
export const leafModes = (t) => [(t * t * (3 - t)) / 2, 4 * t * t * (1 - t)];
export function createLeafFlex(
  length = 1,
  { maxRatio = 0.045, maxDeflection = 0.065, strength = 1 } = {},
) {
  return {
    length,
    limit: Math.min(maxDeflection, length * maxRatio),
    strength,
    q: new Float64Array(4),
    v: new Float64Array(4),
    sleeping: true,
  };
}
export function leafOffset(f, t, out = { x: 0, z: 0 }) {
  const [a, b] = leafModes(t);
  out.x = f.q[0] * a + f.q[2] * b;
  out.z = f.q[1] * a + f.q[3] * b;
  return out;
}
export function advanceLeafFlex(f, flows, dt) {
  let fx = 0,
    fz = 0,
    gx = 0,
    gz = 0,
    energy = 0,
    hasFlow = false;
  for (let i = 0; i < flows.length; i++) {
    const t = (i + 1) / flows.length,
      [a, b] = leafModes(t),
      flow = flows[i];
    fx += flow.x * a;
    fz += flow.z * a;
    gx += flow.x * b;
    gz += flow.z * b;
    energy += a * a;
    hasFlow ||= Math.abs(flow.x) + Math.abs(flow.z) > 1e-8;
  }
  if (!hasFlow && f.sleeping) return false;
  const steps = Math.max(1, Math.ceil(Math.min(dt, 0.1) / 0.01)),
    h = Math.min(dt, 0.1) / steps;
  const force = [fx, fz, gx * 0.45, gz * 0.45],
    limit = f.limit;
  for (let sub = 0; sub < steps; sub++)
    for (let i = 0; i < 4; i++) {
      const k = i < 2 ? 22 : 65,
        damping = i < 2 ? 7 : 12;
      f.v[i] +=
        ((force[i] / Math.max(energy, 0.001)) * 2.2 * f.strength -
          k * f.q[i] -
          damping * f.v[i]) *
        h;
      f.q[i] += f.v[i] * h;
      const cap = i < 2 ? limit : limit * 0.3;
      if (Math.abs(f.q[i]) > cap) {
        f.q[i] = Math.sign(f.q[i]) * cap;
        f.v[i] = 0;
      }
    }
  const settled =
    !hasFlow &&
    f.q.every((x) => Math.abs(x) < 0.000025) &&
    f.v.every((x) => Math.abs(x) < 0.0001);
  f.sleeping = settled;
  if (settled) {
    f.q.fill(0);
    f.v.fill(0);
  }
  return true;
}
