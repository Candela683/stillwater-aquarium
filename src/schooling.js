import * as T from "three";
import { advanceGait, createGait } from "./swim-gait.js";
import { updateFishDarts, startleFish } from "./fish-darts.js";
const clamp = T.MathUtils.clamp;
const worldUp = new T.Vector3(0, 1, 0),
  pitchAxis = new T.Vector3(0, 0, 1);
const heading = new T.Vector3(),
  desired = new T.Vector3(),
  rotation = new T.Quaternion(),
  pitchRotation = new T.Quaternion();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const schools = new WeakMap();
export function createSchoolGroups(fish, random = Math.random) {
  const count = Math.min(fish.length, 3 + Math.floor(random() * 2));
  const groups = Array.from({ length: count }, (_, id) => {
    const anchor = new T.Vector3(
      (id / Math.max(1, count - 1) - 0.5) * 3.5,
      1.35 + random() * 0.65,
      (random() - 0.5) * 1.25,
    );
    return {
      id,
      anchor,
      target: anchor.clone(),
      nextTarget: 4 + random() * 9,
      count: 0,
    };
  });
  const shuffled = [...fish];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  shuffled.forEach((f, i) => {
    const id = i % count;
    f.school = {
      id,
      previous: id,
      transition: 1,
      nextSwitch: 18 + random() * 24,
    };
    groups[id].count++;
  });
  const state = { groups, random };
  schools.set(fish, state);
  return state;
}
export function startleSchool(fish, point, obstacles, time) {
  return startleFish(
    fish,
    point,
    obstacles,
    schools.get(fish) || createSchoolGroups(fish),
    time,
  );
}
function updateSchoolGroups(fish, time, dt) {
  const state = schools.get(fish) || createSchoolGroups(fish),
    { groups, random } = state;
  for (const g of groups) {
    if (time >= g.nextTarget) {
      g.nextTarget = time + 10 + random() * 14;
      // Overlapping home regions let small schools cross paths without sharing a leader.
      g.target.set(
        (g.id / Math.max(1, groups.length - 1) - 0.5) * 3 +
          (random() - 0.5) * 1.1,
        1.25 + random() * 0.9,
        (random() - 0.5) * 1.3,
      );
    }
    g.anchor.lerp(g.target, 1 - Math.exp(-dt * 0.18));
  }
  for (const f of fish) {
    const s = f.school;
    s.transition = Math.min(1, s.transition + dt / 4);
    if (time < s.nextSwitch) continue;
    s.nextSwitch = time + 18 + random() * 28;
    if (groups[s.id].count <= 4 || random() > 0.5) continue;
    const nearby = fish.filter(
      (o) => o.school.id !== s.id && o.p.distanceToSquared(f.p) < 0.8 * 0.8,
    );
    if (!nearby.length) continue;
    const destination = nearby[Math.floor(random() * nearby.length)].school.id;
    s.previous = s.id;
    groups[s.id].count--;
    s.id = destination;
    groups[s.id].count++;
    s.transition = 0;
  }
  return groups;
}

// Local, forward-biased neighbours; independent burst/coast rhythms and bounded turns.
export function advanceSchool(fish, obstacles, time, dt) {
  dt = Math.min(dt, 0.04);
  const groups = updateSchoolGroups(fish, time, dt);
  updateFishDarts(fish, obstacles, schools.get(fish), time, dt);
  for (const f of fish) {
    f.swim ??= {
      yaw: Math.atan2(f.v.z, f.v.x),
      pitch: 0,
      speed: f.v.length(),
      cruise: 0.24 + 0.12 * (0.5 + 0.5 * Math.sin(f.phase * 3.7)),
      force: new T.Vector3(),
      gait: createGait(f.phase),
      social: new T.Vector3(),
      attention: 0,
      keyNeighbours: [],
    };
    const s = f.swim,
      force = s.force.set(0, 0, 0);
    heading.copy(f.v).normalize();
    const neighbours = [];
    let sx = 0,
      sy = 0,
      sz = 0;
    for (const other of fish) {
      if (other === f) continue;
      const dx = other.p.x - f.p.x,
        dy = other.p.y - f.p.y,
        dz = other.p.z - f.p.z,
        d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < 0.29 * 0.29 && d2 > 0.000001) {
        const w = (1 - Math.sqrt(d2) / 0.29) / Math.max(d2, 0.006);
        sx -= dx * w;
        sy -= dy * w;
        sz -= dz * w;
      }
      if (
        d2 < 1.05 * 1.05 &&
        dx * heading.x + dy * heading.y + dz * heading.z > -0.2 * Math.sqrt(d2)
      ) {
        const membership =
          other.school.id === f.school.id
            ? 1
            : other.school.id === f.school.previous
              ? 1 - f.school.transition
              : 0;
        const ahead =
          (dx * heading.x + dy * heading.y + dz * heading.z) /
          Math.max(Math.sqrt(d2), 0.001);
        const previous = s.keyNeighbours.includes(other) ? 1.2 : 1;
        neighbours.push({
          f: other,
          d2,
          weight:
            (0.12 + 0.88 * membership) *
            (0.65 + 0.35 * Math.max(0, ahead)) *
            previous *
            (1 - 0.7 * other.dart.blend),
        });
      }
    }
    neighbours.sort((a, b) => a.d2 / a.weight - b.d2 / b.weight);
    // Refresh social attention asynchronously; collision avoidance still runs every step.
    s.attention -= dt;
    if (s.attention <= 0) {
      s.attention = 0.18 + 0.12 * (0.5 + 0.5 * Math.sin(f.phase + time * 0.4));
      s.keyNeighbours = neighbours.slice(0, 2).map((n) => n.f);
    }
    const influential = neighbours.filter((n) => s.keyNeighbours.includes(n.f));
    let ax = 0,
      ay = 0,
      az = 0,
      cx = 0,
      cy = 0,
      cz = 0,
      weight = 0,
      n = influential.length;
    for (let i = 0; i < n; i++) {
      const o = influential[i].f,
        w = influential[i].weight;
      weight += w;
      ax += o.v.x * w;
      ay += o.v.y * w;
      az += o.v.z * w;
      cx += (o.p.x - f.p.x) * w;
      cy += (o.p.y - f.p.y) * w;
      cz += (o.p.z - f.p.z) * w;
    }
    if (weight)
      force
        .set(
          (ax / weight - f.v.x) * 0.8 + (cx / weight) * 0.16,
          (ay / weight - f.v.y) * 0.6 + (cy / weight) * 0.12,
          (az / weight - f.v.z) * 0.8 + (cz / weight) * 0.16,
        )
        .multiplyScalar(Math.min(1, weight / 2));
    s.social.lerp(force, 1 - Math.exp(-dt * 5));
    force.copy(s.social);
    const membership = f.school,
      oldAnchor = groups[membership.previous].anchor,
      newAnchor = groups[membership.id].anchor;
    const blend =
      membership.transition *
      membership.transition *
      (3 - 2 * membership.transition);
    const rejoin = 1 + f.dart.returning * 0.7;
    force.x +=
      (oldAnchor.x + (newAnchor.x - oldAnchor.x) * blend - f.p.x) *
      0.055 *
      rejoin;
    force.y +=
      (oldAnchor.y + (newAnchor.y - oldAnchor.y) * blend - f.p.y) *
      0.035 *
      rejoin;
    force.z +=
      (oldAnchor.z + (newAnchor.z - oldAnchor.z) * blend - f.p.z) *
      0.045 *
      rejoin;
    force.x += sx * 0.065;
    force.y += sy * 0.04;
    force.z += sz * 0.065;
    const wander =
      Math.sin(time * (0.39 + 0.05 * Math.sin(f.phase)) + f.phase) * 0.09 +
      Math.sin(time * 0.83 + f.phase * 2.3) * 0.035;
    force.x -= heading.z * wander;
    force.z += heading.x * wander;
    force.y +=
      Math.sin(time * 0.31 + f.phase * 1.7) * 0.018 +
      (1.65 + 0.26 * Math.sin(f.phase) - f.p.y) * 0.025 -
      f.v.y * 0.22;
    s.gait = advanceGait(s.gait, dt, f.phase);
    // Steer mainly during a stroke, with gentle residual correction while coasting.
    force.multiplyScalar(0.3 + 0.7 * s.gait.drive);
    if (f.dart.mode === "dart") {
      const urgency = f.dart.source === "startle" ? 1.55 : 1;
      force
        .addScaledVector(f.dart.direction, 0.75 * f.dart.boost * urgency)
        .addScaledVector(heading, -0.75 * f.dart.boost * urgency);
      s.gait.animationTime += dt * 3.4 * f.dart.boost;
    }
    // Predict the path before reaching glass, instead of clamping positions every frame.
    for (const [k, lo, hi, margin] of [
      ["x", -2.72, 2.72, 0.65],
      ["y", 0.65, 2.62, 0.35],
      ["z", -1.2, 1.2, 0.48],
    ]) {
      const p = f.p[k] + f.v[k] * 0.75;
      if (p < lo + margin)
        force[k] += Math.pow((lo + margin - p) / margin, 2) * 0.9;
      if (p > hi - margin)
        force[k] -= Math.pow((p - hi + margin) / margin, 2) * 0.9;
    }
    for (const o of obstacles) {
      const dx = f.p.x + f.v.x * 0.65 - o.p.x,
        dy = f.p.y + f.v.y * 0.65 - o.p.y,
        dz = f.p.z + f.v.z * 0.65 - o.p.z;
      const rx = o.r + 0.22,
        ry = o.h + 0.23;
      const d = Math.sqrt(
        (dx * dx + dz * dz) / (rx * rx) + (dy * dy) / (ry * ry),
      );
      if (d < 1.25) {
        const w = ((1.25 - d) * 1.6) / Math.max(d, 0.15);
        force.x += (dx / rx) * w;
        force.y += (dy / ry) * w * 0.6;
        force.z += (dz / rx) * w;
      }
    }
  }
  // All steering above reads the same snapshot, avoiding update-order bias.
  for (const f of fish) {
    const s = f.swim;
    desired.copy(f.v).addScaledVector(s.force, 0.9);
    const yaw = Math.atan2(desired.z, desired.x),
      pitch = clamp(
        Math.atan2(desired.y, Math.hypot(desired.x, desired.z)),
        -0.32,
        0.32,
      );
    const yawRate =
        1.55 + 1.55 * f.dart.boost * (f.dart.source === "startle" ? 1.55 : 1),
      pitchRate = 0.45 + 0.25 * f.dart.boost;
    const turn = clamp(wrap(yaw - s.yaw), -yawRate * dt, yawRate * dt);
    s.yaw += turn;
    s.pitch += clamp(pitch - s.pitch, -pitchRate * dt, pitchRate * dt);
    // Propulsive pulses followed by drag; no sinusoidal target-speed servo.
    const thrust = (0.72 + s.cruise * 0.7) * s.gait.drive + 2.4 * f.dart.boost;
    s.speed = clamp(
      s.speed + (thrust - (0.85 + 0.6 * f.dart.returning) * s.speed) * dt,
      0.13,
      0.53 + f.dart.speedBonus * f.dart.blend,
    );
    f.v
      .set(
        Math.cos(s.yaw) * Math.cos(s.pitch),
        Math.sin(s.pitch),
        Math.sin(s.yaw) * Math.cos(s.pitch),
      )
      .multiplyScalar(s.speed);
    f.p.addScaledVector(f.v, dt);
    // Only a numerical safety boundary; predictive steering normally turns well before this.
    for (const [k, lo, hi] of [
      ["x", -2.83, 2.83],
      ["y", 0.52, 2.7],
      ["z", -1.32, 1.32],
    ])
      f.p[k] = clamp(f.p[k], lo, hi);
    f.group.position.copy(f.p);
    // Yaw around world-up, then pitch around the local side axis. The shortest
    // rotation between forward vectors is ambiguous at a U-turn and can invert up.
    rotation.setFromAxisAngle(worldUp, -s.yaw);
    pitchRotation.setFromAxisAngle(pitchAxis, s.pitch);
    f.group.quaternion.copy(rotation).multiply(pitchRotation);
  }
}
