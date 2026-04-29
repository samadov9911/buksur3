/**
 * Орбитальная механика — расчёты орбит, манёвров и возмущений
 */

import {
  MU_EARTH, R_EARTH, J2, ATMOSPHERE_LIMIT,
  VIS_SCALE, TIME_SCALE
} from './constants';

// ============================================================
// Структуры данных
// ============================================================

/** Орбитальные элементы */
export interface OrbitalElements {
  semiMajorAxis: number; // Большая полуось (м)
  eccentricity: number;  // Эксцентриситет
  inclination: number;   // Наклонение (рад)
  raan: number;          // Долгота восходящего узла (рад)
  argPerigee: number;    // Аргумент перигея (рад)
  trueAnomaly: number;   // Истинная аномалия (рад)
}

/** Состояние в пространстве */
export interface SpatialState {
  x: number; y: number; z: number; // Позиция (м)
  vx: number; vy: number; vz: number; // Скорость (м/с)
}

/** Информация об орбите для HUD */
export interface OrbitalInfo {
  apogee: number;       // Апогей (км)
  perigee: number;      // Перигей (км)
  altitude: number;     // Текущая высота (км)
  inclination: number;  // Наклонение (град)
  eccentricity: number; // Эксцентриситет
  period: number;       // Период (мин)
  speed: number;        // Орбитальная скорость (м/с)
}

// ============================================================
// Основные расчёты
// ============================================================

/** Расчёт орбитальной скорости по круговой орбите */
export function circularOrbitalSpeed(radius: number): number {
  return Math.sqrt(MU_EARTH / radius);
}

/** Расчёт скорости по vis-viva уравнению */
export function visVivaSpeed(r: number, a: number): number {
  return Math.sqrt(MU_EARTH * (2 / r - 1 / a));
}

/** Период орбиты (секунды) */
export function orbitalPeriod(semiMajorAxis: number): number {
  return 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / MU_EARTH);
}

/** Большая полуось из апогея и перигея */
export function semiMajorAxisFromApsides(apogee: number, perigee: number): number {
  const ra = R_EARTH + apogee;
  const rp = R_EARTH + perigee;
  return (ra + rp) / 2;
}

/** Эксцентриситет из апогея и перигея */
export function eccentricityFromApsides(apogee: number, perigee: number): number {
  const ra = R_EARTH + apogee;
  const rp = R_EARTH + perigee;
  return (ra - rp) / (ra + rp);
}

/** Delta-V для манёвра Хомана (переход между круговыми орбитами) */
export function hohmannDeltaV(r1: number, r2: number): { dv1: number; dv2: number; total: number } {
  const a_transfer = (r1 + r2) / 2;
  const v1 = circularOrbitalSpeed(r1);
  const v2 = circularOrbitalSpeed(r2);
  const vt1 = visVivaSpeed(r1, a_transfer);
  const vt2 = visVivaSpeed(r2, a_transfer);
  const dv1 = Math.abs(vt1 - v1);
  const dv2 = Math.abs(v2 - vt2);
  return { dv1, dv2, total: dv1 + dv2 };
}

/** Расход топлива по формуле Циолковского */
export function tsiolkovskyDeltaV(m0: number, mFinal: number, isp: number): number {
  const g0 = 9.80665; // Ускорение свободного падения
  return isp * g0 * Math.log(m0 / mFinal);
}

/** Масса топлива для заданного delta-V */
export function fuelForDeltaV(deltaV: number, dryMass: number, isp: number): number {
  const g0 = 9.80665;
  return dryMass * (Math.exp(deltaV / (isp * g0)) - 1);
}

// ============================================================
// Преобразования между координатами
// ============================================================

/** Орбитальные элементы → декартовы координаты */
export function orbitalToCartesian(elements: OrbitalElements): SpatialState {
  const { semiMajorAxis: a, eccentricity: e, inclination: i, raan: omega, argPerigee: w, trueAnomaly: v } = elements;

  const p = a * (1 - e * e);
  const r = p / (1 + e * Math.cos(v));

  // Позиция в орбитальной плоскости
  const rOrbital = {
    x: r * Math.cos(v),
    y: r * Math.sin(v),
    z: 0
  };

  // Скорость в орбитальной плоскости
  const sqrtMuP = Math.sqrt(MU_EARTH / p);
  const vOrbital = {
    x: -sqrtMuP * Math.sin(v),
    y: sqrtMuP * (e + Math.cos(v)),
    z: 0
  };

  // Матрица поворота
  const cosO = Math.cos(omega), sinO = Math.sin(omega);
  const cosI = Math.cos(i), sinI = Math.sin(i);
  const cosW = Math.cos(w), sinW = Math.sin(w);

  const R = {
    x00: cosO * cosW - sinO * sinW * cosI,
    x01: -cosO * sinW - sinO * cosW * cosI,
    x10: sinO * cosW + cosO * sinW * cosI,
    x11: -sinO * sinW + cosO * cosW * cosI,
    x20: sinW * sinI,
    x21: cosW * sinI
  };

  return {
    x: R.x00 * rOrbital.x + R.x01 * rOrbital.y,
    y: R.x10 * rOrbital.x + R.x11 * rOrbital.y,
    z: R.x20 * rOrbital.x + R.x21 * rOrbital.y,
    vx: R.x00 * vOrbital.x + R.x01 * vOrbital.y,
    vy: R.x10 * vOrbital.x + R.x11 * vOrbital.y,
    vz: R.x20 * vOrbital.x + R.x21 * vOrbital.y
  };
}

/** Декартовы координаты → орбитальные элементы */
export function cartesianToOrbital(state: SpatialState): OrbitalElements {
  const { x, y, z, vx, vy, vz } = state;
  const r = Math.sqrt(x * x + y * y + z * z);
  const v = Math.sqrt(vx * vx + vy * vy + vz * vz);

  // Удельный момент импульса
  const hx = y * vz - z * vy;
  const hy = z * vx - x * vz;
  const hz = x * vy - y * vx;
  const h = Math.sqrt(hx * hx + hy * hy + hz * hz);

  // Наклонение
  const inclination = Math.acos(Math.max(-1, Math.min(1, hz / h)));

  // Узел
  const nx = -hy;
  const ny = hx;
  const n = Math.sqrt(nx * nx + ny * ny);

  const raan = n > 1e-10 ? Math.atan2(ny, nx) : 0;

  // Эксцентриситет
  const rdotv = x * vx + y * vy + z * vz;
  const ex = (1 / MU_EARTH) * ((v * v - MU_EARTH / r) * x - rdotv * vx);
  const ey = (1 / MU_EARTH) * ((v * v - MU_EARTH / r) * y - rdotv * vy);
  const ez = (1 / MU_EARTH) * ((v * v - MU_EARTH / r) * z - rdotv * vz);
  const eccentricity = Math.sqrt(ex * ex + ey * ey + ez * ez);

  // Большая полуось
  const energy = v * v / 2 - MU_EARTH / r;
  const semiMajorAxis = energy !== 0 ? -MU_EARTH / (2 * energy) : r;

  // Аргумент перигея
  let argPerigee = 0;
  if (n > 1e-10 && eccentricity > 1e-10) {
    argPerigee = Math.acos(Math.max(-1, Math.min(1, (nx * ex + ny * ey) / (n * eccentricity))));
    if (ez < 0) argPerigee = 2 * Math.PI - argPerigee;
  }

  // Истинная аномалия
  let trueAnomaly = 0;
  if (eccentricity > 1e-10) {
    trueAnomaly = Math.acos(Math.max(-1, Math.min(1, (ex * x + ey * y + ez * z) / (eccentricity * r))));
    if (rdotv < 0) trueAnomaly = 2 * Math.PI - trueAnomaly;
  } else if (n > 1e-10) {
    trueAnomaly = Math.acos(Math.max(-1, Math.min(1, (nx * x + ny * y) / (n * r))));
    if (z < 0) trueAnomaly = 2 * Math.PI - trueAnomaly;
  }

  return { semiMajorAxis, eccentricity, inclination, raan, argPerigee, trueAnomaly };
}

/** Получить информацию об орбите для HUD */
export function getOrbitalInfo(state: SpatialState): OrbitalInfo {
  const elements = cartesianToOrbital(state);
  const r = Math.sqrt(state.x * state.x + state.y * state.y + state.z * state.z);

  const apogee = elements.semiMajorAxis * (1 + elements.eccentricity) - R_EARTH;
  const perigee = elements.semiMajorAxis * (1 - elements.eccentricity) - R_EARTH;
  const altitude = r - R_EARTH;
  const speed = Math.sqrt(state.vx * state.vx + state.vy * state.vy + state.vz * state.vz);

  return {
    apogee: apogee / 1000, // в км
    perigee: perigee / 1000,
    altitude: altitude / 1000,
    inclination: (elements.inclination * 180) / Math.PI,
    eccentricity: elements.eccentricity,
    period: orbitalPeriod(elements.semiMajorAxis) / 60, // в минутах
    speed
  };
}

// ============================================================
// Возмущения орбиты
// ============================================================

/** J2-возмущение — прецессия восходящего узла (рад/с) */
export function j2RAANPrecession(a: number, i: number): number {
  const p = a * (1 - 1e-6);
  const n = Math.sqrt(MU_EARTH / (a * a * a));
  return -1.5 * n * J2 * Math.pow(R_EARTH / p, 2) * Math.cos(i);
}

/** J2-возмущение — прецессия перигея (рад/с) */
export function j2ArgPerigeePrecession(a: number, e: number, i: number): number {
  const p = a * (1 - e * e);
  const n = Math.sqrt(MU_EARTH / (a * a * a));
  return 1.5 * n * J2 * Math.pow(R_EARTH / p, 2) * (2 - 2.5 * Math.sin(i) * Math.sin(i));
}

/** Плотность атмосферы по экспоненциальной модели (кг/м³) */
export function atmosphericDensity(altitude: number): number {
  if (altitude > 1000_000 || altitude < 0) return 0;

  // Упрощённая экспоненциальная модель
  const layers = [
    { h: 0, rho: 1.225, H: 8500 },
    { h: 100_000, rho: 5.297e-7, H: 5800 },
    { h: 200_000, rho: 2.789e-10, H: 37900 },
    { h: 300_000, rho: 7.248e-12, H: 45500 },
    { h: 400_000, rho: 3.725e-13, H: 53500 },
    { h: 500_000, rho: 4.038e-14, H: 53600 },
    { h: 600_000, rho: 1.170e-14, H: 61900 },
    { h: 700_000, rho: 3.614e-15, H: 71800 },
    { h: 800_000, rho: 1.170e-15, H: 88700 },
  ];

  for (let idx = layers.length - 1; idx >= 0; idx--) {
    if (altitude >= layers[idx].h) {
      const { rho, H } = layers[idx];
      return rho * Math.exp(-(altitude - layers[idx].h) / H);
    }
  }
  return 0;
}

/** Тормозное ускорение от атмосферы (м/с²) */
export function atmosphericDrag(altitude: number, speed: number, cd: number = 2.2, areaMassRatio: number = 0.01): number {
  const rho = atmosphericDensity(altitude);
  return 0.5 * rho * speed * speed * cd * areaMassRatio;
}

// ============================================================
// Визуальные координаты (для Three.js)
// ============================================================

/** Визуальный масштаб: R_EARTH = 1.0 единиц в Three.js */
const EARTH_VIS_SCALE = 1 / R_EARTH;

/** Превратить позицию в метрах в визуальные координаты Three.js */
export function toVisualCoords(x: number, y: number, z: number): [number, number, number] {
  return [x * EARTH_VIS_SCALE, z * EARTH_VIS_SCALE, y * EARTH_VIS_SCALE];
}

/** Масштаб высоты для визуализации (высота в м → визуальные единицы) */
export function altitudeToVisual(altitude: number): number {
  return altitude * EARTH_VIS_SCALE;
}

/** Радиус Земли в визуальных единицах = 1.0 */
export const EARTH_VISUAL_RADIUS = 1.0;

/** Перевести высоту в км в визуальный радиус орбиты */
export function altitudeKmToVisualOrbitRadius(altKm: number): number {
  return EARTH_VISUAL_RADIUS + (altKm * 1000) / R_EARTH;
}
