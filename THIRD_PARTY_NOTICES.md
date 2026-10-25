# Third-party notices

## WebGL Water — Evan Wallace

- Source: https://madebyevan.com/webgl-water/
- Copyright 2011 Evan Wallace. MIT license; full license text is retained in `LICENSE`.
- Adaptations: finite-difference water simulation and reflection, refraction and Fresnel calculations integrated with Three.js and BVH scene intersections.

## Neon Tetra Automated Swimming Rig — AeroPlankton

- Source: https://sketchfab.com/3d-models/neon-tetra-automated-swimming-rig-22cddb626d9f417e9baec7894e86cb73
- Author: AeroPlankton (AeroPlankton3D).
- License: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).
- Files: `public/models/neon-tetra/` (glTF, binary geometry/animation and texture).
- Changes: axis/scale normalization, cached skeletal poses, procedural body bending, iridescent material and ray-intersection integration.
- Retain attribution and the license link when sharing the asset or renders featuring it.

## Rock 07 — Jenelle van Heerden / Poly Haven

- Source: https://polyhaven.com/a/rock_07
- License: [CC0](https://polyhaven.com/license).
- Files: `public/models/rock-07/`.
- Changes: reduced from 14,844 to 3,766 triangles, normalized, scaled and tinted for the aquarium. The original glTF and binary are included alongside the simplified geometry.

## Dependencies

Three.js, three-mesh-bvh and Vite retain their respective licenses in their npm packages. `package-lock.json` records dependency versions.

## Procedural plant references

Procedural plant growth uses parameter inheritance and stochastic variation inspired by [Hanan's parametric L-systems](https://algorithmicbotany.org/papers/hanan.dis1992.html). Species references include [Limnophila sessiliflora](https://plant-directory.ifas.ufl.edu/plant-directory/limnophila-sessiliflora/) and [Glossostigma elatinoides](https://www.nparks.gov.sg/florafaunaweb/flora/5/8/5826).
