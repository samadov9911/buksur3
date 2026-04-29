/**
 * SpaceScene — main 3D scene for ORBITAL TUG simulator
 * Stars, lighting, camera, tug models, debris, orbits
 */
'use client';

import { useRef, useMemo, useCallback, useEffect } from 'react';

/** Tug visual scale — real tug ~2m = invisible in Three.js.
 *  TUG_SCALE=0.2 makes tug ~30 km visual — exaggerated but
 *  allows seeing details without intersecting atmosphere. */
const TUG_SCALE = 0.2;
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';

// Patch BufferGeometry.computeBoundingSphere to silently handle NaN positions
// which occur on first render before useFrame updates geometry positions
const _origComputeBS = THREE.BufferGeometry.prototype.computeBoundingSphere;
THREE.BufferGeometry.prototype.computeBoundingSphere = function () {
  const pos = this.getAttribute('position');
  if (pos) {
    const arr = pos.array as Float32Array;
    for (let i = 0; i < Math.min(arr.length, 36); i++) {
      if (arr[i] !== arr[i]) return this; // NaN detected — skip
    }
  }
  return _origComputeBS.call(this);
};
import Earth from './Earth';

// ============================================================
// Helper: map a value from one range to another, clamped
// ============================================================
function remap(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const t = Math.max(0, Math.min(1, (value - inMin) / (inMax - inMin)));
  return outMin + t * (outMax - outMin);
}

// ============================================================
// Tug marker (always visible from any distance)
// ============================================================
// ============================================================
// ============================================================
// REENTRY FIRE EFFECT — realistic atmospheric burning from 250km
// Includes: debris fragments, bow shock, extended plasma trail,
// flickering sparks, multi-stage color gradient
// ============================================================
function ReentryFireEffect({ position, altitude }: { position: THREE.Vector3; altitude: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const debrisGroupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const glowRef = useRef<THREE.PointLight>(null);
  const glowRef2 = useRef<THREE.PointLight>(null);

  // Debris particle config (stable across renders)
  const debrisConfig = useMemo(() =>
    Array.from({ length: 14 }).map(() => ({
      ox: (Math.random() - 0.5) * 0.005,
      oy: (Math.random() - 0.5) * 0.005,
      oz: -(Math.random() * 0.035 + 0.008),
      size: Math.random() * 0.0008 + 0.0003,
      speed: Math.random() * 0.015 + 0.005,
      phase: Math.random() * Math.PI * 2,
    })), []);

  // Extended altitude range: 250km = faint glow, 180km = visible, 100km = intense, 80km = extreme
  const intensity = useMemo(() => {
    if (altitude >= 250_000) return 0;
    if (altitude <= 80_000) return 1.0;
    const t = (250_000 - altitude) / 170_000; // 0 at 250km, 1.0 at 80km
    return Math.pow(t, 2.0); // Gradual start, rapid increase at lower altitudes
  }, [altitude]);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;

    if (groupRef.current) {
      groupRef.current.position.copy(position);
      // Multi-frequency flickering scale for realistic fire effect
      const flicker = 1.0
        + Math.sin(t * 30) * 0.08
        + Math.sin(t * 47) * 0.05
        + Math.sin(t * 73) * 0.03
        + Math.sin(t * 97) * 0.02;
      groupRef.current.scale.setScalar(flicker);
    }

    // Animate debris fragments — drift backward and flicker
    if (debrisGroupRef.current) {
      debrisGroupRef.current.children.forEach((child, i) => {
        const d = debrisConfig[i];
        if (!d) return;
        const drift = ((t * d.speed + d.phase) % 0.06);
        child.position.set(
          d.ox + Math.sin(t * 30 + d.phase) * 0.001,
          d.oy + Math.cos(t * 25 + d.phase) * 0.0008,
          d.oz - drift
        );
        const fade = Math.max(0.05, 1 - drift * 15);
        child.scale.setScalar(fade);
      });
    }

    if (glowRef.current) {
      const flicker = intensity * (3.0 + Math.sin(t * 25) * 0.8 + Math.sin(t * 41) * 0.5 + Math.sin(t * 67) * 0.3);
      glowRef.current.intensity = flicker;
    }
    if (glowRef2.current) {
      const flicker = intensity * (2.0 + Math.sin(t * 33) * 0.6 + Math.sin(t * 55) * 0.2);
      glowRef2.current.intensity = flicker;
    }
  });

  if (intensity <= 0.005) return null;

  // Multi-stage color gradient: dark red → red → orange → yellow → white-hot
  const coreColor = intensity < 0.15
    ? '#aa1100'
    : intensity < 0.3
      ? '#dd3300'
      : intensity < 0.5
        ? '#ff6600'
        : intensity < 0.7
          ? '#ff9933'
          : intensity < 0.9
            ? '#ffcc44'
            : '#ffee88';

  const outerColor = intensity < 0.2
    ? '#881100'
    : intensity < 0.4
      ? '#cc2200'
      : intensity < 0.6
        ? '#ff4400'
        : '#ffaa44';

  return (
    <group ref={groupRef}>
      {/* White-hot inner core (visible at high intensity) */}
      {intensity > 0.5 && (
        <mesh>
          <sphereGeometry args={[0.004 * intensity + 0.002, 10, 10]} />
          <meshBasicMaterial
            color={intensity > 0.85 ? '#ffffcc' : '#ffdd88'}
            transparent
            opacity={(intensity - 0.5) * 1.2}
          />
        </mesh>
      )}

      {/* Central fire glow — bright core */}
      <mesh>
        <sphereGeometry args={[0.008 * intensity + 0.003, 12, 12]} />
        <meshBasicMaterial
          color={coreColor}
          transparent
          opacity={Math.min(1, intensity * 0.8)}
        />
      </mesh>

      {/* Outer fire envelope */}
      <mesh>
        <sphereGeometry args={[0.015 * intensity + 0.006, 12, 12]} />
        <meshBasicMaterial
          color={outerColor}
          transparent
          opacity={Math.min(1, intensity * 0.35)}
        />
      </mesh>

      {/* Atmospheric halo */}
      {intensity > 0.2 && (
        <mesh>
          <sphereGeometry args={[0.025 * intensity + 0.01, 10, 10]} />
          <meshBasicMaterial
            color="#ff4400"
            transparent
            opacity={intensity * 0.1}
          />
        </mesh>
      )}

      {/* Bow shock wave — flattened disc perpendicular to velocity */}
      <mesh position={[0, 0, 0.012 * intensity + 0.004]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[
          0.015 * intensity + 0.005,
          0.018 * intensity + 0.007,
          0.001,
          20
        ]} />
        <meshBasicMaterial
          color={intensity > 0.7 ? '#ffeecc' : intensity > 0.4 ? '#ffaa66' : '#ff6633'}
          transparent
          opacity={intensity * 0.25}
        />
      </mesh>

      {/* Secondary bow shock ring */}
      {intensity > 0.3 && (
        <mesh position={[0, 0, 0.014 * intensity + 0.005]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.013 * intensity + 0.004, 0.0005, 8, 24]} />
          <meshBasicMaterial
            color={intensity > 0.6 ? '#ffddaa' : '#ff8844'}
            transparent
            opacity={intensity * 0.3}
          />
        </mesh>
      )}

      {/* Extended plasma trail (6 segments for longer trail) */}
      {[0, 0.06, 0.12, 0.18, 0.24, 0.30].map((zOff, i) => (
        <mesh key={`trail-${i}`} position={[0, (i - 2.5) * 0.0015 * intensity, -(0.012 + zOff) * intensity]}>
          <coneGeometry args={[
            Math.max(0.001, (0.005 - i * 0.0007) * intensity + 0.001),
            0.015 * intensity + 0.008,
            8
          ]} />
          <meshBasicMaterial
            color={i < 2 ? '#ff5500' : i < 4 ? '#cc2200' : '#991100'}
            transparent
            opacity={Math.max(0.05, (0.55 - i * 0.08) * intensity)}
          />
        </mesh>
      ))}

      {/* Side plasma wisps */}
      {[-1, 1].map((side: number) => (
        <mesh key={`wisp-${side}`} position={[side * (0.007 * intensity + 0.002), 0, -0.006 * intensity]}>
          <coneGeometry args={[0.003 * intensity + 0.001, 0.018 * intensity + 0.005, 6]} />
          <meshBasicMaterial
            color="#ff4400"
            transparent
            opacity={0.3 * intensity}
          />
        </mesh>
      ))}

      {/* Top/bottom plasma wisps */}
      {[-1, 1].map((side: number) => (
        <mesh key={`wisp-tb-${side}`} position={[0, side * (0.005 * intensity + 0.001), -0.004 * intensity]}>
          <coneGeometry args={[0.002 * intensity + 0.0005, 0.012 * intensity + 0.004, 6]} />
          <meshBasicMaterial
            color="#ff3300"
            transparent
            opacity={0.2 * intensity}
          />
        </mesh>
      ))}

      {/* Debris fragments — small breaking-off particles */}
      <group ref={debrisGroupRef}>
        {debrisConfig.map((d, i) => (
          <mesh key={`debris-${i}`} position={[d.ox, d.oy, d.oz]}>
            <boxGeometry args={[d.size, d.size, d.size]} />
            <meshBasicMaterial
              color={i % 3 === 0 ? '#ffcc00' : i % 3 === 1 ? '#ff8800' : '#ff4400'}
              transparent
              opacity={0.7}
            />
          </mesh>
        ))}
      </group>

      {/* Flickering spark particles */}
      {Array.from({ length: 8 }).map((_, i) => {
        const ox = Math.sin(i * 1.7 + 3.14) * 0.003;
        const oy = Math.cos(i * 2.3 + 1.57) * 0.003;
        const oz = -(i * 0.004 + 0.005);
        return (
          <mesh key={`spark-${i}`} position={[ox, oy, oz]}>
            <sphereGeometry args={[0.0003, 4, 4]} />
            <meshBasicMaterial
              color={intensity > 0.6 ? '#ffff88' : '#ffcc44'}
              transparent
              opacity={intensity * 0.9}
            />
          </mesh>
        );
      })}

      {/* Point lights for illumination */}
      <pointLight
        ref={glowRef}
        color="#ff6622"
        intensity={intensity * 3}
        distance={0.4}
        decay={2}
      />
      <pointLight
        ref={glowRef2}
        color="#ff4400"
        intensity={intensity * 2}
        distance={0.25}
        decay={2}
      />
      {/* White-hot point light at extreme intensity */}
      {intensity > 0.7 && (
        <pointLight
          color="#ffddaa"
          intensity={(intensity - 0.7) * 5}
          distance={0.15}
          decay={2}
        />
      )}
    </group>
  );
}

// ============================================================
// CAPTURE ANIMATION — visual capture mechanism during capturing state
// Shows: harpoon projectile, manipulator arm, or net deployment
// ============================================================
function CaptureAnimation({
  tugPosition,
  targetPosition,
  captureProgress,
  captureType,
}: {
  tugPosition: THREE.Vector3;
  targetPosition: THREE.Vector3 | null;
  captureProgress: number;
  captureType: string;
}) {
  if (!targetPosition || captureProgress <= 0 || captureProgress >= 1) return null;

  switch (captureType) {
    case 'harpoon':
      return <HarpoonProjectile tugPosition={tugPosition} targetPosition={targetPosition} progress={captureProgress} />;
    case 'manipulator':
      return <ManipulatorArm tugPosition={tugPosition} targetPosition={targetPosition} progress={captureProgress} />;
    case 'net':
      return <NetDeployment tugPosition={tugPosition} targetPosition={targetPosition} progress={captureProgress} />;
    default:
      return null;
  }
}

/** Harpoon projectile — shoots from tug to target with tether line */
function HarpoonProjectile({ tugPosition, targetPosition, progress }: {
  tugPosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
  progress: number;
}) {
  const projRef = useRef<THREE.Mesh>(null);
  const lineRef = useRef<THREE.Line>(null);
  const flashMatRef = useRef<THREE.MeshBasicMaterial>(null);

  // Projectile fires in first 30% of progress, then stays at target
  const fireProgress = Math.min(1, progress / 0.3);

  const tetherPositions = useMemo(() => new Float32Array([0, 0, 0, 0, 0, 0]), []);

  useFrame(() => {
    if (projRef.current) {
      projRef.current.position.lerpVectors(tugPosition, targetPosition, fireProgress);
      projRef.current.lookAt(targetPosition);
    }
    if (lineRef.current) {
      const pos = lineRef.current.geometry.attributes.position;
      if (pos) {
        const s = (v: number) => (Number.isFinite(v) ? v : 0);
        pos.array[0] = s(tugPosition.x);
        pos.array[1] = s(tugPosition.y);
        pos.array[2] = s(tugPosition.z);
        pos.array[3] = s(tugPosition.x + (targetPosition.x - tugPosition.x) * fireProgress);
        pos.array[4] = s(tugPosition.y + (targetPosition.y - tugPosition.y) * fireProgress);
        pos.array[5] = s(tugPosition.z + (targetPosition.z - tugPosition.z) * fireProgress);
        pos.needsUpdate = true;
        lineRef.current.geometry.computeBoundingSphere();
      }
    }
    if (flashMatRef.current) {
      flashMatRef.current.opacity = Math.max(0, 1 - progress * 12);
    }
  });

  return (
    <group>
      {/* Harpoon projectile */}
      <mesh ref={projRef}>
        <coneGeometry args={[0.001, 0.004, 6]} />
        <meshPhongMaterial
          color="#c0c0c8"
          specular="#ffffff"
          shininess={90}
          emissive="#444444"
          emissiveIntensity={0.3}
        />
      </mesh>
      {/* Tether line from tug to projectile */}
      <line ref={lineRef as any}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[tetherPositions, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#ffaa00" transparent opacity={0.8} linewidth={1} />
      </line>
      {/* Muzzle flash at tug position */}
      <mesh position={tugPosition}>
        <sphereGeometry args={[0.003, 8, 8]} />
        <meshBasicMaterial ref={flashMatRef} color="#ffff88" transparent opacity={1} />
      </mesh>
      {/* Impact flash at target when projectile arrives */}
      {progress > 0.3 && progress < 0.5 && (
        <mesh position={targetPosition}>
          <sphereGeometry args={[0.002, 8, 8]} />
          <meshBasicMaterial
            color="#ffcc44"
            transparent
            opacity={Math.max(0, 1 - (progress - 0.3) * 5)}
          />
        </mesh>
      )}
    </group>
  );
}

/** Robotic manipulator arm — extends from tug toward target in 3 segments */
function ManipulatorArm({ tugPosition, targetPosition, progress }: {
  tugPosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
  progress: number;
}) {
  const seg1Ref = useRef<THREE.Mesh>(null);
  const seg2Ref = useRef<THREE.Mesh>(null);
  const seg3Ref = useRef<THREE.Mesh>(null);
  const joint1Ref = useRef<THREE.Mesh>(null);
  const joint2Ref = useRef<THREE.Mesh>(null);
  const clawGroupRef = useRef<THREE.Group>(null);

  const _dir = useRef(new THREE.Vector3());
  const _seg1End = useRef(new THREE.Vector3());
  const _seg2End = useRef(new THREE.Vector3());
  const _mid = useRef(new THREE.Vector3());

  useFrame(() => {
    const dir = _dir.current.subVectors(targetPosition, tugPosition);
    const dist = dir.length();
    dir.normalize();
    const segLen = Math.max(0.001, dist / 3);

    // Progressive extension: segment 1 (0-33%), segment 2 (33-66%), segment 3 (66-100%)
    const s1 = Math.min(1, progress / 0.33);
    const s2 = Math.max(0, Math.min(1, (progress - 0.33) / 0.33));
    const s3 = Math.max(0, Math.min(1, (progress - 0.66) / 0.34));

    // Compute segment endpoints
    _seg1End.current.copy(tugPosition).add(dir.clone().multiplyScalar(segLen * s1));
    _seg2End.current.copy(_seg1End.current).add(dir.clone().multiplyScalar(segLen * s2));
    const seg3End = new THREE.Vector3().copy(_seg2End.current).add(dir.clone().multiplyScalar(segLen * s3));

    // Segment 1
    if (seg1Ref.current) {
      _mid.current.lerpVectors(tugPosition, _seg1End.current, 0.5);
      seg1Ref.current.position.copy(_mid.current);
      seg1Ref.current.lookAt(_seg1End.current);
      seg1Ref.current.scale.z = Math.max(0.01, s1);
    }

    // Segment 2
    if (seg2Ref.current) {
      _mid.current.lerpVectors(_seg1End.current, _seg2End.current, 0.5);
      seg2Ref.current.position.copy(_mid.current);
      seg2Ref.current.lookAt(_seg2End.current);
      seg2Ref.current.scale.z = Math.max(0.01, s2);
      seg2Ref.current.visible = s2 > 0;
    }

    // Segment 3
    if (seg3Ref.current) {
      _mid.current.lerpVectors(_seg2End.current, seg3End, 0.5);
      seg3Ref.current.position.copy(_mid.current);
      seg3Ref.current.lookAt(seg3End);
      seg3Ref.current.scale.z = Math.max(0.01, s3);
      seg3Ref.current.visible = s3 > 0;
    }

    // Joints at segment connections
    if (joint1Ref.current) {
      joint1Ref.current.position.copy(_seg1End.current);
      joint1Ref.current.visible = s1 > 0.8;
    }
    if (joint2Ref.current) {
      joint2Ref.current.position.copy(_seg2End.current);
      joint2Ref.current.visible = s2 > 0.8;
    }

    // Claw at tip — opens wide then closes to grip
    if (clawGroupRef.current) {
      clawGroupRef.current.position.copy(seg3End);
      clawGroupRef.current.lookAt(targetPosition);
      const clawOpen = s3 > 0.5 ? Math.max(0.2, 1 - (s3 - 0.5) * 2) : 0.5 + s3;
      clawGroupRef.current.visible = s3 > 0;
      clawGroupRef.current.scale.set(1 + clawOpen * 0.5, 1, 1);
    }
  });

  const dist = tugPosition.distanceTo(targetPosition);
  const segLen = Math.max(0.001, dist / 3);

  return (
    <group>
      {/* Arm segment 1 — thick base */}
      <mesh ref={seg1Ref}>
        <boxGeometry args={[0.0012, 0.0012, segLen]} />
        <meshPhongMaterial color="#888890" specular="#bbbbbb" shininess={60} />
      </mesh>
      {/* Arm segment 2 — medium */}
      <mesh ref={seg2Ref} visible={false}>
        <boxGeometry args={[0.0008, 0.0008, segLen]} />
        <meshPhongMaterial color="#909098" specular="#bbbbcc" shininess={60} />
      </mesh>
      {/* Arm segment 3 — thin tip */}
      <mesh ref={seg3Ref} visible={false}>
        <boxGeometry args={[0.0005, 0.0005, segLen]} />
        <meshPhongMaterial color="#a0a0a8" specular="#cccccc" shininess={70} />
      </mesh>
      {/* Joint sphere 1 */}
      <mesh ref={joint1Ref}>
        <sphereGeometry args={[0.0008, 8, 8]} />
        <meshPhongMaterial color="#707078" specular="#aaaaaa" shininess={50} />
      </mesh>
      {/* Joint sphere 2 */}
      <mesh ref={joint2Ref}>
        <sphereGeometry args={[0.0006, 8, 8]} />
        <meshPhongMaterial color="#808088" specular="#aaaaaa" shininess={50} />
      </mesh>
      {/* Claw/gripper at tip */}
      <group ref={clawGroupRef} visible={false}>
        {[-1, 1].map((side: number) => (
          <group key={`claw-x-${side}`}>
            <mesh position={[side * 0.001, 0, 0.001]}>
              <boxGeometry args={[0.0003, 0.0003, 0.002]} />
              <meshPhongMaterial color="#b0b0b8" specular="#dddddd" shininess={80} />
            </mesh>
            <mesh position={[side * 0.001, 0, 0.002]}>
              <boxGeometry args={[0.0003, 0.0003, 0.0008]} />
              <meshPhongMaterial color="#a0a0a8" specular="#cccccc" shininess={70} />
            </mesh>
          </group>
        ))}
        {[-1, 1].map((side: number) => (
          <group key={`claw-y-${side}`}>
            <mesh position={[0, side * 0.001, 0.001]}>
              <boxGeometry args={[0.0003, 0.0003, 0.002]} />
              <meshPhongMaterial color="#b0b0b8" specular="#dddddd" shininess={80} />
            </mesh>
            <mesh position={[0, side * 0.001, 0.002]}>
              <boxGeometry args={[0.0003, 0.0003, 0.0008]} />
              <meshPhongMaterial color="#a0a0a8" specular="#cccccc" shininess={70} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/** Net deployment — expanding net from tug toward target */
function NetDeployment({ tugPosition, targetPosition, progress }: {
  tugPosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
  progress: number;
}) {
  const netRef = useRef<THREE.Group>(null);
  const lineRef = useRef<THREE.Line>(null);
  const timeRef = useRef(0);

  const tetherPositions = useMemo(() => new Float32Array([0, 0, 0, 0, 0, 0]), []);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;

    // Net moves from tug toward target
    if (netRef.current) {
      const p = Math.min(1, progress * 1.1);
      netRef.current.position.lerpVectors(tugPosition, targetPosition, p);
      // Gentle tumbling during flight
      netRef.current.rotation.x = t * 0.5;
      netRef.current.rotation.z = Math.sin(t * 0.3) * 0.2;
    }

    // Tether line from tug to net
    if (lineRef.current) {
      const pos = lineRef.current.geometry.attributes.position;
      if (pos) {
        const s = (v: number) => (Number.isFinite(v) ? v : 0);
        const p = Math.min(1, progress * 1.1);
        pos.array[0] = s(tugPosition.x);
        pos.array[1] = s(tugPosition.y);
        pos.array[2] = s(tugPosition.z);
        pos.array[3] = s(tugPosition.x + (targetPosition.x - tugPosition.x) * p);
        pos.array[4] = s(tugPosition.y + (targetPosition.y - tugPosition.y) * p);
        pos.array[5] = s(tugPosition.z + (targetPosition.z - tugPosition.z) * p);
        pos.needsUpdate = true;
        lineRef.current.geometry.computeBoundingSphere();
      }
    }
  });

  // Net expands after launch: starts small, grows to capture target
  const expandProgress = Math.max(0, Math.min(1, (progress - 0.15) / 0.6));
  const netSize = 0.002 + expandProgress * 0.008;

  return (
    <group>
      <group ref={netRef}>
        {/* Net frame — octagonal outline */}
        <mesh>
          <torusGeometry args={[netSize * 0.55, 0.0003, 6, 8]} />
          <meshBasicMaterial color="#cccc44" transparent opacity={0.8} />
        </mesh>
        {/* Net cross lines (4 diagonal + 2 axis = 6 lines) */}
        {[0, 1, 2, 3].map((i) => {
          const angle = (i * Math.PI) / 4;
          return (
            <mesh key={`netline-${i}`} rotation={[0, 0, angle]}>
              <boxGeometry args={[netSize * 1.1, 0.00015, 0.0001]} />
              <meshBasicMaterial color="#aaaa33" transparent opacity={0.6} />
            </mesh>
          );
        })}
        {/* Inner diamond net pattern */}
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <torusGeometry args={[netSize * 0.28, 0.0002, 4, 4]} />
          <meshBasicMaterial color="#aaaa33" transparent opacity={0.5} />
        </mesh>
        {/* Corner weights */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const angle = (i * Math.PI) / 4;
          return (
            <mesh key={`weight-${i}`} position={[Math.cos(angle) * netSize * 0.55, Math.sin(angle) * netSize * 0.55, 0.0005]}>
              <sphereGeometry args={[0.0003, 6, 6]} />
              <meshPhongMaterial color="#666666" specular="#aaaaaa" shininess={50} />
            </mesh>
          );
        })}
      </group>
      {/* Tether line from tug to net center */}
      <line ref={lineRef as any}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[tetherPositions, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#cccc44" transparent opacity={0.6} linewidth={1} />
      </line>
    </group>
  );
}

// ============================================================
// TUG MARKER
// ============================================================
function TugMarker({ position }: { position: THREE.Vector3 }) {
  const markerRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (markerRef.current) {
      markerRef.current.lookAt(camera.position);
    }
  });

  return (
    <mesh ref={markerRef} position={position}>
      <planeGeometry args={[0.03, 0.03]} />
      <meshBasicMaterial
        color="#00ddff"
        transparent
        opacity={0.7}
        depthTest={false}
      />
    </mesh>
  );
}

// ============================================================
// Camera controller — 4 modes + mouse (zoom, orbit)
// ============================================================
function CameraController({ followTarget, view, tugRotation }: {
  followTarget: THREE.Vector3 | null;
  view: string;
  tugRotation: THREE.Euler;
}) {
  const { camera, gl } = useThree();
  const smoothPos = useRef(new THREE.Vector3(0, 0, 2));
  const smoothQuat = useRef(new THREE.Quaternion());
  const cinematicAngle = useRef(0);
  const prevView = useRef(view);

  // Smooth FOV transition on view switch
  const targetFov = useRef(60);

  // Mouse: zoom & orbit
  const zoomRef = useRef(1.0);
  const orbitTheta = useRef(0);
  const orbitPhi = useRef(0);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const isOrbitActive = useRef(false);

  // Velocity prediction
  const prevTargetPos = useRef(new THREE.Vector3());
  const targetVelocity = useRef(new THREE.Vector3());
  const isFirstFrame = useRef(true);

  // Temporaries (avoid allocation in useFrame)
  const _tmpV = useRef(new THREE.Vector3());
  const _tmpQ = useRef(new THREE.Quaternion());
  const _up = useRef(new THREE.Vector3(0, 1, 0));
  const _fwd = useRef(new THREE.Vector3());

  useEffect(() => {
    const canvas = gl.domElement;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.92 : 1.08;
      zoomRef.current = Math.max(0.1, Math.min(12.0, zoomRef.current * delta));
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0 || e.button === 2) {
        isDragging.current = true;
        isOrbitActive.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      orbitTheta.current += dx * 0.005;
      orbitPhi.current += dy * 0.005;
      orbitPhi.current = Math.max(-1.5, Math.min(1.5, orbitPhi.current));
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0 || e.button === 2) {
        isDragging.current = false;
      }
    };

    const onContextMenu = (e: Event) => {
      e.preventDefault();
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('contextmenu', onContextMenu);

    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('contextmenu', onContextMenu);
    };
  }, [gl.domElement]);

  useFrame((_, delta) => {
    if (!followTarget) return;

    const dt = Math.min(delta, 0.1);

    // Compute target velocity for predictive camera tracking
    if (isFirstFrame.current) {
      prevTargetPos.current.copy(followTarget);
      isFirstFrame.current = false;
    } else {
      const instantVel = _tmpV.current.copy(followTarget).sub(prevTargetPos.current).divideScalar(Math.max(dt, 0.001));
      targetVelocity.current.lerp(instantVel, 0.2);
      prevTargetPos.current.copy(followTarget);
    }

    // View switch — reset camera state
    if (prevView.current !== view) {
      prevView.current = view;
      orbitTheta.current = 0;
      orbitPhi.current = 0;
      isOrbitActive.current = false;
      isFirstFrame.current = true;
      const dist = followTarget.length();

      if (view === 'cockpit') {
        // Start exactly at tug position
        const q = _tmpQ.current.setFromEuler(tugRotation);
        smoothQuat.current.copy(q);
        smoothPos.current.copy(followTarget);
        targetFov.current = 50;
      } else if (view === 'tug') {
        smoothPos.current.copy(followTarget).add(new THREE.Vector3(0, 0.05 * TUG_SCALE, -0.15 * TUG_SCALE));
        smoothQuat.current.identity();
        targetFov.current = 55;
      } else if (view === 'target') {
        smoothPos.current.copy(followTarget).add(new THREE.Vector3(0, 0.08 * TUG_SCALE, 0.08 * TUG_SCALE));
        smoothQuat.current.identity();
        targetFov.current = 50;
      } else {
        smoothPos.current.set(dist * 0.7, dist * 0.5, dist * 0.7);
        smoothQuat.current.identity();
        targetFov.current = 50;
      }
      targetVelocity.current.set(0, 0, 0);
    }

    // Compute forward vector from tug rotation (quaternion-based, no gimbal lock)
    const tugQuat = _tmpQ.current.setFromEuler(tugRotation);
    _fwd.current.set(0, 0, 1).applyQuaternion(tugQuat).normalize();
    const up = _up.current.set(0, 1, 0);

    // ── COCKPIT: Smooth FPV — SLERP rotation + lerp position ──
    if (view === 'cockpit') {
      // Desired position: small offset forward and up from tug center
      const eyeOffset = _tmpV.current.copy(_fwd.current).multiplyScalar(0.014 * TUG_SCALE)
        .add(up.clone().multiplyScalar(0.008 * TUG_SCALE));
      const desiredCockpitPos = _tmpV.current.copy(followTarget).add(eyeOffset);

      // Frame-rate independent smoothing (fast but filters jitter)
      const cockpitPosSmooth = 1 - Math.exp(-14 * dt);
      const cockpitRotSmooth = 1 - Math.exp(-18 * dt);

      // Smooth position
      smoothPos.current.lerp(desiredCockpitPos, cockpitPosSmooth);
      camera.position.copy(smoothPos.current);

      // Smooth quaternion (SLERP) — eliminates jitter from physics angular velocity
      smoothQuat.current.slerp(tugQuat, cockpitRotSmooth);
      camera.quaternion.copy(smoothQuat.current);

      // FOV — 50° for realistic FPV perspective (65° causes fish-eye distortion)
      if (Math.abs(camera.fov - 50) > 0.1) {
        // eslint-disable-next-line react-hooks/immutability
        camera.fov += (50 - camera.fov) * 0.15;
        camera.updateProjectionMatrix();
      } else {
        camera.fov = 50;
        camera.updateProjectionMatrix();
      }
      return;
    }

    // ── NON-COCKPIT VIEWS: Smooth tracking with position + lookAt ──
    let desiredPosition: THREE.Vector3;
    let desiredLookAt: THREE.Vector3;
    let baseSmooth: number;

    switch (view) {
      case 'tug': {
        const behind = _tmpV.current.copy(_fwd.current).multiplyScalar(-0.15 * TUG_SCALE);
        const above = up.clone().multiplyScalar(0.05 * TUG_SCALE);
        desiredPosition = followTarget.clone().add(behind).add(above);
        desiredLookAt = followTarget.clone()
          .add(_fwd.current.clone().multiplyScalar(0.04 * TUG_SCALE));
        baseSmooth = 8;  // Smooth buttery tracking
        targetFov.current = 55;
        break;
      }
      case 'target': {
        cinematicAngle.current += dt * 0.06;  // Very slow cinematic rotation
        const radius = 0.12 * TUG_SCALE;
        const cx = Math.cos(cinematicAngle.current) * radius;
        const cz = Math.sin(cinematicAngle.current) * radius;
        desiredPosition = followTarget.clone().add(new THREE.Vector3(cx, 0.05 * TUG_SCALE, cz));
        desiredLookAt = followTarget;
        baseSmooth = 4;  // Smooth cinematic feel
        targetFov.current = 50;
        break;
      }
      default: { // orbital
        const dist = followTarget.length();
        const earthDir = followTarget.clone().normalize();
        desiredPosition = earthDir.clone().multiplyScalar(dist * 0.8)
          .add(new THREE.Vector3(0, dist * 0.4, 0));
        desiredLookAt = new THREE.Vector3(0, 0, 0);
        baseSmooth = 3;  // Smooth grand view
        targetFov.current = 50;
        break;
      }
    }

    // Apply zoom and orbit rotation
    const offset = desiredPosition.clone().sub(followTarget);
    const baseDistance = offset.length();
    const baseDirection = offset.normalize();
    const zoomedDistance = baseDistance * zoomRef.current;

    if (isOrbitActive.current) {
      const orbitQ = _tmpQ.current.setFromEuler(new THREE.Euler(orbitPhi.current, orbitTheta.current, 0, 'YXZ'));
      baseDirection.applyQuaternion(orbitQ);
    }

    desiredPosition = followTarget.clone().add(baseDirection.multiplyScalar(zoomedDistance));

    // Frame-rate independent exponential smoothing
    const positionSmooth = 1 - Math.exp(-baseSmooth * dt);
    const lookSmooth = 1 - Math.exp(-baseSmooth * 0.9 * dt);  // Look tracks closely to reduce swing

    smoothPos.current.lerp(desiredPosition, positionSmooth);

    camera.position.copy(smoothPos.current);
    camera.lookAt(desiredLookAt);  // lookAt directly — no lag accumulation

    // Smooth FOV transitions
    if (Math.abs(camera.fov - targetFov.current) > 0.1) {
      camera.fov += (targetFov.current - camera.fov) * positionSmooth * 2;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

/** Compute forward vector from tug Euler angles */
function computeForward(rot: THREE.Euler): THREE.Vector3 {
  const q = new THREE.Quaternion().setFromEuler(rot);
  const fwd = new THREE.Vector3(0, 0, 1);
  fwd.applyQuaternion(q);
  return fwd.normalize();
}

// ============================================================
// SPACE TUG MODEL COMPONENTS
// Based on VLM analysis of uploaded space tug image
//
// Body dimensions (before TUG_SCALE):
//   Width (X): 0.012  (1.0 m real)
//   Depth (Z): 0.022  (1.8 m real) — long axis, forward direction
//   Top section (black):   Y height 0.006 (0.5 m real)
//   Middle section (gold):  Y height 0.008 (0.6 m real)
//   Bottom section (silver): Y height 0.010 (0.7 m real)
// ============================================================

// --- Body dimension constants ---
const BODY_W = 0.012;
const BODY_D = 0.022;
const TOP_H = 0.006;
const MID_H = 0.008;
const BOT_H = 0.010;
const TOTAL_H = TOP_H + MID_H + BOT_H; // 0.024

// Y positions of section centers (bottom at -TOTAL_H/2, top at +TOTAL_H/2)
const BOT_Y = -TOTAL_H / 2 + BOT_H / 2;       // -0.007
const MID_Y = -TOTAL_H / 2 + BOT_H + MID_H / 2; // 0.001
const TOP_Y = -TOTAL_H / 2 + BOT_H + MID_H + TOP_H / 2; // 0.009

/** Grid texture overlay for the black top section (thermal management) */
function ThermalGrid({ width, depth, height, y }: {
  width: number; depth: number; height: number; y: number;
}) {
  const gridLines = 4;
  const spacing_w = width / (gridLines + 1);
  const spacing_d = depth / (gridLines + 1);

  return (
    <group position={[0, y, 0]}>
      {/* Horizontal grid lines on top face */}
      {Array.from({ length: gridLines }).map((_, i) => (
        <mesh key={`gh-${i}`} position={[-width / 2 + spacing_w * (i + 1), height / 2 + 0.00005, 0]}>
          <boxGeometry args={[0.0004, 0.0001, depth * 0.98]} />
          <meshPhongMaterial color="#222222" emissive="#111111" emissiveIntensity={0.1} />
        </mesh>
      ))}
      {/* Vertical grid lines on top face */}
      {Array.from({ length: gridLines }).map((_, i) => (
        <mesh key={`gv-${i}`} position={[0, height / 2 + 0.00005, -depth / 2 + spacing_d * (i + 1)]}>
          <boxGeometry args={[width * 0.98, 0.0001, 0.0004]} />
          <meshPhongMaterial color="#222222" emissive="#111111" emissiveIntensity={0.1} />
        </mesh>
      ))}
    </group>
  );
}

/** Solar panel assembly — two rectangular panels on silver booms, fully deployed */
function SolarPanelAssembly({ side }: { side: 'left' | 'right' }) {
  const xSign = side === 'left' ? -1 : 1;
  const angle = 0; // Fully deployed — panels extend horizontally outward

  return (
    <group position={[xSign * BODY_W / 2, MID_Y, 0]} rotation={[0, 0, angle]}>
      {/* Silver boom — extended length for fully deployed panels */}
      <mesh position={[xSign * 0.012, 0, 0]} rotation={[0, 0, side === 'left' ? Math.PI / 2 : -Math.PI / 2]}>
        <cylinderGeometry args={[0.0004, 0.0004, 0.026, 6]} />
        <meshPhongMaterial color="#b0b0b0" specular="#dddddd" shininess={70} />
      </mesh>

      {/* Solar panel at boom end — fully deployed, larger area */}
      <group position={[xSign * 0.032, 0, 0]}>
        {/* Panel substrate (dark blue/black) */}
        <mesh>
          <boxGeometry args={[0.06, 0.0006, 0.028]} />
          <meshPhongMaterial color="#0a0a1e" specular="#1a1a3e" shininess={40} />
        </mesh>

        {/* Solar cell grid — horizontal lines */}
        {Array.from({ length: 9 }).map((_, i) => (
          <mesh key={`ch-${i}`} position={[0, 0.00035, -0.012 + i * 0.003]}>
            <boxGeometry args={[0.056, 0.0002, 0.0018]} />
            <meshPhongMaterial color="#1a237e" specular="#333366" shininess={80} />
          </mesh>
        ))}
        {/* Solar cell grid — vertical lines */}
        {Array.from({ length: 16 }).map((_, i) => (
          <mesh key={`cv-${i}`} position={[-0.027 + i * 0.0036, 0.00035, 0]}>
            <boxGeometry args={[0.0015, 0.0002, 0.026]} />
            <meshPhongMaterial color="#1a237e" specular="#333366" shininess={80} />
          </mesh>
        ))}

        {/* Silver frame around panel */}
        <mesh position={[0, 0.0005, 0]}>
          <boxGeometry args={[0.061, 0.0003, 0.029]} />
          <meshPhongMaterial color="#888888" specular="#bbbbbb" shininess={50} />
        </mesh>
      </group>
    </group>
  );
}

/** Plasma thruster — silver body with blue nozzle glow */
function PlasmaEngine({ thrust, position = [0, 0, -BODY_D / 2 - 0.002] }: {
  thrust: boolean; position?: [number, number, number];
}) {
  const engineGlowRef = useRef<THREE.PointLight>(null);
  const flameRef = useRef<THREE.Mesh>(null);
  const flameOuterRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;
    const intensity = thrust ? (2.0 + Math.sin(t * 20) * 0.3 + Math.sin(t * 35) * 0.15) : 0;

    if (engineGlowRef.current) {
      engineGlowRef.current.intensity = intensity;
    }

    if (flameRef.current) {
      flameRef.current.visible = thrust;
      const s = 1.0 + Math.sin(t * 25) * 0.15;
      flameRef.current.scale.set(s, s, 1.0 + Math.sin(t * 18) * 0.2);
    }
    if (flameOuterRef.current) {
      flameOuterRef.current.visible = thrust;
      const s = 0.8 + Math.sin(t * 22) * 0.1;
      flameOuterRef.current.scale.set(s, s, 1.0 + Math.sin(t * 30) * 0.15);
    }
  });

  return (
    <group position={position as unknown as THREE.Vector3}>
      {/* Thruster body (silver cylinder) */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.0018, 0.0022, 0.005, 12]} />
        <meshPhongMaterial color="#a0a0a8" specular="#cccccc" shininess={70} />
      </mesh>

      {/* Blue nozzle bell */}
      <mesh position={[0, 0, -0.003]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.0008, 0.0018, 0.003, 12]} />
        <meshPhongMaterial color="#4466aa" specular="#6688cc" shininess={80} />
      </mesh>

      {/* Nozzle inner glow */}
      <mesh position={[0, 0, -0.004]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.0005, 0.0008, 0.001, 8]} />
        <meshBasicMaterial color="#00aaff" transparent opacity={0.4} />
      </mesh>

      {/* Main flame (bright cyan) */}
      <mesh ref={flameRef} position={[0, 0, -0.007]} visible={thrust}>
        <coneGeometry args={[0.0016, 0.008, 8]} />
        <meshBasicMaterial color="#00ccff" transparent opacity={0.8} />
      </mesh>

      {/* Outer flame glow */}
      <mesh ref={flameOuterRef} position={[0, 0, -0.006]} visible={thrust}>
        <coneGeometry args={[0.0025, 0.01, 8]} />
        <meshBasicMaterial color="#0088ff" transparent opacity={0.3} />
      </mesh>

      {/* Point light */}
      <pointLight
        ref={engineGlowRef}
        position={[0, 0, -0.009]}
        color="#00ccff"
        intensity={0}
        distance={0.15}
      />
    </group>
  );
}

/** Secondary RCS thruster (small, for attitude control) */
function SecondaryThruster({ position, direction = [0, 0, 1] }: {
  position: [number, number, number];
  direction?: [number, number, number];
}) {
  return (
    <group position={position}>
      <mesh rotation={direction[0] !== 0 ? [Math.PI / 2, 0, 0] : direction[1] !== 0 ? [0, 0, Math.PI / 2] : [0, 0, 0]}>
        <cylinderGeometry args={[0.0005, 0.0008, 0.002, 8]} />
        <meshPhongMaterial color="#909098" specular="#bbbbcc" shininess={60} />
      </mesh>
      <mesh
        position={[
          direction[0] * 0.001,
          direction[1] * 0.001,
          direction[2] * 0.001
        ]}
      >
        <coneGeometry args={[0.0006, 0.0015, 6]} />
        <meshBasicMaterial color="#0066aa" transparent opacity={0.15} />
      </mesh>
    </group>
  );
}

/** Deploy container — black box on top with hinged lid, spring ejector, guide rails */
function DeployContainer({
  cubeSatType,
  deployProgress = 0,
  deploymentState = 'idle',
}: {
  cubeSatType: '1U' | '2U' | '3U';
  deployProgress?: number;
  deploymentState?: string;
}) {
  const satW = 0.005;
  const satH = 0.005;
  const satLen = cubeSatType === '1U' ? 0.005 : cubeSatType === '2U' ? 0.008 : 0.011;

  // Container inner dimensions (slightly larger than CubeSat)
  const cW = satW + 0.003;
  const cH = satH + 0.003;
  const cD = satLen + 0.005;

  // Door open angle: Phase 1 (0-0.15) → 0 to -90 degrees
  const lidAngle = remap(deployProgress, 0, 0.15, 0, -Math.PI / 2);
  const showLidOpen = deploymentState === 'deploying' || deploymentState === 'deployed' || deploymentState === 'undocked';

  // Spring extension: Phase 2 (0.15-0.4)
  const springExtension = remap(deployProgress, 0.15, 0.4, 0, cD * 0.6);

  return (
    <group position={[0, TOP_Y + TOP_H / 2 + cH / 2, 0]}>
      {/* Main container body (black) */}
      <mesh>
        <boxGeometry args={[cW, cH, cD]} />
        <meshPhongMaterial color="#1a1a22" specular="#333344" shininess={30} />
      </mesh>

      {/* Container frame edges (silver) */}
      {[
        [cW / 2, 0, 0, 0.0005, cH, cD],
        [-cW / 2, 0, 0, 0.0005, cH, cD],
        [0, cH / 2, 0, cW, 0.0005, cD],
        [0, -cH / 2, 0, cW, 0.0005, cD],
        [0, 0, cD / 2, cW, cH, 0.0005],
        [0, 0, -cD / 2, cW, cH, 0.0005],
      ].map(([x, y, z, w, h, d], i) => (
        <mesh key={`frame-${i}`} position={[x as number, y as number, z as number]}>
          <boxGeometry args={[w as number, h as number, d as number]} />
          <meshPhongMaterial color="#888888" specular="#aaaaaa" shininess={50} />
        </mesh>
      ))}

      {/* Guide rails (left & right inside) */}
      <mesh position={[-satW / 2 - 0.0005, 0, 0]}>
        <boxGeometry args={[0.0008, 0.0008, cD - 0.002]} />
        <meshPhongMaterial color="#aaaacc" specular="#ccccdd" shininess={60} />
      </mesh>
      <mesh position={[satW / 2 + 0.0005, 0, 0]}>
        <boxGeometry args={[0.0008, 0.0008, cD - 0.002]} />
        <meshPhongMaterial color="#aaaacc" specular="#ccccdd" shininess={60} />
      </mesh>

      {/* Spring ejector (visible inside, pushes forward) */}
      <mesh position={[0, 0, cD / 2 - 0.001 - springExtension / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.0012, 0.0012, 0.004, 8]} />
        <meshPhongMaterial color="#cccccc" specular="#eeeeee" shininess={90} />
      </mesh>
      {/* Spring coils */}
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={`coil-${i}`} position={[0, 0, cD / 2 - 0.001 - (i + 1) * 0.001 - springExtension * (i / 4)]}
          rotation={[0, (i * Math.PI) / 3, 0]}>
          <torusGeometry args={[0.0012, 0.00015, 4, 8]} />
          <meshPhongMaterial color="#bbbbbb" specular="#dddddd" shininess={80} />
        </mesh>
      ))}

      {/* === Separation pusher springs (left & right side springs) === */}
      {deployProgress < 0.5 && (
        <group>
          {[-1, 1].map(side => (
            <group key={`sep-spring-${side}`}>
              {/* Multi-coil spring — compresses as CubeSat ejects */}
              {Array.from({ length: 6 }).map((_, i) => (
                <mesh key={`ss-${side}-${i}`}
                  position={[
                    side * (satW / 2 - 0.001),
                    0,
                    cD / 2 - 0.002 - (i + 1) * (0.0008 * (1 - deployProgress * 1.2))
                  ]}
                  rotation={[0, (i * Math.PI) / 3, 0]}>
                  <torusGeometry args={[0.0008, 0.0001, 4, 8]} />
                  <meshPhongMaterial color="#dddddd" specular="#ffffff" shininess={90} />
                </mesh>
              ))}
              {/* Spring base plate (attached to container back wall) */}
              <mesh position={[side * (satW / 2 - 0.001), 0, -cD / 2 + 0.002]}>
                <boxGeometry args={[0.0014, 0.0014, 0.0008]} />
                <meshPhongMaterial color="#888888" specular="#aaaaaa" shininess={60} />
              </mesh>
              {/* Spring pusher plate (contacts CubeSat) */}
              <mesh position={[side * (satW / 2 - 0.001), 0, cD / 2 - 0.002 - springExtension * 0.3]}>
                <boxGeometry args={[0.0014, 0.0014, 0.0006]} />
                <meshPhongMaterial color="#bbbbbb" specular="#dddddd" shininess={70} />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* Hinged lid — rotates open on hinge at front edge (+Z) */}
      <group position={[0, cH / 2, cD / 2 - 0.001]} rotation={[lidAngle, 0, 0]}>
        {/* Lid plate */}
        <mesh position={[0, 0.0005, -cD * 0.35]}>
          <boxGeometry args={[cW - 0.001, 0.0008, cD * 0.7]} />
          <meshPhongMaterial
            color={showLidOpen ? '#252530' : '#1a1a22'}
            specular="#444455"
            shininess={35}
          />
        </mesh>
        {/* Lid frame */}
        <mesh position={[0, 0.0009, -cD * 0.35]}>
          <boxGeometry args={[cW, 0.0003, cD * 0.72]} />
          <meshPhongMaterial color="#777777" specular="#999999" shininess={50} />
        </mesh>
        {/* Hinge rod */}
        <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.0004, 0.0004, cW + 0.002, 8]} />
          <meshPhongMaterial color="#aaaaaa" specular="#cccccc" shininess={70} />
        </mesh>
      </group>

      {/* Status indicator */}
      <mesh position={[0, cH / 2 + 0.001, -cD / 2 + 0.001]}>
        <sphereGeometry args={[0.0005, 8, 8]} />
        <meshBasicMaterial
          color={deploymentState === 'deploying' || deploymentState === 'aligning' ? '#ffaa00' : '#00ff88'}
        />
      </mesh>
      <pointLight position={[0, cH / 2 + 0.002, -cD / 2 + 0.001]}
        color={deploymentState === 'deploying' || deploymentState === 'aligning' ? '#ffaa00' : '#00ff88'} intensity={0.25} distance={0.03} />
    </group>
  );
}

/** Antenna assembly — low-gain rods at 30°, high-gain dish, star trackers */
function AntennaAssembly() {
  return (
    <group>
      {/* Low-gain antenna rod — left top corner at 30° */}
      <group position={[-BODY_W / 2 + 0.001, TOP_Y + TOP_H / 2, BODY_D / 2 - 0.002]}>
        <group rotation={[0, 0, -Math.PI / 6]}>
          {/* Rod */}
          <mesh position={[0, 0.004, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.00015, 0.00015, 0.008, 4]} />
            <meshPhongMaterial color="#c0c0c0" specular="#eeeeee" shininess={70} />
          </mesh>
          {/* Tip ball */}
          <mesh position={[0, 0.008, 0]}>
            <sphereGeometry args={[0.0003, 6, 6]} />
            <meshPhongMaterial color="#d0d0d0" specular="#ffffff" shininess={90} />
          </mesh>
        </group>
      </group>

      {/* Low-gain antenna rod — right top corner at 30° */}
      <group position={[BODY_W / 2 - 0.001, TOP_Y + TOP_H / 2, BODY_D / 2 - 0.002]}>
        <group rotation={[0, 0, Math.PI / 6]}>
          <mesh position={[0, 0.004, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.00015, 0.00015, 0.008, 4]} />
            <meshPhongMaterial color="#c0c0c0" specular="#eeeeee" shininess={70} />
          </mesh>
          <mesh position={[0, 0.008, 0]}>
            <sphereGeometry args={[0.0003, 6, 6]} />
            <meshPhongMaterial color="#d0d0d0" specular="#ffffff" shininess={90} />
          </mesh>
        </group>
      </group>

      {/* High-gain dish antenna — bottom section, rear */}
      <group position={[0, BOT_Y - BOT_H / 2 - 0.002, -BODY_D / 2 + 0.004]}>
        {/* Feed horn (rod) */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.0002, 0.0002, 0.004, 4]} />
          <meshPhongMaterial color="#a0a0a0" />
        </mesh>
        {/* Dish */}
        <mesh position={[0, -0.001, 0]} rotation={[0.5, 0, 0]}>
          <sphereGeometry args={[0.003, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3]} />
          <meshPhongMaterial color="#c8c8c8" specular="#ffffff" shininess={90} side={THREE.DoubleSide} />
        </mesh>
        {/* Dish back frame */}
        <mesh position={[0, 0.001, 0]} rotation={[-0.5, 0, 0]}>
          <circleGeometry args={[0.003, 16]} />
          <meshPhongMaterial color="#888888" side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Star tracker — small box sensor on top front */}
      <group position={[BODY_W / 2 - 0.002, TOP_Y + TOP_H / 2 + 0.001, BODY_D / 4]}>
        <mesh>
          <boxGeometry args={[0.002, 0.001, 0.002]} />
          <meshPhongMaterial color="#2a2a35" specular="#5555aa" emissive="#1a1a3a" emissiveIntensity={0.2} shininess={80} />
        </mesh>
        {/* Lens */}
        <mesh position={[0, 0.0007, 0]}>
          <circleGeometry args={[0.001, 12]} />
          <meshBasicMaterial color="#2244cc" transparent opacity={0.9} />
        </mesh>
      </group>
    </group>
  );
}

/** Docking port — central circular port with blue LED ring */
function DockingPort() {
  const ledRef = useRef<THREE.PointLight>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    if (ledRef.current) {
      ledRef.current.intensity = 0.3 + Math.sin(timeRef.current * 2) * 0.15;
    }
  });

  return (
    <group position={[0, BOT_Y - BOT_H / 2, BODY_D / 2 + 0.001]}>
      {/* Port ring (silver) */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.003, 0.0006, 8, 24]} />
        <meshPhongMaterial color="#a0a0a8" specular="#cccccc" shininess={70} />
      </mesh>
      {/* Port face (dark) */}
      <mesh rotation={[0, 0, 0]}>
        <circleGeometry args={[0.0024, 16]} />
        <meshPhongMaterial color="#1a1a22" specular="#333344" shininess={30} />
      </mesh>
      {/* Blue LED ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.0032, 0.0002, 6, 24]} />
        <meshBasicMaterial color="#00aaff" />
      </mesh>
      <pointLight ref={ledRef} color="#0088ff" intensity={0.3} distance={0.04} />
    </group>
  );
}

/** Label plate on middle section — "Space Tug-1" */
function TugLabelPlate() {
  return (
    <group position={[0, MID_Y, BODY_D / 2 + 0.0001]}>
      {/* Label background */}
      <mesh>
        <planeGeometry args={[0.009, 0.003]} />
        <meshPhongMaterial color="#2a2010" emissive="#1a1508" emissiveIntensity={0.3} shininess={60} />
      </mesh>
      {/* Simulated text lines (thin rectangles) */}
      <mesh position={[0, 0.0004, 0.0001]}>
        <planeGeometry args={[0.008, 0.0008]} />
        <meshBasicMaterial color="#c8a040" transparent opacity={0.7} />
      </mesh>
      <mesh position={[0, -0.0004, 0.0001]}>
        <planeGeometry args={[0.005, 0.0005]} />
        <meshBasicMaterial color="#c8a040" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

// ============================================================
// NANOSAT TUG (deployer mode)
// ============================================================
function NanosatTug({ position, rotation, thrust, cubeSatType, deploymentState = 'idle', deployProgress = 0 }: {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  thrust: boolean;
  cubeSatType: '1U' | '2U' | '3U';
  deploymentState?: string;
  deployProgress?: number;
}) {
  const tugRef = useRef<THREE.Group>(null);
  // Smooth interpolation to eliminate jitter — position and rotation are
  // updated every frame from physics, so we lerp towards target values
  const smoothPos = useRef(new THREE.Vector3());
  const smoothQuat = useRef(new THREE.Quaternion());
  const initialized = useRef(false);

  useFrame((_, delta) => {
    if (!tugRef.current) return;
    const dt = Math.min(delta, 0.1);
    // Ultra-fast tracking — nearly instant snap to physics position
    // Camera handles all visual smoothing, so the model just follows physics directly
    const lerpF = 1 - Math.pow(0.000001, dt);
    if (!initialized.current) {
      smoothPos.current.copy(position);
      smoothQuat.current.setFromEuler(rotation);
      initialized.current = true;
    } else {
      smoothPos.current.lerp(position, lerpF);
      const targetQ = new THREE.Quaternion().setFromEuler(rotation);
      smoothQuat.current.slerp(targetQ, lerpF);
    }
    tugRef.current.position.copy(smoothPos.current);
    tugRef.current.quaternion.copy(smoothQuat.current);
  });

  return (
    <group ref={tugRef}>
      <group scale={[TUG_SCALE, TUG_SCALE, TUG_SCALE]}>
      {/* === MAIN BODY — 3 stacked sections === */}

      {/* Bottom section — Silver (polished metal structural core) */}
      <mesh position={[0, BOT_Y, 0]}>
        <boxGeometry args={[BODY_W, BOT_H, BODY_D]} />
        <meshPhongMaterial color="#a8a8b0" specular="#e0e0e8" shininess={80} />
      </mesh>

      {/* Middle section — Gold (brushed metal MLI insulation) */}
      <mesh position={[0, MID_Y, 0]}>
        <boxGeometry args={[BODY_W, MID_H, BODY_D]} />
        <meshPhongMaterial color="#b8960a" specular="#ddbb22" shininess={30} />
      </mesh>
      {/* Brushed metal lines on gold section */}
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={`brush-${i}`} position={[0, MID_Y + MID_H / 2 + 0.00005, -BODY_D / 2 + 0.003 + i * 0.0033]}>
          <boxGeometry args={[BODY_W * 0.95, 0.0001, 0.0015]} />
          <meshPhongMaterial color="#c8a820" emissive="#665500" emissiveIntensity={0.05} shininess={40} />
        </mesh>
      ))}

      {/* Top section — Black (matte, grid texture for thermal management) */}
      <mesh position={[0, TOP_Y, 0]}>
        <boxGeometry args={[BODY_W, TOP_H, BODY_D]} />
        <meshPhongMaterial color="#0e0e12" specular="#222233" shininess={20} />
      </mesh>
      {/* Thermal grid overlay on top */}
      <ThermalGrid width={BODY_W} depth={BODY_D} height={TOP_H} y={TOP_Y} />

      {/* Section separator lines (silver) */}
      <mesh position={[0, BOT_Y + BOT_H / 2, 0]}>
        <boxGeometry args={[BODY_W + 0.001, 0.0003, BODY_D + 0.001]} />
        <meshPhongMaterial color="#c0c0c0" specular="#eeeeee" shininess={70} />
      </mesh>
      <mesh position={[0, MID_Y + MID_H / 2, 0]}>
        <boxGeometry args={[BODY_W + 0.001, 0.0003, BODY_D + 0.001]} />
        <meshPhongMaterial color="#c0c0c0" specular="#eeeeee" shininess={70} />
      </mesh>

      {/* === SOLAR PANELS at 45° from middle section === */}
      <SolarPanelAssembly side="left" />
      <SolarPanelAssembly side="right" />

      {/* === DEPLOY CONTAINER on top === */}
      <DeployContainer cubeSatType={cubeSatType} deployProgress={deployProgress} deploymentState={deploymentState} />

      {/* === PRIMARY THRUSTERS (bottom, rear) — two engines === */}
      <PlasmaEngine thrust={thrust} position={[-0.003, BOT_Y - BOT_H / 2, -BODY_D / 2 + 0.003]} />
      <PlasmaEngine thrust={thrust} position={[0.003, BOT_Y - BOT_H / 2, -BODY_D / 2 + 0.003]} />

      {/* === SECONDARY THRUSTERS (top, four RCS) === */}
      <SecondaryThruster position={[-BODY_W / 2 - 0.001, TOP_Y, BODY_D / 2]} direction={[-1, 0, 0]} />
      <SecondaryThruster position={[BODY_W / 2 + 0.001, TOP_Y, BODY_D / 2]} direction={[1, 0, 0]} />
      <SecondaryThruster position={[-BODY_W / 2, TOP_Y + TOP_H / 2, 0]} direction={[0, 1, 0]} />
      <SecondaryThruster position={[BODY_W / 2, TOP_Y + TOP_H / 2, 0]} direction={[0, 1, 0]} />

      {/* === ANTENNAS === */}
      <AntennaAssembly />

      {/* === DOCKING PORT === */}
      <DockingPort />

      {/* === LABEL PLATE === */}
      <TugLabelPlate />

      {/* === STATUS INDICATORS === */}
      <mesh position={[BODY_W / 2 - 0.001, MID_Y + MID_H / 2, -BODY_D / 2 + 0.001]}>
        <sphereGeometry args={[0.0004, 8, 8]} />
        <meshBasicMaterial color="#00ff44" />
      </mesh>
      <mesh position={[-BODY_W / 2 + 0.001, MID_Y + MID_H / 2, -BODY_D / 2 + 0.001]}>
        <sphereGeometry args={[0.0004, 8, 8]} />
        <meshBasicMaterial color="#ff2200" />
      </mesh>

      {/* Beacon lights for visibility */}
      <pointLight position={[0, TOP_Y, 0]} color="#00ccff" intensity={2.0} distance={0.15} decay={2} />
      <pointLight position={[0, BOT_Y, 0]} color="#ffffff" intensity={1.0} distance={0.1} decay={2} />
      </group>
    </group>
  );
}

// ============================================================
// CAPTURE MECHANISMS (janitor mode)
// ============================================================

/** Enhanced Harpoon — barbed head, cable reel with wrapped cable, guide tube */
function HarpoonCapture() {
  return (
    <group position={[0, 0, BODY_D / 2 + 0.004]}>
      {/* Guide tube */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.0012, 0.0012, 0.02, 8]} />
        <meshPhongMaterial color="#808088" specular="#aaaabb" shininess={60} />
      </mesh>
      {/* Inner bore */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.0007, 0.0007, 0.022, 8]} />
        <meshPhongMaterial color="#2a2a35" emissive="#1a1a2a" emissiveIntensity={0.2} />
      </mesh>

      {/* Harpoon head */}
      <group position={[0, 0, 0.012]}>
        {/* Main tip */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.0012, 0.006, 6]} />
          <meshPhongMaterial color="#c0c0c8" specular="#ffffff" shininess={90} />
        </mesh>
        {/* Barbs (4x around the head) */}
        {Array.from({ length: 4 }).map((_, i) => (
          <mesh key={`barb-${i}`}
            position={[Math.cos(i * Math.PI / 2) * 0.001, 0, Math.sin(i * Math.PI / 2) * 0.001 + 0.002]}
            rotation={[Math.cos(i * Math.PI / 2) * 0.4, 0, Math.sin(i * Math.PI / 2) * 0.4]}>
            <boxGeometry args={[0.0006, 0.0003, 0.003]} />
            <meshPhongMaterial color="#b0b0b8" specular="#dddddd" shininess={80} />
          </mesh>
        ))}
      </group>

      {/* Cable reel with wrapped cable */}
      <group position={[0, -0.004, 0]}>
        {/* Reel drum */}
        <mesh>
          <cylinderGeometry args={[0.004, 0.004, 0.003, 16]} />
          <meshPhongMaterial color="#555560" specular="#777788" shininess={40} />
        </mesh>
        {/* Flanges */}
        <mesh position={[0.0017, 0, 0]}>
          <cylinderGeometry args={[0.0045, 0.0045, 0.0004, 16]} />
          <meshPhongMaterial color="#666670" specular="#888899" shininess={50} />
        </mesh>
        <mesh position={[-0.0017, 0, 0]}>
          <cylinderGeometry args={[0.0045, 0.0045, 0.0004, 16]} />
          <meshPhongMaterial color="#666670" specular="#888899" shininess={50} />
        </mesh>
        {/* Wrapped cable (torus segments) */}
        {Array.from({ length: 4 }).map((_, i) => (
          <mesh key={`cable-${i}`} position={[0, 0, -0.001 + i * 0.0008]}
            rotation={[0, (i * Math.PI) / 2, 0]}>
            <torusGeometry args={[0.003, 0.0003, 4, 16]} />
            <meshPhongMaterial color="#aaaaaa" specular="#cccccc" shininess={60} />
          </mesh>
        ))}
      </group>

      {/* Visible cable extending from reel */}
      <mesh position={[0, -0.004, 0.006]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.0002, 0.0002, 0.02, 4]} />
        <meshBasicMaterial color="#bbbbbb" transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

/** Enhanced Manipulator — 3-finger gripper with joints, wrist, proximity sensors */
function ManipulatorCapture() {
  return (
    <group position={[0, 0, BODY_D / 2 + 0.003]}>
      {/* Base mount */}
      <mesh>
        <cylinderGeometry args={[0.0025, 0.003, 0.005, 12]} />
        <meshPhongMaterial color="#505060" specular="#888899" shininess={60} />
      </mesh>

      {/* Shoulder joint */}
      <group position={[0, 0, 0.004]} rotation={[0.35, 0, 0]}>
        {/* Upper arm */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.0014, 0.0018, 0.012, 8]} />
          <meshPhongMaterial color="#606070" specular="#888899" shininess={50} />
        </mesh>
        {/* Joint ring */}
        <mesh position={[0, 0, 0.006]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.002, 0.0004, 8, 12]} />
          <meshPhongMaterial color="#707080" specular="#aaaabb" shininess={60} />
        </mesh>

        {/* Elbow joint + forearm */}
        <group position={[0, 0.002, 0.012]} rotation={[-0.5, 0, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.001, 0.0014, 0.01, 8]} />
            <meshPhongMaterial color="#707080" specular="#999aaa" shininess={50} />
          </mesh>

          {/* Wrist joint */}
          <group position={[0, 0.001, 0.01]}>
            {/* Wrist cylinder */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.0012, 0.0015, 0.004, 8]} />
              <meshPhongMaterial color="#808890" specular="#aabbcc" shininess={60} />
            </mesh>

            {/* 3-finger gripper */}
            {[0, 2.094, 4.189].map((angle, i) => {
              const xOff = Math.sin(angle) * 0.0018;
              const zOff = Math.cos(angle) * 0.0018;
              const tiltAngle = angle - Math.PI;
              return (
                <group key={`finger-${i}`} position={[xOff, 0, 0.002 + zOff]} rotation={[Math.cos(tiltAngle) * 0.35, 0, Math.sin(tiltAngle) * 0.35]}>
                  {/* Finger segment 1 */}
                  <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.0004, 0.0005, 0.006, 6]} />
                    <meshPhongMaterial color="#909098" specular="#aabbcc" shininess={50} />
                  </mesh>
                  {/* Knuckle joint */}
                  <mesh position={[0, 0.003, 0]}>
                    <sphereGeometry args={[0.0005, 6, 6]} />
                    <meshPhongMaterial color="#808890" specular="#aaaabb" shininess={60} />
                  </mesh>
                  {/* Finger segment 2 (tip) */}
                  <group position={[0, 0.003, 0]} rotation={[Math.cos(tiltAngle) * 0.25, 0, Math.sin(tiltAngle) * 0.25]}>
                    <mesh rotation={[Math.PI / 2, 0, 0]}>
                      <cylinderGeometry args={[0.0003, 0.0004, 0.005, 6]} />
                      <meshPhongMaterial color="#a0a0a8" specular="#bbccdd" shininess={50} />
                    </mesh>
                    {/* Fingertip pad */}
                    <mesh position={[0, 0.0025, 0]}>
                      <sphereGeometry args={[0.0004, 6, 6]} />
                      <meshPhongMaterial color="#333340" specular="#555566" shininess={30} />
                    </mesh>
                  </group>
                </group>
              );
            })}

            {/* Proximity sensors (small glowing dots) */}
            {[0, 2.094, 4.189].map((angle, i) => (
              <mesh key={`sensor-${i}`}
                position={[Math.sin(angle) * 0.0025, 0.001, 0.003 + Math.cos(angle) * 0.0025]}>
                <sphereGeometry args={[0.00025, 6, 6]} />
                <meshBasicMaterial color="#ff4400" transparent opacity={0.8} />
              </mesh>
            ))}
            <pointLight position={[0, 0.001, 0.004]} color="#ff4400" intensity={0.15} distance={0.02} />
          </group>
        </group>
      </group>

      {/* Servo drive box */}
      <mesh position={[0, 0.004, 0.003]}>
        <boxGeometry args={[0.005, 0.003, 0.004]} />
        <meshPhongMaterial color="#404050" specular="#666677" shininess={40} />
      </mesh>
      {/* Servo label */}
      <mesh position={[0, 0.0056, 0.003]}>
        <planeGeometry args={[0.003, 0.001]} />
        <meshBasicMaterial color="#888899" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

/** Enhanced Net capture — folded net package, deployment weights, visible mesh */
function NetCapture() {
  return (
    <group position={[0, 0, BODY_D / 2 + 0.003]}>
      {/* Launcher frame */}
      <mesh>
        <boxGeometry args={[BODY_W + 0.002, 0.003, 0.006]} />
        <meshPhongMaterial color="#3a3a4a" specular="#555566" shininess={40} />
      </mesh>

      {/* Folded net package (central box) */}
      <mesh position={[0, 0.002, 0]}>
        <boxGeometry args={[0.008, 0.004, 0.004]} />
        <meshPhongMaterial color="#2a2a35" specular="#444455" shininess={30} />
      </mesh>
      {/* Net texture lines on package */}
      {Array.from({ length: 4 }).map((_, i) => (
        <mesh key={`netline-${i}`} position={[0, 0.0041, -0.0015 + i * 0.001]}>
          <boxGeometry args={[0.007, 0.0001, 0.0004]} />
          <meshBasicMaterial color="#777777" transparent opacity={0.4} />
        </mesh>
      ))}

      {/* Net mesh (pre-deployed, visible but folded) */}
      <group position={[0, 0.003, 0.008]} rotation={[0.15, 0, 0]}>
        {/* Main net body */}
        <mesh>
          <ringGeometry args={[0.001, 0.009, 8]} />
          <meshBasicMaterial color="#cccccc" transparent opacity={0.2} side={THREE.DoubleSide} />
        </mesh>
        {/* Mesh grid lines */}
        {Array.from({ length: 4 }).map((_, i) => (
          <mesh key={`mesh-${i}`}
            position={[0, 0, 0]}
            rotation={[0, 0, (i * Math.PI) / 4]}>
            <planeGeometry args={[0.018, 0.0003]} />
            <meshBasicMaterial color="#aaaaaa" transparent opacity={0.15} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>

      {/* Tether cables to corners */}
      {[-1, 1].flatMap(sx =>
        [-1, 1].map(sz => (
          <group key={`${sx}-${sz}`}>
            <mesh position={[sx * 0.006, 0.001, 0.005 + sz * 0.002]}
              rotation={[Math.PI / 2 + sz * 0.2, 0, sx * 0.3]}>
              <cylinderGeometry args={[0.0002, 0.0002, 0.015, 4]} />
              <meshBasicMaterial color="#999999" transparent opacity={0.4} />
            </mesh>
            {/* Deployment weight at corner */}
            <mesh position={[sx * 0.009, 0.001, 0.012 + sz * 0.004]}>
              <sphereGeometry args={[0.0008, 6, 6]} />
              <meshPhongMaterial color="#555560" specular="#777788" shininess={50} />
            </mesh>
          </group>
        ))
      )}

      {/* Ready indicator */}
      <mesh position={[0, 0.006, -0.001]}>
        <sphereGeometry args={[0.0005, 6, 6]} />
        <meshBasicMaterial color="#ffaa00" />
      </mesh>
      <pointLight position={[0, 0.006, -0.001]} color="#ffaa00" intensity={0.2} distance={0.03} />
    </group>
  );
}

// ============================================================
// JANITOR TUG (space cleaner mode) — larger, heavier
// ============================================================
function JanitorTug({ position, rotation, thrust, captureType }: {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  thrust: boolean;
  captureType: 'harpoon' | 'manipulator' | 'net';
}) {
  const tugRef = useRef<THREE.Group>(null);
  const smoothPos = useRef(new THREE.Vector3());
  const smoothQuat = useRef(new THREE.Quaternion());
  const initialized = useRef(false);

  useFrame((_, delta) => {
    if (!tugRef.current) return;
    const dt = Math.min(delta, 0.1);
    // Ultra-fast tracking — nearly instant snap to physics position
    // Camera handles all visual smoothing, so the model just follows physics directly
    const lerpF = 1 - Math.pow(0.000001, dt);
    if (!initialized.current) {
      smoothPos.current.copy(position);
      smoothQuat.current.setFromEuler(rotation);
      initialized.current = true;
    } else {
      smoothPos.current.lerp(position, lerpF);
      const targetQ = new THREE.Quaternion().setFromEuler(rotation);
      smoothQuat.current.slerp(targetQ, lerpF);
    }
    tugRef.current.position.copy(smoothPos.current);
    tugRef.current.quaternion.copy(smoothQuat.current);
  });

  // Janitor is ~1.4x larger in each dimension than nanosat (1800 kg vs 800 kg)
  const S = 1.4;

  return (
    <group ref={tugRef}>
      <group scale={[TUG_SCALE, TUG_SCALE, TUG_SCALE]}>
      {/* === MAIN BODY — 3 stacked sections (larger) === */}

      {/* Bottom section — Silver (structural core) */}
      <mesh position={[0, BOT_Y * S, 0]}>
        <boxGeometry args={[BODY_W * S, BOT_H * S, BODY_D * S]} />
        <meshPhongMaterial color="#a8a8b0" specular="#e0e0e8" shininess={80} />
      </mesh>

      {/* Middle section — Gold (MLI) */}
      <mesh position={[0, MID_Y * S, 0]}>
        <boxGeometry args={[BODY_W * S, MID_H * S, BODY_D * S]} />
        <meshPhongMaterial color="#b8960a" specular="#ddbb22" shininess={30} />
      </mesh>
      {/* Brushed metal lines */}
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={`jbrush-${i}`} position={[0, MID_Y * S + MID_H * S / 2 + 0.00005, -BODY_D * S / 2 + 0.004 + i * 0.005]}>
          <boxGeometry args={[BODY_W * S * 0.95, 0.0001, 0.002]} />
          <meshPhongMaterial color="#c8a820" emissive="#665500" emissiveIntensity={0.05} shininess={40} />
        </mesh>
      ))}

      {/* Top section — Black (thermal) */}
      <mesh position={[0, TOP_Y * S, 0]}>
        <boxGeometry args={[BODY_W * S, TOP_H * S, BODY_D * S]} />
        <meshPhongMaterial color="#0e0e12" specular="#222233" shininess={20} />
      </mesh>
      <ThermalGrid width={BODY_W * S} depth={BODY_D * S} height={TOP_H * S} y={TOP_Y * S} />

      {/* Section separators */}
      <mesh position={[0, (BOT_Y * S + MID_Y * S) / 2 + BOT_H * S / 2, 0]}>
        <boxGeometry args={[BODY_W * S + 0.001, 0.0003, BODY_D * S + 0.001]} />
        <meshPhongMaterial color="#c0c0c0" specular="#eeeeee" shininess={70} />
      </mesh>
      <mesh position={[0, (MID_Y * S + TOP_Y * S) / 2 + MID_H * S / 2, 0]}>
        <boxGeometry args={[BODY_W * S + 0.001, 0.0003, BODY_D * S + 0.001]} />
        <meshPhongMaterial color="#c0c0c0" specular="#eeeeee" shininess={70} />
      </mesh>

      {/* === SOLAR PANELS (larger for more power) === */}
      <SolarPanelAssembly side="left" />
      <SolarPanelAssembly side="right" />

      {/* === CAPTURE DEVICE === */}
      {captureType === 'harpoon' && <HarpoonCapture />}
      {captureType === 'manipulator' && <ManipulatorCapture />}
      {captureType === 'net' && <NetCapture />}

      {/* === PRIMARY THRUSTERS (bottom, rear) — twin engines */}
      <PlasmaEngine thrust={thrust} position={[-0.004 * S, BOT_Y * S - BOT_H * S / 2, -BODY_D * S / 2 + 0.003]} />
      <PlasmaEngine thrust={thrust} position={[0.004 * S, BOT_Y * S - BOT_H * S / 2, -BODY_D * S / 2 + 0.003]} />

      {/* === SECONDARY THRUSTERS (top, four RCS) === */}
      <SecondaryThruster position={[-BODY_W * S / 2 - 0.001, TOP_Y * S, BODY_D * S / 2]} direction={[-1, 0, 0]} />
      <SecondaryThruster position={[BODY_W * S / 2 + 0.001, TOP_Y * S, BODY_D * S / 2]} direction={[1, 0, 0]} />
      <SecondaryThruster position={[-BODY_W * S / 2, TOP_Y * S + TOP_H * S / 2, 0]} direction={[0, 1, 0]} />
      <SecondaryThruster position={[BODY_W * S / 2, TOP_Y * S + TOP_H * S / 2, 0]} direction={[0, 1, 0]} />

      {/* === ANTENNAS === */}
      <AntennaAssembly />

      {/* === DOCKING PORT === */}
      <DockingPort />

      {/* === LABEL PLATE === */}
      <TugLabelPlate />

      {/* === STATUS INDICATORS === */}
      <mesh position={[BODY_W * S / 2 - 0.001, MID_Y * S + MID_H * S / 2, -BODY_D * S / 2 + 0.001]}>
        <sphereGeometry args={[0.0005, 8, 8]} />
        <meshBasicMaterial color="#00ff44" />
      </mesh>
      <mesh position={[-BODY_W * S / 2 + 0.001, MID_Y * S + MID_H * S / 2, -BODY_D * S / 2 + 0.001]}>
        <sphereGeometry args={[0.0005, 8, 8]} />
        <meshBasicMaterial color="#ffaa00" />
      </mesh>
      <mesh position={[0, MID_Y * S + MID_H * S / 2, -BODY_D * S / 2 + 0.001]}>
        <sphereGeometry args={[0.0004, 8, 8]} />
        <meshBasicMaterial color="#ff4444" />
      </mesh>

      {/* Beacon lights */}
      <pointLight position={[0, TOP_Y * S, 0]} color="#00ccff" intensity={2.5} distance={0.2} decay={2} />
      <pointLight position={[0, BOT_Y * S, 0]} color="#ffffff" intensity={1.2} distance={0.12} decay={2} />
      </group>
    </group>
  );
}

// ============================================================
// INFRASTRUCTURE COMPONENTS (unchanged)
// ============================================================

/** Debris object */
// ============================================================
// REALISTIC DEBRIS MODELS — different shapes per debris type
// ============================================================
function DebrisObject({ position, rotation, color, size, tumble, debrisType = 'dead_sat' }: {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  color: string;
  size: [number, number, number];
  tumble: [number, number, number];
  debrisType?: string;
}) {
  const debrisRef = useRef<THREE.Group>(null);
  const tumbleRef = useRef(new THREE.Vector3(...tumble));

  useFrame((_, delta) => {
    if (debrisRef.current) {
      debrisRef.current.position.copy(position);
      debrisRef.current.rotation.x += tumbleRef.current.x * delta;
      debrisRef.current.rotation.y += tumbleRef.current.y * delta;
      debrisRef.current.rotation.z += tumbleRef.current.z * delta;
    }
  });

  const DEBRIS_SCALE = 0.01;
  const s: [number, number, number] = [
    Math.max(size[0] * DEBRIS_SCALE, 0.004),
    Math.max(size[1] * DEBRIS_SCALE, 0.004),
    Math.max(size[2] * DEBRIS_SCALE, 0.004),
  ];

  return (
    <group ref={debrisRef}>
      {debrisType === 'rocket_stage' ? (
        <RocketStageDebris s={s} color={color} />
      ) : debrisType === 'fragment' ? (
        <FragmentDebris s={s} color={color} />
      ) : (
        <SatelliteDebris s={s} color={color} />
      )}
    </group>
  );
}

/** Rocket stage — cylindrical body with nozzle, interstage rings, fuel lines */
function RocketStageDebris({ s, color }: { s: [number, number, number]; color: string }) {
  const radius = Math.max(s[0], s[1]) / 2;
  const length = s[2];

  return (
    <group>
      {/* Main cylindrical body */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius, radius, length, 16]} />
        <meshPhongMaterial color={color} specular="#888888" shininess={40} />
      </mesh>

      {/* Metallic sheen highlight stripe */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, radius * 0.95, 0]}>
        <cylinderGeometry args={[radius * 1.005, radius * 1.005, length * 0.9, 16, 1, true, 0, Math.PI * 0.3]} />
        <meshPhongMaterial color="#ffffff" specular="#ffffff" shininess={100} transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>

      {/* Interstage rings (3-4 rings along the body) */}
      {[0.25, 0.5, 0.75].map((t, i) => (
        <mesh key={`ring-${i}`} position={[0, 0, -length / 2 + length * t]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius + 0.0005, 0.0004, 6, 16]} />
          <meshPhongMaterial color="#666666" specular="#999999" shininess={60} />
        </mesh>
      ))}

      {/* Engine nozzle at rear (-Z) */}
      <group position={[0, 0, -length / 2 - 0.001]}>
        {/* Nozzle cone */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[radius * 0.3, radius * 0.7, length * 0.15, 12]} />
          <meshPhongMaterial color="#555560" specular="#777777" shininess={50} />
        </mesh>
        {/* Nozzle bell (dark interior) */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.0005]}>
          <cylinderGeometry args={[radius * 0.15, radius * 0.3, length * 0.05, 8]} />
          <meshPhongMaterial color="#222228" emissive="#111115" emissiveIntensity={0.3} />
        </mesh>
        {/* Nozzle rim */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius * 0.7, 0.0003, 6, 16]} />
          <meshPhongMaterial color="#777777" specular="#aaaaaa" shininess={70} />
        </mesh>
      </group>

      {/* Forward skirt / interstage at front (+Z) */}
      <group position={[0, 0, length / 2]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[radius * 0.8, radius, length * 0.08, 12]} />
          <meshPhongMaterial color={color} specular="#777777" shininess={35} />
        </mesh>
        {/* Forward cap (closed end) */}
        <mesh position={[0, 0, length * 0.04]}>
          <circleGeometry args={[radius * 0.8, 16]} />
          <meshPhongMaterial color="#333338" specular="#555555" shininess={30} />
        </mesh>
      </group>

      {/* Fuel lines / piping along the body */}
      {[0.4, -0.4].map((angle, i) => (
        <mesh key={`pipe-${i}`} position={[Math.cos(angle) * (radius + 0.0006), 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.0003, 0.0003, length * 0.8, 6]} />
          <meshPhongMaterial color="#888888" specular="#bbbbbb" shininess={50} />
        </mesh>
      ))}

      {/* Small thruster / RCS pods on sides */}
      {[-1, 1].map((side) => (
        <group key={`rcs-${side}`} position={[side * (radius + 0.001), radius * 0.3, length * 0.2]}>
          <mesh>
            <boxGeometry args={[0.0012, 0.001, 0.0008]} />
            <meshPhongMaterial color="#444448" specular="#666666" shininess={40} />
          </mesh>
        </group>
      ))}

      {/* Damage: a few bent metal plates sticking out */}
      <mesh position={[radius * 0.6, -radius * 0.8, -length * 0.15]} rotation={[0.3, 0.5, -0.4]}>
        <boxGeometry args={[0.003, 0.0003, 0.002]} />
        <meshPhongMaterial color="#666666" specular="#888888" shininess={30} />
      </mesh>
      <mesh position={[-radius * 0.3, -radius * 0.9, length * 0.3]} rotation={[-0.2, -0.3, 0.6]}>
        <boxGeometry args={[0.002, 0.0003, 0.0015]} />
        <meshPhongMaterial color="#777777" specular="#999999" shininess={25} />
      </mesh>
    </group>
  );
}

/** Satellite debris — box body, solar panels (one damaged), antenna dish, thermal blanket */
function SatelliteDebris({ s, color }: { s: [number, number, number]; color: string }) {
  const panelWidth = s[0] * 1.2;
  const panelDepth = s[2] * 0.8;

  return (
    <group>
      {/* Main satellite body */}
      <mesh>
        <boxGeometry args={s} />
        <meshPhongMaterial color={color} specular="#666666" shininess={35} />
      </mesh>

      {/* Gold MLI thermal blanket patches */}
      <mesh position={[0, s[1] / 2 + 0.00005, 0]}>
        <planeGeometry args={[s[0] * 0.6, s[2] * 0.4]} />
        <meshPhongMaterial color="#b8960a" specular="#ddbb22" shininess={25} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -s[1] / 2 - 0.00005, 0]}>
        <planeGeometry args={[s[0] * 0.5, s[2] * 0.3]} />
        <meshPhongMaterial color="#a08008" specular="#ccaa20" shininess={20} side={THREE.DoubleSide} />
      </mesh>

      {/* Solar panel — intact (left side) */}
      <group position={[-s[0] / 2 - panelWidth / 2 - 0.001, 0, 0]}>
        {/* Panel boom */}
        <mesh>
          <boxGeometry args={[panelWidth + 0.002, 0.0008, 0.0008]} />
          <meshPhongMaterial color="#888888" specular="#bbbbbb" shininess={60} />
        </mesh>
        {/* Solar panel surface */}
        <mesh position={[0, 0.0006, 0]}>
          <boxGeometry args={[panelWidth, 0.0003, panelDepth]} />
          <meshPhongMaterial color="#0a0a2e" specular="#1a1a5e" shininess={60} />
        </mesh>
        {/* Solar cell grid — horizontal */}
        {Array.from({ length: 5 }).map((_, i) => (
          <mesh key={`sg-${i}`} position={[0, 0.0008, -panelDepth / 2 + (i + 0.5) * panelDepth / 5]}>
            <boxGeometry args={[panelWidth * 0.95, 0.0001, 0.0003]} />
            <meshPhongMaterial color="#1a237e" specular="#3333aa" shininess={80} />
          </mesh>
        ))}
        {/* Solar cell grid — vertical */}
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={`sv-${i}`} position={[-panelWidth / 2 + (i + 0.5) * panelWidth / 8, 0.0008, 0]}>
            <boxGeometry args={[0.0003, 0.0001, panelDepth * 0.95]} />
            <meshPhongMaterial color="#1a237e" specular="#3333aa" shininess={80} />
          </mesh>
        ))}
        {/* Panel frame */}
        <mesh position={[0, 0.0005, 0]}>
          <boxGeometry args={[panelWidth + 0.0006, 0.0005, panelDepth + 0.0006]} />
          <meshPhongMaterial color="#555555" specular="#777777" shininess={40} />
        </mesh>
      </group>

      {/* Solar panel — DAMAGED (right side, bent at angle) */}
      <group position={[s[0] / 2 + panelWidth * 0.3 + 0.001, 0, 0]} rotation={[0.3, 0.2, -0.5]}>
        {/* Broken boom */}
        <mesh position={[-panelWidth * 0.15, 0, 0]}>
          <boxGeometry args={[panelWidth * 0.4, 0.0006, 0.0006]} />
          <meshPhongMaterial color="#777777" specular="#999999" shininess={40} />
        </mesh>
        {/* Panel fragment — smaller (partially torn off) */}
        <mesh position={[panelWidth * 0.1, 0, 0]}>
          <boxGeometry args={[panelWidth * 0.5, 0.0003, panelDepth * 0.6]} />
          <meshPhongMaterial color="#0a0a1e" specular="#1a1a3e" shininess={40} />
        </mesh>
        {/* Torn edge detail */}
        <mesh position={[panelWidth * 0.35, 0.0002, 0]} rotation={[0, 0, 0.1]}>
          <boxGeometry args={[0.0008, 0.0003, panelDepth * 0.55]} />
          <meshPhongMaterial color="#333333" specular="#555555" shininess={20} />
        </mesh>
      </group>

      {/* Antenna dish on top */}
      <group position={[s[0] * 0.15, s[1] / 2 + 0.002, s[2] * 0.2]}>
        {/* Dish mount */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.0003, 0.0003, 0.003, 4]} />
          <meshPhongMaterial color="#aaaaaa" specular="#cccccc" shininess={60} />
        </mesh>
        {/* Dish (slightly bent) */}
        <mesh position={[0, 0.002, 0]} rotation={[0.5, 0.15, 0]}>
          <sphereGeometry args={[0.002, 12, 8, 0, Math.PI * 2, 0, Math.PI / 3]} />
          <meshPhongMaterial color="#cccccc" specular="#ffffff" shininess={80} side={THREE.DoubleSide} />
        </mesh>
        {/* Feed horn */}
        <mesh position={[0, 0.003, 0.001]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.00015, 0.00015, 0.002, 4]} />
          <meshPhongMaterial color="#999999" />
        </mesh>
      </group>

      {/* Exposed internal structure (damage hole) */}
      <mesh position={[s[0] * 0.2, s[1] / 2 + 0.0001, -s[2] * 0.3]}>
        <boxGeometry args={[s[0] * 0.3, 0.001, s[2] * 0.25]} />
        <meshPhongMaterial color="#1a1a22" emissive="#0a0a10" emissiveIntensity={0.2} />
      </mesh>
      {/* Internal wiring visible through hole */}
      {Array.from({ length: 3 }).map((_, i) => (
        <mesh key={`wire-${i}`} position={[s[0] * (0.1 + i * 0.06), s[1] / 2 + 0.001, -s[2] * (0.25 + i * 0.05)]}
          rotation={[0.3 * (i - 1), 0.2 * i, 0]}>
          <cylinderGeometry args={[0.0001, 0.0001, 0.002, 4]} />
          <meshBasicMaterial color={i === 1 ? '#ff4400' : '#ffcc00'} />
        </mesh>
      ))}

      {/* Status indicator (dim red — no power) */}
      <mesh position={[-s[0] / 2 + 0.001, s[1] / 2 + 0.0005, s[2] / 2 - 0.001]}>
        <sphereGeometry args={[0.0003, 6, 6]} />
        <meshBasicMaterial color="#330000" />
      </mesh>
    </group>
  );
}

/** Fragment debris — irregular bent metal, torn panels, shattered pieces */
function FragmentDebris({ s, color }: { s: [number, number, number]; color: string }) {
  // Pre-compute random values once via useMemo to avoid NaN from Math.random() on every render
  const jaggedPieces = useMemo(() =>
    Array.from({ length: 4 }).map((_, i) => {
      const angle = (i / 4) * Math.PI * 2;
      const dist = 0.3 + (i * 0.137 + 0.1) * 1.5; // deterministic pseudo-random
      const seed = i * 7 + 3;
      return {
        key: i,
        pos: [
          Math.cos(angle) * s[0] * dist,
          Math.sin(angle) * s[1] * dist,
          (i % 2 === 0 ? 1 : -1) * s[2] * 0.4,
        ] as [number, number, number],
        rot: [
          ((seed * 13 % 10) / 20) - 0.25,
          ((seed * 7 % 10) / 20) - 0.25,
          ((seed * 3 % 10) / 10) - 0.5,
        ] as [number, number, number],
        geo: [0.001 + (seed % 5) * 0.0005, 0.0004, 0.001 + ((seed + 2) % 5) * 0.0005] as [number, number, number],
        isAlt: i % 2 === 0,
      };
    }), [s]);

  return (
    <group>
      {/* Main irregular chunk */}
      <mesh>
        <boxGeometry args={s} />
        <meshPhongMaterial color={color} specular="#444444" shininess={20} />
      </mesh>

      {/* Bent metal plate 1 */}
      <mesh position={[s[0] * 0.4, -s[1] * 0.3, -s[2] * 0.5]} rotation={[0.5, 0.3, -0.7]}>
        <boxGeometry args={[s[0] * 0.6, 0.0003, s[2] * 0.4]} />
        <meshPhongMaterial color="#777777" specular="#999999" shininess={25} />
      </mesh>

      {/* Bent metal plate 2 */}
      <mesh position={[-s[0] * 0.3, s[1] * 0.4, s[2] * 0.4]} rotation={[-0.4, -0.6, 0.3]}>
        <boxGeometry args={[s[0] * 0.5, 0.0004, s[2] * 0.35]} />
        <meshPhongMaterial color="#888888" specular="#aaaaaa" shininess={30} />
      </mesh>

      {/* Torn solar panel fragment */}
      <mesh position={[s[0] * 0.5, 0, s[2] * 0.3]} rotation={[0.2, 0.8, 0.1]}>
        <boxGeometry args={[s[0] * 0.4, 0.0003, s[2] * 0.5]} />
        <meshPhongMaterial color="#0a0a2e" specular="#1a1a5e" shininess={50} />
      </mesh>

      {/* Jagged edge / torn surface */}
      {jaggedPieces.map((p) => (
        <mesh key={`jag-${p.key}`}
          position={p.pos}
          rotation={p.rot}>
          <boxGeometry args={p.geo} />
          <meshPhongMaterial color={p.isAlt ? color : '#555555'} specular="#666666" shininess={15} />
        </mesh>
      ))}

      {/* Exposed framework struts */}
      {[-1, 1].map((side) => (
        <mesh key={`strut-${side}`} position={[side * s[0] * 0.5, 0, 0]} rotation={[0, 0, side * 0.3]}>
          <cylinderGeometry args={[0.0003, 0.0003, s[1] * 1.5, 4]} />
          <meshPhongMaterial color="#999999" specular="#bbbbbb" shininess={50} />
        </mesh>
      ))}

      {/* Small debris particles floating nearby */}
      {[1, 2, 3].map((i) => (
        <mesh key={`particle-${i}`}
          position={[
            (Math.sin(i * 2.1) * 0.5) * s[0],
            (Math.cos(i * 1.7) * 0.5) * s[1],
            (Math.sin(i * 3.3) * 0.5) * s[2]
          ]}>
          <boxGeometry args={[0.0005, 0.0005, 0.0005]} />
          <meshPhongMaterial color="#666666" specular="#888888" shininess={20} />
        </mesh>
      ))}

      {/* Burn marks / scorching */}
      <mesh position={[s[0] * 0.1, s[1] / 2 + 0.00005, 0]}>
        <planeGeometry args={[s[0] * 0.3, s[2] * 0.2]} />
        <meshPhongMaterial color="#222222" emissive="#110808" emissiveIntensity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Orbit line */
function OrbitLine({ radius, inclination = 0, raan = 0, color = '#44ff44', opacity = 0.4 }: {
  radius: number;
  inclination?: number;
  raan?: number;
  color?: string;
  opacity?: number;
}) {
  // Guard against NaN radius — skip rendering if invalid
  const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 1.0;
  const safeInclination = Number.isFinite(inclination) ? inclination : 0;
  const safeRaan = Number.isFinite(raan) ? raan : 0;

  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = safeRadius * Math.cos(angle);
      const z = safeRadius * Math.sin(angle);
      const incRad = (safeInclination * Math.PI) / 180;
      const y = z * Math.sin(incRad);
      const zr = z * Math.cos(incRad);
      const raanRad = (safeRaan * Math.PI) / 180;
      const xr = x * Math.cos(raanRad) - zr * Math.sin(raanRad);
      const zrr = x * Math.sin(raanRad) + zr * Math.cos(raanRad);
      pts.push(new THREE.Vector3(xr, y, zrr));
    }
    return pts;
  }, [safeRadius, safeInclination, safeRaan]);

  const lineGeometry = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [points]);

  return (
    <line geometry={lineGeometry}>
      <lineBasicMaterial color={color} transparent opacity={opacity} linewidth={1} />
    </line>
  );
}

/** Star field */
function StarField() {
  return (
    <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={0.5} />
  );
}

// ============================================================
// ENHANCED DEPLOYED CUBESAT with multi-phase animation
// ============================================================
function DeployedCubeSat({ tugPosition, tugRotation, deployProgress, cubeSatType, deployed, satIndex }: {
  tugPosition: THREE.Vector3;
  tugRotation: THREE.Euler;
  deployProgress: number;
  cubeSatType: '1U' | '2U' | '3U';
  deployed?: boolean;
  satIndex?: number;
}) {
  const satRef = useRef<THREE.Group>(null);
  const leftPanelRef = useRef<THREE.Group>(null);
  const rightPanelRef = useRef<THREE.Group>(null);
  const antennaRef = useRef<THREE.Mesh>(null);
  const ledRef = useRef<THREE.Mesh>(null);
  const driftTime = useRef(0);
  const leftPanelMatRef = useRef<THREE.MeshPhongMaterial>(null);
  const rightPanelMatRef = useRef<THREE.MeshPhongMaterial>(null);
  const ledLightRef = useRef<THREE.PointLight>(null);
  const flashTriggeredRef = useRef(false);
  const flashTimeRef = useRef(0);
  const flashRef = useRef<THREE.Group>(null);
  const flashParticleRefs = useRef<(THREE.Mesh | null)[]>(new Array(8).fill(null));
  const flashLightRef = useRef<THREE.PointLight>(null);

  // CubeSat body dimensions
  const satSize = 0.004; // 10cm real
  const satLen = cubeSatType === '1U' ? 0.004 : cubeSatType === '2U' ? 0.007 : 0.010;

  // Animation phases
  const lidAngle = remap(deployProgress, 0, 0.15, 0, -Math.PI / 2);
  const slideOffset = remap(deployProgress, 0.15, 0.6, 0, 1);
  const panelExtension = remap(deployProgress, 0.6, 0.8, 0, 1);
  const antennaExtension = remap(deployProgress, 0.8, 1.0, 0, 1);

  useFrame((_, delta) => {
    if (!satRef.current) return;

    const q = new THREE.Quaternion().setFromEuler(tugRotation);
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(q);

    // For multi-satellite: rotate drift direction per satellite index
    const directionAngle = (satIndex || 0) * (Math.PI / 3); // 60° apart for each satellite
    const q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), directionAngle);
    const driftDir = forward.clone().applyQuaternion(q2);

    if (!deployed) {
      // During deployment: satellite slides out of container
      const containerTopY = TOP_Y + TOP_H / 2;
      const baseOffset = containerTopY + 0.004; // container height above tug body
      const ejectionOffset = slideOffset * 0.05 * TUG_SCALE;
      satRef.current.position.copy(tugPosition)
        .add(driftDir.clone().multiplyScalar(baseOffset + ejectionOffset));
      satRef.current.quaternion.copy(q);
    } else {
      // After deployment: accelerating drift away
      driftTime.current += delta;
      const driftSpeed = 0.004 + driftTime.current * 0.0006;
      const drift = 0.05 * TUG_SCALE + driftTime.current * driftSpeed;
      satRef.current.position.copy(tugPosition)
        .add(driftDir.clone().multiplyScalar(drift));
      // Gentle spinning tumble — rate slowly increases over time
      const tumbleRate = 0.4 + driftTime.current * 0.04;
      satRef.current.rotation.x = tugRotation.x + Math.sin(driftTime.current * tumbleRate) * 0.25;
      satRef.current.rotation.y = tugRotation.y + Math.sin(driftTime.current * tumbleRate * 0.7) * 0.2;
      satRef.current.rotation.z = tugRotation.z + Math.cos(driftTime.current * tumbleRate * 0.8) * 0.22;
    }

    // Animate solar panels
    if (leftPanelRef.current) {
      leftPanelRef.current.rotation.z = remap(deployProgress, 0.6, 0.8, 0, -Math.PI / 2);
    }
    if (rightPanelRef.current) {
      rightPanelRef.current.rotation.z = remap(deployProgress, 0.6, 0.8, 0, Math.PI / 2);
    }

    // Animate antenna
    if (antennaRef.current) {
      antennaRef.current.scale.y = deployed ? 1.0 : antennaExtension;
    }

    // Blink LED after deployment
    if (ledRef.current && deployed) {
      ledRef.current.visible = Math.sin(driftTime.current * 4) > 0;
    }

    // Solar panel blue shimmer after deployment
    if (leftPanelMatRef.current && deployed) {
      const shimmer = 0.2 + Math.sin(driftTime.current * 2.5) * 0.2;
      leftPanelMatRef.current.emissive.setRGB(0.02, 0.06, shimmer);
      leftPanelMatRef.current.emissiveIntensity = 0.3 + shimmer;
    }
    if (rightPanelMatRef.current && deployed) {
      const shimmer = 0.2 + Math.sin(driftTime.current * 2.5 + 1.2) * 0.2;
      rightPanelMatRef.current.emissive.setRGB(0.02, 0.06, shimmer);
      rightPanelMatRef.current.emissiveIntensity = 0.3 + shimmer;
    }

    // Blink LED point light in sync with LED mesh
    if (ledLightRef.current && deployed) {
      ledLightRef.current.intensity = Math.sin(driftTime.current * 4) > 0 ? 0.6 : 0.0;
    }

    // Separation flash: trigger once when deployProgress crosses 0.6
    if (deployProgress > 0.6 && !flashTriggeredRef.current) {
      flashTriggeredRef.current = true;
      flashTimeRef.current = 0;
    }
    if (flashTriggeredRef.current && flashRef.current) {
      flashTimeRef.current += delta * 2.5;
      if (flashTimeRef.current < 1.0) {
        flashRef.current.visible = true;
        const t = flashTimeRef.current;
        flashParticleRefs.current.forEach((mesh, i) => {
          if (!mesh) return;
          const angle = (i / 8) * Math.PI * 2;
          const radius = t * 0.008;
          mesh.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
          mesh.scale.setScalar(Math.max(0.1, 1 - t * 0.8));
          (mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 - t);
        });
        if (flashLightRef.current) {
          flashLightRef.current.intensity = Math.max(0, 2.0 - t * 3);
        }
      } else {
        flashRef.current.visible = false;
      }
    }
  });

  return (
    <group ref={satRef}>
      <group scale={[TUG_SCALE, TUG_SCALE, TUG_SCALE]}>
      {/* === CubeSat body === */}
      <mesh>
        <boxGeometry args={[satSize, satSize, satLen]} />
        <meshPhongMaterial color="#2a2a3a" specular="#444466" shininess={50} />
      </mesh>
      {/* Body frame edges */}
      <mesh>
        <boxGeometry args={[satSize + 0.0002, satSize + 0.0002, satLen + 0.0002]} />
        <meshPhongMaterial color="#3a3a4a" specular="#555577" shininess={40} />
      </mesh>
      <mesh>
        <boxGeometry args={[satSize - 0.0001, satSize - 0.0001, satLen - 0.0001]} />
        <meshPhongMaterial color="#2a2a3a" specular="#444466" shininess={50} />
      </mesh>

      {/* Solar cells on body faces */}
      {[-1, 1].map(side => (
        <group key={`face-${side}`}>
          {/* Grid on body side face */}
          {Array.from({ length: 3 }).map((_, i) => (
            <mesh key={`sg-${side}-${i}`}
              position={[side * (satSize / 2 + 0.00005), -satSize / 2 + 0.001 + i * (satSize - 0.002) / 2, 0]}>
              <planeGeometry args={[0.001, satSize * 0.7]} />
              <meshBasicMaterial color="#1a237e" transparent opacity={0.6} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
      ))}

      {/* === Deployment hinge marks (visible on body) === */}
      <mesh position={[-satSize / 2 - 0.0003, 0, 0]}>
        <cylinderGeometry args={[0.0003, 0.0003, 0.001, 6]} />
        <meshPhongMaterial color="#888888" specular="#aaaaaa" shininess={60} />
      </mesh>
      <mesh position={[satSize / 2 + 0.0003, 0, 0]}>
        <cylinderGeometry args={[0.0003, 0.0003, 0.001, 6]} />
        <meshPhongMaterial color="#888888" specular="#aaaaaa" shininess={60} />
      </mesh>

      {/* === Deploying solar panels (extend outward) === */}
      <group ref={leftPanelRef} position={[-satSize / 2 - 0.0003, 0, 0]}>
        <mesh position={[-0.005, 0, 0]}>
          <boxGeometry args={[0.008, 0.0003, satSize * 0.8]} />
          <meshPhongMaterial ref={leftPanelMatRef} color="#1a237e" specular="#333366" shininess={80} emissive="#000022" emissiveIntensity={0.1} />
        </mesh>
        {/* Cell grid on panel */}
        {Array.from({ length: 4 }).map((_, i) => (
          <mesh key={`lpc-${i}`} position={[-0.005, 0.0002, -satSize * 0.3 + i * satSize * 0.2]}>
            <planeGeometry args={[0.007, 0.0003]} />
            <meshBasicMaterial color="#223388" transparent opacity={0.5} />
          </mesh>
        ))}
      </group>

      <group ref={rightPanelRef} position={[satSize / 2 + 0.0003, 0, 0]}>
        <mesh position={[0.005, 0, 0]}>
          <boxGeometry args={[0.008, 0.0003, satSize * 0.8]} />
          <meshPhongMaterial ref={rightPanelMatRef} color="#1a237e" specular="#333366" shininess={80} emissive="#000022" emissiveIntensity={0.1} />
        </mesh>
        {Array.from({ length: 4 }).map((_, i) => (
          <mesh key={`rpc-${i}`} position={[0.005, 0.0002, -satSize * 0.3 + i * satSize * 0.2]}>
            <planeGeometry args={[0.007, 0.0003]} />
            <meshBasicMaterial color="#223388" transparent opacity={0.5} />
          </mesh>
        ))}
      </group>

      {/* === Antenna whip (extends upward) === */}
      <mesh ref={antennaRef} position={[0, satSize / 2 + 0.002, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.00015, 0.00015, 0.008, 4]} />
        <meshPhongMaterial color="#c0c0c0" specular="#eeeeee" shininess={70} />
      </mesh>
      {/* Antenna tip */}
      <mesh position={[0, satSize / 2 + 0.002 + antennaExtension * 0.004, 0]}>
        <sphereGeometry args={[0.0003, 6, 6]} />
        <meshPhongMaterial color="#d0d0d0" specular="#ffffff" shininess={90} />
      </mesh>

      {/* === Separation springs (visible before full deploy, multi-coil) === */}
      {!deployed && deployProgress < 0.5 && (
        <group>
          {[-1, 1].map(side => (
            <group key={`sep-spring-${side}`}>
              {/* Coil spring body — 5 coils that compress during ejection */}
              {Array.from({ length: 5 }).map((_, i) => (
                <mesh key={`coil-${side}-${i}`}
                  position={[
                    side * satSize * 0.3,
                    -satSize / 2 - 0.0005,
                    satLen / 2 + 0.001 - (i + 1) * 0.0008 * (1 - deployProgress * 0.8)
                  ]}
                  rotation={[0, (i * Math.PI) / 2.5, 0]}>
                  <torusGeometry args={[0.0006, 0.00012, 4, 8]} />
                  <meshPhongMaterial color="#dddddd" specular="#ffffff" shininess={90} />
                </mesh>
              ))}
              {/* Spring base plate */}
              <mesh position={[side * satSize * 0.3, -satSize / 2 - 0.0005, satLen / 2 + 0.001 - 5 * 0.0008]}>
                <boxGeometry args={[0.001, 0.001, 0.0005]} />
                <meshPhongMaterial color="#999999" specular="#bbbbbb" shininess={60} />
              </mesh>
              {/* Spring pusher plate */}
              <mesh position={[side * satSize * 0.3, -satSize / 2 - 0.0005, satLen / 2 + 0.001 - deployProgress * 0.003]}>
                <boxGeometry args={[0.001, 0.001, 0.0005]} />
                <meshPhongMaterial color="#bbbbbb" specular="#dddddd" shininess={70} />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* === Green status LED (blinks when deployed) === */}
      <mesh ref={ledRef} position={[satSize / 2 - 0.001, satSize / 2 - 0.001, satLen / 2 + 0.0001]} visible={false}>
        <sphereGeometry args={[0.0004, 6, 6]} />
        <meshBasicMaterial color="#00ff44" transparent opacity={0.9} />
      </mesh>
      {/* LED glow halo (visible after deployment) */}
      <mesh position={[satSize / 2 - 0.001, satSize / 2 - 0.001, satLen / 2 + 0.0001]} visible={!!deployed}>
        <sphereGeometry args={[0.0008, 8, 8]} />
        <meshBasicMaterial color="#00ff44" transparent opacity={0.15} />
      </mesh>
      <pointLight ref={ledLightRef} position={[satSize / 2 - 0.001, satSize / 2 - 0.001, satLen / 2 + 0.0001]} color="#00ff44" intensity={0} distance={0.02} />

      {/* === Separation flash particles (triggered at deployProgress > 0.6) === */}
      <group ref={flashRef} position={[0, 0, satLen / 2]} visible={false}>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={`flash-${i}`} ref={el => { flashParticleRefs.current[i] = el; }}>
            <sphereGeometry args={[0.0003, 4, 4]} />
            <meshBasicMaterial color="#88ccff" transparent opacity={0.8} />
          </mesh>
        ))}
        <pointLight ref={flashLightRef} color="#aaddff" intensity={0} distance={0.05} />
      </group>
      </group>
    </group>
  );
}

// ============================================================
// CAPTURE TETHER (unchanged)
// ============================================================
function CaptureTether({ tugPosition, targetPosition, captureState, captureType, captureProgress }: {
  tugPosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
  captureState?: string;
  captureType?: string | null;
  captureProgress?: number;
}) {
  const lineRef = useRef<any>(null);

  useFrame(() => {
    if (!lineRef.current) return;
    const geo = lineRef.current.geometry;
    const positions = geo.attributes.position;
    if (positions) {
      // Guard against NaN — only update if positions are valid
      const px = tugPosition?.x ?? 0;
      const py = tugPosition?.y ?? 0;
      const pz = tugPosition?.z ?? 0;
      const tx = targetPosition?.x ?? 0;
      const ty = targetPosition?.y ?? 0;
      const tz = targetPosition?.z ?? 0;
      const safe = (v: number) => (Number.isFinite(v) ? v : 0);
      positions.array[0] = safe(px);
      positions.array[1] = safe(py);
      positions.array[2] = safe(pz);
      positions.array[3] = safe(tx);
      positions.array[4] = safe(ty);
      positions.array[5] = safe(tz);
      positions.needsUpdate = true;
      // Force bounding sphere recalculation to prevent NaN propagation
      geo.computeBoundingSphere();
    }
  });

  const isCapturing = captureState === 'capturing';
  const isCaptured = captureState === 'captured' || captureState === 'deorbiting';

  let color = '#ffff00';
  let opacity = 0.3;
  if (isCapturing) {
    color = '#ff8800';
    opacity = 0.5 + (captureProgress || 0) * 0.5;
  } else if (isCaptured) {
    color = '#00ff88';
    opacity = 0.9;
  }

  // Stable initial positions (0,0,0 → 0,0,0) avoids NaN bounding sphere before useFrame updates
  const initialPositions = useMemo(() => new Float32Array([0, 0, 0, 0, 0, 0]), []);

  return (
    <line ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[initialPositions, 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={opacity} linewidth={1} />
    </line>
  );
}

// ============================================================
// PREDICTED ORBIT PATH — shows actual elliptical trajectory
// ============================================================
function PredictedOrbitPath({ points }: { points: number[] }) {
  const geoRef = useRef<THREE.BufferGeometry>(null);

  // Rebuild geometry when points change
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    if (points.length < 9) return geo;
    const arr = new Float32Array(points);
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    geo.computeBoundingSphere();
    return geo;
  }, [points]);

  if (points.length < 9) return null;

  return (
    <line geometry={geometry}>
      <lineBasicMaterial color="#44ff88" transparent opacity={0.7} linewidth={1} />
    </line>
  );
}

// ============================================================
// MAIN SCENE (export)
// ============================================================
interface SpaceSceneProps {
  tugPosition?: THREE.Vector3;
  tugRotation?: THREE.Euler;
  thrust?: boolean;
  targetPosition?: THREE.Vector3 | null;
  targetColor?: string;
  targetSize?: [number, number, number];
  targetTumble?: [number, number, number];
  /** Debris type for realistic rendering */
  targetDebrisType?: string;
  /** Predicted orbit path (flat [x,y,z,...] in visual coords) */
  orbitPath?: number[];
  currentOrbitRadius?: number;
  targetOrbitRadius?: number;
  currentOrbitInclination?: number;
  targetOrbitInclination?: number;
  /** RAAN of target orbit (degrees, 0-360) */
  targetOrbitRAAN?: number;
  cameraView?: string;
  showTarget?: boolean;
  burning?: boolean;
  /** Current altitude in meters — for reentry fire intensity */
  altitude?: number;
  /** Game mode — determines tug model */
  gameMode?: 'nanosat' | 'janitor' | null;
  /** Capture type (for janitor) */
  captureType?: 'harpoon' | 'manipulator' | 'net' | null;
  /** CubeSat type (for nanosat) */
  cubeSatType?: '1U' | '2U' | '3U';
  /** Capture state */
  captureState?: string;
  /** Deployment state */
  deploymentState?: string;
  /** Capture progress (0-1) */
  captureProgress?: number;
  /** Deployment progress (0-1) */
  deployProgress?: number;
  /** Count of already deployed satellites */
  deployedSats?: number;
  /** Total satellites player chose to deploy */
  selectedSatCount?: number;
}

export default function SpaceScene({
  tugPosition = new THREE.Vector3(0, 0, 1.1),
  tugRotation = new THREE.Euler(0, 0, 0),
  thrust = false,
  targetPosition = null,
  targetColor = '#888888',
  targetSize = [0.01, 0.01, 0.01],
  targetTumble = [0.5, 0.5, 0.5],
  targetDebrisType = 'dead_sat',
  orbitPath,
  currentOrbitRadius = 1.1,
  targetOrbitRadius = 1.1,
  currentOrbitInclination = 51.6,
  targetOrbitInclination = 51.6,
  targetOrbitRAAN = 0,
  cameraView = 'orbital',
  showTarget = false,
  burning = false,
  altitude = 400_000,
  gameMode = 'nanosat',
  captureType = 'harpoon',
  cubeSatType = '1U',
  captureState = 'approaching',
  deploymentState = 'approaching',
  captureProgress = 0,
  deployProgress = 0,
  deployedSats = 0,
  selectedSatCount = 1,
}: SpaceSceneProps) {
  // Detect mobile for performance adaptations
  const isMobileDevice = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);
  }, []);

  // Cap DPR — critical for mobile: 3x screens render 9x pixels → GPU crash
  const cappedDpr = useMemo(() => {
    const maxDpr = isMobileDevice ? 1.5 : 2;
    return Math.min(window.devicePixelRatio, maxDpr);
  }, [isMobileDevice]);

  // Handle WebGL context creation errors
  const handleCreated = useCallback((state: any) => {
    const renderer = state.gl;
    if (!renderer) {
      console.error('[SpaceScene] WebGL context creation failed');
      return;
    }
    // Set performance hints for mobile
    if (isMobileDevice) {
      renderer.setClearColor(0x000005, 1);
    }
    // Log renderer info for debugging — use raw WebGL context
    try {
      const rawGl = renderer.getContext?.() ?? renderer.domElement?.getContext('webgl2') ?? renderer.domElement?.getContext('webgl');
      if (rawGl && typeof rawGl.getExtension === 'function') {
        const debugInfo = rawGl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          const gpuRenderer = rawGl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          console.log('[SpaceScene] WebGL renderer:', gpuRenderer);
        }
      }
    } catch {
      // Silently ignore — debug info is non-critical
    }
  }, [isMobileDevice]);

  return (
    <Canvas
      camera={{ position: [0.5, 0.5, 1.5], fov: 60, near: 0.001, far: 100 }}
      style={{ background: '#000005' }}
      dpr={cappedDpr}
      gl={{
        antialias: !isMobileDevice,
        alpha: false,
        powerPreference: isMobileDevice ? 'low-power' : 'high-performance',
        stencil: false,
        depth: true,
      }}
      onCreated={handleCreated}
      onError={(err) => {
        console.error('[SpaceScene] Canvas error:', err);
      }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 3, 5]} intensity={2.0} color="#ffffff" />
      <directionalLight position={[-3, -1, -5]} intensity={0.1} color="#4466aa" />

      {/* Stars */}
      <StarField />

      {/* Earth */}
      <Earth />

      {/* Predicted orbit path (from engine — shows actual elliptical trajectory) */}
      {orbitPath && orbitPath.length > 6 && (
        <PredictedOrbitPath points={orbitPath} />
      )}

      {/* Target orbit (analytical circle with RAAN) */}
      {Math.abs(targetOrbitRadius - currentOrbitRadius) > 0.01 && (
        <OrbitLine
          radius={targetOrbitRadius}
          inclination={targetOrbitInclination}
          color="#ff8844"
          opacity={0.2}
          raan={targetOrbitRAAN}
        />
      )}

      {/* Reentry fire effect — visible when altitude < 250km in ANY mode */}
      {altitude < 250_000 && <ReentryFireEffect position={tugPosition} altitude={altitude} />}

      {/* Tug model — TUG_SCALE applied inside each model */}
        {gameMode === 'nanosat' ? (
          <NanosatTug
            position={tugPosition}
            rotation={tugRotation}
            thrust={thrust}
            cubeSatType={cubeSatType || '1U'}
            deploymentState={deploymentState}
            deployProgress={deployProgress}
          />
        ) : (
          <JanitorTug
            position={tugPosition}
            rotation={tugRotation}
            thrust={thrust}
            captureType={captureType || 'harpoon'}
          />
        )}

      {/* Tug marker removed — tug model is visible enough */}

      {/* Target debris */}
      {showTarget && targetPosition && (
        <DebrisObject
          position={targetPosition}
          rotation={new THREE.Euler(0, 0, 0)}
          color={targetColor}
          size={targetSize}
          tumble={targetTumble}
          debrisType={targetDebrisType}
        />
      )}

      {/* Capture tether */}
      {showTarget && targetPosition && (
        <CaptureTether
          tugPosition={tugPosition}
          targetPosition={targetPosition}
          captureState={captureState}
          captureType={captureType}
          captureProgress={captureProgress}
        />
      )}

      {/* Capture animation — visible capture mechanism during capturing state */}
      {captureState === 'capturing' && targetPosition && (
        <CaptureAnimation
          tugPosition={tugPosition}
          targetPosition={targetPosition}
          captureProgress={captureProgress}
          captureType={captureType || 'harpoon'}
        />
      )}

      {/* Deployed satellites — previously deployed ones drift away */}
      {gameMode === 'nanosat' && deployedSats > 0 && Array.from({ length: deployedSats }).map((_, i) => (
        <DeployedCubeSat
          key={`deployed-${i}`}
          tugPosition={tugPosition}
          tugRotation={tugRotation}
          deployProgress={1}
          cubeSatType={cubeSatType || '1U'}
          deployed={true}
          satIndex={i}
        />
      ))}
      {/* Currently deploying satellite */}
      {gameMode === 'nanosat' && (deploymentState === 'deploying') && (
        <DeployedCubeSat
          tugPosition={tugPosition}
          tugRotation={tugRotation}
          deployProgress={deployProgress}
          cubeSatType={cubeSatType || '1U'}
          deployed={false}
        />
      )}

      {/* Camera controller */}
      <CameraController
        followTarget={tugPosition}
        view={cameraView}
        tugRotation={tugRotation}
      />
    </Canvas>
  );
}
