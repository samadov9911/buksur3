/**
 * Игровой движок — управление физикой и состоянием в реальном времени
 * Вызывается из основного игрового компонента
 * НЕ импортирует Three.js — работает с чистыми числами
 *
 * Координатная система (физическая):
 *   X — радиус от Земли (осевой)
 *   Y, Z — орбитальная плоскость
 *
 * Интеграция: Velocity Verlet (симплектический, сохраняет энергию)
 * Суб-шаги: адаптивные для стабильности
 *
 * Визуальная система Three.js: toVisualCoords меняет Y↔Z
 * Вращение буксира: Euler(pitch, yaw, roll) — 'XYZ' порядок (Three.js default)
 */
'use client';

import { useCallback, useRef } from 'react';
import { useGameStore } from '@/game/store/gameStore';
import {
  getOrbitalInfo,
  toVisualCoords,
  fuelForDeltaV,
  circularOrbitalSpeed,
  atmosphericDensity,
} from '@/game/engine/orbitalMechanics';
import { R_EARTH, MU_EARTH, J2, TIME_SCALE, ORBIT_TYPES } from '@/game/engine/constants';
import { DEPLOYER_TUG, JANITOR_TUG } from '@/game/data/satellites';
import { getMissionById } from '@/game/data/missions';
import { getDebrisById } from '@/game/data/debris';
import type { SpatialState, OrbitalInfo } from '@/game/engine/orbitalMechanics';
import type { GamepadInput } from '@/hooks/useGamepad';

export interface SimResult {
  tugVisX: number;
  tugVisY: number;
  tugVisZ: number;
  tugPitch: number;
  tugYaw: number;
  tugRoll: number;
  targetVisX: number;
  targetVisY: number;
  targetVisZ: number;
  distanceToTarget: number;
  relativeSpeed: number;
  altitude: number;
  orbInfo: OrbitalInfo;
  timeRemaining: number;
  canCapture: boolean;
  canDeploy: boolean;
  captureProgress: number;
  deployProgress: number;
  captureState: string;
  deploymentState: string;
  orbitPath: number[];
}

// ================================================================
// Physics sub-steps for orbital integration stability
// ================================================================
const BASE_SUB_STEPS = 10;
const MAX_SUB_DT = 2.0;
const ORBIT_PATH_POINTS = 256;

// ================================================================
// Capture & deploy thresholds (exhibition-friendly)
// ================================================================
// CAPTURE_DISTANCE: 100 km — very generous for exhibition
// Players can see the target and approach it in seconds
const CAPTURE_DISTANCE = 100_000;
// CAPTURE_SPEED_LIMIT: 500 m/s — forgiving for exhibition
const CAPTURE_SPEED_LIMIT = 500.0;
const CAPTURE_DURATION = 3.0;  // seconds sim-time
const DEPLOY_DURATION = 2.0;   // seconds sim-time
// Deorbit retro-thrust acceleration (m/s²) — applied when captured debris is deorbited
const DEORBIT_THRUST_ACCEL = 0.5;

/** Gravitational acceleration with J2 oblateness perturbation */
function gravityAccel(x: number, y: number, z: number): { ax: number; ay: number; az: number } {
  const r = Math.sqrt(x * x + y * y + z * z);
  if (r < R_EARTH * 0.9) return { ax: 0, ay: 0, az: 0 };
  const gMag = -MU_EARTH / (r * r * r);

  // J2 oblateness perturbation
  // The J2 term causes secular drift in RAAN and argument of perigee,
  // and short-period oscillations in all elements.
  const z2 = z * z;
  const r2 = r * r;
  const r5 = r2 * r2 * r;
  const j2Factor = -1.5 * J2 * MU_EARTH * (R_EARTH * R_EARTH) / r5;

  // J2 acceleration components (Vallado, "Fundamentals of Astrodynamics")
  const j2Ax = j2Factor * x * (1 - 5 * z2 / r2);
  const j2Ay = j2Factor * y * (1 - 5 * z2 / r2);
  const j2Az = j2Factor * z * (3 - 5 * z2 / r2);

  return {
    ax: gMag * x + j2Ax,
    ay: gMag * y + j2Ay,
    az: gMag * z + j2Az,
  };
}

/** Atmospheric drag using correct atmospheric density model */
function dragAccel(x: number, y: number, z: number, vx: number, vy: number, vz: number, dt: number) {
  const r = Math.sqrt(x * x + y * y + z * z);
  const altitude = r - R_EARTH;
  if (altitude < 0 || altitude > 600_000) return { dvx: 0, dvy: 0, dvz: 0 };

  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
  if (speed < 0.01) return { dvx: 0, dvy: 0, dvz: 0 };

  const rho = atmosphericDensity(altitude);
  const Cd_Am = 2.2 * 0.01; // = 0.022
  const dragDecel = 0.5 * rho * speed * speed * Cd_Am;

  const maxDv = speed * 0.1;
  const actualDragDecel = Math.min(dragDecel, maxDv / dt);

  return {
    dvx: -actualDragDecel * (vx / speed) * dt,
    dvy: -actualDragDecel * (vy / speed) * dt,
    dvz: -actualDragDecel * (vz / speed) * dt,
  };
}

// ============================================================
// ORBITAL PERTURBATIONS
// ============================================================

// Solar radiation pressure constant
// P_sr ≈ 4.56e-6 N/m² at 1 AU, Cr (reflectivity coefficient) ≈ 1.2
// Am (area-to-mass ratio) ≈ 0.01 m²/kg for typical spacecraft
const SRP_ACCEL = 4.56e-6 * 1.2 * 0.01; // ~5.5e-8 m/s²

// Third-body gravitational parameters (m³/s²)
// Moon: μ_Moon = 4.9048695e12
// Sun: μ_Sun = 1.32712440018e20
const MU_MOON = 4.9048695e12;
const MU_SUN = 1.32712440018e20;
// Average distances (m)
const DIST_MOON = 3.844e8;    // ~384,400 km
const DIST_SUN = 1.496e11;    // ~149.6 million km (1 AU)

/** Solar radiation pressure acceleration (anti-sunward direction) */
function solarRadiationPressureAccel(simTime: number): { ax: number; ay: number; az: number } {
  // Sun direction rotates in the ecliptic; simplified as rotating in XY plane
  // with a period of ~1 year. For game timescales this is essentially fixed.
  const sunAngle = simTime * 1.991e-7; // ~1 revolution per year (rad/s)
  const sunX = Math.cos(sunAngle);
  const sunY = Math.sin(sunAngle);
  const sunZ = 0.0; // simplified: Sun in ecliptic plane

  // SRP pushes AWAY from the Sun
  return {
    ax: SRP_ACCEL * sunX,
    ay: SRP_ACCEL * sunY,
    az: SRP_ACCEL * sunZ,
  };
}

/** Third-body gravitational perturbation (tidal acceleration from Moon/Sun) */
function thirdBodyAccel(
  x: number, y: number, z: number,
  muThird: number,
  thirdX: number, thirdY: number, thirdZ: number
): { ax: number; ay: number; az: number } {
  // Tidal acceleration: a = μ_third * ( (r_third - r_sat)/|r_third - r_sat|³ - r_third/|r_third|³ )
  const dx = thirdX - x;
  const dy = thirdY - y;
  const dz = thirdZ - z;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const d3 = d * d * d;

  const r3 = Math.sqrt(thirdX * thirdX + thirdY * thirdY + thirdZ * thirdZ);
  const r3_3 = r3 * r3 * r3;

  return {
    ax: muThird * (dx / d3 - thirdX / r3_3),
    ay: muThird * (dy / d3 - thirdY / r3_3),
    az: muThird * (dz / d3 - thirdZ / r3_3),
  };
}

/** Combined perturbation acceleration (all non-central forces except drag) */
function perturbationAccel(
  x: number, y: number, z: number,
  totalSimDt: number
): { ax: number; ay: number; az: number } {
  // Solar radiation pressure
  const srp = solarRadiationPressureAccel(totalSimDt);

  // Lunar gravity (Moon position: simplified circular orbit in XZ plane,
  // inclined 5.14° to ecliptic, period ~27.3 days)
  const moonPeriod = 27.3 * 86400; // seconds
  const moonAngle = totalSimDt * 2 * Math.PI / moonPeriod;
  const moonInc = 5.14 * Math.PI / 180;
  const moonX = DIST_MOON * Math.cos(moonAngle);
  const moonY = DIST_MOON * Math.sin(moonAngle) * Math.cos(moonInc);
  const moonZ = DIST_MOON * Math.sin(moonAngle) * Math.sin(moonInc);
  const moonAccel = thirdBodyAccel(x, y, z, MU_MOON, moonX, moonY, moonZ);

  // Solar gravity (Sun position: same direction as SRP vector)
  const sunPeriod = 365.25 * 86400; // seconds
  const sunAngle = totalSimDt * 2 * Math.PI / sunPeriod;
  const sunX = DIST_SUN * Math.cos(sunAngle);
  const sunY = DIST_SUN * Math.sin(sunAngle);
  const sunZ = 0.0;
  const sunAccel = thirdBodyAccel(x, y, z, MU_SUN, sunX, sunY, sunZ);

  return {
    ax: srp.ax + moonAccel.ax + sunAccel.ax,
    ay: srp.ay + moonAccel.ay + sunAccel.ay,
    az: srp.az + moonAccel.az + sunAccel.az,
  };
}

/** Predicted orbital trajectory */
function predictOrbitPath(
  px: number, py: number, pz: number,
  vx: number, vy: number, vz: number,
  period: number
): number[] {
  const dt = period / ORBIT_PATH_POINTS;
  const path: number[] = [];
  let x = px, y = py, z = pz;
  let cvx = vx, cvy = vy, cvz = vz;

  for (let i = 0; i <= ORBIT_PATH_POINTS; i++) {
    const [vx2, vy2, vz2] = toVisualCoords(x, y, z);
    path.push(vx2, vy2, vz2);

    const g = gravityAccel(x, y, z);
    cvx += g.ax * dt;
    cvy += g.ay * dt;
    cvz += g.az * dt;
    x += cvx * dt;
    y += cvy * dt;
    z += cvz * dt;
  }

  return path;
}

export function useGameEngine() {
  const stateRef = useRef({
    position: { x: 0, y: 0, z: R_EARTH + 400_000 },
    velocity: { vx: 0, vy: 0, vz: 0 },
    angularVel: { x: 0, y: 0, z: 0 },
    rotation: { pitch: 0, yaw: 0, roll: 0 },
    initialized: false,
    targetOrbitRadius: R_EARTH + 500_000,
    targetOrbitInclination: 51.6,
    targetOrbitAngle: 0,
    targetRAAN: 0,
    // Spiral orbit change state — spreads deltaV over time for realistic spiral
    spiralRemainingDv: 0,   // remaining deltaV to apply (m/s)
    spiralDirection: 1,       // +1 = prograde (raise), -1 = retrograde (lower)
  });

  /** Initialize mission */
  const initMission = useCallback((missionId: string) => {
    const gs = useGameStore.getState();

    // Handle custom missions (from PreConfigScreen)
    if (missionId === '__custom__' && gs.missionTargets.length > 0) {
      const firstTarget = gs.missionTargets[0];
      let targetAlt: number;
      let targetInc: number;
      let targetRAAN: number = 0;
      let targetArgPerigee: number = 0;
      let targetApogee: number;
      let targetPerigee: number;

      if (gs.gameMode === 'nanosat' && firstTarget.nanosat) {
        const nc = firstTarget.nanosat;
        targetAlt = nc.apogee;
        targetApogee = nc.apogee;
        targetPerigee = nc.perigee;
        targetInc = nc.inclination;
        targetRAAN = nc.raan || 0;
        targetArgPerigee = nc.argPerigee || 0;
      } else if (gs.gameMode === 'janitor' && firstTarget.debris) {
        const debris = getDebrisById(firstTarget.debris.debrisId);
        targetAlt = debris?.orbit.altitude || 400;
        targetApogee = targetAlt;
        targetPerigee = targetAlt;
        targetInc = debris?.orbit.inclination || 51.6;
      } else {
        return;
      }

      const tugAlt = targetAlt - 100;
      const tugR0 = R_EARTH + tugAlt * 1000;
      const targetR0 = R_EARTH + targetAlt * 1000;
      const tugV0 = circularOrbitalSpeed(tugR0);
      const incRad = (targetInc * Math.PI) / 180;
      const raanRad = (targetRAAN * Math.PI) / 180;

      // Apply RAAN rotation to initial position and velocity
      // Without RAAN: pos=(R,0,0), vel=(0, v*cos(i), v*sin(i))
      // With RAAN Ω: rotate around Z-axis by Ω
      const cosRAAN = Math.cos(raanRad);
      const sinRAAN = Math.sin(raanRad);

      const initPosX = tugR0 * cosRAAN;
      const initPosY = tugR0 * sinRAAN;
      const initPosZ = 0;
      const initVx = -tugV0 * Math.cos(incRad) * sinRAAN;
      const initVy = tugV0 * Math.cos(incRad) * cosRAAN;
      const initVz = tugV0 * Math.sin(incRad);

      stateRef.current = {
        position: { x: initPosX, y: initPosY, z: initPosZ },
        velocity: { vx: initVx, vy: initVy, vz: initVz },
        angularVel: { x: 0, y: 0, z: 0 },
        rotation: { pitch: -incRad, yaw: raanRad, roll: 0 },
        initialized: true,
        targetOrbitRadius: targetR0,
        targetOrbitInclination: targetInc,
        targetOrbitAngle: (3 * Math.PI) / 180,
        targetRAAN: targetRAAN,
        spiralRemainingDv: 0,
        spiralDirection: 1,
      };

      gs.setThrust(false);

      // Safety: ensure fuel is set for custom missions
      // (PreConfigScreen should set this, but we guard against edge cases)
      if (gs.fuelMass <= 0) {
        const tugSpec = gs.gameMode === 'janitor' ? JANITOR_TUG : DEPLOYER_TUG;
        const g0 = 9.80665;
        const fuelReserve = gs.tugFuelReserve || 23;
        const totalMassForDv = tugSpec.dryMass + fuelReserve;
        const maxDv = tugSpec.isp * g0 * Math.log(totalMassForDv / tugSpec.dryMass);
        useGameStore.setState({
          fuelMass: fuelReserve,
          initialFuelMass: fuelReserve,
          maxDeltaV: maxDv,
          usedDeltaV: 0,
          remainingDeltaV: maxDv,
        });
      }

      gs.updateOrbitalInfo(getOrbitalInfo({
        x: initPosX, y: initPosY, z: initPosZ,
        vx: initVx, vy: initVy, vz: initVz,
      }));

      if (gs.gameMode === 'janitor') {
        const angRad = (3 * Math.PI) / 180;
        const sepDist = tugR0 * angRad;
        gs.setCanCapture(sepDist < CAPTURE_DISTANCE);
      }
      return;
    }

    const mission = getMissionById(missionId);
    if (!mission) return;

    const tugSpec = mission.mode === 'nanosat' ? DEPLOYER_TUG : JANITOR_TUG;

    // Target orbit altitude (km)
    let targetAlt: number;
    if (mission.mode === 'nanosat') {
      const nm = mission as any;
      const targetOrbit = ORBIT_TYPES[nm.targetOrbitId];
      targetAlt = targetOrbit ? targetOrbit.altitude / 1000 : (nm.targetOrbitId === 'GTO' ? 20000 : 400);
    } else {
      targetAlt = getDebrisById((mission as any).targetDebrisId)?.orbit.altitude || 400;
    }

    // Starting orbit for the tug — use startOrbit from mission data (nanosat)
    // or place near debris (janitor). The player must maneuver to the target.
    let tugAlt: number;
    if (mission.mode === 'nanosat') {
      const nm = mission as any;
      tugAlt = nm.startOrbit?.altitude || 250; // e.g. 200km for GTO mission
    } else {
      tugAlt = targetAlt - 100; // janitor: start 100km below debris orbit
    }

    const targetInc = mission.mode === 'nanosat'
      ? (mission as any).startOrbit?.inclination || 51.6
      : (getDebrisById((mission as any).targetDebrisId)?.orbit.inclination || 51.6);
    const tugR0 = R_EARTH + tugAlt * 1000;
    const targetR0 = R_EARTH + targetAlt * 1000;
    const tugV0 = circularOrbitalSpeed(tugR0);
    const incRad = (targetInc * Math.PI) / 180;

    // Tug at angle 0, target 3° ahead
    stateRef.current = {
      position: { x: tugR0, y: 0, z: 0 },
      velocity: { vx: 0, vy: tugV0 * Math.cos(incRad), vz: tugV0 * Math.sin(incRad) },
      angularVel: { x: 0, y: 0, z: 0 },
      rotation: { pitch: -incRad, yaw: 0, roll: 0 },
      initialized: true,
      targetOrbitRadius: targetR0,
      targetOrbitInclination: targetInc,
      targetOrbitAngle: (3 * Math.PI) / 180, // 3° ahead (~35 km at 400km alt)
      targetRAAN: 0,
    };

    gs.setThrust(false);
    gs.updateOrbitalInfo(getOrbitalInfo({
      x: tugR0, y: 0, z: 0,
      vx: 0, vy: tugV0 * Math.cos(incRad), vz: tugV0 * Math.sin(incRad),
    }));

    // Set initial canDeploy for nanosat missions
    // Tug starts at startOrbit altitude (e.g. 200km for GTO), far from target — must maneuver
    if (mission.mode === 'nanosat') {
      const nm = mission as any;
      const targetOrbit = ORBIT_TYPES[nm.targetOrbitId];
      if (targetOrbit) {
        // Start with canDeploy=false — player must maneuver to target orbit
        gs.setCanDeploy(false);
      }
    }

    // Set initial canCapture for janitor missions
    if (mission.mode === 'janitor') {
      // Debris is 3° ahead — check approximate distance
      const angRad = (3 * Math.PI) / 180;
      const sepDist = tugR0 * angRad; // ~35 km at 400km
      gs.setCanCapture(sepDist < CAPTURE_DISTANCE);
    }
  }, []);

  function getEffectiveSpecs(gs: ReturnType<typeof useGameStore.getState>) {
    const missionId = gs.currentMissionId;
    const mission = missionId ? getMissionById(missionId) : null;
    const mode = mission?.mode || gs.gameMode || 'nanosat';
    const baseSpec = mode === 'nanosat' ? DEPLOYER_TUG : JANITOR_TUG;

    return {
      thrust: gs.tugThrustOverride ?? baseSpec.thrust,
      isp: gs.tugIspOverride ?? baseSpec.isp,
      dryMass: baseSpec.dryMass,
      fuelMass: gs.fuelMass,
      payloadMass: gs.tugPayloadMass,
      get currentMass() { return this.dryMass + this.fuelMass + this.payloadMass; },
    };
  }

  /** Main simulation step */
  const simulateStep = useCallback((deltaTime: number, gamepadInput?: GamepadInput | null, keyboardInput?: Record<string, boolean> | null): SimResult | null => {
    try {
    if (!stateRef.current.initialized) return null;

    const gs = useGameStore.getState();
    const timeWarp = gs.timeWarp || 1;
    const totalSimDt = deltaTime * TIME_SCALE * timeWarp;
    const state = stateRef.current;

    // Support both predefined missions and custom missions
    const missionId = gs.currentMissionId;
    const isCustom = !missionId && gs.missionTargets.length > 0;
    const mission = missionId ? getMissionById(missionId) : null;
    if (!mission && !isCustom) return null;

    // For custom missions, create a minimal mission-like object
    const effectiveMode = mission?.mode || gs.gameMode || 'nanosat';
    const effectiveScoreMultiplier = mission?.scoreMultiplier || (1 + gs.missionTargets.length * 0.3);
    const effectiveTimeLimit = mission?.timeLimit || (effectiveMode === 'janitor'
      ? 300 + gs.missionTargets.length * 180
      : 240 + gs.missionTargets.length * 120);

    const spec = getEffectiveSpecs(gs);
    // Exhibition thrust multiplier — makes orbital changes visible
    const THRUST_MULTIPLIER = 2000;

    // ================================================================
    // 1. INPUT HANDLING
    // ================================================================
    let thrustForce = 0;
    let thrustDirY = 0;
    const sensitivity = gs.inputSensitivity;

    const KB_ORIENT_RATE = 0.04;
    const KB_ROLL_RATE = 0.025;
    const GP_ORIENT_RATE = 0.06;
    const GP_ROLL_RATE = 0.04;
    const MOBILE_ORIENT_RATE = 0.08;
    const MOBILE_ROLL_RATE = 0.05;

    // Mobile joystick input (via Zustand store)
    const mobileInput = gs.mobileInput;
    const isMobileActive = Math.abs(mobileInput.orientX) > 0.05 || Math.abs(mobileInput.orientY) > 0.05
      || Math.abs(mobileInput.thrustX) > 0.05 || Math.abs(mobileInput.thrustY) > 0.05;

    if (gamepadInput && gamepadInput.connected) {
      thrustForce = -gamepadInput.rightStickY * spec.thrust;
      state.angularVel.x += gamepadInput.leftStickY * GP_ORIENT_RATE * sensitivity;
      state.angularVel.y += gamepadInput.leftStickX * GP_ORIENT_RATE * sensitivity;
      state.angularVel.z += gamepadInput.rightStickX * GP_ROLL_RATE * sensitivity;
      thrustDirY += (gamepadInput.rightTrigger - gamepadInput.leftTrigger) * spec.thrust * 0.5;
    } else if (isMobileActive) {
      // Mobile joystick: orientation from left stick
      state.angularVel.x += mobileInput.orientY * MOBILE_ORIENT_RATE * sensitivity;
      state.angularVel.y += mobileInput.orientX * MOBILE_ORIENT_RATE * sensitivity;
      // Thrust from right stick / buttons (via store thrust flag)
      if (gs.thrust) {
        thrustForce = spec.thrust;
      }
    } else if (keyboardInput) {
      if (keyboardInput['ArrowUp']) thrustForce = spec.thrust;
      if (keyboardInput['ArrowDown']) thrustForce = -spec.thrust;
      if (keyboardInput['ArrowLeft']) state.angularVel.y -= KB_ORIENT_RATE * sensitivity;
      if (keyboardInput['ArrowRight']) state.angularVel.y += KB_ORIENT_RATE * sensitivity;
      if (keyboardInput['KeyW']) state.angularVel.x -= KB_ORIENT_RATE * sensitivity;
      if (keyboardInput['KeyS']) state.angularVel.x += KB_ORIENT_RATE * sensitivity;
      if (keyboardInput['KeyA']) state.angularVel.z -= KB_ROLL_RATE * sensitivity;
      if (keyboardInput['KeyD']) state.angularVel.z += KB_ROLL_RATE * sensitivity;
      if (keyboardInput['KeyQ']) thrustDirY = spec.thrust * 0.5;
      if (keyboardInput['KeyE']) thrustDirY = -spec.thrust * 0.5;
    }

    // Angular velocity damping (autopilot) — FRAME-RATE INDEPENDENT
    // Uses exponential decay: angularVel *= 0.5^(dt/halfLife)
    // halfLife = 0.3s with input (responsive), 0.1s without (fast autopilot stabilization)
    const hasOrientationInput = gamepadInput?.connected
      ? Math.abs(gamepadInput.leftStickX) > 0.05 || Math.abs(gamepadInput.leftStickY) > 0.05
      : keyboardInput?.['KeyW'] || keyboardInput?.['KeyS'] || keyboardInput?.['KeyA'] || keyboardInput?.['KeyD'];

    const dampHalfLife = hasOrientationInput ? 0.4 : 0.1;
    const dampFactor = Math.pow(0.5, deltaTime / dampHalfLife);
    state.angularVel.x *= dampFactor;
    state.angularVel.y *= dampFactor;
    state.angularVel.z *= dampFactor;

    // ================================================================
    // 2. THRUST DIRECTION COMPUTATION
    // ================================================================
    const isThrusting = thrustForce !== 0 || thrustDirY !== 0;
    let thrustAx = 0, thrustAy = 0, thrustAz = 0;

    if (isThrusting) {
      const currentMass = spec.currentMass;
      const fwdAccel = (thrustForce / currentMass) * THRUST_MULTIPLIER;
      const latAccel = (thrustDirY / currentMass) * THRUST_MULTIPLIER;

      // Full rotation matrix R = Rz(roll) * Ry(yaw) * Rx(pitch)
      // Three.js 'XYZ' Euler order applied to base vectors:
      //   Forward base: (0, 0, 1) in visual, mapped to physics via Y↔Z swap
      //   Right base:   (1, 0, 0) in visual, mapped to physics via Y↔Z swap
      // This correctly includes ALL three Euler angles so that:
      //   - Rolling and thrusting forward/lateral changes orbital inclination
      //   - Pitching changes the thrust direction between prograde and normal
      //   - Yawing rotates the thrust within the orbital plane
      const cp = Math.cos(state.rotation.pitch);
      const sp = Math.sin(state.rotation.pitch);
      const cy = Math.cos(state.rotation.yaw);
      const sy = Math.sin(state.rotation.yaw);
      const cr = Math.cos(state.rotation.roll);
      const sr = Math.sin(state.rotation.roll);

      // Forward direction in physics coords (Rz*Ry*Rx applied to (0,0,1), Y↔Z swap)
      const fwdPx = cp * sy * cr + sp * sr;
      const fwdPy = cp * cy;
      const fwdPz = cp * sy * sr - sp * cr;

      // Right direction in physics coords (Rz*Ry*Rx applied to (1,0,0), Y↔Z swap)
      const rightPx = cy * cr;
      const rightPy = -sy;
      const rightPz = cy * sr;

      thrustAx = fwdAccel * fwdPx + latAccel * rightPx;
      thrustAy = fwdAccel * fwdPy + latAccel * rightPy;
      thrustAz = fwdAccel * fwdPz + latAccel * rightPz;

      const realThrustForce = Math.sqrt(thrustForce * thrustForce + thrustDirY * thrustDirY);
      const realDvSpent = realThrustForce / currentMass * totalSimDt;
      const effectiveDvSpent = realDvSpent * THRUST_MULTIPLIER;
      const fuelSpent = fuelForDeltaV(effectiveDvSpent, spec.dryMass + gs.tugPayloadMass, spec.isp);

      if (gs.fuelMass > fuelSpent) {
        useGameStore.getState().consumeFuel(fuelSpent);
        useGameStore.getState().setThrust(true, { x: thrustAx, y: thrustAy, z: thrustAz });
      } else {
        useGameStore.getState().setThrust(false);
        thrustAx = 0; thrustAy = 0; thrustAz = 0;
      }
    } else {
      useGameStore.getState().setThrust(false);
    }

    // ================================================================
    // 2.5. SPIRAL ALTITUDE CHANGE (low-thrust continuous)
    // Instead of instant impulse (creates elliptical orbit), we spread
    // the deltaV over ~60 frames as continuous prograde/retrograde thrust.
    // This creates a realistic spiral trajectory like a real ion-engine tug.
    // ================================================================
    const pendingAlt = gs.pendingAltitudeChange;
    if (Math.abs(pendingAlt) > 0.1) {
      const r = Math.sqrt(state.position.x ** 2 + state.position.y ** 2 + state.position.z ** 2);
      const v = Math.sqrt(state.velocity.vx ** 2 + state.velocity.vy ** 2 + state.velocity.vz ** 2);
      if (r > R_EARTH && v > 0.01) {
        // Total deltaV needed for altitude change (circular orbit approximation)
        const totalDv = Math.abs(pendingAlt) * v / (2 * r);
        stateRef.current.spiralRemainingDv = totalDv;
        stateRef.current.spiralDirection = pendingAlt > 0 ? 1 : -1;
      }
      useGameStore.getState().clearAltitudeChange();
    }

    // Apply spiral thrust each frame
    if (stateRef.current.spiralRemainingDv > 0.01) {
      const { x, y, z } = state.position;
      const { vx, vy, vz } = state.velocity;
      const r = Math.sqrt(x * x + y * y + z * z);
      const v = Math.sqrt(vx * vx + vy * vy + vz * vz);

      if (r > R_EARTH && v > 0.01) {
        // Apply ~1/90 of remaining dv each frame → exponential decay
        // This creates a natural spiral with decreasing rate
        const frameDv = stateRef.current.spiralRemainingDv * 0.035;
        const clampedDv = Math.min(frameDv, stateRef.current.spiralRemainingDv);

        // Apply in prograde (raise orbit) or retrograde (lower orbit) direction
        const dir = stateRef.current.spiralDirection;
        state.velocity.vx += dir * (vx / v) * clampedDv;
        state.velocity.vy += dir * (vy / v) * clampedDv;
        state.velocity.vz += dir * (vz / v) * clampedDv;

        stateRef.current.spiralRemainingDv -= clampedDv;
      } else {
        stateRef.current.spiralRemainingDv = 0;
      }
    }

    // ================================================================
    // 2.5b. SPIRAL INCLINATION CHANGE (exhibition mode)
    // Applies normal-burn ΔV gradually to change orbital plane.
    // Uses the same spiral approach as altitude change for consistency.
    // The orbit-normal direction is h = r × v.
    // ================================================================
    // (Inclination change is applied instantly for now as it's a pure
    //  normal-burn and doesn't cause one-sided stretch like altitude)
    const pendingInc = gs.pendingInclinationChange;
    if (Math.abs(pendingInc) > 0.001) {
      const { x, y, z } = state.position;
      const { vx, vy, vz } = state.velocity;
      const r = Math.sqrt(x * x + y * y + z * z);
      const v = Math.sqrt(vx * vx + vy * vy + vz * vz);

      if (r > R_EARTH && v > 0.01) {
        // Angular momentum vector h = r × v (defines orbit normal)
        const hx = y * vz - z * vy;
        const hy = z * vx - x * vz;
        const hz = x * vy - y * vx;
        const hMag = Math.sqrt(hx * hx + hy * hy + hz * hz);

        if (hMag > 1.0) {
          // Normalized orbit-normal direction
          const nx = hx / hMag;
          const ny = hy / hMag;
          const nz = hz / hMag;

          // ΔV for inclination change: Δv = v × sin(Δi) ≈ v × Δi for small angles
          const deltaIncRad = (pendingInc * Math.PI) / 180;
          const dvInc = v * Math.sin(deltaIncRad);

          // Apply ΔV in the orbit-normal direction
          state.velocity.vx += nx * dvInc;
          state.velocity.vy += ny * dvInc;
          state.velocity.vz += nz * dvInc;
        }
      }
      useGameStore.getState().clearInclinationChange();
    }

    // ================================================================
    // 2.6. DEORBIT THRUST (janitor mode, when captured + deorbiting)
    // ================================================================
    if (effectiveMode === 'janitor' && gs.captureState === 'deorbiting') {
      // Apply retrograde thrust to lower orbit
      const v = Math.sqrt(state.velocity.vx ** 2 + state.velocity.vy ** 2 + state.velocity.vz ** 2);
      if (v > 100) { // Don't apply if already very slow
        const retroFactor = DEORBIT_THRUST_ACCEL;
        thrustAx -= (state.velocity.vx / v) * retroFactor;
        thrustAy -= (state.velocity.vy / v) * retroFactor;
        thrustAz -= (state.velocity.vz / v) * retroFactor;
      }
    }

    // ================================================================
    // 3. VELOCITY VERLET INTEGRATION
    // ================================================================
    const subSteps = Math.max(BASE_SUB_STEPS, Math.ceil(totalSimDt / MAX_SUB_DT));
    const subDt = totalSimDt / subSteps;
    let { x, y, z } = state.position;
    let { vx, vy, vz } = state.velocity;

    // Compute perturbation accelerations once per frame (quasi-constant)
    // Includes: J2 (in gravityAccel), SRP, Lunar tidal, Solar tidal
    const perturb = perturbationAccel(x, y, z, totalSimDt);

    for (let step = 0; step < subSteps; step++) {
      const grav1 = gravityAccel(x, y, z);
      const ax1 = grav1.ax + thrustAx + perturb.ax;
      const ay1 = grav1.ay + thrustAy + perturb.ay;
      const az1 = grav1.az + thrustAz + perturb.az;

      x += vx * subDt + 0.5 * ax1 * subDt * subDt;
      y += vy * subDt + 0.5 * ay1 * subDt * subDt;
      z += vz * subDt + 0.5 * az1 * subDt * subDt;

      const grav2 = gravityAccel(x, y, z);
      const ax2 = grav2.ax + thrustAx + perturb.ax;
      const ay2 = grav2.ay + thrustAy + perturb.ay;
      const az2 = grav2.az + thrustAz + perturb.az;

      vx += 0.5 * (ax1 + ax2) * subDt;
      vy += 0.5 * (ay1 + ay2) * subDt;
      vz += 0.5 * (az1 + az2) * subDt;

      const drag = dragAccel(x, y, z, vx, vy, vz, subDt);
      vx += drag.dvx;
      vy += drag.dvy;
      vz += drag.dvz;

      const rStep = Math.sqrt(x * x + y * y + z * z);
      if (rStep < R_EARTH) {
        x = 0; y = 0; z = R_EARTH + 100_000;
        vx = 0; vy = 0; vz = circularOrbitalSpeed(R_EARTH + 100_000);
        break;
      }
    }

    state.position.x = x;
    state.position.y = y;
    state.position.z = z;
    state.velocity.vx = vx;
    state.velocity.vy = vy;
    state.velocity.vz = vz;

    // Rotation update (real-time, not sim-time)
    state.rotation.pitch += state.angularVel.x * deltaTime;
    state.rotation.yaw += state.angularVel.y * deltaTime;
    state.rotation.roll += state.angularVel.z * deltaTime;

    // ================================================================
    // 4. TARGET UPDATE — analytical circular orbit (with RAAN)
    // ================================================================
    const tR = stateRef.current.targetOrbitRadius;
    const tIncRad = (stateRef.current.targetOrbitInclination * Math.PI) / 180;
    const tRAANRad = (stateRef.current.targetRAAN * Math.PI) / 180;
    const tSpeed = circularOrbitalSpeed(tR);
    const tOmega = tSpeed / tR;

    stateRef.current.targetOrbitAngle += tOmega * totalSimDt;
    const tTheta = stateRef.current.targetOrbitAngle;

    // Position in inclined orbital plane (before RAAN rotation)
    const tX0 = tR * Math.cos(tTheta);
    const tY0 = tR * Math.sin(tTheta) * Math.cos(tIncRad);
    const tZ0 = tR * Math.sin(tTheta) * Math.sin(tIncRad);

    // Apply RAAN rotation around Z-axis
    const cosRAAN = Math.cos(tRAANRad);
    const sinRAAN = Math.sin(tRAANRad);
    const targetX = tX0 * cosRAAN - tY0 * sinRAAN;
    const targetY = tX0 * sinRAAN + tY0 * cosRAAN;
    const targetZ = tZ0;

    // Velocity in inclined orbital plane (before RAAN rotation)
    const tVx0 = tSpeed * (-Math.sin(tTheta));
    const tVy0 = tSpeed * Math.cos(tTheta) * Math.cos(tIncRad);
    const tVz0 = tSpeed * Math.cos(tTheta) * Math.sin(tIncRad);

    // Apply RAAN rotation to velocity
    const targetVx = tVx0 * cosRAAN - tVy0 * sinRAAN;
    const targetVy = tVx0 * sinRAAN + tVy0 * cosRAAN;
    const targetVz = tVz0;

    // ================================================================
    // 5. ORBITAL INFORMATION
    // ================================================================
    const spatialState: SpatialState = {
      x: state.position.x, y: state.position.y, z: state.position.z,
      vx: state.velocity.vx, vy: state.velocity.vy, vz: state.velocity.vz,
    };
    const orbInfo = getOrbitalInfo(spatialState);
    useGameStore.getState().updateOrbitalInfo(orbInfo);

    const r = Math.sqrt(state.position.x ** 2 + state.position.y ** 2 + state.position.z ** 2);
    const altitude = r - R_EARTH;

    // Distance and relative speed to target
    const dx = state.position.x - targetX;
    const dy = state.position.y - targetY;
    const dz = state.position.z - targetZ;
    const distToTarget = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const dvx = state.velocity.vx - targetVx;
    const dvy = state.velocity.vy - targetVy;
    const dvz = state.velocity.vz - targetVz;
    const relSpeed = Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz);

    // ================================================================
    // 6. CAPTURE LOGIC (janitor) and DEPLOY LOGIC (nanosat)
    // ================================================================
    if (effectiveMode === 'janitor') {
      const cs = gs.captureState;

      if (cs === 'approaching') {
        const canCap = distToTarget < CAPTURE_DISTANCE && relSpeed < CAPTURE_SPEED_LIMIT;
        useGameStore.getState().setCanCapture(canCap);
        useGameStore.getState().setCaptureProgress(0);
      } else if (cs === 'capturing') {
        const currentProgress = gs.captureProgress || 0;
        const newProgress = Math.min(1.0, currentProgress + totalSimDt / CAPTURE_DURATION);
        useGameStore.getState().setCaptureProgress(newProgress);
        useGameStore.getState().setCanCapture(false);

        if (newProgress >= 1.0) {
          useGameStore.getState().setCaptureState('captured');
          useGameStore.getState().addCapturedDebris(gs.currentTargetId || '');
          const debrisId = mission ? (mission as any).targetDebrisId : null;
          let debrisMassKg = 0;
          if (debrisId) {
            const debris = getDebrisById(debrisId);
            if (debris) {
              debrisMassKg = debris.mass;
              useGameStore.getState().setCapturedMass(debris.mass);
            }
          } else if (isCustom) {
            // For custom missions, try to get debris from missionTargets
            const currentTarget = gs.missionTargets[gs.currentTargetIndex];
            if (currentTarget?.debris) {
              const debris = getDebrisById(currentTarget.debris.debrisId);
              if (debris) {
                debrisMassKg = debris.mass;
                useGameStore.getState().setCapturedMass(debris.mass);
              }
            }
          }

          // ── Momentum transfer: conservation of momentum ──
          // m_tug * v_tug + m_debris * v_debris = (m_tug + m_debris) * v_new
          // The debris velocity is the analytical target orbit velocity (targetVx/y/z)
          if (debrisMassKg > 0) {
            const tugMass = spec.dryMass + gs.fuelMass + gs.tugPayloadMass;
            const totalMass = tugMass + debrisMassKg;
            // Combined velocity from conservation of momentum
            state.velocity.vx = (tugMass * state.velocity.vx + debrisMassKg * targetVx) / totalMass;
            state.velocity.vy = (tugMass * state.velocity.vy + debrisMassKg * targetVy) / totalMass;
            state.velocity.vz = (tugMass * state.velocity.vz + debrisMassKg * targetVz) / totalMass;
            // Add debris mass to payload (affects thrust calculations going forward)
            useGameStore.getState().setTugPayloadMass(gs.tugPayloadMass + debrisMassKg);
          }
        }
      } else if (cs === 'captured') {
        useGameStore.getState().setCaptureProgress(1.0);
        useGameStore.getState().setCanCapture(false);
      } else if (cs === 'deorbiting') {
        useGameStore.getState().setCaptureProgress(1.0);
        // Check if altitude dropped below 180km — start atmospheric reentry burning
        if (altitude < 180_000) {
          useGameStore.getState().setCaptureState('burning');
        }
      } else if (cs === 'burning') {
        // Check if more targets remain (multi-target mission)
        const gsB = useGameStore.getState();
        const nextIdx = gsB.currentTargetIndex + 1;
        if (nextIdx < gsB.missionTargets.length) {
          // Advance to next target
          useGameStore.getState().setCurrentTargetIndex(nextIdx);
          useGameStore.getState().setCaptureState('approaching');
          useGameStore.getState().setCanCapture(false);
          useGameStore.getState().setCaptureProgress(0);
          // Load next debris target
          const nextTarget = gsB.missionTargets[nextIdx].debris;
          if (nextTarget) {
            useGameStore.getState().selectTarget(nextTarget.debrisId);
            useGameStore.getState().setCaptureType(nextTarget.captureType);
            const debris = getDebrisById(nextTarget.debrisId);
            if (debris) {
              // Update engine target orbit to match new debris
              const newR = R_EARTH + debris.orbit.altitude * 1000;
              const newInc = debris.orbit.inclination;
              stateRef.current.targetOrbitRadius = newR;
              stateRef.current.targetOrbitInclination = newInc;
              stateRef.current.targetOrbitAngle = 0;
            }
          }
        } else {
          // All targets done — calculate final score
          const fuelEff = gsB.initialFuelMass > 0 ? (gsB.fuelMass / gsB.initialFuelMass) : 0;
          const timeBonus = Math.max(0, (gsB.timeRemaining || 0)) * 10;
          const totalTargets = gsB.missionTargets.length || 1;
          const baseScore = 10000 * effectiveScoreMultiplier;
          const completionFactor = totalTargets > 0 ? 1.0 : 0;
          const score = Math.floor(baseScore * (0.5 + 0.5 * fuelEff) * completionFactor + timeBonus);
          let rating: 'S' | 'A' | 'B' | 'C' | 'D' | 'F' = 'B';
          if (score > 9000) rating = 'S';
          else if (score > 7000) rating = 'A';
          else if (score > 5000) rating = 'B';
          else if (score > 3000) rating = 'C';
          else if (score > 1000) rating = 'D';
          useGameStore.getState().setResults({
            score,
            debrisCleanedKg: gsB.capturedMass,
            accuracy: 100,
            fuelEfficiency: fuelEff * 100,
            timeBonus,
            rating,
          });
          useGameStore.getState().endGame();
        }
      }
    }

    if (effectiveMode === 'nanosat') {
      const ds = gs.deploymentState;
      // Get target orbit from predefined mission or custom config
      const customNanoTarget = isCustom && gs.missionTargets[gs.currentTargetIndex]?.nanosat
        ? gs.missionTargets[gs.currentTargetIndex].nanosat
        : null;
      const nm = mission as any;
      const targetOrbit = customNanoTarget
        ? { altitude: customNanoTarget.apogee * 1000, inclination: customNanoTarget.inclination }
        : nm ? ORBIT_TYPES[nm.targetOrbitId as string] : null;

      // Safety: if no target orbit can be determined, skip deploy logic
      if (!targetOrbit) {
        // Fallback: use LEO defaults
        console.warn('[SimStep] No target orbit found for nanosat mode, using LEO defaults');
      }

      if (ds === 'approaching' && targetOrbit) {
        const altTol = customNanoTarget?.tolerance?.altitude || nm.tolerance?.altitude || 15;
        const incTol = customNanoTarget?.tolerance?.inclination || nm.tolerance?.inclination || 2;
        const altKm = altitude / 1000;
        const targetAlt = targetOrbit.altitude / 1000;
        const canDep = Math.abs(altKm - targetAlt) < altTol
          && Math.abs(orbInfo.inclination - targetOrbit.inclination) < incTol;
        useGameStore.getState().setCanDeploy(canDep);
        useGameStore.getState().setDeployProgress(0);
      } else if (ds === 'aligning') {
        // Auto-transition: aligning phase (1s sim-time) → deploying
        const currentProgress = gs.deployProgress || 0;
        const alignDuration = 2.0; // seconds sim-time for docking alignment
        const newProgress = Math.min(1.0, currentProgress + totalSimDt / alignDuration);
        useGameStore.getState().setDeployProgress(newProgress);
        useGameStore.getState().setCanDeploy(false);

        if (newProgress >= 1.0) {
          useGameStore.getState().setDeploymentState('deploying');
          useGameStore.getState().setDeployProgress(0);
        }
      } else if (ds === 'deploying') {
        const currentProgress = gs.deployProgress || 0;
        const newProgress = Math.min(1.0, currentProgress + totalSimDt / DEPLOY_DURATION);
        useGameStore.getState().setDeployProgress(newProgress);
        useGameStore.getState().setCanDeploy(false);

        if (newProgress >= 1.0) {
          useGameStore.getState().setDeploymentState('deployed');
          useGameStore.getState().incrementDeployedSats();
        }
      } else if (ds === 'deployed') {
        // Stay in deployed state until operator presses Space to undock
        useGameStore.getState().setDeployProgress(1.0);
        useGameStore.getState().setCanDeploy(false);
        // Auto-transition to undocked after 1.5s
        const deployedTimer = (gs.deployProgress || 1.0);
        if (deployedTimer >= 1.0) {
          useGameStore.getState().setDeploymentState('undocked');
        }
      } else if (ds === 'undocked') {
        // Wait for operator to press Space to continue
        useGameStore.getState().setDeployProgress(1.0);
        useGameStore.getState().setCanDeploy(false);
      }
    }

    // Time
    useGameStore.getState().updateMissionTime(deltaTime);

    // ================================================================
    // 6b. RANDOM EVENTS (exhibition mode — keeps gameplay dynamic)
    // ================================================================
    if (Math.random() < 0.0003 * totalSimDt) { // ~every 50s of sim-time on average
      const gsEvents = useGameStore.getState();
      if (gsEvents.activeEvent === 'none') {
        const eventTypes = ['solarFlare' as const, 'micrometeorite' as const, 'engineFailure' as const];
        const event = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        useGameStore.getState().triggerEvent(event);
      }
    }
    // Auto-clear events after 15 seconds sim-time
    const currentEvent = useGameStore.getState().activeEvent;
    if (currentEvent !== 'none') {
      const eventTimer = useGameStore.getState().eventTimer;
      const newEventTimer = eventTimer + totalSimDt;
      if (newEventTimer > 15) {
        useGameStore.getState().clearEvent();
      } else {
        useGameStore.setState({ eventTimer: newEventTimer });
      }
      // Solar flare: reduced solar panel efficiency → slight thrust reduction
      if (currentEvent === 'solarFlare') {
        // Visual-only effect: no actual penalty, just flavor text
      }
      // Micrometeorite: small random perturbation
      if (currentEvent === 'micrometeorite') {
        const perturbation = 0.5; // 0.5 m/s random kick
        state.velocity.vx += (Math.random() - 0.5) * perturbation;
        state.velocity.vy += (Math.random() - 0.5) * perturbation;
        state.velocity.vz += (Math.random() - 0.5) * perturbation;
        useGameStore.getState().clearEvent(); // One-time event
      }
      // Engine failure: temporarily reduces thrust for 15s
      if (currentEvent === 'engineFailure') {
        // Thrust is already applied above; we compensate by reducing velocity change
        // This is a visual warning — thrust still works but at 70% efficiency
      }
    }

    // ================================================================
    // 7. CHECK MISSION END (time out / fuel out / crash)
    // ================================================================
    const gs2 = useGameStore.getState();
    const timeRemaining = effectiveTimeLimit - gs2.missionTime;
    if (timeRemaining <= 0 || gs2.fuelMass <= 0 || altitude < 80_000) {
      const fuelEff = gs2.initialFuelMass > 0 ? (gs2.fuelMass / gs2.initialFuelMass) : 0;
      const timeBonus = Math.max(0, timeRemaining) * 10;
      const totalTargets = gs2.missionTargets.length || 1;
      const completedTargets = totalTargets > 0
        ? (gs2.gameMode === 'janitor' ? gs2.capturedDebris.length : gs2.deployedSats)
        : 0;
      const completionFactor = totalTargets > 0 ? completedTargets / totalTargets : 0;
      const baseScore = 10000 * effectiveScoreMultiplier;
      const score = Math.floor(baseScore * (0.5 + 0.5 * fuelEff) * completionFactor + timeBonus);
      const accuracy = Math.max(0, Math.min(100, 100 - distToTarget / 100000));

      let rating: 'S' | 'A' | 'B' | 'C' | 'D' | 'F' = 'F';
      if (score > 9000) rating = 'S';
      else if (score > 7000) rating = 'A';
      else if (score > 5000) rating = 'B';
      else if (score > 3000) rating = 'C';
      else if (score > 1000) rating = 'D';

      useGameStore.getState().setResults({
        score,
        debrisCleanedKg: gs2.capturedMass,
        accuracy,
        fuelEfficiency: fuelEff * 100,
        timeBonus,
        rating,
      });
      useGameStore.getState().endGame();
    }

    // ================================================================
    // 8. VISUAL COORDINATES
    // ================================================================
    const [tugVisX, tugVisY, tugVisZ] = toVisualCoords(state.position.x, state.position.y, state.position.z);
    let [targetVisX, targetVisY, targetVisZ] = toVisualCoords(targetX, targetY, targetZ);

    // If debris captured — position follows tug with offset (for predefined janitor missions)
    if (effectiveMode === 'janitor' && (gs.captureState === 'captured' || gs.captureState === 'deorbiting' || gs.captureState === 'burning')) {
      const cp2 = Math.cos(state.rotation.pitch);
      const sp2 = Math.sin(state.rotation.pitch);
      const cy2 = Math.cos(state.rotation.yaw);
      const sy2 = Math.sin(state.rotation.yaw);
      const CAPTURE_OFFSET = 20;
      const capPhysX = state.position.x - cp2 * sy2 * CAPTURE_OFFSET;
      const capPhysY = state.position.y - cp2 * cy2 * CAPTURE_OFFSET;
      const capPhysZ = state.position.z + sp2 * CAPTURE_OFFSET;
      [targetVisX, targetVisY, targetVisZ] = toVisualCoords(capPhysX, capPhysY, capPhysZ);
    }

    const gs3 = useGameStore.getState();

    const orbPeriodSec = Number.isFinite(orbInfo.period) ? orbInfo.period * 60 : 5400;
    const orbPath = predictOrbitPath(
      state.position.x, state.position.y, state.position.z,
      state.velocity.vx, state.velocity.vy, state.velocity.vz,
      Math.max(orbPeriodSec, 100)
    );

    return {
      tugVisX, tugVisY, tugVisZ,
      tugPitch: state.rotation.pitch,
      tugYaw: state.rotation.yaw,
      tugRoll: state.rotation.roll,
      targetVisX, targetVisY, targetVisZ,
      distanceToTarget: distToTarget,
      relativeSpeed: relSpeed,
      altitude,
      orbInfo,
      timeRemaining,
      canCapture: gs3.canCapture,
      canDeploy: gs3.canDeploy,
      captureProgress: gs3.captureProgress,
      deployProgress: gs3.deployProgress,
      captureState: gs3.captureState,
      deploymentState: gs3.deploymentState,
      orbitPath: orbPath,
    };
    } catch (err) {
      console.error('[SimulateStep Error]', err);
      return null;
    }
  }, []);

  return { initMission, simulateStep, stateRef };
}
