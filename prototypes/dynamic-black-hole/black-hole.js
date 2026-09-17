import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const stage=document.querySelector("#black-hole-stage");
const lab=document.querySelector("#black-hole-lab");
const fallback=document.querySelector("#webgl-fallback");
const renderState=document.querySelector("#render-state");
const energyInput=document.querySelector("#accretion-energy");
const energyValue=document.querySelector("#energy-value");
const lensingInput=document.querySelector("#lensing-strength");
const lensingValue=document.querySelector("#lensing-value");
const resetButton=document.querySelector("#reset-view");
const tourButton=document.querySelector("#auto-tour");
const bearingValue=document.querySelector("#bearing-value");

const reducedMotion=window.matchMedia("(prefers-reduced-motion:reduce)").matches;
const coarsePointer=window.matchMedia("(pointer:coarse)").matches;
const lowPower=coarsePointer||(navigator.hardwareConcurrency||8)<=4;
const starCount=lowPower?7000:15000;
const particleCount=lowPower?900:2600;
const jetCount=lowPower?180:520;
const defaultCameraPosition=new THREE.Vector3(0,1.55,12.6);
const defaultTarget=new THREE.Vector3(0,0,0);

let renderer;
let camera;
let controls;
let backgroundScene;
let objectScene;
let postScene;
let postCamera;
let backgroundTarget;
let skySphere;
let starMaterial;
let diskMaterial;
let diskGlowMaterial;
let coronaMaterial;
let particleMaterial;
let photonMaterial;
let haloMaterial;
let jetMaterial;
let lensMaterial;
let photonPlane;
let haloPlane;
let diskGroup;
let tourActive=false;
let resettingView=false;
let lastInteraction=performance.now();
let lastTime=performance.now();
let visualMode="cinematic";
let frameSamples=0;
let sampleStart=performance.now();
let adaptiveScale=lowPower?.68:.86;
let adaptivePixelRatio=Math.min(window.devicePixelRatio||1,lowPower?1:1.25);
const localCameraPosition=new THREE.Vector3();

let randomState=0x8f3a2c19;
function random(){
  randomState^=randomState<<13;
  randomState^=randomState>>>17;
  randomState^=randomState<<5;
  return (randomState>>>0)/4294967296;
}
function clamp(value,minimum,maximum){return Math.min(maximum,Math.max(minimum,value));}
function randomDirection(){
  const z=random()*2-1;
  const angle=random()*Math.PI*2;
  const radial=Math.sqrt(Math.max(0,1-z*z));
  return new THREE.Vector3(Math.cos(angle)*radial,z,Math.sin(angle)*radial);
}

const skyVertexShader=`
  varying vec2 vUv;
  varying vec3 vDirection;
  void main(){
    vUv=uv;
    vDirection=normalize(position);
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
  }
`;

const skyFragmentShader=`
  uniform sampler2D uMap;
  varying vec2 vUv;
  varying vec3 vDirection;
  float hash(vec3 p){p=fract(p*.3183099+vec3(.17,.31,.47));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
  float noise(vec3 p){
    vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=noise(p)*a;p=p*2.03+vec3(1.7,-2.2,2.9);a*=.5;}return v;}
  void main(){
    vec3 d=normalize(vDirection);
    vec3 photo=texture2D(uMap,vUv).rgb*.68;
    float cloud=fbm(d*3.9+vec3(1.2,-2.4,2.8));
    float filament=1.-abs(fbm(d*9.2+cloud*2.5)*2.-1.);
    filament*=filament;
    vec3 polar=mix(vec3(.005,.009,.025),vec3(.045,.12,.28),cloud)+filament*vec3(.045,.065,.12);
    float cap=smoothstep(.76,.97,abs(d.y));
    gl_FragColor=vec4(mix(photo,polar,cap),1.);
  }
`;

const starVertexShader=`
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uOpacity;
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  void main(){
    vec4 mv=modelViewMatrix*vec4(position,1.);
    gl_Position=projectionMatrix*mv;
    float pulse=.96+sin(uTime*(.18+aPhase*.22)+aPhase*19.)*.04;
    gl_PointSize=aSize*uPixelRatio*pulse;
    vColor=aColor;
    vAlpha=uOpacity*pulse;
  }
`;

const starFragmentShader=`
  varying vec3 vColor;
  varying float vAlpha;
  void main(){
    vec2 p=gl_PointCoord-.5;
    float r=length(p);
    float core=smoothstep(.2,0.,r);
    float halo=smoothstep(.5,.05,r)*.24;
    float rays=(exp(-abs(p.x)*52.)+exp(-abs(p.y)*52.))*smoothstep(.48,.04,r)*.15;
    gl_FragColor=vec4(vColor*(.7+core*.9),(core+halo+rays)*vAlpha);
  }
`;

const diskVertexShader=`
  uniform float uTime;
  uniform float uLayer;
  varying vec3 vLocal;
  varying vec3 vWorldPosition;
  varying float vWarp;
  void main(){
    float radius=length(position.xy);
    float angle=atan(position.y,position.x);
    vec3 transformed=position;
    float broad=sin(angle*3.-uTime*.16+radius*.72)*(.018+.032*smoothstep(1.7,5.8,radius));
    float shear=sin(angle*9.+uTime*.27-radius*3.4)*(.008+.013*uLayer);
    float ripple=sin(angle*19.-uTime*.46+radius*7.2)*.0045;
    vWarp=broad+shear+ripple;
    transformed.z+=vWarp+uLayer*(.016+.018*sin(angle*4.+radius));
    vLocal=transformed;
    vec4 world=modelMatrix*vec4(transformed,1.);
    vWorldPosition=world.xyz;
    gl_Position=projectionMatrix*viewMatrix*world;
  }
`;

const diskFragmentShader=`
  uniform float uTime;
  uniform float uEnergy;
  uniform float uPhysical;
  uniform float uLayer;
  uniform vec3 uCameraLocal;
  varying vec3 vLocal;
  varying vec3 vWorldPosition;
  varying float vWarp;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){
    vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(.82,-.57,.57,.82);for(int i=0;i<6;i++){v+=noise(p)*a;p=m*p*2.04+vec2(1.8,-2.4);a*=.5;}return v;}
  void main(){
    float radius=length(vLocal.xy);
    float radial=clamp((radius-1.72)/4.08,0.,1.);
    float angle=atan(vLocal.y,vLocal.x);
    float orbit=uTime*(1.1/pow(radius,.58));
    vec2 domain=vec2(angle*2.15-orbit+uLayer*.73,radial*13.5-uLayer*1.7);
    float large=fbm(domain);
    float curl=fbm(domain*1.78+vec2(large*3.1,-large*2.2));
    float micro=fbm(domain*3.65+vec2(curl*4.2,large*2.7));
    float filament=1.-abs(curl*2.-1.);
    filament=pow(filament,3.7);
    float hairline=pow(1.-abs(micro*2.-1.),5.2);
    float rings=pow(.5+.5*sin(radius*24.-uTime*.44+large*6.4),4.2);
    float spiral=pow(.5+.5*sin(angle*3.8-log(radius)*17.-uTime*.31+curl*3.2),5.);
    float broken=.55+.45*smoothstep(.28,.79,fbm(vec2(angle*5.2+uTime*.08,radial*6.)));
    float dustLane=smoothstep(.48,.67,fbm(domain*.86+vec2(8.3,-4.7)));
    float innerEdge=smoothstep(1.72,1.91,radius);
    float outerEdge=1.-smoothstep(5.05,5.8,radius);
    float density=(.12+large*.28+filament*.5+hairline*.32+rings*.16+spiral*.15)*broken*innerEdge*outerEdge;
    density*=mix(.7,1.08,dustLane);
    float heat=pow(1.-radial,.72);
    vec3 ember=vec3(.17,.012,.003);
    vec3 orange=vec3(1.0,.19,.025);
    vec3 gold=vec3(1.0,.65,.22);
    vec3 white=vec3(1.0,.96,.78);
    vec3 blue=vec3(.52,.82,1.0);
    vec3 color=mix(ember,orange,smoothstep(.02,.43,heat));
    color=mix(color,gold,smoothstep(.34,.68,heat));
    color=mix(color,white,smoothstep(.64,.88,heat));
    color=mix(color,blue,smoothstep(.89,1.,heat)*.78);
    vec3 orbitalVelocity=normalize(vec3(-sin(angle),cos(angle),0.));
    vec3 viewDirection=normalize(uCameraLocal-vLocal);
    float velocity=dot(orbitalVelocity,viewDirection);
    float approaching=.5+.5*velocity;
    vec3 doppler=mix(vec3(1.12,.38,.1),vec3(.45,.77,1.32),approaching);
    color*=mix(vec3(1.),doppler,.3+.29*uPhysical);
    float boost=mix(.62,1.55,approaching);
    float layerFade=mix(1.,mix(.36,.13,clamp(uLayer-1.,0.,1.)),step(.5,uLayer));
    float alpha=density*(.4+heat*.6)*uEnergy*mix(1.,boost,.48+.31*uPhysical)*layerFade;
    color*=.57+filament*.61+hairline*.34+rings*.13;
    color+=abs(vWarp)*vec3(.15,.24,.35)*heat;
    gl_FragColor=vec4(color,clamp(alpha,0.,.98));
  }
`;

const particleVertexShader=`
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uEnergy;
  attribute float aRadius;
  attribute float aAngle;
  attribute float aPhase;
  attribute float aSize;
  varying float vHeat;
  varying float vAlpha;
  void main(){
    float speed=1.2/pow(aRadius,.62);
    float angle=aAngle+uTime*speed;
    float flicker=.72+.28*sin(uTime*(.6+aPhase)+aPhase*31.);
    vec3 transformed=vec3(cos(angle)*aRadius,sin(angle)*aRadius,position.z+sin(angle*7.+aPhase*19.)*.025);
    vec4 mv=modelViewMatrix*vec4(transformed,1.);
    gl_Position=projectionMatrix*mv;
    gl_PointSize=aSize*uPixelRatio*(12./max(3.,-mv.z));
    vHeat=1.-clamp((aRadius-1.7)/4.1,0.,1.);
    vAlpha=uEnergy*flicker;
  }
`;

const particleFragmentShader=`
  varying float vHeat;
  varying float vAlpha;
  void main(){
    float r=length(gl_PointCoord-.5);
    float alpha=smoothstep(.5,.05,r)*vAlpha;
    vec3 color=mix(vec3(1.,.18,.025),vec3(.72,.89,1.),smoothstep(.58,1.,vHeat));
    color=mix(color,vec3(1.,.76,.32),smoothstep(.2,.72,vHeat));
    gl_FragColor=vec4(color,alpha);
  }
`;

const photonVertexShader=`
  varying vec2 vUv;
  void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
`;

const photonFragmentShader=`
  uniform float uTime;
  uniform float uEnergy;
  uniform float uQuiet;
  varying vec2 vUv;
  float hash(float n){return fract(sin(n)*43758.5453);}
  void main(){
    vec2 p=(vUv-.5)*2.;
    float radius=length(p);
    float angle=atan(p.y,p.x);
    float primary=exp(-pow((radius-.686)/.009,2.));
    float subringA=exp(-pow((radius-.704)/.005,2.))*.48;
    float subringB=exp(-pow((radius-.718)/.004,2.))*.27;
    float subringC=exp(-pow((radius-.73)/.0035,2.))*.14;
    float secondary=exp(-pow((radius-.746)/.025,2.))*.16;
    float echo=exp(-pow((radius-.798)/.07,2.))*.058;
    float granule=hash(floor((angle+3.14159)*42.));
    float pulse=.78+.22*sin(angle*17.-uTime*.92+granule*3.1);
    pulse*=.84+.16*sin(angle*53.+uTime*.31);
    float side=.5+.5*cos(angle-.22);
    vec3 amber=vec3(1.,.37,.055);
    vec3 white=vec3(1.,.96,.8);
    vec3 blue=vec3(.42,.78,1.);
    vec3 color=mix(amber,white,smoothstep(.15,.58,side));
    color=mix(color,blue,smoothstep(.68,1.,side));
    float alpha=(primary+subringA+subringB+subringC+secondary+echo)*pulse*uEnergy*(1.-uQuiet*.45);
    gl_FragColor=vec4(color,alpha);
  }
`;

const haloFragmentShader=`
  uniform float uTime;
  uniform float uEnergy;
  uniform float uQuiet;
  varying vec2 vUv;
  void main(){
    vec2 p=(vUv-.5)*2.;
    float radius=length(p);
    float angle=atan(p.y,p.x);
    float topCurve=.625-.38*p.x*p.x;
    float bottomCurve=-.63+.4*p.x*p.x;
    float topArc=exp(-pow((p.y-topCurve)/.025,2.))*(1.-smoothstep(.68,.98,abs(p.x)));
    float bottomArc=exp(-pow((p.y-bottomCurve)/.032,2.))*(1.-smoothstep(.66,.96,abs(p.x)))*.42;
    float upper=exp(-pow((radius-.765)/.036,2.))*smoothstep(-.1,.25,p.y)*.38+topArc;
    float lower=exp(-pow((radius-.79)/.052,2.))*smoothstep(.08,-.34,p.y)*.2+bottomArc;
    float streak=.53+.47*sin(angle*37.-uTime*.92+sin(angle*9.)*2.4+p.x*19.);
    streak=pow(max(streak,0.),2.);
    float side=.5+.5*cos(angle-.25);
    vec3 color=mix(vec3(1.,.2,.035),vec3(.62,.88,1.),smoothstep(.58,1.,side));
    color=mix(color,vec3(1.,.8,.43),.42);
    float fine=.74+.26*sin(p.x*96.+uTime*.23);
    float alpha=(upper+lower)*(.2+streak*.8)*fine*uEnergy*(1.-uQuiet*.55);
    gl_FragColor=vec4(color,alpha);
  }
`;

const jetVertexShader=`
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aPhase;
  attribute float aSize;
  varying float vAlpha;
  void main(){
    vec3 transformed=position;
    float distanceFromCore=abs(position.z);
    transformed.x+=sin(uTime*.34+aPhase*19.+distanceFromCore*.7)*(.015+distanceFromCore*.014);
    transformed.y+=cos(uTime*.27+aPhase*23.+distanceFromCore*.55)*(.015+distanceFromCore*.012);
    vec4 mv=modelViewMatrix*vec4(transformed,1.);
    gl_Position=projectionMatrix*mv;
    gl_PointSize=aSize*uPixelRatio*(11./max(3.,-mv.z));
    vAlpha=(1.-smoothstep(1.2,8.8,distanceFromCore))*(.35+.65*aPhase);
  }
`;

const jetFragmentShader=`
  uniform float uEnergy;
  uniform float uQuiet;
  varying float vAlpha;
  void main(){
    float r=length(gl_PointCoord-.5);
    float alpha=smoothstep(.5,.05,r)*vAlpha*uEnergy*(1.-uQuiet*.75)*.32;
    gl_FragColor=vec4(vec3(.38,.68,1.),alpha);
  }
`;

const postVertexShader=`
  varying vec2 vUv;
  void main(){vUv=uv;gl_Position=vec4(position,1.);}
`;

const lensFragmentShader=`
  uniform sampler2D uScene;
  uniform vec2 uCenter;
  uniform float uAspect;
  uniform float uStrength;
  uniform float uRadius;
  uniform float uTime;
  varying vec2 vUv;
  void main(){
    vec2 p=vUv-uCenter;
    vec2 metric=vec2(p.x*uAspect,p.y);
    float radius=length(metric);
    vec2 direction=radius>.0001?normalize(metric):vec2(0.);
    float field=1.-smoothstep(uRadius*.62,uRadius*2.35,radius);
    float horizonGuard=smoothstep(uRadius*.43,uRadius*.72,radius);
    float angle=atan(metric.y,metric.x);
    float bend=uStrength*field*horizonGuard*(.019/(radius+.052));
    vec2 tangent=vec2(-direction.y,direction.x);
    float shear=sin(angle*3.+uTime*.035)*field*uStrength*.0018;
    vec2 offset=vec2((direction.x*bend+tangent.x*shear)/uAspect,direction.y*bend+tangent.y*shear);
    float chroma=.0018*field*uStrength;
    vec3 color;
    color.r=texture2D(uScene,vUv+offset*(1.+chroma*7.)).r;
    color.g=texture2D(uScene,vUv+offset).g;
    color.b=texture2D(uScene,vUv+offset*(1.-chroma*8.)).b;
    float critical=uRadius*.82;
    float mirrorWeight=exp(-pow((radius-critical)/(uRadius*.09),2.))*field*uStrength;
    vec2 mirroredMetric=-direction*(critical+(radius-critical)*.22);
    vec2 mirroredUv=uCenter+vec2(mirroredMetric.x/uAspect,mirroredMetric.y);
    vec3 mirrored=texture2D(uScene,mirroredUv).rgb;
    color=mix(color,mirrored,mirrorWeight*.17);
    float caustic=exp(-pow((radius-uRadius*.76)/(uRadius*.08),2.))*field;
    vec3 causticColor=mix(vec3(.055,.026,.014),vec3(.025,.058,.105),.5+.5*cos(angle));
    color+=caustic*causticColor*uStrength;
    gl_FragColor=vec4(color,1.);
  }
`;

function setupRenderer(){
  renderer=new THREE.WebGLRenderer({canvas:stage,antialias:!lowPower,alpha:false,powerPreference:"high-performance"});
  renderer.setPixelRatio(adaptivePixelRatio);
  renderer.setSize(window.innerWidth,window.innerHeight,false);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.02;
  renderer.autoClear=false;
}

function createRenderTarget(){
  const pixelRatio=renderer.getPixelRatio();
  backgroundTarget?.dispose();
  backgroundTarget=new THREE.WebGLRenderTarget(
    Math.max(1,Math.floor(window.innerWidth*pixelRatio*adaptiveScale)),
    Math.max(1,Math.floor(window.innerHeight*pixelRatio*adaptiveScale)),
    {minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat,depthBuffer:true}
  );
  backgroundTarget.texture.colorSpace=THREE.SRGBColorSpace;
  if(lensMaterial)lensMaterial.uniforms.uScene.value=backgroundTarget.texture;
}

function createSky(){
  const geometry=new THREE.SphereGeometry(480,lowPower?48:72,lowPower?32:48);
  const fallbackTexture=new THREE.DataTexture(new Uint8Array([2,4,10,255]),1,1,THREE.RGBAFormat);
  fallbackTexture.needsUpdate=true;
  const material=new THREE.ShaderMaterial({
    uniforms:{uMap:{value:fallbackTexture}},
    vertexShader:skyVertexShader,
    fragmentShader:skyFragmentShader,
    side:THREE.BackSide,
    depthWrite:false
  });
  skySphere=new THREE.Mesh(geometry,material);
  skySphere.rotation.y=1.25;
  backgroundScene.add(skySphere);
  const url=new URL("../cosmic-background-lab/assets/nebula-panorama-v1.png",import.meta.url).href;
  new THREE.TextureLoader().load(url,(texture)=>{
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=THREE.RepeatWrapping;
    texture.minFilter=THREE.LinearMipmapLinearFilter;
    material.uniforms.uMap.value=texture;
  });
}

function createStars(){
  const positions=new Float32Array(starCount*3);
  const sizes=new Float32Array(starCount);
  const phases=new Float32Array(starCount);
  const colors=new Float32Array(starCount*3);
  const palette=[new THREE.Color(0xddeaff),new THREE.Color(0x84b7ff),new THREE.Color(0xffd6a2),new THREE.Color(0xb6f1ff)];
  for(let i=0;i<starCount;i+=1){
    const direction=randomDirection();
    const radius=34+Math.pow(random(),.28)*390;
    positions[i*3]=direction.x*radius;
    positions[i*3+1]=direction.y*radius;
    positions[i*3+2]=direction.z*radius;
    sizes[i]=random()>.985?3.2+random()*3.6:.42+Math.pow(random(),3)*1.6;
    phases[i]=random();
    const color=palette[Math.floor(random()*palette.length)];
    colors[i*3]=color.r;colors[i*3+1]=color.g;colors[i*3+2]=color.b;
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
  geometry.setAttribute("aSize",new THREE.BufferAttribute(sizes,1));
  geometry.setAttribute("aPhase",new THREE.BufferAttribute(phases,1));
  geometry.setAttribute("aColor",new THREE.BufferAttribute(colors,3));
  starMaterial=new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0},uPixelRatio:{value:renderer.getPixelRatio()},uOpacity:{value:.76}},
    vertexShader:starVertexShader,
    fragmentShader:starFragmentShader,
    transparent:true,
    depthWrite:false,
    blending:THREE.AdditiveBlending
  });
  backgroundScene.add(new THREE.Points(geometry,starMaterial));
}

function createPostProcess(){
  postScene=new THREE.Scene();
  postCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  lensMaterial=new THREE.ShaderMaterial({
    uniforms:{
      uScene:{value:backgroundTarget.texture},
      uCenter:{value:new THREE.Vector2(.5,.5)},
      uAspect:{value:window.innerWidth/window.innerHeight},
      uStrength:{value:Number(lensingInput.value)/100},
      uRadius:{value:.17},
      uTime:{value:0}
    },
    vertexShader:postVertexShader,
    fragmentShader:lensFragmentShader,
    depthTest:false,
    depthWrite:false
  });
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),lensMaterial));
}

function createAccretionDisk(){
  diskGroup=new THREE.Group();
  diskGroup.rotation.x=1.08;
  diskGroup.rotation.z=-.16;
  objectScene.add(diskGroup);
  const geometry=new THREE.RingGeometry(1.72,5.8,lowPower?144:256,lowPower?46:88);
  diskMaterial=new THREE.ShaderMaterial({
    uniforms:{
      uTime:{value:0},
      uEnergy:{value:Number(energyInput.value)/100},
      uPhysical:{value:0},
      uLayer:{value:0},
      uCameraLocal:{value:new THREE.Vector3(0,0,12.6)}
    },
    vertexShader:diskVertexShader,
    fragmentShader:diskFragmentShader,
    transparent:true,
    depthWrite:false,
    side:THREE.DoubleSide
  });
  const disk=new THREE.Mesh(geometry,diskMaterial);
  disk.renderOrder=2;
  diskGroup.add(disk);
  diskGlowMaterial=diskMaterial.clone();
  diskGlowMaterial.uniforms={
    uTime:{value:0},
    uEnergy:{value:Number(energyInput.value)/100*.34},
    uPhysical:{value:0},
    uLayer:{value:1},
    uCameraLocal:{value:new THREE.Vector3(0,0,12.6)}
  };
  diskGlowMaterial.blending=THREE.AdditiveBlending;
  diskGlowMaterial.depthWrite=false;
  const glow=new THREE.Mesh(geometry,diskGlowMaterial);
  glow.scale.setScalar(1.012);
  glow.position.z=-.025;
  glow.renderOrder=1;
  diskGroup.add(glow);
  if(!lowPower){
    coronaMaterial=diskMaterial.clone();
    coronaMaterial.uniforms={
      uTime:{value:0},
      uEnergy:{value:Number(energyInput.value)/100*.16},
      uPhysical:{value:0},
      uLayer:{value:2},
      uCameraLocal:{value:new THREE.Vector3(0,0,12.6)}
    };
    coronaMaterial.blending=THREE.AdditiveBlending;
    coronaMaterial.depthWrite=false;
    const corona=new THREE.Mesh(geometry,coronaMaterial);
    corona.scale.setScalar(1.022);
    corona.position.z=.055;
    corona.renderOrder=1;
    diskGroup.add(corona);
  }
}

function createAccretionParticles(){
  const positions=new Float32Array(particleCount*3);
  const radii=new Float32Array(particleCount);
  const angles=new Float32Array(particleCount);
  const phases=new Float32Array(particleCount);
  const sizes=new Float32Array(particleCount);
  for(let i=0;i<particleCount;i+=1){
    const radius=1.76+Math.pow(random(),1.34)*4.05;
    positions[i*3+2]=(random()-.5)*(.025+radius*.025);
    radii[i]=radius;
    angles[i]=random()*Math.PI*2;
    phases[i]=random();
    sizes[i]=.45+Math.pow(random(),2.2)*2.1;
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
  geometry.setAttribute("aRadius",new THREE.BufferAttribute(radii,1));
  geometry.setAttribute("aAngle",new THREE.BufferAttribute(angles,1));
  geometry.setAttribute("aPhase",new THREE.BufferAttribute(phases,1));
  geometry.setAttribute("aSize",new THREE.BufferAttribute(sizes,1));
  particleMaterial=new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0},uPixelRatio:{value:renderer.getPixelRatio()},uEnergy:{value:Number(energyInput.value)/100}},
    vertexShader:particleVertexShader,
    fragmentShader:particleFragmentShader,
    transparent:true,
    depthWrite:false,
    blending:THREE.AdditiveBlending
  });
  const particles=new THREE.Points(geometry,particleMaterial);
  particles.renderOrder=3;
  diskGroup.add(particles);
}

function createJets(){
  const positions=new Float32Array(jetCount*3);
  const phases=new Float32Array(jetCount);
  const sizes=new Float32Array(jetCount);
  for(let i=0;i<jetCount;i+=1){
    const sign=i%2===0?1:-1;
    const distance=1.3+Math.pow(random(),.62)*7.8;
    const spread=.015+distance*.014;
    positions[i*3]=(random()-.5)*spread;
    positions[i*3+1]=(random()-.5)*spread;
    positions[i*3+2]=distance*sign;
    phases[i]=random();
    sizes[i]=.5+random()*1.5;
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
  geometry.setAttribute("aPhase",new THREE.BufferAttribute(phases,1));
  geometry.setAttribute("aSize",new THREE.BufferAttribute(sizes,1));
  jetMaterial=new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0},uPixelRatio:{value:renderer.getPixelRatio()},uEnergy:{value:Number(energyInput.value)/100},uQuiet:{value:0}},
    vertexShader:jetVertexShader,
    fragmentShader:jetFragmentShader,
    transparent:true,
    depthWrite:false,
    blending:THREE.AdditiveBlending
  });
  diskGroup.add(new THREE.Points(geometry,jetMaterial));
}

function createEventHorizon(){
  const horizon=new THREE.Mesh(
    new THREE.SphereGeometry(1.55,lowPower?64:112,lowPower?42:72),
    new THREE.MeshBasicMaterial({color:0x000000})
  );
  horizon.renderOrder=4;
  objectScene.add(horizon);

  const planeGeometry=new THREE.PlaneGeometry(4.6,4.6,1,1);
  photonMaterial=new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0},uEnergy:{value:Number(energyInput.value)/100},uQuiet:{value:0}},
    vertexShader:photonVertexShader,
    fragmentShader:photonFragmentShader,
    transparent:true,
    depthWrite:false,
    depthTest:false,
    blending:THREE.AdditiveBlending
  });
  photonPlane=new THREE.Mesh(planeGeometry,photonMaterial);
  photonPlane.renderOrder=7;
  objectScene.add(photonPlane);

  haloMaterial=new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0},uEnergy:{value:Number(energyInput.value)/100},uQuiet:{value:0}},
    vertexShader:photonVertexShader,
    fragmentShader:haloFragmentShader,
    transparent:true,
    depthWrite:false,
    depthTest:false,
    blending:THREE.AdditiveBlending
  });
  haloPlane=new THREE.Mesh(new THREE.PlaneGeometry(5.15,5.15),haloMaterial);
  haloPlane.renderOrder=6;
  objectScene.add(haloPlane);
}

function setupControls(){
  controls=new OrbitControls(camera,stage);
  controls.target.copy(defaultTarget);
  controls.enableDamping=true;
  controls.dampingFactor=.055;
  controls.enablePan=false;
  controls.zoomSpeed=.52;
  controls.rotateSpeed=.45;
  controls.minDistance=7.8;
  controls.maxDistance=18;
  controls.minPolarAngle=.12;
  controls.maxPolarAngle=Math.PI-.12;
  controls.autoRotate=false;
  controls.autoRotateSpeed=.11;
  controls.addEventListener("start",()=>{
    lastInteraction=performance.now();
    resettingView=false;
    if(!tourActive)controls.autoRotate=false;
  });
  controls.addEventListener("end",()=>{lastInteraction=performance.now();});
  controls.update();
}

function resetView(){resettingView=true;lastInteraction=performance.now();}
function updateViewReset(delta){
  if(!resettingView)return;
  const response=1-Math.pow(.0015,delta);
  camera.position.lerp(defaultCameraPosition,response);
  controls.target.lerp(defaultTarget,response);
  if(camera.position.distanceTo(defaultCameraPosition)<.015){camera.position.copy(defaultCameraPosition);controls.target.copy(defaultTarget);resettingView=false;}
}

function applyVisualMode(mode){
  visualMode=mode;
  document.body.dataset.visualMode=mode;
  document.querySelectorAll("[data-mode]").forEach((button)=>button.classList.toggle("is-active",button.dataset.mode===mode));
  const baseEnergy=Number(energyInput.value)/100;
  const baseLensing=Number(lensingInput.value)/100;
  if(mode==="cinematic"){
    renderer.toneMappingExposure=1.02;
    diskMaterial.uniforms.uEnergy.value=baseEnergy;
    diskMaterial.uniforms.uPhysical.value=0;
    diskGlowMaterial.uniforms.uEnergy.value=baseEnergy*.34;
    if(coronaMaterial)coronaMaterial.uniforms.uEnergy.value=baseEnergy*.16;
    lensMaterial.uniforms.uStrength.value=baseLensing*.9;
    starMaterial.uniforms.uOpacity.value=.76;
    photonMaterial.uniforms.uQuiet.value=0;
    haloMaterial.uniforms.uQuiet.value=0;
    jetMaterial.uniforms.uQuiet.value=0;
  }else if(mode==="physical"){
    renderer.toneMappingExposure=.88;
    diskMaterial.uniforms.uEnergy.value=baseEnergy*.86;
    diskMaterial.uniforms.uPhysical.value=1;
    diskGlowMaterial.uniforms.uEnergy.value=baseEnergy*.16;
    if(coronaMaterial)coronaMaterial.uniforms.uEnergy.value=baseEnergy*.075;
    lensMaterial.uniforms.uStrength.value=baseLensing*1.12;
    starMaterial.uniforms.uOpacity.value=.68;
    photonMaterial.uniforms.uQuiet.value=.12;
    haloMaterial.uniforms.uQuiet.value=.2;
    jetMaterial.uniforms.uQuiet.value=.35;
  }else{
    renderer.toneMappingExposure=.72;
    diskMaterial.uniforms.uEnergy.value=baseEnergy*.48;
    diskMaterial.uniforms.uPhysical.value=.35;
    diskGlowMaterial.uniforms.uEnergy.value=baseEnergy*.08;
    if(coronaMaterial)coronaMaterial.uniforms.uEnergy.value=baseEnergy*.025;
    lensMaterial.uniforms.uStrength.value=baseLensing*.54;
    starMaterial.uniforms.uOpacity.value=.48;
    photonMaterial.uniforms.uQuiet.value=.72;
    haloMaterial.uniforms.uQuiet.value=.8;
    jetMaterial.uniforms.uQuiet.value=1;
  }
  diskGlowMaterial.uniforms.uPhysical.value=diskMaterial.uniforms.uPhysical.value;
  if(coronaMaterial)coronaMaterial.uniforms.uPhysical.value=diskMaterial.uniforms.uPhysical.value;
  particleMaterial.uniforms.uEnergy.value=diskMaterial.uniforms.uEnergy.value*.82;
  photonMaterial.uniforms.uEnergy.value=baseEnergy;
  haloMaterial.uniforms.uEnergy.value=baseEnergy;
  jetMaterial.uniforms.uEnergy.value=baseEnergy;
}

function bindInterface(){
  energyInput.addEventListener("input",()=>{energyValue.textContent=`${energyInput.value}%`;applyVisualMode(visualMode);});
  lensingInput.addEventListener("input",()=>{lensingValue.textContent=`${lensingInput.value}%`;applyVisualMode(visualMode);});
  document.querySelectorAll("[data-mode]").forEach((button)=>button.addEventListener("click",()=>applyVisualMode(button.dataset.mode)));
  resetButton.addEventListener("click",resetView);
  tourButton.addEventListener("click",()=>{
    tourActive=!tourActive;
    tourButton.classList.toggle("is-active",tourActive);
    tourButton.querySelector("b").textContent=tourActive?"停止巡视":"开始巡视";
    controls.autoRotate=tourActive;
    renderState.textContent=tourActive?"引力场巡视":"静默观测";
    lastInteraction=performance.now();
  });
  stage.addEventListener("dblclick",resetView);
  window.addEventListener("resize",resize);
}

function resize(){
  const width=window.innerWidth,height=window.innerHeight;
  camera.aspect=width/height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(adaptivePixelRatio);
  renderer.setSize(width,height,false);
  createRenderTarget();
  lensMaterial.uniforms.uAspect.value=width/height;
  starMaterial.uniforms.uPixelRatio.value=renderer.getPixelRatio();
  particleMaterial.uniforms.uPixelRatio.value=renderer.getPixelRatio();
  jetMaterial.uniforms.uPixelRatio.value=renderer.getPixelRatio();
}

function updateBearing(){
  const direction=new THREE.Vector3().subVectors(controls.target,camera.position).normalize();
  let azimuth=THREE.MathUtils.radToDeg(Math.atan2(direction.x,-direction.z));
  if(azimuth<0)azimuth+=360;
  const elevation=THREE.MathUtils.radToDeg(Math.asin(direction.y));
  bearingValue.textContent=`AZ ${Math.round(azimuth).toString().padStart(3,"0")}° · EL ${elevation>=0?"+":"−"}${Math.abs(Math.round(elevation)).toString().padStart(2,"0")}°`;
}

function updateLensingCenter(){
  const projected=new THREE.Vector3(0,0,0).project(camera);
  lensMaterial.uniforms.uCenter.value.set(projected.x*.5+.5,projected.y*.5+.5);
  const distance=camera.position.length();
  lensMaterial.uniforms.uRadius.value=clamp(.168*(12.6/distance),.105,.245);
}

function adaptResolution(now){
  if(frameSamples>=0){
    frameSamples+=1;
    if(now-sampleStart>2400){
      const fps=frameSamples*1000/(now-sampleStart);
      if(fps<42&&adaptiveScale>.62){
        adaptiveScale=Math.max(.62,adaptiveScale-.1);
        createRenderTarget();
      }
      if(fps<34&&adaptivePixelRatio>.86){
        adaptivePixelRatio=Math.max(.86,adaptivePixelRatio-.16);
        renderer.setPixelRatio(adaptivePixelRatio);
        renderer.setSize(window.innerWidth,window.innerHeight,false);
        starMaterial.uniforms.uPixelRatio.value=adaptivePixelRatio;
        particleMaterial.uniforms.uPixelRatio.value=adaptivePixelRatio;
        jetMaterial.uniforms.uPixelRatio.value=adaptivePixelRatio;
        createRenderTarget();
      }
      frameSamples=-1;
    }
  }
}

function renderFrame(){
  renderer.setRenderTarget(backgroundTarget);
  renderer.clear(true,true,true);
  renderer.render(backgroundScene,camera);
  renderer.setRenderTarget(null);
  renderer.clear(true,true,true);
  renderer.render(postScene,postCamera);
  renderer.clearDepth();
  renderer.render(objectScene,camera);
}

function animate(now){
  const delta=clamp((now-lastTime)/1000,0,.05);
  lastTime=now;
  const time=reducedMotion?0:now/1000;
  starMaterial.uniforms.uTime.value=time;
  diskMaterial.uniforms.uTime.value=time;
  diskGlowMaterial.uniforms.uTime.value=time+7.4;
  if(coronaMaterial)coronaMaterial.uniforms.uTime.value=time-11.8;
  particleMaterial.uniforms.uTime.value=time;
  photonMaterial.uniforms.uTime.value=time;
  haloMaterial.uniforms.uTime.value=time;
  jetMaterial.uniforms.uTime.value=time;
  lensMaterial.uniforms.uTime.value=time;
  photonPlane.quaternion.copy(camera.quaternion);
  haloPlane.quaternion.copy(camera.quaternion);
  if(!reducedMotion){
    skySphere.rotation.y=1.25+time*.00016;
    diskGroup.rotation.z=-.16+Math.sin(time*.045)*.018;
  }
  if(!tourActive&&!resettingView&&!reducedMotion&&performance.now()-lastInteraction>11000)controls.autoRotate=true;
  if(!tourActive&&performance.now()-lastInteraction<11000)controls.autoRotate=false;
  updateViewReset(delta);
  controls.update(delta);
  diskGroup.updateWorldMatrix(true,false);
  localCameraPosition.copy(camera.position);
  diskGroup.worldToLocal(localCameraPosition);
  diskMaterial.uniforms.uCameraLocal.value.copy(localCameraPosition);
  diskGlowMaterial.uniforms.uCameraLocal.value.copy(localCameraPosition);
  if(coronaMaterial)coronaMaterial.uniforms.uCameraLocal.value.copy(localCameraPosition);
  updateLensingCenter();
  updateBearing();
  renderFrame();
  adaptResolution(now);
}

function initialize(){
  try{
    setupRenderer();
    backgroundScene=new THREE.Scene();
    backgroundScene.background=new THREE.Color(0x010205);
    objectScene=new THREE.Scene();
    camera=new THREE.PerspectiveCamera(50,window.innerWidth/window.innerHeight,.06,900);
    camera.position.copy(defaultCameraPosition);
    createRenderTarget();
    createSky();
    createStars();
    createPostProcess();
    createAccretionDisk();
    createAccretionParticles();
    createJets();
    createEventHorizon();
    setupControls();
    bindInterface();
    applyVisualMode("cinematic");
    renderer.setAnimationLoop(animate);
    lab.classList.add("is-ready");
  }catch(error){
    console.error("Black hole observatory failed to initialize",error);
    fallback.hidden=false;
    stage.hidden=true;
  }
}

initialize();
