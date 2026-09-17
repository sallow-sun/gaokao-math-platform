import * as THREE from "three";

const vertexShader=`
  uniform mat4 uPreviousViewProjection;
  uniform mat4 uOlderViewProjection;
  uniform vec2 uViewport;
  uniform float uPixelRatio;
  uniform float uEnergy;
  uniform float uTime;
  attribute vec3 aCurrent;
  attribute vec3 aPrevious;
  attribute vec3 aOlder;
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aAlpha;
  attribute float aTrailScale;
  attribute float aPhase;
  varying vec3 vColor;
  varying float vAlong;
  varying float vAcross;
  varying float vAlpha;
  varying float vPhase;

  vec2 projectNdc(vec4 clipPosition){return clipPosition.xy/max(.0001,clipPosition.w);}

  void main(){
    vec4 headClip=projectionMatrix*viewMatrix*vec4(aCurrent,1.);
    vec4 previousClip=uPreviousViewProjection*vec4(aPrevious,1.);
    vec4 olderClip=uOlderViewProjection*vec4(aOlder,1.);
    if(headClip.w<.12||previousClip.w<.12||olderClip.w<.12){
      gl_Position=vec4(2.,2.,2.,1.);vAlpha=0.;vColor=aColor;vAlong=1.;vAcross=1.;vPhase=aPhase;return;
    }

    vec2 head=projectNdc(headClip);
    vec2 previous=projectNdc(previousClip);
    vec2 older=projectNdc(olderClip);
    vec2 firstMotion=head-previous;
    vec2 secondMotion=previous-older;
    float energy=clamp(uEnergy,0.,1.);
    float gain=mix(1.15,8.8,pow(energy,.82))*aTrailScale;
    float maximumLength=mix(.0045,.235,pow(energy,.72))*mix(.72,1.18,aTrailScale);
    vec2 firstTrail=firstMotion*gain;
    vec2 secondTrail=secondMotion*gain*.82;
    float firstLength=length(firstTrail);
    float secondLength=length(secondTrail);
    if(firstLength>maximumLength)firstTrail=normalize(firstTrail)*maximumLength;
    if(secondLength>maximumLength*.74)secondTrail=normalize(secondTrail)*maximumLength*.74;

    vec2 fallbackDirection=length(firstMotion)>.00001?normalize(firstMotion):vec2(1.,0.);
    float minimumLength=(1.15+aSize*.35)*2./max(1.,uViewport.y);
    if(length(firstTrail)<minimumLength)firstTrail=fallbackDirection*minimumLength;
    if(length(secondTrail)<minimumLength*.34)secondTrail=firstTrail*.34;

    vec2 curveStart=head;
    vec2 curveMiddle=head-firstTrail;
    vec2 curveEnd=curveMiddle-secondTrail;
    float segment=position.z;
    float interpolation=position.x;
    vec2 segmentStart=segment<.5?curveStart:curveMiddle;
    vec2 segmentEnd=segment<.5?curveMiddle:curveEnd;
    vec2 segmentDirection=segmentEnd-segmentStart;
    vec2 normalDirection=length(segmentDirection)>.00001?normalize(vec2(-segmentDirection.y,segmentDirection.x)):vec2(0.,1.);
    float widthPixels=aSize*mix(.86,1.16,energy)*uPixelRatio;
    vec2 widthOffset=normalDirection*position.y*widthPixels*2./uViewport;
    vec2 finalNdc=mix(segmentStart,segmentEnd,interpolation)+widthOffset;

    gl_Position=vec4(finalNdc*headClip.w,headClip.z,headClip.w);
    vColor=aColor;
    vAlong=segment<.5?interpolation*.56:.56+interpolation*.44;
    vAcross=position.y;
    vAlpha=aAlpha;
    vPhase=aPhase;
  }
`;

const fragmentShader=`
  uniform float uTime;
  uniform float uEnergy;
  varying vec3 vColor;
  varying float vAlong;
  varying float vAcross;
  varying float vAlpha;
  varying float vPhase;
  void main(){
    float edge=pow(max(0.,1.-abs(vAcross)),.72);
    float tail=pow(max(0.,1.-vAlong),1.18);
    float headGlow=exp(-vAlong*10.5);
    float twinkle=mix(.72+.28*sin(uTime*(1.1+vPhase*.8)+vPhase*18.),1.,smoothstep(.14,.5,uEnergy));
    float alpha=vAlpha*edge*(.16+tail*.62+headGlow*.48)*twinkle;
    if(alpha<.008)discard;
    vec3 color=mix(vColor,vec3(.92,.97,1.),headGlow*.7);
    gl_FragColor=vec4(color,alpha);
  }
`;

function createRibbonGeometry(){
  const geometry=new THREE.InstancedBufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute([
    0,-1,0, 0,1,0, 1,-1,0, 1,1,0,
    0,-1,1, 0,1,1, 1,-1,1, 1,1,1
  ],3));
  geometry.setIndex([0,2,1,2,3,1,4,6,5,6,7,5]);
  return geometry;
}

export function createFlightParticleField({camera,lowPower,reducedMotion,direction,anchor}){
  const nearCount=reducedMotion?90:lowPower?230:520;
  const middleCount=reducedMotion?150:lowPower?340:760;
  const farCount=reducedMotion?180:lowPower?430:880;
  const count=nearCount+middleCount+farCount;
  const geometry=createRibbonGeometry();
  geometry.instanceCount=count;

  const currentPositions=new Float32Array(count*3);
  const previousPositions=new Float32Array(count*3);
  const olderPositions=new Float32Array(count*3);
  const colors=new Float32Array(count*3);
  const sizes=new Float32Array(count);
  const alphas=new Float32Array(count);
  const trailScales=new Float32Array(count);
  const phases=new Float32Array(count);
  const speedScales=new Float32Array(count);
  const layers=new Uint8Array(count);
  const longitudinalRanges=[{back:24,front:32,radius:10},{back:52,front:66,radius:27},{back:110,front:145,radius:72}];
  const palette=[new THREE.Color(0xdceaff),new THREE.Color(0x82baf4),new THREE.Color(0xf0c990),new THREE.Color(0xb89aff)];
  const travelDirection=direction.clone().normalize();
  const worldUp=new THREE.Vector3(0,1,0);
  const travelRight=new THREE.Vector3().crossVectors(travelDirection,worldUp).normalize();
  const travelUp=new THREE.Vector3().crossVectors(travelRight,travelDirection).normalize();
  const particlePosition=new THREE.Vector3();
  const previousViewProjection=new THREE.Matrix4();
  const olderViewProjection=new THREE.Matrix4();
  const currentViewProjection=new THREE.Matrix4();
  let matricesReady=false;
  let speed=0;

  function layerFor(index){if(index<nearCount)return 0;if(index<nearCount+middleCount)return 1;return 2;}

  function copyPosition(target,index,source){const offset=index*3;target[offset]=source.x;target[offset+1]=source.y;target[offset+2]=source.z;}

  function respawn(index,ahead=false){
    const layer=layers[index];
    const range=longitudinalRanges[layer];
    const longitudinal=ahead?range.front*(.76+Math.random()*.24):-range.back+Math.random()*(range.back+range.front);
    const angle=Math.random()*Math.PI*2;
    const radial=Math.sqrt(Math.random())*range.radius*(layer===0?.72+Math.random()*.28:.5+Math.random()*.5);
    particlePosition.copy(anchor)
      .addScaledVector(travelDirection,longitudinal)
      .addScaledVector(travelRight,Math.cos(angle)*radial)
      .addScaledVector(travelUp,Math.sin(angle)*radial);
    copyPosition(currentPositions,index,particlePosition);
    copyPosition(previousPositions,index,particlePosition);
    copyPosition(olderPositions,index,particlePosition);
  }

  for(let index=0;index<count;index+=1){
    const layer=layerFor(index);layers[index]=layer;
    const color=palette[Math.floor(Math.random()*palette.length)];
    const offset=index*3;colors[offset]=color.r;colors[offset+1]=color.g;colors[offset+2]=color.b;
    if(layer===0){sizes[index]=1.15+Math.random()*1.5;alphas[index]=.28+Math.random()*.56;trailScales[index]=.88+Math.random()*.46;speedScales[index]=.85+Math.random()*.36;}
    else if(layer===1){sizes[index]=.74+Math.random()*.92;alphas[index]=.22+Math.random()*.42;trailScales[index]=.42+Math.random()*.36;speedScales[index]=.34+Math.random()*.24;}
    else{sizes[index]=.48+Math.random()*.64;alphas[index]=.16+Math.random()*.34;trailScales[index]=.12+Math.random()*.17;speedScales[index]=.055+Math.random()*.075;}
    phases[index]=Math.random();respawn(index,false);
  }

  const currentAttribute=new THREE.InstancedBufferAttribute(currentPositions,3).setUsage(THREE.DynamicDrawUsage);
  const previousAttribute=new THREE.InstancedBufferAttribute(previousPositions,3).setUsage(THREE.DynamicDrawUsage);
  const olderAttribute=new THREE.InstancedBufferAttribute(olderPositions,3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("aCurrent",currentAttribute);
  geometry.setAttribute("aPrevious",previousAttribute);
  geometry.setAttribute("aOlder",olderAttribute);
  geometry.setAttribute("aColor",new THREE.InstancedBufferAttribute(colors,3));
  geometry.setAttribute("aSize",new THREE.InstancedBufferAttribute(sizes,1));
  geometry.setAttribute("aAlpha",new THREE.InstancedBufferAttribute(alphas,1));
  geometry.setAttribute("aTrailScale",new THREE.InstancedBufferAttribute(trailScales,1));
  geometry.setAttribute("aPhase",new THREE.InstancedBufferAttribute(phases,1));

  camera.updateMatrixWorld();
  currentViewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  previousViewProjection.copy(currentViewProjection);olderViewProjection.copy(currentViewProjection);matricesReady=true;

  const material=new THREE.ShaderMaterial({
    uniforms:{
      uPreviousViewProjection:{value:previousViewProjection.clone()},
      uOlderViewProjection:{value:olderViewProjection.clone()},
      uViewport:{value:new THREE.Vector2(window.innerWidth,window.innerHeight)},
      uPixelRatio:{value:Math.min(window.devicePixelRatio||1,1.2)},
      uEnergy:{value:0},
      uTime:{value:0}
    },
    vertexShader,fragmentShader,transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,toneMapped:false
  });
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=0;

  function update({delta,time,energy}){
    if(!matricesReady)return;
    const targetSpeed=reducedMotion?.025:.16+Math.pow(energy,2.05)*25.5;
    speed+=(targetSpeed-speed)*(1-Math.pow(.028,delta));
    olderPositions.set(previousPositions);previousPositions.set(currentPositions);
    for(let index=0;index<count;index+=1){
      const offset=index*3;
      const travel=speed*speedScales[index]*delta;
      currentPositions[offset]-=travelDirection.x*travel;
      currentPositions[offset+1]-=travelDirection.y*travel;
      currentPositions[offset+2]-=travelDirection.z*travel;
      particlePosition.set(currentPositions[offset],currentPositions[offset+1],currentPositions[offset+2]);
      const longitudinal=particlePosition.sub(anchor).dot(travelDirection);
      if(longitudinal<-longitudinalRanges[layers[index]].back)respawn(index,true);
    }
    currentAttribute.needsUpdate=true;previousAttribute.needsUpdate=true;olderAttribute.needsUpdate=true;
    camera.updateMatrixWorld();currentViewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    material.uniforms.uPreviousViewProjection.value.copy(previousViewProjection);
    material.uniforms.uOlderViewProjection.value.copy(olderViewProjection);
    olderViewProjection.copy(previousViewProjection);previousViewProjection.copy(currentViewProjection);
    material.uniforms.uEnergy.value=energy;material.uniforms.uTime.value=time;
  }

  function resize(width,height,pixelRatio){material.uniforms.uViewport.value.set(width,height);material.uniforms.uPixelRatio.value=pixelRatio;}

  function synchronizeCamera(){camera.updateMatrixWorld();currentViewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);previousViewProjection.copy(currentViewProjection);olderViewProjection.copy(currentViewProjection);material.uniforms.uPreviousViewProjection.value.copy(currentViewProjection);material.uniforms.uOlderViewProjection.value.copy(currentViewProjection);}

  return{mesh,update,resize,synchronizeCamera};
}
