import * as T from "three";
import {
  MeshBVH,
  MeshBVHUniformStruct,
  FloatVertexAttributeTexture,
  shaderStructs,
  shaderIntersectFunction,
} from "three-mesh-bvh";

// Evan Wallace, WebGL Water (MIT): reflect/refract rays, Fresnel blending,
// analytic ray-box bounds. Extended with a triangle BVH and dynamic fish intersections.
export function installRayWater({
  scene,
  surface,
  glass,
  fish,
  tetra,
  wood,
  rockMap,
  rockDetail,
  rockTint,
  aquariumLight,
  waterY,
  heightfield,
  fieldSize,
}) {
  scene.updateMatrixWorld(true);
  const plantRanges = [];
  const leafNormals = [],
    normalMatrix = new T.Matrix3(),
    leafNormal = new T.Vector3();
  const positions = [],
    colors = [],
    v = new T.Vector3(),
    matrix = new T.Matrix4(),
    instance = new T.Matrix4(),
    color = new T.Color();
  scene.traverse((o) => {
    if (
      o.userData.rayIgnore ||
      !o.isMesh ||
      o === surface ||
      o.material === glass ||
      o.material.transparent ||
      o.parent !== scene ||
      o.position.y < 0 ||
      o.count > 3000
    )
      return;
    const g = o.geometry,
      p = g.attributes.position,
      idx = g.index;
    const n = o.isInstancedMesh ? o.count : 1;
    for (let k = 0; k < n; k++) {
      matrix.copy(o.matrixWorld);
      color.copy(o.material.color || new T.Color(1, 1, 1));
      if (o.isInstancedMesh) {
        o.getMatrixAt(k, instance);
        matrix.multiply(instance);
        if (o.instanceColor) {
          const tint = new T.Color();
          o.getColorAt(k, tint);
          color.multiply(tint);
        }
      }
      normalMatrix.getNormalMatrix(matrix);
      if (o.userData.deformableLeaves)
        plantRanges.push({
          object: o,
          instance: k,
          start: positions.length / 3,
          count: idx ? idx.count : p.count,
          version: p.version,
        });
      for (let j = 0; j < (idx ? idx.count : p.count); j++) {
        const i = idx ? idx.getX(j) : j;
        v.fromBufferAttribute(p, i).applyMatrix4(matrix);
        positions.push(v.x, v.y, v.z);
        if (
          o.userData.leafSurface ||
          o.userData.rockSurface ||
          o.userData.substrateSurface
        ) {
          leafNormal
            .fromBufferAttribute(g.attributes.normal, i)
            .applyNormalMatrix(normalMatrix);
          leafNormals.push(
            leafNormal.x,
            leafNormal.y,
            leafNormal.z,
            o.userData.substrateSurface ? 3 : o.userData.rockSurface ? 2 : 1,
          );
        } else leafNormals.push(0, 0, 0, 0);
        if (o.userData.rockSurface) {
          colors.push(g.attributes.uv.getX(i), g.attributes.uv.getY(i), 0);
        } else if (g.attributes.color) {
          const tint = new T.Color().fromBufferAttribute(g.attributes.color, i);
          colors.push(color.r * tint.r, color.g * tint.g, color.b * tint.b);
        } else colors.push(color.r, color.g, color.b);
      }
    }
  });
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geometry.setAttribute(
    "leafNormal",
    new T.Float32BufferAttribute(leafNormals, 4),
  );
  const bvh = new MeshBVH(geometry, { maxLeafSize: 8 });
  const gpu = new MeshBVHUniformStruct();
  gpu.updateFrom(bvh);
  // Refit changes bounds/positions only; topology and indices remain unchanged.
  const rootData = new Float32Array(
    MeshBVH.serialize(bvh, { cloneBuffers: false }).roots[0],
  );
  function uploadDeformation() {
    const bounds = gpu.bvhBounds.image.data;
    for (let i = 0; i < rootData.length; i += 8) {
      bounds[i] = rootData[i];
      bounds[i + 1] = rootData[i + 1];
      bounds[i + 2] = rootData[i + 2];
      bounds[i + 4] = rootData[i + 3];
      bounds[i + 5] = rootData[i + 4];
      bounds[i + 6] = rootData[i + 5];
    }
    gpu.bvhBounds.needsUpdate = true;
    const src = geometry.attributes.position.array,
      dst = gpu.position.image.data,
      stride =
        dst.length / gpu.position.image.width / gpu.position.image.height;
    for (let i = 0, j = 0; i < src.length; i += 3, j += stride) {
      dst[j] = src[i];
      dst[j + 1] = src[i + 1];
      dst[j + 2] = src[i + 2];
    }
    gpu.position.needsUpdate = true;
  }
  const colorTexture = new FloatVertexAttributeTexture();
  colorTexture.updateFrom(geometry.attributes.color);
  const leafNormalTexture = new FloatVertexAttributeTexture();
  leafNormalTexture.updateFrom(geometry.attributes.leafNormal);
  const fishTransforms = fish.map(() => new T.Matrix4()),
    fishPoses = new Float32Array(fish.length);
  const heightTexture = new T.DataTexture(
    heightfield,
    fieldSize,
    fieldSize,
    T.RedFormat,
    T.FloatType,
  );
  heightTexture.minFilter = heightTexture.magFilter = T.LinearFilter;
  heightTexture.needsUpdate = true;
  const shared = {
    rockMap: { value: rockMap },
    rockDetail: { value: rockDetail },
    rockTint: { value: rockTint },
    leafNormals: { value: leafNormalTexture },
    fishPose: { value: fishPoses },
    fishInv: { value: fishTransforms },
    fishBVH: { value: tetra.gpu },
    fishUV: { value: tetra.uv },
    fishMap: { value: tetra.map },
    heightfield: { value: heightTexture },
    bvh: { value: gpu },
    vertexColors: { value: colorTexture },
    wood: { value: wood },
    waterY: { value: waterY },
    lampPosition: { value: aquariumLight.emitterPosition },
    lampHalfSize: { value: aquariumLight.emitterHalfSize },
  };
  const fragment = `
 precision highp isampler2D;precision highp usampler2D;
 ${shaderStructs}
 ${shaderIntersectFunction.replace("float triangleDistance = INFINITY;", "float triangleDistance = dist;")}
 uniform sampler2D heightfield,leafNormals,rockMap,rockDetail;
 uniform vec3 lampPosition,rockTint;uniform vec2 lampHalfSize;
 uniform sampler2D fishUV,fishMap;uniform BVH fishBVH;uniform mat4 fishInv[38];uniform float fishPose[38];
 uniform BVH bvh;uniform sampler2D vertexColors,wood;uniform float waterY,isGlass;
 varying vec3 worldPosition,worldNormal;
 vec2 intersectCube(vec3 origin,vec3 ray,vec3 cubeMin,vec3 cubeMax){vec3 tMin=(cubeMin-origin)/ray;vec3 tMax=(cubeMax-origin)/ray;vec3 t1=min(tMin,tMax),t2=max(tMin,tMax);return vec2(max(max(t1.x,t1.y),t1.z),min(min(t2.x,t2.y),t2.z));}
 vec2 grainHash(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
 vec3 stoneNormal(uvec4 ids,vec3 n,vec2 encoded){
  vec3 a=texelFetch1D(bvh.position,ids.x).xyz,b=texelFetch1D(bvh.position,ids.y).xyz,c=texelFetch1D(bvh.position,ids.z).xyz;
  vec2 ua=texelFetch1D(vertexColors,ids.x).xy,ub=texelFetch1D(vertexColors,ids.y).xy,uc=texelFetch1D(vertexColors,ids.z).xy;
  vec2 du=ub-ua,dv=uc-ua;float det=du.x*dv.y-du.y*dv.x;
  if(abs(det)<.0000001)return n;
  vec3 tangent=((b-a)*dv.y-(c-a)*du.y)/det;
  vec3 bitangent=(-(b-a)*dv.x+(c-a)*du.x)/det;
  tangent-=n*dot(tangent,n);if(dot(tangent,tangent)<.0000001)return n;
  tangent=normalize(tangent);
  vec3 basisB=normalize(cross(n,tangent));basisB*=dot(basisB,bitangent)<0.?-1.:1.;
  vec2 xy=(encoded*2.-1.)*.85;
  return normalize(tangent*xy.x+basisB*xy.y+n*sqrt(max(.001,1.-dot(xy,xy))));
 }
 vec3 sceneRay(vec3 origin,vec3 ray,bool coarseFish){
  uvec4 indices=uvec4(0);vec3 normal=vec3(0.),bary=vec3(0.);float side=1.,dist=1.e20;
  bool hit=bvhIntersectFirstHit(bvh,origin,ray,indices,normal,bary,side,dist);
  bool leafHit=false,stoneHit=false,soilHit=false,neon=false;vec3 base=vec3(0.);float roughness=.8,occlusion=1.;
  if(hit)base=texelFetch1D(vertexColors,indices.x).rgb*bary.x+texelFetch1D(vertexColors,indices.y).rgb*bary.y+texelFetch1D(vertexColors,indices.z).rgb*bary.z;
  if(hit){
   vec4 n0=texelFetch1D(leafNormals,indices.x);
   if(n0.w>.5){leafHit=n0.w<1.5;stoneHit=n0.w>1.5&&n0.w<2.5;soilHit=n0.w>2.5;
    vec2 rockUV=base.xy;
    if(stoneHit)base=texture2D(rockMap,rockUV).rgb*rockTint;
    vec3 smoothNormal=n0.xyz*bary.x+texelFetch1D(leafNormals,indices.y).xyz*bary.y+texelFetch1D(leafNormals,indices.z).xyz*bary.z;
    if(dot(smoothNormal,smoothNormal)>.00001)normal=normalize(smoothNormal);
    if(stoneHit){
     vec4 detail=texture2D(rockDetail,rockUV);
     normal=stoneNormal(indices,normal,detail.rg);roughness=clamp(detail.b*.76,.26,.88);occlusion=mix(.3,1.,detail.a);
    }
   }
  }
  // Only rays inside a fish's conservative bound traverse the shared local mesh.
  for(int i=0;i<38;i++){
   vec3 ro=(fishInv[i]*vec4(origin,1.)).xyz,rd=(fishInv[i]*vec4(ray,0.)).xyz;
   float a=dot(rd,rd),b=dot(ro,rd),c=dot(ro,ro)-.205*.205,d=b*b-a*c;
   if(d<0.)continue;
   float nearT=(-b-sqrt(d))/a,farT=(-b+sqrt(d))/a;
   if(farT<0.||nearT>dist)continue;
   if(coarseFish){
    // Water reflections use a broad silhouette, without eyes, scales or fin triangles.
    vec3 radii=vec3(.17,.052,.034),sr=ro/radii,sd=rd/radii;
    float aa=dot(sd,sd),bb=dot(sr,sd),cc=dot(sr,sr)-1.,dd=bb*bb-aa*cc;
    if(dd>0.){
     float t=(-bb-sqrt(dd))/aa;
     if(t>.001&&t<dist){
      vec3 fp=ro+rd*t;dist=t;hit=true;leafHit=false;stoneHit=false;soilHit=false;occlusion=1.;roughness=.4;
      float stripe=exp(-pow((fp.y-.012)/.023,2.));
      base=mix(vec3(.22,.12,.14),vec3(.025,.32,.48),stripe);
      base=mix(base,vec3(.48,.025,.04),(1.-smoothstep(-.1,.03,fp.x))*(1.-stripe)*.65);
      normal=normalize(transpose(mat3(fishInv[i]))*(fp/(radii*radii)));neon=false;
     }
    }
    continue;
   }
   float offset=max(0.,nearT);
   vec3 atlasOrigin=ro+vec3(fishPose[i],0.,0.);
   for(int layer=0;layer<4;layer++){
    uvec4 fi=uvec4(0);vec3 fn=vec3(0.),fb=vec3(0.);float fs=1.,ft=min(dist,farT)-offset;
    if(ft<=0.)break;
    bool found=bvhIntersectFirstHit(fishBVH,atlasOrigin+rd*offset,rd,fi,fn,fb,fs,ft);
    if(!found||ft+offset>=min(dist,farT))break;
    vec2 uv=texelFetch1D(fishUV,fi.x).xy*fb.x+texelFetch1D(fishUV,fi.y).xy*fb.y+texelFetch1D(fishUV,fi.z).xy*fb.z;
    vec4 tex=texture2D(fishMap,uv);
    if(tex.a<.25){offset+=ft+.0001;continue;}
    dist=ft+offset;hit=true;leafHit=false;stoneHit=false;soilHit=false;occlusion=1.;roughness=.4;base=tex.rgb;neon=base.b>base.r+.08&&base.g>base.r+.035;
    normal=normalize(transpose(mat3(fishInv[i]))*fn);break;
   }
  }
  float lampT=(lampPosition.y-origin.y)/ray.y;
  vec3 lampHit=origin+ray*lampT;
  if(lampT>.001&&lampT<dist&&abs(lampHit.x-lampPosition.x)<lampHalfSize.x&&abs(lampHit.z-lampPosition.z)<lampHalfSize.y)return vec3(5.,5.2,4.9);
  if(hit){
   vec3 p=origin+ray*dist;
   if(soilHit){
    // Small rounded aquasoil grains remain visible through glass without 8,000 ray meshes.
    vec2 q=p.xz*56.,cell=floor(q),local=fract(q),delta=vec2(0.);float nearest=10.,variation=0.;
    for(int gy=-1;gy<=1;gy++)for(int gx=-1;gx<=1;gx++){
     vec2 offset=vec2(float(gx),float(gy)),seed=grainHash(cell+offset);
     vec2 v=offset+.18+.64*seed-local;float d=dot(v,v);
     if(d<nearest){nearest=d;delta=-v;variation=seed.x;}
    }
    float grain=1.-smoothstep(.24,.47,sqrt(nearest));
    base*=mix(.30,.80+variation*.48,grain);
    normal=normalize(normal+vec3(delta.x,0.,delta.y)*grain*1.15);
    occlusion=.65+.35*grain;
   }
   // Nearest point on the long LED gives broad illumination instead of a central hot spot.
   vec3 lightPoint=lampPosition+vec3(clamp(p.x-lampPosition.x,-lampHalfSize.x*.9,lampHalfSize.x*.9),0.,0.);
   vec3 toLight=lightPoint-p;vec3 L=normalize(toLight);vec3 V=-ray;
   if(dot(normal,V)<0.)normal=-normal;
   vec3 H=normalize(L+V);float angle=clamp(dot(normal,H),0.,1.);
   if(neon){
    // Structural-color approximation: stripe hue shifts with incidence/view angle.
    float shift=pow(1.-angle,.65);
    base=shift<.52?mix(vec3(.015,.55,.44),vec3(.015,.17,.95),shift/.52):mix(vec3(.015,.17,.95),vec3(.40,.035,.85),(shift-.52)/.48);
   }
   float attenuation=8./(3.+dot(toLight,toLight));
   float facing=dot(normal,L);
   float diffuse=.20*occlusion+1.8*max(facing,0.)*attenuation;
   if(leafHit){
    // Thin-leaf lighting approximation: softer front/back contrast, no extra rays.
    float backlight=pow(max(dot(-L,V),0.),3.);
    diffuse=.22+(1.20*max(facing,0.)+.32*max(-facing,0.)+.17*backlight)*attenuation;
   }
   float specular=pow(max(dot(normal,H),0.),neon?65.:stoneHit?mix(80.,12.,roughness):30.)*attenuation*max(facing,0.);
   vec3 absorption=exp(-vec3(.035,.012,.008)*min(dist,7.));
   return (base*diffuse+vec3(specular)*(neon?.24:leafHit?.012:soilHit?.006:stoneHit?.045:.04))*absorption;
  }
  // Original ray-box termination, with the open aquarium looking onto the timber slab.
  vec2 bounds=intersectCube(origin,ray,vec3(-3.,0.,-1.5),vec3(3.,3.1,1.5));
  float t=(-.19-origin.y)/ray.y;if(t>0.){vec3 p=origin+t*ray;if(abs(p.x)<4.5&&abs(p.z)<2.9)return texture2D(wood,vec2(p.x/9.+.5,p.z/5.8+.5)).rgb*.65;}
  float strip=pow(max(dot(ray,normalize(vec3(-.4,1.,.2))),0.),180.);
  return vec3(strip*.9);
 }

 float waterHeight(vec2 p){return waterY+texture2D(heightfield,vec2(p.x/6.+.5,.5-p.y/3.)).r;}
 // Split at a water interface without calling the scene tracer here.
 // Keeping one call site for BVH traversal prevents driver-side shader expansion.
 void splitWaterRay(vec3 origin,vec3 ray,out vec3 o0,out vec3 d0,out vec3 o1,out vec3 d1,out float weight,out bool waterTIR){
  o0=origin;d0=ray;o1=origin;d1=ray;weight=0.;waterTIR=false;
  if(abs(ray.y)<.0001)return;
  float t=(waterY-origin.y)/ray.y;
  if(t<=.002)return;
  for(int i=0;i<4;i++){vec3 q=origin+ray*t;t=(waterHeight(q.xz)-origin.y)/ray.y;}
  vec3 q=origin+ray*t;
  if(t<=.002||abs(q.x)>2.97||abs(q.z)>1.47)return;
  uvec4 face=uvec4(0);vec3 fn=vec3(0.),bary=vec3(0.);float side=1.,distance=1.e20;
  bool occupied=bvhIntersectFirstHit(bvh,origin,ray,face,fn,bary,side,distance);
  if(occupied&&distance<t)return;
  float dx=.094,dz=.047;
  vec3 n=normalize(vec3((waterHeight(q.xz-vec2(dx,0.))-waterHeight(q.xz+vec2(dx,0.)))/(2.*dx),1.,(waterHeight(q.xz-vec2(0.,dz))-waterHeight(q.xz+vec2(0.,dz)))/(2.*dz)));
  bool above=ray.y<0.;if(!above)n=-n;
  o1=q+n*.004;d1=reflect(ray,n);o0=q-n*.004;d0=refract(ray,n,above?1./1.333:1.333);
  weight=mix(.0204,1.,pow(1.-max(0.,dot(n,-ray)),3.));
  if(length(d0)<.01){o0=o1;d0=d1;weight=0.;waterTIR=true;}
 }
 void main(){
  vec3 normal=normalize(worldNormal),incomingRay=normalize(worldPosition-cameraPosition);
  bool entering=dot(incomingRay,normal)<0.;if(!entering)normal=-normal;
  float ior=isGlass>.5?1.52:1.333;
  float eta=entering?1./ior:ior;
  if(isGlass>.5){eta=worldPosition.y<waterY?1./1.333:1.;}
  vec3 reflectedRay=reflect(incomingRay,normal);
  vec3 refractedRay=refract(incomingRay,normal,eta);
  float f0=pow((1.-ior)/(1.+ior),2.);
  float fresnel=mix(f0,1.,pow(1.-dot(normal,-incomingRay),3.));
  vec3 result=vec3(0.);
  bool tir=length(refractedRay)<.01;if(tir)fresnel=1.;
  for(int branch=0;branch<2;branch++){
   float primaryWeight=branch==0?fresnel:1.-fresnel;
   if(primaryWeight<.0001)continue;
   vec3 origin=branch==0?worldPosition+normal*.003:worldPosition-normal*.004;
   vec3 direction=branch==0?reflectedRay:refractedRay;
   vec3 o0=origin,d0=direction,o1=origin,d1=direction;float secondaryWeight=0.;bool waterTIR=false;
   if(isGlass>.5)splitWaterRay(origin,direction,o0,d0,o1,d1,secondaryWeight,waterTIR);
   for(int secondary=0;secondary<2;secondary++){
    float weight=primaryWeight*(secondary==0?1.-secondaryWeight:secondaryWeight);
    if(weight<.0001)continue;
    result+=sceneRay(secondary==0?o0:o1,secondary==0?d0:d1,branch==0||secondary==1||waterTIR)*weight;
   }
  }
  gl_FragColor=vec4(result,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`;
  function material(isGlass) {
    return new T.ShaderMaterial({
      uniforms: { ...shared, isGlass: { value: isGlass } },
      vertexShader: `varying vec3 worldPosition,worldNormal;void main(){worldPosition=(modelMatrix*vec4(position,1.)).xyz;worldNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*vec4(worldPosition,1.);}`,
      fragmentShader: fragment,
      side: T.FrontSide,
    });
  }
  surface.material = material(0);
  surface.material.side = T.DoubleSide;
  surface.renderOrder = 3;
  const glassRay = material(1);
  scene.traverse((o) => {
    if (o.isMesh && o.material === glass) {
      o.material = glassRay;
      o.renderOrder = 4;
    }
  });
  // Populate depth with cheap passes first, so hidden glass faces never run the ray shader.
  const raySurfaces = [];
  scene.traverse((o) => {
    if (o.isMesh && (o.material === glassRay || o === surface))
      raySurfaces.push(o);
  });
  for (const o of raySurfaces) {
    const depth = new T.ShaderMaterial({
      vertexShader: o.material.vertexShader,
      fragmentShader: "void main(){gl_FragColor=vec4(0.);}",
      colorWrite: false,
      depthWrite: true,
      side: o.material.side,
    });
    const proxy = new T.Mesh(o.geometry, depth);
    proxy.position.copy(o.position);
    proxy.quaternion.copy(o.quaternion);
    proxy.scale.copy(o.scale);
    proxy.renderOrder = 2;
    proxy.userData.rayIgnore = true;
    scene.add(proxy);
  }
  return {
    update(plantsMoved = false) {
      heightTexture.needsUpdate = true;
      fish.forEach((f, i) => {
        f.group.updateMatrixWorld(true);
        fishTransforms[i].copy(f.group.matrixWorld).invert();
        fishPoses[i] = f.poseIndex || 0;
      });
      if (plantsMoved) {
        const dst = geometry.attributes.position;
        for (const entry of plantRanges) {
          const o = entry.object,
            src = o.geometry.attributes.position,
            idx = o.geometry.index;
          if (entry.version === src.version) continue;
          entry.version = src.version;
          matrix.copy(o.matrixWorld);
          if (o.isInstancedMesh) {
            o.getMatrixAt(entry.instance, instance);
            matrix.multiply(instance);
          }
          normalMatrix.getNormalMatrix(matrix);
          for (let j = 0; j < entry.count; j++) {
            const i = idx ? idx.getX(j) : j;
            v.fromBufferAttribute(src, i).applyMatrix4(matrix);
            dst.setXYZ(entry.start + j, v.x, v.y, v.z);
            leafNormal
              .fromBufferAttribute(o.geometry.attributes.normal, i)
              .applyNormalMatrix(normalMatrix);
            geometry.attributes.leafNormal.setXYZW(
              entry.start + j,
              leafNormal.x,
              leafNormal.y,
              leafNormal.z,
              1,
            );
          }
        }
        dst.needsUpdate = true;
        bvh.refit();
        uploadDeformation();
        leafNormalTexture.image.data.set(geometry.attributes.leafNormal.array);
        leafNormalTexture.needsUpdate = true;
      }
    },
    triangles: geometry.attributes.position.count / 3,
  };
}
