// Two weak circulation sources feed the existing water solver, rather than
// moving the entire surface with a shared sine wave. Kernels are built once.
export function createSurfaceRippleDriver({ size, width, depth }) {
  const sources = [
    {
      x: -width * 0.39,
      z: -depth * 0.28,
      radius: 0.19,
      strength: 0.1,
      frequency: 1.47,
      phase: 0.3,
    },
    {
      x: width * 0.33,
      z: -depth * 0.3,
      radius: 0.23,
      strength: 0.07,
      frequency: 1.91,
      phase: 2.1,
    },
  ].map((source) => {
    const indices = [],
      weights = [];
    for (let z = 1; z < size - 1; z++)
      for (let x = 1; x < size - 1; x++) {
        const dx = (x / (size - 1) - 0.5) * width - source.x,
          dz = (0.5 - z / (size - 1)) * depth - source.z;
        const distance = (dx * dx + dz * dz) / (source.radius * source.radius);
        if (distance > 9) continue;
        indices.push(z * size + x);
        weights.push((1 - distance) * Math.exp(-distance));
      }
    const mean =
      weights.reduce((sum, value) => sum + value, 0) / weights.length;
    return {
      ...source,
      indices: Uint32Array.from(indices),
      weights: Float64Array.from(weights, (value) => value - mean),
    };
  });
  let time = 0;
  return {
    inject(velocity, dt) {
      time += dt;
      for (const source of sources) {
        const phase = time * source.frequency * Math.PI * 2 + source.phase;
        const pressure =
          0.7 * Math.sin(phase + 0.38 * Math.sin(time * 0.67 + source.phase)) +
          0.3 * Math.sin(phase * 1.613 + 1.2);
        const impulse = pressure * source.strength * dt;
        for (let i = 0; i < source.indices.length; i++)
          velocity[source.indices[i]] += source.weights[i] * impulse;
      }
    },
  };
}
