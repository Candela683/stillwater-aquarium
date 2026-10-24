// A travelling lateral wave; the head is steady and amplitude grows toward the tail.
// The local cross-section follows the centerline tangent rather than shearing sideways.
export function bendFishBody(p, phase) {
  const x = p.x,
    z = p.z;
  const u = Math.max(0, Math.min(1, (0.105 - x) / 0.29));
  const amplitude = 0.031 * u * u,
    theta = phase - u * 3.6;
  const shift = amplitude * Math.sin(theta);
  const slope =
    u > 0 && u < 1
      ? (-0.062 * u * Math.sin(theta) + amplitude * 3.6 * Math.cos(theta)) /
        0.29
      : 0;
  const scale = 1 / Math.sqrt(1 + slope * slope);
  p.x = x - z * slope * scale;
  p.z = shift + z * scale;
  return p;
}
