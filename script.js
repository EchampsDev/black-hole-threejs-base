import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { LOOKS, QUALITY, autoQuality } from './presets.js?v=original-lilac-2';

const BLACK_HOLE_RADIUS = 1.3;
const DISK_INNER_RADIUS = BLACK_HOLE_RADIUS + 0.2;
const DISK_OUTER_RADIUS = 8.0;
const DISK_TILT_ANGLE = Math.PI / 3.0;
const ui = {
    panel: document.getElementById('control-panel'), toggle: document.getElementById('panel-toggle'),
    quality: document.getElementById('quality'), note: document.getElementById('quality-note'),
    camera: document.getElementById('cinematic-camera'), motion: document.getElementById('motion'),
    tour: document.getElementById('tour-overlay'), tourPhase: document.getElementById('tour-phase'),
    tourCount: document.getElementById('tour-count'), tourDescription: document.getElementById('tour-description')
};
const saved = (() => { try { return JSON.parse(localStorage.getItem('black-hole-cinematic-v2') || '{}'); } catch { return {}; } })();
let lookName = Object.hasOwn(LOOKS, saved.look) ? saved.look : 'observatory';
let qualityMode = Object.hasOwn(QUALITY, saved.quality) ? saved.quality : 'auto';
let activeQuality = qualityMode === 'auto' ? autoQuality() : qualityMode;
let motionEnabled = typeof saved.motion === 'boolean' ? saved.motion : !matchMedia('(prefers-reduced-motion: reduce)').matches;
let cameraEnabled = saved.camera === true && !matchMedia('(prefers-reduced-motion: reduce)').matches;
const overrides = Object.fromEntries(['lensing', 'bloom', 'exposure'].map(key => [key, Number.isFinite(saved[key]) ? THREE.MathUtils.clamp(saved[key], 0, 100) : 50]));

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x020104, 0.025);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 4000);
camera.position.set(-6.5, 5.0, 6.5);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY[activeQuality].dpr));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.52, 0.55, 0.72
);
composer.addPass(bloomPass);

const lensingShader = {
    uniforms: {
        "tDiffuse": { value: null },
        "blackHoleScreenPos": { value: new THREE.Vector2(0.5, 0.5) },
        "lensingStrength": { value: 0.075 },
        "lensingRadius": { value: 0.3 },
        "aspectRatio": { value: window.innerWidth / window.innerHeight },
        "chromaticAberration": { value: 0.0012 },
        "vignetteStrength": { value: 0.18 },
        "exposureScale": { value: 1.0 }
    },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 blackHoleScreenPos;
        uniform float lensingStrength;
        uniform float lensingRadius;
        uniform float aspectRatio;
        uniform float chromaticAberration;
        uniform float vignetteStrength;
        uniform float exposureScale;
        varying vec2 vUv;
        
        void main() {
            vec2 screenPos = vUv;
            vec2 toCenter = screenPos - blackHoleScreenPos;
            toCenter.x *= aspectRatio;
            float dist = length(toCenter);
            
            float distortionAmount = clamp(lensingStrength * 0.11 / max(dist, 0.025), 0.0, 0.16);
            float falloff = 1.0 - smoothstep(lensingRadius * 0.28, lensingRadius, dist);
            distortionAmount *= falloff;
            
            vec2 offset = toCenter / max(dist, 0.0001) * distortionAmount;
            offset.x /= aspectRatio;
            
            vec2 distortedUvR = screenPos - offset * (1.0 + chromaticAberration);
            vec2 distortedUvG = screenPos - offset;
            vec2 distortedUvB = screenPos - offset * (1.0 - chromaticAberration);
            
            float r = texture2D(tDiffuse, distortedUvR).r;
            float g = texture2D(tDiffuse, distortedUvG).g;
            float b = texture2D(tDiffuse, distortedUvB).b;
            
            float vignette = smoothstep(0.3, 0.9, length((vUv - 0.5) * vec2(aspectRatio, 1.0)));
            gl_FragColor = vec4(vec3(r, g, b) * exposureScale * (1.0 - vignetteStrength * vignette), 1.0);
        }`
};
const lensingPass = new ShaderPass(lensingShader);
composer.addPass(lensingPass);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.035;
controls.rotateSpeed = 0.4;
controls.target.set(0, 0, 0);
controls.minDistance = 2.5;
controls.maxDistance = 100;
controls.enablePan = false;
controls.update();

const starGeometry = new THREE.BufferGeometry();
const starCount = 150000;
const starPositions = new Float32Array(starCount * 3);
const starColors = new Float32Array(starCount * 3);
const starSizes = new Float32Array(starCount);
const starTwinkle = new Float32Array(starCount);
const starFieldRadius = 2000;
const starPalette = [
    new THREE.Color(0xcbdaf2), new THREE.Color(0xe5eaf7), new THREE.Color(0xffe6c5),
    new THREE.Color(0xfff4dc), new THREE.Color(0xffffff), new THREE.Color(0xffd4ae)
];

for (let i = 0; i < starCount; i++) {
    const i3 = i * 3;
    // Random ordering keeps every quality draw range spread across the whole sky.
    const phi = Math.acos(2 * Math.random() - 1);
    const theta = Math.random() * Math.PI * 2;
    const radius = Math.cbrt(Math.random()) * starFieldRadius + 100;

    starPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    starPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    starPositions[i3 + 2] = radius * Math.cos(phi);

    const starColor = starPalette[Math.floor(Math.random() * starPalette.length)].clone();
    starColor.multiplyScalar(Math.random() * 0.7 + 0.3);
    starColors[i3] = starColor.r; starColors[i3 + 1] = starColor.g; starColors[i3 + 2] = starColor.b;
    starSizes[i] = THREE.MathUtils.randFloat(0.6, 3.0);
    starTwinkle[i] = Math.random() * Math.PI * 2;
}
starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
starGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
starGeometry.setAttribute('twinkle', new THREE.BufferAttribute(starTwinkle, 1));
starGeometry.setDrawRange(0, QUALITY[activeQuality].stars);

const starMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: renderer.getPixelRatio() },
        uOpacity: { value: 0.7 }
    },
    vertexShader: `
        uniform float uTime;
        uniform float uPixelRatio;
        attribute float size;
        attribute float twinkle;
        varying vec3 vColor;
        varying float vTwinkle;
        
        void main() {
            vColor = color;
            vTwinkle = sin(uTime * 2.5 + twinkle) * 0.5 + 0.5;
            
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * uPixelRatio * (300.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        varying vec3 vColor;
        varying float vTwinkle;
        uniform float uOpacity;
        
        void main() {
            float dist = distance(gl_PointCoord, vec2(0.5));
            if (dist > 0.5) discard;
            
            float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
            alpha *= (0.65 + vTwinkle * 0.35) * uOpacity;
            
            gl_FragColor = vec4(vColor, alpha);
        }
    `,
    transparent: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

const eventHorizonGeom = new THREE.SphereGeometry(BLACK_HOLE_RADIUS * 1.05, 128, 64);
const eventHorizonMat = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uCameraPosition: { value: camera.position },
        uGlowColor: { value: new THREE.Color('#f0a45e') }
    },
    vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
            vNormal = normalize(mat3(modelMatrix) * normal);
            vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float uTime;
        uniform vec3 uCameraPosition;
        uniform vec3 uGlowColor;
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
            vec3 viewDirection = normalize(uCameraPosition - vPosition);
            float fresnel = 1.0 - abs(dot(vNormal, viewDirection));
            fresnel = pow(fresnel, 2.5);
            
            float pulse = sin(uTime * 1.2) * 0.05 + 0.95;
            
            gl_FragColor = vec4(uGlowColor * fresnel * pulse, fresnel * 0.16);
        }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide
});

const eventHorizon = new THREE.Mesh(eventHorizonGeom, eventHorizonMat);
scene.add(eventHorizon);

const blackHoleGeom = new THREE.SphereGeometry(BLACK_HOLE_RADIUS, 128, 64);
const blackHoleMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
const blackHoleMesh = new THREE.Mesh(blackHoleGeom, blackHoleMat);
blackHoleMesh.renderOrder = 0;
scene.add(blackHoleMesh);

// A narrow, camera-facing photon-ring cue, visually separate from the black silhouette.
const photonRing = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.ShaderMaterial({
    uniforms: { uRingColor: { value: new THREE.Color('#f2bf83') } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uRingColor; varying vec2 vUv;
        void main() {
            float r = length(vUv - 0.5) * 2.0;
            float ringDistance = (r - 0.735) / 0.014;
            float haloDistance = (r - 0.75) / 0.07;
            float ring = exp(-ringDistance * ringDistance);
            float halo = exp(-haloDistance * haloDistance);
            float strength = ring * 0.7 + halo * 0.13;
            gl_FragColor = vec4(uRingColor * strength, strength);
        }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
}));
photonRing.renderOrder = 3;
scene.add(photonRing);

const diskGeometry = new THREE.RingGeometry(DISK_INNER_RADIUS, DISK_OUTER_RADIUS, 256, 128);
const diskMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0.0 },
        uColorHot: { value: new THREE.Color(0xffffff) },
        uColorMid1: { value: new THREE.Color(0xff7733) },
        uColorMid2: { value: new THREE.Color(0xff4477) },
        uColorMid3: { value: new THREE.Color(0x7744ff) },
        uColorOuter: { value: new THREE.Color(0x4477ff) },
        uNoiseScale: { value: 2.5 },
        uFlowSpeed: { value: 0.22 },
        uDensity: { value: 1.05 },
        uCameraPosition: { value: camera.position }
    },
    vertexShader: `
        varying vec2 vUv;
        varying float vRadius;
        varying float vAngle;
        varying vec3 vWorldPos;
        varying vec3 vFlowDir;
        void main() {
            vUv = uv;
            vRadius = length(position.xy);
            vAngle = atan(position.y, position.x);
            vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
            vFlowDir = normalize((modelMatrix * vec4(-position.y, position.x, 0.0, 0.0)).xyz);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float uTime;
        uniform vec3 uColorHot;
        uniform vec3 uColorMid1;
        uniform vec3 uColorMid2;
        uniform vec3 uColorMid3;
        uniform vec3 uColorOuter;
        uniform float uNoiseScale;
        uniform float uFlowSpeed;
        uniform float uDensity;
        uniform vec3 uCameraPosition;

        varying vec2 vUv;
        varying float vRadius;
        varying float vAngle;
        varying vec3 vWorldPos;
        varying vec3 vFlowDir;

        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
        
        float snoise(vec3 v) {
            const vec2 C = vec2(1.0/6.0, 1.0/3.0);
            const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
            vec3 i  = floor(v + dot(v, C.yyy) );
            vec3 x0 = v - i + dot(i, C.xxx) ;
            vec3 g = step(x0.yzx, x0.xyz);
            vec3 l = 1.0 - g;
            vec3 i1 = min( g.xyz, l.zxy );
            vec3 i2 = max( g.xyz, l.zxy );
            vec3 x1 = x0 - i1 + C.xxx;
            vec3 x2 = x0 - i2 + C.yyy;
            vec3 x3 = x0 - D.yyy;
            i = mod289(i);
            vec4 p = permute( permute( permute( 
                     i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                   + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                   + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
            float n_ = 0.142857142857;
            vec3  ns = n_ * D.wyz - D.xzx;
            vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
            vec4 x_ = floor(j * ns.z);
            vec4 y_ = floor(j - 7.0 * x_ );
            vec4 x = x_ *ns.x + ns.yyyy;
            vec4 y = y_ *ns.x + ns.yyyy;
            vec4 h = 1.0 - abs(x) - abs(y);
            vec4 b0 = vec4( x.xy, y.xy );
            vec4 b1 = vec4( x.zw, y.zw );
            vec4 s0 = floor(b0)*2.0 + 1.0;
            vec4 s1 = floor(b1)*2.0 + 1.0;
            vec4 sh = -step(h, vec4(0.0));
            vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
            vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
            vec3 p0 = vec3(a0.xy,h.x);
            vec3 p1 = vec3(a0.zw,h.y);
            vec3 p2 = vec3(a1.xy,h.z);
            vec3 p3 = vec3(a1.zw,h.w);
            vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
            p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
            vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
            m = m * m;
            return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
        }

        void main() {
            float normalizedRadius = smoothstep(1.50, 8.00, vRadius);
            
            float spiral = vAngle * 3.0 - (1.0 / (normalizedRadius + 0.1)) * 2.0;
            vec2 noiseUv = vec2(vUv.x + uTime * uFlowSpeed * (2.0 / (vRadius * 0.3 + 1.0)) + sin(spiral) * 0.1, vUv.y * 0.8 + cos(spiral) * 0.1);
            float noiseVal1 = snoise(vec3(noiseUv * uNoiseScale, uTime * 0.15));
            float noiseVal2 = snoise(vec3(noiseUv * uNoiseScale * 3.0 + 0.8, uTime * 0.22));
            float noiseVal3 = snoise(vec3(noiseUv * uNoiseScale * 6.0 + 1.5, uTime * 0.3));
            
            float noiseVal = (noiseVal1 * 0.45 + noiseVal2 * 0.35 + noiseVal3 * 0.2);
            noiseVal = (noiseVal + 1.0) * 0.5;
            
            vec3 color = uColorHot;
            color = mix(color, uColorMid1, smoothstep(0.05, 0.3, normalizedRadius));
            color = mix(color, uColorMid2, smoothstep(0.3, 0.58, normalizedRadius));
            color = mix(color, uColorMid3, smoothstep(0.53, 0.8, normalizedRadius));
            color = mix(color, uColorOuter, smoothstep(0.77, 1.0, normalizedRadius));
            
            color *= (0.5 + noiseVal * 1.0);
            float brightness = pow(1.0 - normalizedRadius, 1.5) * 3.2 + 0.15;
            brightness *= (0.3 + noiseVal * 2.2);
            float approaching = dot(normalize(vFlowDir), normalize(uCameraPosition - vWorldPos));
            brightness *= 1.0 + 0.3 * approaching;
            
            float pulse = sin(uTime * 1.8 + normalizedRadius * 12.0 + vAngle * 2.0) * 0.15 + 0.85;
            brightness *= pulse;
            
            float alpha = uDensity * (0.2 + noiseVal * 0.9);
            alpha *= smoothstep(0.0, 0.15, normalizedRadius);
            alpha *= (1.0 - smoothstep(0.85, 1.0, normalizedRadius));
            alpha = clamp(alpha, 0.0, 1.0);

            gl_FragColor = vec4(color * brightness, alpha);
        }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});

const accretionDisk = new THREE.Mesh(diskGeometry, diskMaterial);
accretionDisk.rotation.x = DISK_TILT_ANGLE;
accretionDisk.renderOrder = 1;
scene.add(accretionDisk);

const clock = new THREE.Clock();
const blackHoleScreenPosVec3 = new THREE.Vector3();
let elapsedTime = 0;
let autoResumeAt = 0;
let resizeTimeout;
const TOUR_COUNTDOWN = 5;
const TOUR_DURATION = 29;
let tourState = 'idle';
let tourStartedAt = 0;
let tourRoute = [];
let lastCountdown = 0;
const tourShots = [
    { time: 4, position: [-11, 5, 11] },
    { time: 10, position: [-7, 3.3, 6] },
    { time: 17, position: [-2.2, 1.5, 3.2] },
    { time: 23, position: [2.4, 1.1, 2.2] },
    { time: TOUR_DURATION, position: [6, 3, 7] }
];

function persist() {
    try { localStorage.setItem('black-hole-cinematic-v2', JSON.stringify({ look: lookName, quality: qualityMode, motion: motionEnabled, camera: cameraEnabled, ...overrides })); } catch { /* Storage is optional. */ }
}

function applyLook() {
    const look = LOOKS[lookName];
    for (const [index, key] of ['uColorHot', 'uColorMid1', 'uColorMid2', 'uColorMid3', 'uColorOuter'].entries()) {
        diskMaterial.uniforms[key].value.set(look.colors[index]);
    }
    photonRing.material.uniforms.uRingColor.value.set(look.colors[1]);
    eventHorizonMat.uniforms.uGlowColor.value.set(look.colors[1]);
    diskMaterial.uniforms.uDensity.value = look.density;
    starMaterial.uniforms.uOpacity.value = look.stars;
    bloomPass.strength = look.bloom * (overrides.bloom / 50);
    lensingPass.uniforms.lensingStrength.value = look.lensing * (overrides.lensing / 50);
    lensingPass.uniforms.chromaticAberration.value = look.aberration;
    renderer.toneMappingExposure = look.exposure;
    lensingPass.uniforms.exposureScale.value = 0.5 + overrides.exposure / 100;
    bloomPass.enabled = QUALITY[activeQuality].bloom && overrides.bloom > 0;
    document.getElementById('look-description').textContent = look.description;
    document.querySelectorAll('[data-look]').forEach(button => {
        const active = button.dataset.look === lookName;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
    });
    for (const key of Object.keys(overrides)) {
        document.getElementById(key).value = overrides[key];
        document.getElementById(`${key}-value`).textContent = `${Math.round(overrides[key])}%`;
    }
}

function resizeRenderer() {
    const ratio = Math.min(window.devicePixelRatio || 1, QUALITY[activeQuality].dpr);
    renderer.setPixelRatio(ratio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setPixelRatio(ratio);
    composer.setSize(window.innerWidth, window.innerHeight);
    starMaterial.uniforms.uPixelRatio.value = ratio;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    lensingPass.uniforms.aspectRatio.value = camera.aspect;
}

function applyQuality() {
    activeQuality = qualityMode === 'auto' ? autoQuality() : qualityMode;
    const budget = QUALITY[activeQuality];
    starGeometry.setDrawRange(0, budget.stars);
    ui.note.textContent = `${qualityMode === 'auto' ? 'Auto → ' : ''}${budget.label} · ${budget.stars.toLocaleString('es-MX')} estrellas`;
    ui.quality.value = qualityMode;
    resizeRenderer();
    applyLook();
}

function applyCamera() {
    ui.camera.checked = cameraEnabled;
    controls.autoRotateSpeed = 0.16;
    controls.autoRotate = tourState === 'idle' && cameraEnabled && performance.now() > autoResumeAt;
}

function stopTour() {
    if (tourState === 'idle') return;
    tourState = 'idle';
    document.body.classList.remove('tour-active');
    ui.tour.hidden = true;
    controls.enabled = true;
    controls.target.set(0, 0, 0);
    controls.update();
    autoResumeAt = performance.now() + 12000;
    applyCamera();
}

function startTour() {
    if (tourState !== 'idle') stopTour();
    tourRoute = [{ time: 0, position: camera.position.clone() },
        ...tourShots.map(shot => ({ ...shot, position: new THREE.Vector3(...shot.position) }))];
    tourState = 'countdown';
    document.body.classList.remove('tour-active');
    tourStartedAt = performance.now();
    lastCountdown = 5;
    controls.enabled = false;
    controls.autoRotate = false;
    ui.tour.hidden = false;
    ui.tourPhase.textContent = 'CÁMARA INTERSTELLAR';
    ui.tourCount.textContent = '5';
    ui.tourDescription.textContent = 'El viaje comienza en breve';
    setPanel(false);
}

function updateTour(now) {
    if (tourState === 'idle') return;
    const elapsed = (now - tourStartedAt) / 1000;
    if (tourState === 'countdown') {
        const remaining = Math.ceil(TOUR_COUNTDOWN - elapsed);
        if (remaining > 0) {
            if (remaining !== lastCountdown) ui.tourCount.textContent = String(remaining);
            lastCountdown = remaining;
            return;
        }
        tourState = 'running';
        ui.tour.hidden = true;
        document.body.classList.add('tour-active');
    }
    const progress = Math.min(TOUR_DURATION, elapsed - TOUR_COUNTDOWN);
    if (progress >= TOUR_DURATION) { stopTour(); return; }
    const sceneIndex = tourRoute.findIndex((shot, index) => index > 0 && progress <= shot.time);
    const from = tourRoute[sceneIndex - 1];
    const to = tourRoute[sceneIndex];
    const fraction = THREE.MathUtils.clamp((progress - from.time) / (to.time - from.time), 0, 1);
    const eased = fraction * fraction * (3 - 2 * fraction);
    camera.position.lerpVectors(from.position, to.position, eased);
    camera.lookAt(0, 0, 0);
}

function setPanel(open) {
    ui.panel.classList.toggle('open', open);
    ui.toggle.setAttribute('aria-expanded', String(open));
}

ui.toggle.addEventListener('click', () => setPanel(!ui.panel.classList.contains('open')));
document.getElementById('panel-close').addEventListener('click', () => setPanel(false));
document.addEventListener('keydown', event => { if (event.key === 'Escape') { setPanel(false); stopTour(); } });
document.getElementById('tour-start').addEventListener('click', startTour);
document.getElementById('tour-cancel').addEventListener('click', stopTour);
renderer.domElement.addEventListener('pointerdown', stopTour);
document.querySelectorAll('[data-look]').forEach(button => button.addEventListener('click', () => {
    if (!Object.hasOwn(LOOKS, button.dataset.look)) return;
    lookName = button.dataset.look; applyLook(); persist();
}));
ui.quality.addEventListener('change', () => { qualityMode = ui.quality.value; applyQuality(); persist(); });
for (const key of Object.keys(overrides)) {
    document.getElementById(key).addEventListener('input', event => {
        overrides[key] = Number(event.target.value); applyLook(); persist();
    });
}
ui.camera.addEventListener('change', () => { cameraEnabled = ui.camera.checked; applyCamera(); persist(); });
ui.motion.addEventListener('change', () => { motionEnabled = ui.motion.checked; persist(); });
document.getElementById('reset').addEventListener('click', () => {
    lookName = 'observatory'; qualityMode = 'auto'; motionEnabled = true; cameraEnabled = false;
    for (const key of Object.keys(overrides)) overrides[key] = 50;
    ui.motion.checked = true; applyQuality(); applyCamera(); persist();
});
controls.addEventListener('start', () => {
    autoResumeAt = performance.now() + 12000;
    controls.autoRotate = false;
});
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => { if (qualityMode === 'auto') applyQuality(); else resizeRenderer(); }, 150);
});

ui.motion.checked = motionEnabled;
applyQuality();
applyCamera();

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = Math.min(clock.getDelta(), 0.05);
    if (motionEnabled) elapsedTime += deltaTime;
    diskMaterial.uniforms.uTime.value = elapsedTime;
    starMaterial.uniforms.uTime.value = elapsedTime;
    eventHorizonMat.uniforms.uTime.value = elapsedTime;
    const now = performance.now();
    updateTour(now);
    if (tourState === 'idle') {
        if (cameraEnabled && !controls.autoRotate && now > autoResumeAt) controls.autoRotate = true;
        controls.update();
    }
    photonRing.quaternion.copy(camera.quaternion);
    blackHoleScreenPosVec3.copy(blackHoleMesh.position).project(camera);
    lensingPass.uniforms.blackHoleScreenPos.value.set(
        (blackHoleScreenPosVec3.x + 1) / 2, (blackHoleScreenPosVec3.y + 1) / 2
    );
    if (motionEnabled) {
        stars.rotation.y += deltaTime * 0.003;
        stars.rotation.x += deltaTime * 0.001;
        accretionDisk.rotation.z += deltaTime * 0.005;
    }
    composer.render(deltaTime);
}

animate();
