# Third-party notices

## WebGL Water — Evan Wallace

- Source: https://madebyevan.com/webgl-water/
- Copyright 2011 Evan Wallace. MIT license; full license text is retained in `LICENSE`.
- The current Three.js implementation adapts finite-difference water dynamics and reflect/refract/Fresnel concepts, and adds BVH scene intersections, plants, animated fish and a glass aquarium. It is not the unchanged original demo.

## Neon Tetra Automated Swimming Rig — AeroPlankton

- Source: https://sketchfab.com/3d-models/neon-tetra-automated-swimming-rig-22cddb626d9f417e9baec7894e86cb73
- Author: AeroPlankton (AeroPlankton3D).
- License: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).
- Files: `public/models/neon-tetra/` (glTF, binary geometry/animation and texture).
- Changes: axis/scale normalization, cached skeletal poses, procedural body bending, iridescent material and ray-intersection integration. Original supplied asset files are included with their attribution.
- Keep this credit and license link when redistributing the asset or screenshots/video substantially featuring it. No endorsement by the original author is implied.

## Rock 07 — Jenelle van Heerden / Poly Haven

- Source: https://polyhaven.com/a/rock_07
- License: [CC0](https://polyhaven.com/license).
- Files: `public/models/rock-07/`.
- Changes: reduced from 14,844 to 3,766 triangles, normalized, scaled and tinted for the aquarium. The original glTF and binary are included alongside the simplified geometry.

## Dependencies

Three.js, three-mesh-bvh and Vite are installed by npm. Their original licenses remain in their respective packages. `package-lock.json` pins the tested dependency tree.

## Procedural plant references

The plants are generated in code, not redistributed photographs or downloaded plant models. Parameter inheritance and stochastic variation are inspired by [Hanan's parametric L-systems](https://algorithmicbotany.org/papers/hanan.dis1992.html); this is not a complete L-system implementation. Species references include [Limnophila sessiliflora](https://plant-directory.ifas.ufl.edu/plant-directory/limnophila-sessiliflora/) and [Glossostigma elatinoides](https://www.nparks.gov.sg/florafaunaweb/flora/5/8/5826).
