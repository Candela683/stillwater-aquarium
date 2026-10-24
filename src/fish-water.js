// A depth-attenuated, zero-volume dipole wake coupled to the heightfield velocity.
// This is a surface response model, not a volumetric fluid solver.
export function injectFishWakes(
  fish,
  velocity,
  { size, width, depth, waterY, time, dt },
) {
  let energy = 0;
  for (const f of fish) {
    const speed = Math.hypot(f.v.x, f.v.z);
    if (speed < 0.001) continue;
    const submerged = Math.max(0.05, waterY - f.p.y);
    const strength = 0.16 * speed * speed * Math.exp(-submerged * 2.1) * dt;
    const dx = f.v.x / speed,
      dz = f.v.z / speed;
    const tailX = f.p.x - dx * 0.16,
      tailZ = f.p.z - dz * 0.16;
    const radius = 0.1 + submerged * 0.12;
    const span = Math.ceil((radius / Math.min(width, depth)) * (size - 1) * 3);
    const cx = Math.round((tailX / width + 0.5) * (size - 1)),
      cz = Math.round((0.5 - tailZ / depth) * (size - 1));
    const cells = [];
    let sum = 0;
    for (
      let z = Math.max(1, cz - span);
      z <= Math.min(size - 2, cz + span);
      z++
    )
      for (
        let x = Math.max(1, cx - span);
        x <= Math.min(size - 2, cx + span);
        x++
      ) {
        const wx = (x / (size - 1) - 0.5) * width - tailX,
          wz = (0.5 - z / (size - 1)) * depth - tailZ;
        const along = wx * dx + wz * dz,
          across = -wx * dz + wz * dx;
        const value =
          ((across / radius) * Math.sin(time * 15 + f.phase) +
            (along / radius) * 0.35) *
          Math.exp(-(along * along + across * across) / (radius * radius));
        cells.push([z * size + x, value]);
        sum += value;
      }
    const mean = sum / Math.max(1, cells.length);
    for (const [index, value] of cells) {
      const impulse = (value - mean) * strength;
      velocity[index] += impulse;
      energy += impulse * impulse;
    }
  }
  return energy;
}
