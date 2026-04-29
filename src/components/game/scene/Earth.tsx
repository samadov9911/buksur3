/**
 * Earth with realistic multi-layered atmosphere and real night lights.
 * Uses real Earth day texture (earth.jpg) and real night city lights (night.jpg),
 * specular map, and a view-dependent Rayleigh-scattering atmosphere shader.
 * Realistic terminator with atmospheric scattering glow.
 */
'use client';

import { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Sun direction matching the directional light position [5, 3, 5]
const SUN_DIRECTION = new THREE.Vector3(5, 3, 5).normalize();

// ---------- Shader source code ----------

const outerAtmosphereVertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const outerAtmosphereFragmentShader = /* glsl */ `
  uniform vec3 uCameraPosition;
  uniform vec3 uSunDirection;

  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  void main() {
    vec3 viewDir = normalize(uCameraPosition - vWorldPosition);
    float rim = 1.0 - abs(dot(viewDir, -vWorldNormal));
    float intensity = pow(rim, 2.0);
    float sunAlignment = max(0.0, dot(-vWorldNormal, uSunDirection));
    float sunFactor = pow(sunAlignment, 0.8) * 0.50 + 0.50;

    // Smooth blue atmosphere — continuous gradient, no sharp transitions
    vec3 deepBlue    = vec3(0.25, 0.42, 0.88);
    vec3 paleBlue    = vec3(0.35, 0.55, 0.95);
    vec3 hazeWhite   = vec3(0.50, 0.65, 0.95);
    vec3 sunsetTint  = vec3(0.55, 0.40, 0.65);
    vec3 sunGlow     = vec3(0.45, 0.58, 0.92);

    vec3 color = mix(deepBlue, paleBlue, smoothstep(0.10, 0.45, rim));
    color = mix(color, hazeWhite, smoothstep(0.30, 0.80, rim));
    color = mix(color, sunsetTint, smoothstep(0.75, 1.0, rim) * 0.15);
    color = mix(color, sunGlow, sunAlignment * 0.15);

    float alphaFade = 1.0 - smoothstep(0.85, 1.0, rim);
    float alpha = intensity * 0.95 * sunFactor * alphaFade;

    gl_FragColor = vec4(color * sunFactor, alpha);
  }
`;

const innerAtmosphereVertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const innerAtmosphereFragmentShader = /* glsl */ `
  uniform vec3 uCameraPosition;
  uniform vec3 uSunDirection;

  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  void main() {
    vec3 viewDir = normalize(uCameraPosition - vWorldPosition);
    float rim = 1.0 - abs(dot(viewDir, vWorldNormal));
    // Wider, softer falloff — smooth transition to outer atmosphere
    float intensity = pow(rim, 3.0);
    float sunAlignment = max(0.0, dot(vWorldNormal, uSunDirection));
    float sunFactor = sunAlignment * 0.5 + 0.5;
    // Smooth blue gradient, no hard color transitions
    vec3 coreColor = vec3(0.30, 0.48, 0.92);
    vec3 midBlue   = vec3(0.42, 0.60, 0.95);
    vec3 whitePeak = vec3(0.65, 0.74, 0.97);
    vec3 color = mix(coreColor, midBlue, smoothstep(0.10, 0.55, rim));
    color = mix(color, whitePeak, smoothstep(0.40, 0.95, rim));
    // Gentle alpha fade at the edge for seamless blending with outer
    float edgeFade = 1.0 - smoothstep(0.80, 1.0, rim);
    float alpha = intensity * 0.80 * sunFactor * edgeFade;
    gl_FragColor = vec4(color, alpha);
  }
`;

const limbVertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const limbFragmentShader = /* glsl */ `
  uniform vec3 uCameraPosition;
  uniform vec3 uSunDirection;

  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  void main() {
    vec3 viewDir = normalize(uCameraPosition - vWorldPosition);
    float rim = 1.0 - abs(dot(viewDir, vWorldNormal));
    // Soft limb enhancement — no sharp band, blends with inner atmosphere
    float intensity = pow(rim, 5.0);
    float sunAlignment = max(0.0, dot(vWorldNormal, uSunDirection));
    float sunFactor = sunAlignment * 0.45 + 0.55;
    // Smooth blue glow, continuous gradient
    vec3 limbColor = vec3(0.35, 0.55, 0.95);
    vec3 whitePeak = vec3(0.72, 0.80, 1.00);
    vec3 color = mix(limbColor, whitePeak, smoothstep(0.30, 0.90, rim));
    // Gentle wide bell curve — no sharp band edges
    float envelope = smoothstep(0.15, 0.45, rim) * (1.0 - smoothstep(0.70, 1.0, rim));
    float alpha = intensity * 0.55 * sunFactor * envelope;
    gl_FragColor = vec4(color * sunFactor, alpha);
  }
`;

// ---------- Earth surface shader with realistic day/night cycle ----------

const earthSurfaceVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const cloudVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const cloudFragmentShader = /* glsl */ `
  uniform sampler2D uCloudMap;
  uniform vec3 uSunDirection;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 sunDir = normalize(uSunDirection);
    float sunDot = dot(normal, sunDir);

    // Cloud coverage from grayscale texture (white=cloud, black=clear)
    float cloudRaw = texture2D(uCloudMap, vUv).r;
    float cloudAlpha = smoothstep(0.12, 0.40, cloudRaw);

    // Lighting: bright on sun side, dark on night side
    float diffuse = max(0.0, sunDot);
    float terminator = smoothstep(-0.15, 0.20, sunDot);
    vec3 litColor = vec3(1.0, 1.0, 1.0) * (0.12 + 0.88 * diffuse);

    // Night side: very faint blue glow (moonlight + airglow)
    vec3 nightColor = vec3(0.03, 0.05, 0.10);
    vec3 cloudColor = mix(nightColor, litColor, terminator);

    // Subtle blue atmospheric tint on lit clouds
    cloudColor += vec3(0.02, 0.04, 0.08) * terminator;

    gl_FragColor = vec4(cloudColor, cloudAlpha * 0.55);
  }
`;

const earthSurfaceFragmentShader = /* glsl */ `
  uniform sampler2D uDayMap;
  uniform sampler2D uNightMap;
  uniform sampler2D uSpecMap;
  uniform vec3 uSunDirection;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 sunDir = normalize(uSunDirection);
    float sunDot = dot(normal, sunDir);

    // ── Realistic terminator transition ──────────────────────────
    // Ultra-wide cinematic penumbra (inspired by ISS photography & Gravity):
    //   - Three overlapping smoothstep layers for natural gradation
    //   - Extra-wide penumbra (~45°) mimics real atmospheric scattering
    //   - No hard edges — completely smooth, barely noticeable transition
    float coreDay = smoothstep(-0.15, 0.12, sunDot);       // Wide soft core (~15°)
    float wideDay = smoothstep(-0.30, 0.20, sunDot);       // Wide atmospheric zone (~28°)
    float ultraWide = smoothstep(-0.50, 0.35, sunDot);     // Ultra-wide penumbra (~48°)
    float dayFactor = mix(coreDay, wideDay, 0.35);
    dayFactor = mix(dayFactor, ultraWide, 0.25);            // Add ultra-wide softness

    // ── Day side lighting (reduced contrast, softer tones) ──────
    vec3 dayColor = texture2D(uDayMap, vUv).rgb;
    // Reduce texture contrast: lerp toward mid-gray, then boost brightness back
    vec3 mutedColor = mix(dayColor, vec3(0.45, 0.45, 0.45), 0.22) * 1.18;
    float diffuse = max(0.0, sunDot);

    // Lambertian diffuse + higher ambient for softer shadows
    vec3 dayLit = mutedColor * (0.12 + 0.88 * diffuse);

    // ── Atmospheric haze on day side (Rayleigh forward scattering) ─
    // Soft blueish atmospheric veiling over entire day side
    float limbFactor = 1.0 - abs(dot(normal, normalize(cameraPosition - vWorldPosition)));
    float dayHaze = smoothstep(0.40, 0.95, limbFactor) * 0.12 * dayFactor;
    dayLit += vec3(0.35, 0.52, 0.78) * dayHaze;

    // Ocean specular highlight (Blinn-Phong)
    float specMask = texture2D(uSpecMap, vUv).r;
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 halfDir = normalize(sunDir + viewDir);
    float spec = pow(max(0.0, dot(normal, halfDir)), 48.0) * specMask;
    dayLit += vec3(0.35, 0.35, 0.40) * spec * dayFactor;

    // ── Night side: real city lights ────────────────────────────
    vec3 nightColor = texture2D(uNightMap, vUv).rgb;
    float nightFactor = 1.0 - dayFactor;

    // City lights: visible only well into the night side, fade near terminator
    // In reality, city lights become visible when sun is >6° below horizon
    float nightIntensity = 1.0 + 0.5 * smoothstep(-0.02, -0.20, sunDot);
    // Suppress lights near terminator for realism (atmospheric glow drowns them out)
    // Very wide fade zone — lights dim gradually like they're extinguishing
    float lightsFade = smoothstep(0.10, -0.30, sunDot);
    vec3 nightLit = nightColor * nightIntensity * lightsFade;

    // ── Combine day and night ──────────────────────────────────
    vec3 finalColor = dayLit * dayFactor + nightLit * nightFactor;

    // ── Cinematic terminator atmospheric effects ───────────────
    // All effects are extremely subtle — barely noticeable, realistic space view.
    // Inspired by actual ISS photography where the terminator is a gentle gradation.

    // 1. VERY SUBTLE CORE TERMINATOR — neutral warm, nearly invisible
    float terminatorCore = 1.0 - smoothstep(0.0, 0.10, abs(sunDot));
    finalColor += vec3(0.06, 0.05, 0.04) * terminatorCore * 0.03;

    // 2. FAINT GOLDEN HOUR — almost imperceptible warm tint
    float goldenHour = smoothstep(-0.05, 0.10, sunDot) * (1.0 - smoothstep(0.10, 0.28, sunDot));
    finalColor += vec3(0.04, 0.03, 0.02) * goldenHour * 0.02;

    // 3. VERY FAINT RAYLEIGH HAZE — barely visible blue
    float rayleighHaze = 1.0 - smoothstep(0.0, 0.30, abs(sunDot));
    finalColor += vec3(0.02, 0.04, 0.10) * rayleighHaze * 0.02;

    // 4. ALMOST INVISIBLE TWILIGHT — very faint purple, barely seen
    float twilightPurple = smoothstep(-0.18, -0.06, sunDot) * (1.0 - smoothstep(-0.06, 0.02, sunDot));
    finalColor += vec3(0.03, 0.02, 0.05) * twilightPurple * 0.015;

    // 5. EARTH SHADOW — subtle darkening
    float earthShadow = smoothstep(-0.12, -0.03, sunDot) * (1.0 - smoothstep(-0.03, 0.0, sunDot));
    finalColor *= 1.0 - earthShadow * 0.02;

    // 6. ALMOST INVISIBLE REFRACTION GLOW
    float refractionGlow = smoothstep(-0.12, -0.02, sunDot) * (1.0 - smoothstep(-0.02, 0.02, sunDot));
    finalColor += vec3(0.02, 0.02, 0.01) * refractionGlow * 0.015;

    // 7. TERMINATOR LIMB GLOW — extremely subtle, only visible at the limb edge
    float viewSunAngle = dot(viewDir, sunDir);
    float limbViewMask = smoothstep(-0.2, 0.1, viewSunAngle) * (1.0 - smoothstep(0.2, 0.7, viewSunAngle));
    float terminatorLimbMask = (1.0 - smoothstep(0.0, 0.12, abs(sunDot))) * limbViewMask;
    finalColor += vec3(0.05, 0.07, 0.12) * terminatorLimbMask * 0.02;

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// ---------- Component ----------

export default function Earth() {
  const earthRef = useRef<THREE.Mesh>(null);
  const cloudRef = useRef<THREE.Mesh>(null);
  const outerAtmRef = useRef<THREE.Mesh>(null);
  const innerAtmRef = useRef<THREE.Mesh>(null);
  const limbAtmRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = outerAtmRef;

  // Mobile detection — reduce geometry complexity on mobile GPUs
  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);
  }, []);
  // 32 segments on mobile, 64 on desktop — halves triangle count
  const segments = isMobile ? 32 : 64;

  const [earthTexture, setEarthTexture] = useState<THREE.Texture | null>(null);
  const [nightTexture, setNightTexture] = useState<THREE.Texture | null>(null);
  const [cloudTexture, setCloudTexture] = useState<THREE.Texture | null>(null);

  // ── Fallback procedural night texture (used if real texture fails) ──
  const fallbackNightTexture = useMemo(() => createFallbackNightTexture(isMobile), [isMobile]);

  // ── Load day texture ──────────────────────────────────────────
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    const maxAniso = isMobile ? 1 : 4;
    loader.load(
      '/earth.jpg',
      (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.anisotropy = maxAniso;
        setEarthTexture(texture);
      },
      undefined,
      () => setEarthTexture(createFallbackDayTexture())
    );
  }, [isMobile]);

  // ── Load real night city lights texture ──────────────────────
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    const maxAniso = isMobile ? 1 : 4;
    loader.load(
      '/night.jpg',
      (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.anisotropy = maxAniso;
        texture.colorSpace = THREE.SRGBColorSpace;
        setNightTexture(texture);
      },
      undefined,
      () => setNightTexture(createFallbackNightTexture(isMobile))
    );
  }, [isMobile]);

  // ── Load cloud texture ──────────────────────────────────────
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    const maxAniso = isMobile ? 1 : 4;
    loader.load(
      '/clouds.jpg',
      (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.anisotropy = maxAniso;
        setCloudTexture(texture);
      },
      undefined,
      () => setCloudTexture(null)
    );
  }, [isMobile]);

  // ── Specular map (oceans are shiny) ─────────────────────────
  const specularTexture = useMemo(() => {
    const texSize = isMobile ? 1024 : 2048; // Half resolution on mobile
    const canvas = document.createElement('canvas');
    canvas.width = texSize;
    canvas.height = texSize / 2;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#333333';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#aaaaaa';
    // Scale regions proportionally
    const sx = w / 2048;
    const sy = h / 1024;
    ctx.fillRect(200 * sx, 200 * sy, 500 * sx, 500 * sy);
    ctx.fillRect(900 * sx, 200 * sy, 250 * sx, 600 * sy);
    ctx.fillRect(1200 * sx, 350 * sy, 300 * sx, 400 * sy);
    ctx.fillRect(100 * sx, 650 * sy, 1800 * sx, 200 * sy);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }, [isMobile]);

  // ── Earth surface shader uniforms ─────────────────────────────
  const earthSurfaceUniforms = useMemo(
    () => ({
      uDayMap: { value: earthTexture },
      uNightMap: { value: nightTexture || fallbackNightTexture },
      uSpecMap: { value: specularTexture },
      uSunDirection: { value: SUN_DIRECTION.clone() },
    }),
    [earthTexture, nightTexture, fallbackNightTexture, specularTexture]
  );

  // ── Atmosphere shader uniforms ───────────────────────────────
  const outerAtmosphereUniforms = useMemo(
    () => ({
      uCameraPosition: { value: new THREE.Vector3() },
      uSunDirection: { value: SUN_DIRECTION.clone() },
    }),
    []
  );

  const innerAtmosphereUniforms = useMemo(
    () => ({
      uCameraPosition: { value: new THREE.Vector3() },
      uSunDirection: { value: SUN_DIRECTION.clone() },
    }),
    []
  );

  const limbAtmosphereUniforms = useMemo(
    () => ({
      uCameraPosition: { value: new THREE.Vector3() },
      uSunDirection: { value: SUN_DIRECTION.clone() },
    }),
    []
  );

  // ── Cloud shader uniforms ────────────────────────────────────
  const cloudUniforms = useMemo(
    () => ({
      uCloudMap: { value: cloudTexture },
      uSunDirection: { value: SUN_DIRECTION.clone() },
    }),
    [cloudTexture]
  );

  // ── Per-frame updates ───────────────────────────────────────
  useFrame(({ camera }, delta) => {
    if (earthRef.current) {
      earthRef.current.rotation.y += delta * 0.015;
    }
    // Clouds rotate independently with visible wind drift
    if (cloudRef.current) {
      cloudRef.current.rotation.y += delta * 0.020;
    }
    if (outerAtmRef.current) {
      outerAtmRef.current.material.uniforms.uCameraPosition.value.copy(camera.position);
    }
    if (innerAtmRef.current) {
      innerAtmRef.current.material.uniforms.uCameraPosition.value.copy(camera.position);
    }
    if (limbAtmRef.current) {
      limbAtmRef.current.material.uniforms.uCameraPosition.value.copy(camera.position);
    }
  });

  // ── Loading placeholder ─────────────────────────────────────
  if (!earthTexture) {
    return (
      <mesh>
        <sphereGeometry args={[1, segments, segments]} />
        <meshPhongMaterial color="#1a3a5c" />
      </mesh>
    );
  }

  return (
    <group>
      {/* ── Earth surface (day/night shader with realistic terminator) ── */}
      <mesh ref={earthRef}>
        <sphereGeometry args={[1, segments, segments]} />
        <shaderMaterial
          vertexShader={earthSurfaceVertexShader}
          fragmentShader={earthSurfaceFragmentShader}
          uniforms={earthSurfaceUniforms}
        />
      </mesh>

      {/* ── Cloud layer – textured clouds at ~50 km altitude ── */}
      {cloudTexture && (
        <mesh ref={cloudRef}>
          <sphereGeometry args={[1.0078, segments, segments]} />
          <shaderMaterial
            vertexShader={cloudVertexShader}
            fragmentShader={cloudFragmentShader}
            uniforms={cloudUniforms}
            transparent
            depthWrite={false}
            side={THREE.FrontSide}
          />
        </mesh>
      )}

      {/* ── Dense atmosphere – up to ~250 km (enhanced density) ── */}
      <mesh ref={innerAtmRef}>
        <sphereGeometry args={[1.035, segments, segments]} />
        <shaderMaterial
          vertexShader={innerAtmosphereVertexShader}
          fragmentShader={innerAtmosphereFragmentShader}
          uniforms={innerAtmosphereUniforms}
          transparent
          depthWrite={false}
          side={THREE.FrontSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* ── Limb atmosphere – bright atmospheric rim line (FrontSide) ── */}
      <mesh ref={limbAtmRef}>
        <sphereGeometry args={[1.035, segments, segments]} />
        <shaderMaterial
          vertexShader={limbVertexShader}
          fragmentShader={limbFragmentShader}
          uniforms={limbAtmosphereUniforms}
          transparent
          depthWrite={false}
          side={THREE.FrontSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* ── Outer atmosphere – soft blue halo (BackSide) — overlaps inner ── */}
      <mesh ref={outerAtmRef}>
        <sphereGeometry args={[1.055, segments, segments]} />
        <shaderMaterial
          vertexShader={outerAtmosphereVertexShader}
          fragmentShader={outerAtmosphereFragmentShader}
          uniforms={outerAtmosphereUniforms}
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

// ===================================================================
// Helper texture generators
// ===================================================================

/** Procedural fallback day texture if earth.jpg fails to load */
function createFallbackDayTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createLinearGradient(0, 0, 0, 1024);
  gradient.addColorStop(0, '#1a3a5c');
  gradient.addColorStop(0.3, '#1e5799');
  gradient.addColorStop(0.5, '#2074b0');
  gradient.addColorStop(0.7, '#1e5799');
  gradient.addColorStop(1, '#1a3a5c');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 2048, 1024);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** Procedural fallback night texture if night.jpg fails to load */
function createFallbackNightTexture(mobile = false): THREE.CanvasTexture {
  const scale = mobile ? 0.5 : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(2048 * scale);
  canvas.height = Math.round(1024 * scale);
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);

  const cities = [
    { x: 1050, y: 280, r: 80 }, { x: 1120, y: 270, r: 50 },
    { x: 1070, y: 290, r: 40 }, { x: 1020, y: 260, r: 35 },
    { x: 1150, y: 250, r: 30 }, { x: 1250, y: 240, r: 70 },
    { x: 1350, y: 220, r: 40 }, { x: 1450, y: 210, r: 50 },
    { x: 1550, y: 320, r: 80 }, { x: 1600, y: 340, r: 60 },
    { x: 1500, y: 350, r: 70 }, { x: 1450, y: 300, r: 40 },
    { x: 1350, y: 350, r: 55 }, { x: 1480, y: 380, r: 30 },
    { x: 1180, y: 340, r: 35 }, { x: 1220, y: 370, r: 25 },
    { x: 1060, y: 400, r: 25 }, { x: 1100, y: 470, r: 20 },
    { x: 1150, y: 520, r: 25 }, { x: 1080, y: 550, r: 50 },
    { x: 480, y: 280, r: 80 }, { x: 420, y: 260, r: 60 },
    { x: 380, y: 300, r: 40 }, { x: 340, y: 310, r: 50 },
    { x: 300, y: 280, r: 70 }, { x: 520, y: 260, r: 25 },
    { x: 580, y: 480, r: 50 }, { x: 560, y: 460, r: 40 },
    { x: 540, y: 430, r: 25 }, { x: 520, y: 520, r: 30 },
    { x: 1640, y: 580, r: 40 }, { x: 1600, y: 570, r: 35 },
  ];

  for (const city of cities) {
    const cx = city.x * scale;
    const cy = city.y * scale;
    const cr = city.r * scale;
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * cr * 0.5;
      const alpha = Math.random() * 0.95 + 0.05;
      ctx.fillStyle = `rgba(255, 210, 120, ${alpha})`;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, Math.random() * 2.5 * scale + 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = cr * 0.3 + Math.random() * cr * 0.7;
      const alpha = Math.random() * 0.4 + 0.1;
      ctx.fillStyle = `rgba(255, 190, 90, ${alpha})`;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, Math.random() * 1.8 * scale + 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr * 1.2);
    gradient.addColorStop(0, 'rgba(255, 200, 100, 0.15)');
    gradient.addColorStop(0.5, 'rgba(255, 180, 80, 0.06)');
    gradient.addColorStop(1, 'rgba(255, 160, 60, 0.0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, cr * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}
