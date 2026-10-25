import assert from "node:assert/strict";
import { PerspectiveCamera } from "three";
import { renderStill, detailViews } from "../src/still-capture.js";

function fixture(failure) {
  const camera = new PerspectiveCamera(37, 1.5, 0.05, 80);
  camera.setViewOffset(300, 200, 4, 5, 300, 200);
  const initialView = { ...camera.view };
  const initialProjection = camera.projectionMatrix.clone();
  const controls = { enabled: true };
  const state = { paused: false, resumed: 0, renders: 0, width: 300, height: 200, ratio: 2, image: null };
  const initialTarget = { name: "previous target" };
  let target = initialTarget;
  const gl = {
    RGBA: 6408, UNSIGNED_BYTE: 5121,
    get drawingBufferWidth() { return state.width * state.ratio; },
    get drawingBufferHeight() { return state.height * state.ratio; },
    isContextLost: () => false,
    readPixels(x, y, width, height, format, type, pixels) {
      const value = state.renders <= 4 ? 0 : 255;
      // Bottom row: grayscale, red. Top row: green, blue.
      pixels.set([value, value, value, 255, 255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]);
    },
  };
  const renderer = {
    getSize: (out) => out.set(state.width, state.height),
    getPixelRatio: () => state.ratio,
    setPixelRatio: (ratio) => { state.ratio = ratio; },
    setSize: (width, height) => { Object.assign(state, { width, height }); },
    getRenderTarget: () => target,
    setRenderTarget: (value) => { target = value; },
    getContext: () => gl,
  };
  const options = {
    renderer, camera, controls, width: 2, height: 2,
    pause: () => {
      state.paused = true;
      return () => { state.paused = false; state.resumed++; };
    },
    render: () => {
      assert(state.paused, "simulation is frozen for every sample");
      assert.equal(controls.enabled, false);
      assert.equal(state.ratio, 1);
      assert.equal(camera.aspect, 1);
      assert.equal(target, null);
      state.renders++;
      if (failure === "render") throw Error("render failure");
    },
    yieldFrame: async () => { assert(state.paused); },
    createCanvas: () => ({
      getContext: () => ({
        createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
        putImageData: (image) => { state.image = image.data; },
      }),
      toBlob: (resolve, type) => resolve(failure === "encode" ? null : new Blob([state.image], { type })),
    }),
  };
  function restored() {
    assert.equal(state.paused, false);
    assert.equal(state.resumed, 1);
    assert.equal(state.ratio, 2);
    assert.equal(state.width, 300);
    assert.equal(state.height, 200);
    assert.equal(controls.enabled, true);
    assert.equal(target, initialTarget);
    assert.deepEqual(camera.view, initialView);
    assert(camera.projectionMatrix.equals(initialProjection));
  }
  return { options, state, restored };
}

const success = fixture();
const blob = await renderStill(success.options);
assert.equal(blob.type, "image/png");
assert.equal(success.state.renders, 8);
assert.deepEqual([...success.state.image], [0, 255, 0, 255, 0, 0, 255, 255, 188, 188, 188, 255, 255, 0, 0, 255]);
success.restored();

for (const failure of ["render", "encode"]) {
  const test = fixture(failure);
  await assert.rejects(renderStill(test.options));
  test.restored();
}
assert.equal(new Set(Object.values(detailViews).map(view => view.name)).size, 3);
console.log("PASS: linear-light antialiasing, image orientation, frozen simulation, and state restoration after success or failure.");
