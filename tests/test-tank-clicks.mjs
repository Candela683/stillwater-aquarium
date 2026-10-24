import assert from "node:assert/strict";
import * as T from "three";
import { tankClickPoint, installTankClicks } from "../src/tank-clicks.js";
const dims = { width: 6, depth: 3, waterY: 2.86 },
  fish = [{ p: new T.Vector3(0, 1.5, 0.3) }];
const camera = new T.PerspectiveCamera(45, 4 / 3, 0.1, 100);
camera.position.set(0, 1.5, 8);
camera.lookAt(0, 1.5, 0);
camera.updateMatrixWorld();
const aimed = new T.Ray(camera.position, new T.Vector3(0, 0, -1)),
  point = tankClickPoint(aimed, fish, dims);
assert(
  point.distanceTo(fish[0].p) < 0.15 && point.z > fish[0].p.z,
  "click reaches the targeted fish depth, just ahead of it",
);
const empty = tankClickPoint(
  new T.Ray(new T.Vector3(1.2, 1.5, 8), new T.Vector3(0, 0, -1)),
  fish,
  dims,
);
assert(empty.z > 1 && empty.z < 1.5, "empty-glass click stays near its pane");
assert.equal(
  tankClickPoint(
    new T.Ray(new T.Vector3(8, 6, 8), new T.Vector3(1, 0, 0)),
    fish,
    dims,
  ),
  null,
  "outside tank is ignored",
);
class Canvas extends EventTarget {
  getBoundingClientRect() {
    return { left: 40, top: 30, width: 800, height: 600 };
  }
}
const canvas = new Canvas(),
  taps = [],
  ripples = [];
const dispose = installTankClicks({
  canvas,
  camera,
  fish,
  ...dims,
  onTap: (p) => taps.push(p.clone()),
  onRipple: (p) => ripples.push(p.clone()),
});
function event(type, properties = {}) {
  const e = new Event(type);
  Object.assign(
    e,
    { pointerId: 1, isPrimary: true, button: 0, clientX: 440, clientY: 330 },
    properties,
  );
  canvas.dispatchEvent(e);
}
event("pointerdown");
event("pointerup");
assert.equal(taps.length, 1);
assert.equal(ripples.length, 1);
assert(
  taps[0].distanceTo(point) < 1e-6,
  "canvas offsets correctly map to the 3D click",
);
event("pointerdown");
event("pointermove", { clientX: 475 });
event("pointermove");
event("pointerup");
assert.equal(
  taps.length,
  1,
  "dragging and returning to start does not scare fish",
);
event("pointerdown");
event("pointercancel");
event("pointerup");
assert.equal(taps.length, 1);
event("pointerdown");
event("pointerdown", { pointerId: 2, isPrimary: false });
event("pointerup");
assert.equal(taps.length, 1, "pinch gesture is not a tap");
event("pointerdown", { button: 2 });
event("pointerup", { button: 2 });
assert.equal(taps.length, 1, "right drag is not a tap");
event("pointerdown", { clientY: 35 });
event("pointerup", { clientY: 35 });
assert.equal(taps.length, 1, "click above tank does not trigger");
dispose();
event("pointerdown");
event("pointerup");
assert.equal(taps.length, 1, "listeners can be removed");
console.log(
  "PASS: fish-depth/glass picking, screen offsets, click ripples, drag, cancel, pinch and outside-tank suppression.",
);
