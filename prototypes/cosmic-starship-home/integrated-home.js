import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createFlightParticleField } from "./flight-particles.js";

const home=document.querySelector("#expedition-home");
const stage=document.querySelector("#scene-stage");
const searchForm=document.querySelector("#coordinate-search");
const searchInput=document.querySelector("#coordinate-input");
const routePanel=document.querySelector("#route-panel");
const resolvedQuery=document.querySelector("#resolved-query");
const toast=document.querySelector("#toast");
const fallback=document.querySelector("#webgl-fallback");
const dockTime=document.querySelector("#dock-time");

const reducedMotion=window.matchMedia("(prefers-reduced-motion:reduce)").matches;
const coarsePointer=window.matchMedia("(pointer:coarse)").matches;
const lowPower=coarsePointer||(navigator.hardwareConcurrency||8)<=4;
const tracerCount=lowPower?1900:4700;
const defaultCameraPosition=new THREE.Vector3(0,1.42,11.3);
const defaultTarget=new THREE.Vector3(.82,-.25,.2);
const flightDirection=new THREE.Vector3(.86,.27,-.43).normalize();
const flightAnchor=new THREE.Vector3(1.05,-.83,.9);

let renderer;
let backgroundScene;
let objectScene;
let postScene;
let postCamera;
let backgroundTarget;
let lensMaterial;
let camera;
let controls;
let vessel;
let blackHoleRoot;
let blackHoleDisk;
let photonPlane;
let tracerMaterial;
let reactor;
let reactorHalo;
let bowShock;
let innerHull;
let flightParticleField;
let lastTime=performance.now();
let lastInteraction=performance.now();
let warpTarget=0;
let warpEnergy=0;
let resetActive=false;
let jumpTimers=[];
let toastTimer=0;
const fluidMaterials=[];
const wakeMeshes=[];
const blackHoleMaterials=[];
const signalObjects=[];
const blackHoleWorldPosition=new THREE.Vector3();
let viewportWidth=window.innerWidth;
let viewportHeight=window.innerHeight;

function clamp(value,minimum,maximum){return Math.min(maximum,Math.max(minimum,value));}

function bodyRadius(u){
  const main=Math.pow(Math.max(0,Math.sin(Math.PI*u)),.56);
  const nose=1-.58*Math.pow(u,4.4);
  const shoulder=.27*Math.pow(1-u,5.2);
  return(.15+.69*main)*nose+shoulder;
}

function createBodySurface(longitudinalSegments,radialSegments){
  const positions=[],uvs=[],indices=[];
  for(let longitudinal=0;longitudinal<=longitudinalSegments;longitudinal+=1){
    const u=longitudinal/longitudinalSegments;
    const radius=bodyRadius(u);
    const x=-2.22+4.86*u;
    const lift=Math.pow(Math.sin(Math.PI*clamp((u-.28)/.68,0,1)),2)*.07;
    for(let radial=0;radial<=radialSegments;radial+=1){
      const v=radial/radialSegments;
      const angle=v*Math.PI*2;
      const pulse=1+.035*Math.sin(angle*3+u*8);
      positions.push(x,Math.cos(angle)*radius*.61*pulse+lift,Math.sin(angle)*radius*.93*pulse);
      uvs.push(u,v);
    }
  }
  const row=radialSegments+1;
  for(let longitudinal=0;longitudinal<longitudinalSegments;longitudinal+=1){
    for(let radial=0;radial<radialSegments;radial+=1){
      const a=longitudinal*row+radial,b=(longitudinal+1)*row+radial,c=b+1,d=a+1;
      indices.push(a,b,d,b,c,d);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return geometry;
}

function createWingSurface(side,longitudinalSegments,spanSegments){
  const positions=[],uvs=[],indices=[];
  for(let longitudinal=0;longitudinal<=longitudinalSegments;longitudinal+=1){
    const u=longitudinal/longitudinalSegments;
    const x=1.22-u*3.18;
    const span=.15+Math.pow(u,.82)*2.12;
    for(let across=0;across<=spanSegments;across+=1){
      const v=across/spanSegments;
      const curl=Math.sin(v*Math.PI)*Math.sin(u*Math.PI)*.045;
      positions.push(x,-.105+curl,side*(.14+span*v));
      uvs.push(u,v);
    }
  }
  const row=spanSegments+1;
  for(let longitudinal=0;longitudinal<longitudinalSegments;longitudinal+=1){
    for(let across=0;across<spanSegments;across+=1){
      const a=longitudinal*row+across,b=(longitudinal+1)*row+across,c=b+1,d=a+1;
      if(side>0)indices.push(a,b,d,b,c,d);else indices.push(a,d,b,b,d,c);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return geometry;
}

function createWakeSurface(lane,longitudinalSegments,radialSegments){
  const positions=[],uvs=[],indices=[];
  const laneOffset=lane-1;
  for(let longitudinal=0;longitudinal<=longitudinalSegments;longitudinal+=1){
    const u=longitudinal/longitudinalSegments;
    const x=-2.08-u*5.25;
    const coilRadius=Math.pow(u,1.55)*.42;
    const phase=u*Math.PI*6.5+lane*Math.PI*.66;
    const centerY=(lane===1?-.1:-.25)+Math.cos(phase)*coilRadius*.58;
    const centerZ=laneOffset*.61+Math.sin(phase)*coilRadius;
    const tubeRadius=.045+u*(.14+lane*.018);
    for(let radial=0;radial<=radialSegments;radial+=1){
      const v=radial/radialSegments;
      const angle=v*Math.PI*2;
      positions.push(x,centerY+Math.cos(angle)*tubeRadius,centerZ+Math.sin(angle)*tubeRadius);
      uvs.push(u,v);
    }
  }
  const row=radialSegments+1;
  for(let longitudinal=0;longitudinal<longitudinalSegments;longitudinal+=1){
    for(let radial=0;radial<radialSegments;radial+=1){
      const a=longitudinal*row+radial,b=(longitudinal+1)*row+radial,c=b+1,d=a+1;
      indices.push(a,b,d,b,c,d);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return geometry;
}

const fluidVertexShader=`
  uniform float uTime;uniform float uEnergy;uniform float uCurvature;uniform float uLayer;uniform float uSurfaceType;
  varying vec2 vUv;varying vec3 vWorldPosition;varying vec3 vLocalPosition;varying vec3 vViewDirection;
  void main(){
    vUv=uv;vec3 transformed=position;float advection=uTime*(.3+uEnergy*1.3);float angular=uv.y*6.2831853;
    float large=sin(position.x*2.15-advection*1.25+sin(angular*2.+uLayer)*1.8);
    float medium=cos(position.x*5.8-advection*2.7-angular*3.+large*1.65+uLayer*2.1);
    float fine=sin(position.x*12.4-advection*5.4+angular*6.+medium*1.9);
    float envelope=smoothstep(0.,.08,uv.x)*smoothstep(1.,.9,uv.x);
    float cascade=large*.52+medium*.31+fine*.17;float amplitude=.009+uCurvature*.023+uEnergy*.046;
    if(uSurfaceType<.5){transformed+=normal*cascade*amplitude*envelope;}
    else if(uSurfaceType<1.5){float edge=smoothstep(.48,1.,uv.y);float shedding=sin(uv.x*20.-advection*4.2+uv.y*8.+medium*2.2);transformed+=normal*(cascade*amplitude*.55+shedding*edge*(.01+uEnergy*.05));}
    else if(uSurfaceType<2.5){float growth=smoothstep(.02,.92,uv.x);float phase=uv.x*(18.+uEnergy*13.)-advection*(4.2+uEnergy*2.4)+uLayer*2.3;float packet=sin(phase+large*2.6)*.62+cos(phase*.47-medium*2.1)*.38;transformed+=normal*(cascade*amplitude*.72+packet*growth*(.01+uEnergy*.05));transformed.y+=sin(phase)*growth*(.006+uEnergy*.035);transformed.z+=cos(phase*.82)*growth*(.007+uEnergy*.04);}
    else{float pulse=sin(angular*4.-advection*2.+medium*2.4);transformed+=normal*pulse*(.006+uCurvature*.014+uEnergy*.022);}
    vec4 world=modelMatrix*vec4(transformed,1.);vLocalPosition=transformed;vWorldPosition=world.xyz;vViewDirection=normalize(cameraPosition-world.xyz);gl_Position=projectionMatrix*viewMatrix*world;
  }
`;

const fluidFragmentShader=`
  uniform float uTime;uniform float uEnergy;uniform float uOpacity;uniform float uCurvature;uniform float uLayer;uniform float uHueShift;uniform float uSurfaceType;
  varying vec2 vUv;varying vec3 vWorldPosition;varying vec3 vLocalPosition;varying vec3 vViewDirection;
  float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
  float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=noise(p)*a;p=p*2.04+vec3(1.7,-2.2,2.8);a*=.5;}return v;}
  vec3 palette(float value){value=fract(value+uHueShift);vec3 deep=vec3(.035,.11,.38),blue=vec3(.08,.4,1.),cyan=vec3(.22,.92,.94),violet=vec3(.62,.2,1.),coral=vec3(1.,.34,.2);if(value<.22)return mix(deep,blue,value/.22);if(value<.46)return mix(blue,cyan,(value-.22)/.24);if(value<.73)return mix(cyan,violet,(value-.46)/.27);return mix(violet,coral,(value-.73)/.27);}
  void main(){
    float advection=uTime*(.26+uEnergy*1.12);vec3 samplePoint=vLocalPosition*vec3(1.65,3.5,3.5)+vec3(-advection*2.3,advection*.35,-advection*.22);
    float warpA=fbm(samplePoint+vec3(uLayer*2.1));float warpB=fbm(samplePoint*1.42+vec3(warpA*3.2,-warpA*2.4,warpA*1.8));float micro=noise(samplePoint*4.6+vec3(-advection*3.2,advection,warpB*5.));
    float ridge=1.-abs(warpB*2.-1.);ridge*=ridge;float contour=pow(max(0.,1.-abs(sin(vUv.x*61.-advection*7.4+vUv.y*11.+warpA*(5.5+uEnergy*7.5)))),8.);
    float density=clamp(warpA*.42+warpB*.28+ridge*.2+contour*.17+micro*.08,0.,1.);vec3 normal=normalize(cross(dFdx(vWorldPosition),dFdy(vWorldPosition)));normal=faceforward(normal,-vViewDirection,normal);
    float fresnel=pow(1.-clamp(abs(dot(normal,normalize(vViewDirection))),0.,1.),2.25);vec3 lightDirection=normalize(vec3(-.32,.72,.62));vec3 halfVector=normalize(lightDirection+normalize(vViewDirection));
    float specular=pow(max(0.,dot(normal,halfVector)),32.)*(.3+density*.7)+pow(max(0.,dot(normal,halfVector)),120.)*ridge;
    vec3 color=palette(clamp(density*.64+fresnel*.16+ridge*.13+uEnergy*.06,0.,1.));vec3 rim=mix(vec3(.12,.62,1.),vec3(.92,.25,1.),clamp(warpB+uEnergy*.22,0.,1.));
    float layerFactor=mix(.74,.43,clamp(uLayer/3.,0.,1.));float alpha=uOpacity*layerFactor*(.1+density*.48+fresnel*.4+contour*.17);alpha*=.72+uCurvature*.34;
    if(uSurfaceType>1.5&&uSurfaceType<2.5)alpha*=smoothstep(0.,.045,vUv.x)*smoothstep(1.,.58,vUv.x);if(uSurfaceType>2.5){alpha*=.38+fresnel*.82;color=mix(vec3(.18,.76,1.),vec3(.58,.36,1.),warpB);}
    vec3 optical=color*(.3+density*.63+fresnel*.5)+rim*fresnel*(.16+uEnergy*.18)+specular*vec3(.82,.97,1.);gl_FragColor=vec4(optical,clamp(alpha,0.,.66));
  }
`;

const tracerVertexShader=`
  uniform float uTime;uniform float uEnergy;uniform float uPixelRatio;attribute vec4 aFlow;varying vec3 vColor;varying float vAlpha;
  float radiusAt(float u){float main=pow(max(0.,sin(3.14159265*u)),.56);float nose=1.-.58*pow(u,4.4);return(.15+.69*main)*nose+.27*pow(1.-u,5.2);}
  void main(){float seed=aFlow.z,zone=aFlow.w;float progress=fract(aFlow.x+uTime*(.024+uEnergy*.078)*(.7+seed*.6));float angle=aFlow.y+sin(progress*18.-uTime*(.45+uEnergy*2.2)+seed*17.)*(.04+uEnergy*.14);vec3 transformed;
    if(zone<.66){float x=mix(2.72,-2.4,progress);float profile=clamp((x+2.22)/4.86,0.,1.);float radius=radiusAt(profile)+.025+seed*.08;transformed=vec3(x,cos(angle)*radius*.64,sin(angle)*radius*.96);}else{float lane=floor(seed*3.);float extent=3.+uEnergy*4.2;float coil=progress*(18.+uEnergy*24.)-uTime*(.7+uEnergy*3.)+lane*2.1;float radius=progress*progress*(.08+uEnergy*.55);transformed=vec3(-2.08-progress*extent,(lane==1.?-.1:-.25)+cos(coil)*radius,(lane-1.)*.61+sin(coil)*radius);}
    vec4 mv=viewMatrix*modelMatrix*vec4(transformed,1.);gl_Position=projectionMatrix*mv;gl_PointSize=(.55+seed*1.05)*uPixelRatio*(8./max(2.,-mv.z));vColor=mix(vec3(.22,.8,1.),vec3(.82,.28,1.),clamp(progress*.55+uEnergy*.35,0.,1.));vAlpha=smoothstep(0.,.06,progress)*smoothstep(1.,.66,progress)*(.08+uEnergy*.28)*(.45+seed*.55);}
`;
const tracerFragmentShader=`varying vec3 vColor;varying float vAlpha;void main(){float r=length(gl_PointCoord-.5);gl_FragColor=vec4(vColor,vAlpha*smoothstep(.5,.08,r));}`;

function createFluidMaterial(layer,hueShift,opacityScale=1,surfaceType=0){
  const material=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uEnergy:{value:0},uOpacity:{value:.88*opacityScale},uCurvature:{value:.72},uLayer:{value:layer},uHueShift:{value:hueShift},uSurfaceType:{value:surfaceType}},vertexShader:fluidVertexShader,fragmentShader:fluidFragmentShader,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.NormalBlending});
  material.forceSinglePass=true;fluidMaterials.push(material);return material;
}

function createTracers(){
  const positions=new Float32Array(tracerCount*3),flow=new Float32Array(tracerCount*4);
  for(let i=0;i<tracerCount;i+=1){flow[i*4]=Math.random();flow[i*4+1]=Math.random()*Math.PI*2;flow[i*4+2]=Math.random();flow[i*4+3]=Math.random();}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));geometry.setAttribute("aFlow",new THREE.BufferAttribute(flow,4));geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(-1.2,0,0),10);
  tracerMaterial=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uEnergy:{value:0},uPixelRatio:{value:renderer.getPixelRatio()}},vertexShader:tracerVertexShader,fragmentShader:tracerFragmentShader,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
  const points=new THREE.Points(geometry,tracerMaterial);points.frustumCulled=false;points.renderOrder=8;return points;
}

function createSkeleton(){
  const group=new THREE.Group();
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-2.05,-.08,0),new THREE.Vector3(-.8,0,0),new THREE.Vector3(.8,.12,0),new THREE.Vector3(2.28,.02,0)]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(curve,120,.012,6,false),new THREE.MeshBasicMaterial({color:0xa6f2ff,transparent:true,opacity:.34,blending:THREE.AdditiveBlending,depthWrite:false})));
  reactor=new THREE.Mesh(new THREE.IcosahedronGeometry(.13,3),new THREE.MeshBasicMaterial({color:0xeaffff,transparent:true,opacity:.84,blending:THREE.AdditiveBlending,depthWrite:false}));reactor.position.set(-.34,0,0);group.add(reactor);
  reactorHalo=new THREE.Mesh(new THREE.TorusGeometry(.38,.012,7,64),new THREE.MeshBasicMaterial({color:0x9a65ff,transparent:true,opacity:.42,blending:THREE.AdditiveBlending,depthWrite:false}));reactorHalo.rotation.y=Math.PI/2;reactorHalo.position.copy(reactor.position);reactorHalo.scale.y=.65;group.add(reactorHalo);
  return group;
}

function createFluidVessel(){
  const group=new THREE.Group();const bodyGeometry=createBodySurface(lowPower?74:112,lowPower?34:54);const bodyLayers=lowPower?2:3;
  innerHull=new THREE.Mesh(bodyGeometry,new THREE.MeshStandardMaterial({color:0x203a5c,emissive:0x081c37,emissiveIntensity:.72,roughness:.28,metalness:.62,transparent:true,opacity:.68,side:THREE.DoubleSide,depthWrite:true}));innerHull.scale.set(.975,.94,.94);innerHull.renderOrder=1;group.add(innerHull);
  for(let layer=0;layer<bodyLayers;layer+=1){const mesh=new THREE.Mesh(bodyGeometry,createFluidMaterial(layer,layer*.075,1-layer*.16,0));const expand=1+layer*.044;mesh.scale.set(1+layer*.012,expand,expand);mesh.renderOrder=3+layer;group.add(mesh);}
  [1,-1].forEach((side,index)=>{const wingGeometry=createWingSurface(side,lowPower?50:78,lowPower?14:24);const wingCore=new THREE.Mesh(wingGeometry,new THREE.MeshStandardMaterial({color:side>0?0x183655:0x282153,emissive:side>0?0x081d39:0x160d36,emissiveIntensity:.6,roughness:.34,metalness:.54,transparent:true,opacity:.46,side:THREE.DoubleSide,depthWrite:true}));wingCore.position.y=-.008;wingCore.renderOrder=1;group.add(wingCore);const wing=new THREE.Mesh(wingGeometry,createFluidMaterial(1.4+index*.12,side>0?.06:.16,.78,1));wing.renderOrder=5;group.add(wing);});
  for(let lane=0;lane<3;lane+=1){const wake=new THREE.Mesh(createWakeSurface(lane,lowPower?72:112,lowPower?8:12),createFluidMaterial(2.3+lane*.22,.12+lane*.06,.62,2));wake.userData.phase=lane*2.1;wake.renderOrder=2;wakeMeshes.push(wake);group.add(wake);}
  bowShock=new THREE.Mesh(new THREE.SphereGeometry(1,lowPower?30:52,lowPower?16:28),createFluidMaterial(3.45,.055,.3,3));bowShock.scale.set(.16,.8,1.02);bowShock.position.set(2.63,.015,0);bowShock.renderOrder=7;group.add(bowShock);
  group.add(createSkeleton());group.add(createTracers());group.position.copy(flightAnchor);group.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),flightDirection);group.rotateX(-.08);group.scale.setScalar(.62);return group;
}

const skyVertexShader=`varying vec2 vUv;varying vec3 vDirection;void main(){vUv=uv;vDirection=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const skyFragmentShader=`
  uniform sampler2D uMap;varying vec2 vUv;varying vec3 vDirection;
  float hash(vec3 p){p=fract(p*.3183099+vec3(.17,.31,.47));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
  float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=noise(p)*a;p=p*2.03+vec3(1.7,-2.2,2.9);a*=.5;}return v;}
  void main(){vec3 d=normalize(vDirection);vec3 photo=texture2D(uMap,vUv).rgb*.55;float cloud=fbm(d*3.9+vec3(1.2,-2.4,2.8));float filament=1.-abs(fbm(d*9.2+cloud*2.5)*2.-1.);filament*=filament;vec3 polar=mix(vec3(.004,.008,.022),vec3(.035,.1,.24),cloud)+filament*vec3(.035,.05,.1);float cap=smoothstep(.76,.97,abs(d.y));gl_FragColor=vec4(mix(photo,polar,cap),1.);}`;

const blackHoleVertexShader=`uniform float uTime;varying vec3 vLocal;void main(){vLocal=position;float r=length(position.xy),a=atan(position.y,position.x);vec3 transformed=position;transformed.z+=sin(a*5.-uTime*.32+r*2.2)*.014;gl_Position=projectionMatrix*modelViewMatrix*vec4(transformed,1.);}`;
const blackHoleFragmentShader=`
  uniform float uTime;uniform float uEnergy;varying vec3 vLocal;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=noise(p)*a;p=p*2.04+vec2(1.8,-2.4);a*=.5;}return v;}
  void main(){float r=length(vLocal.xy),radial=clamp((r-1.72)/4.08,0.,1.),angle=atan(vLocal.y,vLocal.x),orbit=uTime*(1./pow(r,.58));vec2 domain=vec2(angle*2.1-orbit,radial*13.);float large=fbm(domain),curl=fbm(domain*1.8+vec2(large*3.,-large*2.2));float filament=pow(1.-abs(curl*2.-1.),3.4);float rings=pow(.5+.5*sin(r*22.-uTime*.4+large*6.),3.);float edge=smoothstep(1.72,1.92,r)*(1.-smoothstep(5.05,5.8,r));float density=(.1+large*.3+filament*.55+rings*.14)*edge;float heat=pow(1.-radial,.72);vec3 color=mix(vec3(.18,.012,.003),vec3(1.,.18,.02),smoothstep(.05,.43,heat));color=mix(color,vec3(1.,.68,.26),smoothstep(.35,.7,heat));color=mix(color,vec3(.68,.88,1.),smoothstep(.78,1.,heat));float side=.5+.5*cos(angle-.3);color*=mix(vec3(1.1,.43,.13),vec3(.5,.82,1.3),side)*(.72+filament*.65);gl_FragColor=vec4(color,clamp(density*(.32+heat*.58)*uEnergy,0.,.82));}`;

const photonVertexShader=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const photonFragmentShader=`uniform float uTime;uniform float uEnergy;varying vec2 vUv;void main(){vec2 p=(vUv-.5)*2.;float r=length(p),a=atan(p.y,p.x);float ring=exp(-pow((r-.686)/.012,2.))+exp(-pow((r-.714)/.008,2.))*.34+exp(-pow((r-.76)/.045,2.))*.09;float pulse=.82+.18*sin(a*17.-uTime*.8);float side=.5+.5*cos(a-.25);vec3 color=mix(vec3(1.,.29,.04),vec3(.55,.84,1.),side);gl_FragColor=vec4(color,ring*pulse*uEnergy);}`;

const postVertexShader=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.);}`;
const lensFragmentShader=`
  uniform sampler2D uScene;uniform vec2 uCenter;uniform float uAspect;uniform float uStrength;uniform float uRadius;uniform float uTime;varying vec2 vUv;
  void main(){
    vec2 p=vUv-uCenter;vec2 metric=vec2(p.x*uAspect,p.y);float radius=length(metric);vec2 direction=radius>.0001?normalize(metric):vec2(0.);float angle=atan(metric.y,metric.x);
    float field=1.-smoothstep(uRadius*.58,uRadius*2.65,radius);float guard=smoothstep(uRadius*.34,uRadius*.68,radius);float bend=uStrength*field*guard*(.021/(radius+.045));
    vec2 tangent=vec2(-direction.y,direction.x);float shear=sin(angle*3.+uTime*.035)*field*uStrength*.0021;vec2 offset=vec2((direction.x*bend+tangent.x*shear)/uAspect,direction.y*bend+tangent.y*shear);
    float chroma=.0019*field*uStrength;vec3 color;color.r=texture2D(uScene,vUv+offset*(1.+chroma*7.)).r;color.g=texture2D(uScene,vUv+offset).g;color.b=texture2D(uScene,vUv+offset*(1.-chroma*8.)).b;
    float critical=uRadius*.82;float mirrorWeight=exp(-pow((radius-critical)/(uRadius*.09),2.))*field*uStrength;vec2 mirroredMetric=-direction*(critical+(radius-critical)*.2);vec2 mirroredUv=uCenter+vec2(mirroredMetric.x/uAspect,mirroredMetric.y);color=mix(color,texture2D(uScene,mirroredUv).rgb,mirrorWeight*.2);
    float caustic=exp(-pow((radius-uRadius*.76)/(uRadius*.075),2.))*field;color+=caustic*mix(vec3(.06,.025,.012),vec3(.022,.062,.115),.5+.5*cos(angle))*uStrength;
    gl_FragColor=vec4(color,1.);
  }
`;

function createSky(){
  const fallbackTexture=new THREE.DataTexture(new Uint8Array([2,4,10,255]),1,1,THREE.RGBAFormat);fallbackTexture.needsUpdate=true;
  const material=new THREE.ShaderMaterial({uniforms:{uMap:{value:fallbackTexture}},vertexShader:skyVertexShader,fragmentShader:skyFragmentShader,side:THREE.BackSide,depthWrite:false});
  const sky=new THREE.Mesh(new THREE.SphereGeometry(480,lowPower?44:64,lowPower?28:42),material);sky.rotation.y=1.25;sky.userData.sky=true;backgroundScene.add(sky);
  const url=new URL("../cosmic-background-lab/assets/nebula-panorama-v1.png",import.meta.url).href;
  new THREE.TextureLoader().load(url,(texture)=>{texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;material.uniforms.uMap.value=texture;});
}

function createBlackHole(){
  blackHoleRoot=new THREE.Group();blackHoleRoot.position.set(6.2,2.2,-14.5);blackHoleRoot.scale.setScalar(1.5);objectScene.add(blackHoleRoot);
  const diskGroup=new THREE.Group();diskGroup.rotation.x=1.12;diskGroup.rotation.z=-.12;blackHoleRoot.add(diskGroup);
  const diskMaterial=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uEnergy:{value:.52}},vertexShader:blackHoleVertexShader,fragmentShader:blackHoleFragmentShader,transparent:true,depthWrite:false,side:THREE.DoubleSide});blackHoleMaterials.push(diskMaterial);
  blackHoleDisk=new THREE.Mesh(new THREE.RingGeometry(1.72,5.8,lowPower?120:196,lowPower?38:64),diskMaterial);blackHoleDisk.renderOrder=1;diskGroup.add(blackHoleDisk);
  const horizon=new THREE.Mesh(new THREE.SphereGeometry(1.55,lowPower?46:72,lowPower?30:48),new THREE.MeshBasicMaterial({color:0x000000}));horizon.renderOrder=4;blackHoleRoot.add(horizon);
  const photonMaterial=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uEnergy:{value:.62}},vertexShader:photonVertexShader,fragmentShader:photonFragmentShader,transparent:true,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending});blackHoleMaterials.push(photonMaterial);
  photonPlane=new THREE.Mesh(new THREE.PlaneGeometry(4.65,4.65),photonMaterial);photonPlane.renderOrder=6;blackHoleRoot.add(photonPlane);
}

function createRenderTarget(){
  const ratio=renderer.getPixelRatio();
  const scale=lowPower?.68:.82;
  backgroundTarget?.dispose();
  backgroundTarget=new THREE.WebGLRenderTarget(Math.max(1,Math.floor(window.innerWidth*ratio*scale)),Math.max(1,Math.floor(window.innerHeight*ratio*scale)),{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat,depthBuffer:true});
  backgroundTarget.texture.colorSpace=THREE.SRGBColorSpace;
  if(lensMaterial)lensMaterial.uniforms.uScene.value=backgroundTarget.texture;
}

function createPostProcess(){
  postScene=new THREE.Scene();postCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  lensMaterial=new THREE.ShaderMaterial({uniforms:{uScene:{value:backgroundTarget.texture},uCenter:{value:new THREE.Vector2(.68,.34)},uAspect:{value:window.innerWidth/window.innerHeight},uStrength:{value:.7},uRadius:{value:.18},uTime:{value:0}},vertexShader:postVertexShader,fragmentShader:lensFragmentShader,depthTest:false,depthWrite:false});
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),lensMaterial));
}

function setupRenderer(){
  renderer=new THREE.WebGLRenderer({canvas:stage,antialias:!lowPower,alpha:false,powerPreference:"high-performance"});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,lowPower?1:1.18));renderer.setSize(window.innerWidth,window.innerHeight,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;renderer.autoClear=false;
}

function setupControls(){
  controls=new OrbitControls(camera,stage);controls.target.copy(defaultTarget);controls.enableDamping=true;controls.dampingFactor=.055;controls.enablePan=false;controls.zoomSpeed=.45;controls.rotateSpeed=.36;controls.minDistance=8.7;controls.maxDistance=14.2;controls.minPolarAngle=.2;controls.maxPolarAngle=Math.PI-.2;
  controls.addEventListener("start",()=>{lastInteraction=performance.now();resetActive=false;});controls.addEventListener("end",()=>{lastInteraction=performance.now();});controls.update();
}

function resetSignal(signal,initial=false){
  const lanes=[{x:410,y:-180},{x:500,y:145},{x:315,y:35}];
  const lane=lanes[signal.index%lanes.length];
  signal.x=lane.x+(Math.random()-.5)*70;
  signal.y=lane.y+(Math.random()-.5)*54;
  signal.z=initial?430+signal.index*255+Math.random()*80:1180+Math.random()*150;
  signal.velocity=.34+Math.random()*.15;
}

function createSignals(){
  document.querySelectorAll(".signal").forEach((element,index)=>{
    const signal={element,index,paused:false};
    element.addEventListener("pointerenter",()=>{signal.paused=true;});
    element.addEventListener("pointerleave",()=>{signal.paused=false;});
    element.addEventListener("focus",()=>{signal.paused=true;});
    element.addEventListener("blur",()=>{signal.paused=false;});
    signalObjects.push(signal);resetSignal(signal,true);
  });
}

function updateSignals(delta){
  const centerX=viewportWidth*.5,centerY=viewportHeight*.52,focal=Math.min(viewportWidth,viewportHeight)*.74;
  signalObjects.forEach((signal)=>{
    if(!signal.paused&&!reducedMotion)signal.z-=signal.velocity*delta;
    if(signal.z<215)resetSignal(signal);
    const x=centerX+signal.x/signal.z*focal;
    const y=centerY+signal.y/signal.z*focal;
    const fade=clamp((1180-signal.z)/360,0,1)*clamp((signal.z-215)/170,0,1);
    const inside=x>viewportWidth*.48&&x<viewportWidth-175&&y>85&&y<viewportHeight-135;
    const opacity=inside?fade*.74:0;
    const scale=clamp(.58+(1180-signal.z)/1650,.58,1.04);
    signal.element.style.transform=`translate3d(${x}px,${y}px,0) scale(${scale})`;
    signal.element.style.opacity=opacity.toFixed(3);
    signal.element.tabIndex=opacity>.25?0:-1;
  });
}

function showToast(message){window.clearTimeout(toastTimer);toast.textContent=message;toast.classList.add("is-visible");toastTimer=window.setTimeout(()=>toast.classList.remove("is-visible"),1900);}

function runSearchWarp(query){
  jumpTimers.forEach((timer)=>window.clearTimeout(timer));jumpTimers=[];routePanel.hidden=true;home.classList.add("is-jumping");warpTarget=1;
  jumpTimers.push(window.setTimeout(()=>{warpTarget=.92;},880));
  jumpTimers.push(window.setTimeout(()=>{warpTarget=.3;},1360));
  jumpTimers.push(window.setTimeout(()=>{warpTarget=0;},1740));
  jumpTimers.push(window.setTimeout(()=>{home.classList.remove("is-jumping");resolvedQuery.textContent=query;routePanel.hidden=false;},2300));
}

function bindInterface(){
  searchForm.addEventListener("submit",(event)=>{event.preventDefault();const query=searchInput.value.trim();if(!query){searchInput.focus();showToast("请输入要探索的问题或知识点");return;}runSearchWarp(query);});
  document.querySelectorAll("[data-query]").forEach((button)=>button.addEventListener("click",()=>{searchInput.value=button.dataset.query;runSearchWarp(button.dataset.query);}));
  document.querySelector("[data-close-panel]").addEventListener("click",()=>{routePanel.hidden=true;});
  document.querySelectorAll("[data-system]").forEach((button)=>button.addEventListener("click",()=>showToast(`${button.querySelector("b").textContent}系统将在下一阶段接入`)));
  document.querySelectorAll("[data-action]").forEach((button)=>button.addEventListener("click",()=>showToast(button.dataset.action==="mission"?"学习计划面板将在下一阶段接入":"探索者档案将在下一阶段接入")));
  document.addEventListener("keydown",(event)=>{if(event.key==="/"&&document.activeElement!==searchInput){event.preventDefault();searchInput.focus();}if(event.key==="Escape"){routePanel.hidden=true;searchInput.blur();}});
  window.addEventListener("resize",resize);
}

function resize(){const width=window.innerWidth,height=window.innerHeight;viewportWidth=width;viewportHeight=height;camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,lowPower?1:1.18));renderer.setSize(width,height,false);tracerMaterial.uniforms.uPixelRatio.value=renderer.getPixelRatio();createRenderTarget();lensMaterial.uniforms.uAspect.value=width/height;flightParticleField?.resize(width,height,renderer.getPixelRatio());flightParticleField?.synchronizeCamera();}

function updateClock(){const now=new Date();dockTime.textContent=`${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;}

function updateLensingCenter(time){
  blackHoleRoot.getWorldPosition(blackHoleWorldPosition);
  const projected=blackHoleWorldPosition.clone().project(camera);
  lensMaterial.uniforms.uCenter.value.set(projected.x*.5+.5,projected.y*.5+.5);
  const distance=camera.position.distanceTo(blackHoleWorldPosition);
  lensMaterial.uniforms.uRadius.value=clamp(.235*(25/distance),.14,.255);
  lensMaterial.uniforms.uStrength.value=.72+warpEnergy*.2;
  lensMaterial.uniforms.uTime.value=time;
}

function renderFrame(){
  renderer.setRenderTarget(backgroundTarget);renderer.clear(true,true,true);renderer.render(backgroundScene,camera);
  renderer.setRenderTarget(null);renderer.clear(true,true,true);renderer.render(postScene,postCamera);
  renderer.clearDepth();renderer.render(objectScene,camera);
}

function animate(now){
  const deltaSeconds=clamp((now-lastTime)/1000,0,.05),deltaFrames=deltaSeconds*60;lastTime=now;warpEnergy+=(warpTarget-warpEnergy)*(1-Math.pow(warpTarget>warpEnergy?.012:.035,deltaSeconds));if(warpEnergy<.001&&warpTarget===0)warpEnergy=0;const time=reducedMotion?0:now/1000;
  const desiredFov=50+Math.pow(warpEnergy,.78)*7.5;camera.fov+=(desiredFov-camera.fov)*(1-Math.pow(.018,deltaSeconds));camera.updateProjectionMatrix();renderer.toneMappingExposure=1.02-warpEnergy*.1;
  const vesselEnergy=.14+warpEnergy*.86;
  fluidMaterials.forEach((material)=>{material.uniforms.uTime.value=time;material.uniforms.uEnergy.value=vesselEnergy;});tracerMaterial.uniforms.uTime.value=time;tracerMaterial.uniforms.uEnergy.value=vesselEnergy;
  blackHoleMaterials.forEach((material,index)=>{material.uniforms.uTime.value=time;material.uniforms.uEnergy.value=(index===0?.48:.6)+warpEnergy*(index===0?.24:.18);});
  if(!reducedMotion){reactor.rotation.x=time*(.42+vesselEnergy*.8);reactor.rotation.y=time*(.28+vesselEnergy*.64);reactor.scale.setScalar(1+Math.sin(time*(2.1+vesselEnergy*2.8))*(.05+vesselEnergy*.08));reactorHalo.rotation.x=time*(.16+vesselEnergy*.36);wakeMeshes.forEach((wake,index)=>{const wakeStretch=1+vesselEnergy*.18;wake.scale.x=wakeStretch;wake.position.x=2.08*(wakeStretch-1);wake.rotation.x=Math.sin(time*(.18+vesselEnergy*.34)+wake.userData.phase)*(.02+vesselEnergy*.06);wake.position.y=Math.sin(time*.42+index*1.8)*(.012+vesselEnergy*.018);});const pulse=1+Math.sin(time*(1.4+vesselEnergy*1.8))*(.025+vesselEnergy*.045);bowShock.scale.set(.16*pulse,.8*pulse,1.02*pulse);innerHull.material.emissiveIntensity=.62+vesselEnergy*.46;vessel.position.y=-.83+Math.sin(time*.4)*.014;blackHoleDisk.rotation.z=time*.003;}
  if(!resetActive&&performance.now()-lastInteraction>12000)resetActive=true;if(resetActive){const response=1-Math.pow(.04,deltaSeconds);camera.position.lerp(defaultCameraPosition,response);controls.target.lerp(defaultTarget,response);if(camera.position.distanceTo(defaultCameraPosition)<.02)resetActive=false;}
  controls.update(deltaSeconds);photonPlane.quaternion.copy(camera.quaternion);flightParticleField.update({delta:deltaSeconds,time,energy:warpEnergy});updateLensingCenter(time);updateSignals(deltaFrames);renderFrame();
}

function initialize(){
  try{setupRenderer();backgroundScene=new THREE.Scene();backgroundScene.background=new THREE.Color(0x010207);objectScene=new THREE.Scene();camera=new THREE.PerspectiveCamera(50,window.innerWidth/window.innerHeight,.06,900);camera.position.copy(defaultCameraPosition);createRenderTarget();createSky();createPostProcess();createBlackHole();vessel=createFluidVessel();objectScene.add(vessel);objectScene.add(new THREE.HemisphereLight(0x92baff,0x03050a,.8));const keyLight=new THREE.DirectionalLight(0xd9efff,2.2);keyLight.position.set(-4,7,10);objectScene.add(keyLight);const violetLight=new THREE.DirectionalLight(0x765dff,.9);violetLight.position.set(6,-2,-8);objectScene.add(violetLight);setupControls();flightParticleField=createFlightParticleField({camera,lowPower,reducedMotion,direction:flightDirection,anchor:flightAnchor});objectScene.add(flightParticleField.mesh);flightParticleField.resize(window.innerWidth,window.innerHeight,renderer.getPixelRatio());createSignals();bindInterface();updateClock();window.setInterval(updateClock,30000);renderer.setAnimationLoop(animate);home.classList.add("is-ready");}
  catch(error){console.error("Integrated expedition home failed to initialize",error);fallback.hidden=false;stage.hidden=true;}
}

initialize();
