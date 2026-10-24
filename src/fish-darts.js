import * as T from "three";
const candidate = new T.Vector3(),
  probe = new T.Vector3();
const smooth = (t) => {
  t = T.MathUtils.clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
const initDart = (f) =>
  (f.dart ??= {
    mode: "cruise",
    source: "explore",
    age: 0,
    duration: 0,
    recovery: 1.8,
    blend: 0,
    boost: 0,
    returning: 0,
    cooldown: 0,
    direction: new T.Vector3(),
    events: 0,
    scares: 0,
    intensity: 1,
    speedBonus: 0.44,
    nextStartle: 0,
  });
function clearPath(fish, direction, distance, obstacles, startled = false) {
  for (let step = 1; step <= 5; step++) {
    probe.copy(fish.p).addScaledVector(direction, (distance * step) / 5);
    if (
      Math.abs(probe.x) > (startled ? 2.55 : 2.34) ||
      Math.abs(probe.z) > (startled ? 1.11 : 1.02) ||
      probe.y < (startled ? 0.75 : 0.88) ||
      probe.y > (startled ? 2.48 : 2.4)
    )
      return false;
    for (const rock of obstacles) {
      const dx = probe.x - rock.p.x,
        dz = probe.z - rock.p.z,
        dy = probe.y - rock.p.y;
      if (
        (dx * dx + dz * dz) / (rock.r + 0.12) ** 2 +
          (dy * dy) / (rock.h + 0.14) ** 2 <
        1.2
      )
        return false;
    }
  }
  return true;
}

// A local pressure/startle response. Escape paths still obey tank and rock clearance.
export function startleFish(
  fish,
  point,
  obstacles,
  state,
  time,
  { radius = 1.75 } = {},
) {
  if (time < (state.nextTap ?? 0)) return 0;
  state.nextTap = time + 0.22;
  const random = state.random,
    away = new T.Vector3(),
    best = new T.Vector3();
  let count = 0;
  for (const f of fish) {
    const distance = f.p.distanceTo(point),
      d = initDart(f);
    if (distance >= radius || time < d.nextStartle) continue;
    away.copy(f.p).sub(point);
    away.y *= 0.3;
    if (Math.hypot(away.x, away.z) < 0.025) {
      away.copy(f.v);
      away.y = -0.06;
    }
    away.normalize();
    const yaw = Math.atan2(away.z, away.x) + (random() - 0.5) * 0.28,
      pitch = T.MathUtils.clamp(away.y, -0.22, 0.14);
    let score = -Infinity;
    for (const offset of [0, 0.4, -0.4, 0.85, -0.85, 1.4, -1.4, Math.PI]) {
      candidate.set(
        Math.cos(yaw + offset) * Math.cos(pitch),
        Math.sin(pitch),
        Math.sin(yaw + offset) * Math.cos(pitch),
      );
      if (!clearPath(f, candidate, 0.48, obstacles, true)) continue;
      const alignment = candidate.dot(away);
      if (alignment > score) {
        score = alignment;
        best.copy(candidate);
      }
    }
    if (score === -Infinity) continue;
    const strength = 0.45 + 0.55 * smooth(1 - distance / radius);
    d.source = "startle";
    d.mode = "react";
    d.age = 0;
    d.delay = 0.025 + distance * 0.055 + random() * 0.045;
    d.duration = 0.58 + strength * 0.18 + random() * 0.1;
    d.recovery = 2 + random() * 0.65;
    d.direction.copy(best);
    d.intensity = 1 + strength * 0.45;
    d.speedBonus = 0.36 + 0.26 * strength;
    d.blend = d.boost = d.returning = 0;
    d.nextStartle = time + 0.9;
    d.cooldown = time + 16 + random() * 10;
    d.scares++;
    count++;
  }
  if (count) state.nextDart = Math.max(state.nextDart ?? 0, time + 6);
  return count;
}

// Rare individual exploration darts, with room checked before acceleration.
export function updateFishDarts(fish, obstacles, state, time, dt) {
  const random = state.random;
  state.nextDart ??= time + 4 + random() * 5;
  for (const f of fish) {
    const d = initDart(f);
    d.age += dt;
    if (d.mode === "react" && d.age >= d.delay) {
      d.mode = "dart";
      d.age = 0;
    }
    if (
      d.mode === "dart" &&
      (d.age >= d.duration ||
        !clearPath(f, d.direction, 0.28, obstacles, d.source === "startle"))
    ) {
      d.mode = "recover";
      d.age = 0;
    }
    if (d.mode === "recover" && d.age >= d.recovery) d.mode = "cruise";
    d.boost =
      d.mode === "dart"
        ? smooth(d.age / (d.source === "startle" ? 0.055 : 0.1)) *
          (1 - 0.7 * smooth((d.age / d.duration - 0.65) / 0.35)) *
          d.intensity
        : 0;
    d.blend =
      d.mode === "dart"
        ? 1
        : d.mode === "recover"
          ? 1 - smooth(d.age / d.recovery)
          : 0;
    d.returning =
      d.mode === "recover" ? Math.sin((Math.PI * d.age) / d.recovery) : 0;
  }
  if (time < state.nextDart) return;
  state.nextDart = time + 6 + random() * 7;
  const start = Math.floor(random() * fish.length);
  for (let i = 0; i < fish.length; i++) {
    const f = fish[(start + i) % fish.length],
      d = f.dart;
    if (time < d.cooldown || d.mode !== "cruise") continue;
    const yaw = Math.atan2(f.v.z, f.v.x);
    for (let attempt = 0; attempt < 5; attempt++) {
      const angle = yaw + (random() - 0.5) * 1.7,
        pitch = (random() - 0.5) * 0.3;
      candidate.set(
        Math.cos(angle) * Math.cos(pitch),
        Math.sin(pitch),
        Math.sin(angle) * Math.cos(pitch),
      );
      if (!clearPath(f, candidate, 0.85, obstacles)) continue;
      d.mode = "dart";
      d.source = "explore";
      d.intensity = 1;
      d.speedBonus = 0.44;
      d.age = 0;
      d.duration = 0.48 + random() * 0.22;
      d.recovery = 1.5 + random() * 0.7;
      d.direction.copy(candidate);
      d.cooldown = time + 22 + random() * 18;
      d.blend = 1;
      d.events++;
      return;
    }
  }
}
