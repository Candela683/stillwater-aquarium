import * as T from "three";

export function tankClickPoint(
  ray,
  fish,
  { width, depth, waterY },
  out = new T.Vector3(),
) {
  const bounds = new T.Box3(
    new T.Vector3(-width / 2, 0.15, -depth / 2),
    new T.Vector3(width / 2, waterY, depth / 2),
  );
  const entry = ray.intersectBox(bounds, new T.Vector3());
  if (!entry) return null;
  let selected = null,
    nearest = Infinity;
  for (const f of fish) {
    const distance = ray.origin.distanceTo(f.p);
    if (
      bounds.containsPoint(f.p) &&
      ray.distanceSqToPoint(f.p) < 0.24 ** 2 &&
      distance < nearest
    ) {
      selected = f;
      nearest = distance;
    }
  }
  // Aiming at a fish taps just in front of it; empty glass taps stay near the pane.
  if (selected) out.copy(selected.p).addScaledVector(ray.direction, -0.14);
  else out.copy(entry).addScaledVector(ray.direction, 0.32);
  return bounds.clampPoint(out, out);
}

export function installTankClicks({
  canvas,
  camera,
  fish,
  width,
  depth,
  waterY,
  surface,
  onTap,
  onRipple,
}) {
  let press = null;
  const caster = new T.Raycaster(),
    pointer = new T.Vector2();
  const down = (e) => {
    if (e.isPrimary === false) {
      press = null;
      return;
    }
    if (e.button !== 0) return;
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, dragged: false };
  };
  const move = (e) => {
    if (
      press?.id === e.pointerId &&
      Math.hypot(e.clientX - press.x, e.clientY - press.y) > 6
    )
      press.dragged = true;
  };
  const cancel = () => {
    press = null;
  };
  const up = (e) => {
    const p = press;
    press = null;
    if (
      !p ||
      p.id !== e.pointerId ||
      p.dragged ||
      Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6
    )
      return;
    const rect = canvas.getBoundingClientRect(),
      x = (e.clientX - rect.left) / rect.width,
      y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    camera.updateMatrixWorld();
    caster.setFromCamera(pointer.set(x * 2 - 1, 1 - y * 2), camera);
    const point = tankClickPoint(caster.ray, fish, { width, depth, waterY });
    if (!point) return;
    onTap(point);
    const hit = surface ? caster.intersectObject(surface)[0] : null;
    onRipple(hit?.point ?? point);
  };
  const handlers = {
    pointerdown: down,
    pointermove: move,
    pointerup: up,
    pointercancel: cancel,
  };
  for (const [type, handler] of Object.entries(handlers))
    canvas.addEventListener(type, handler);
  return () => {
    for (const [type, handler] of Object.entries(handlers))
      canvas.removeEventListener(type, handler);
  };
}
