// Bounded, inherited traits: stochastic growth rather than unrelated random shapes.
export function pearlShootTraits(kind, random) {
  return {
    size: 0.88 + random() * 0.25,
    width: 0.89 + random() * 0.22,
    outline: 0.9 + random() * 0.19,
    cup: 0.025 + random() * 0.035,
    arch: 0.045 + random() * 0.055,
    spoon: kind ? 0.25 + random() * 0.12 : 0.86 + random() * 0.1,
  };
}

export function pearlLeafTraits(kind, shoot, maturity, random) {
  const size = shoot.size * (0.8 + random() * 0.39) * (0.59 + 0.41 * maturity);
  return {
    length: (kind ? 0.064 : 0.094) * size,
    width: (kind ? 0.023 : 0.04) * size * shoot.width * (0.8 + random() * 0.4),
    outline: shoot.outline + (random() - 0.5) * 0.16,
    spoon: shoot.spoon + (random() - 0.5) * 0.07,
    asymmetry: (random() - 0.5) * 0.23,
    sideBend: (random() - 0.5) * 0.15,
    rise: (kind ? 0.47 : 0.17) + random() * (kind ? 0.29 : 0.34),
    arch: shoot.arch * (0.68 + random() * 0.64),
    cup: shoot.cup * (0.55 + random() * 0.85),
    tipCurl: (random() - 0.5) * 0.12,
    twist: (random() - 0.5) * 0.48,
    maturity,
  };
}

// Continuous local surface (s: root to tip, v: across blade). No physical hinges.
export function pearlLeafSurface(s, v, p, out) {
  const taper = p.spoon + (1 - p.spoon) * (0.5 - 0.5 * Math.cos(Math.PI * s));
  const lateral = p.width * v * taper * (1 + p.asymmetry * v),
    twist = p.twist * s;
  out.set(
    p.length * s,
    p.length *
      (p.rise * s +
        p.arch * Math.sin(Math.PI * s) +
        p.tipCurl * s * s * s +
        p.cup * 4 * s * (1 - s) * (1 - v * v)) +
      lateral * Math.sin(twist),
    p.length * p.sideBend * s * s + lateral * Math.cos(twist),
  );
  return out;
}

export function pearlLeafOutline(angle, p) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return [
    (1 + Math.sign(c) * Math.abs(c) ** p.outline) / 2,
    Math.sign(s) * Math.abs(s) ** p.outline,
  ];
}
