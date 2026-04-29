/**
 * Физические константы для орбитальной механики
 * Все значения в системе СИ (метры, секунды, килограммы)
 */

// Гравитационный параметр Земли (м³/с²)
export const MU_EARTH = 3.986004418e14;

// Радиус Земли (м)
export const R_EARTH = 6_371_000;

// Масса Земли (кг)
export const M_EARTH = 5.972e24;

// J2-коэффициент (вытянутость Земли)
export const J2 = 1.08263e-3;

// Скорость света (м/с)
export const C_LIGHT = 299_792_458;

// Атмосферные параметры
export const ATMOSPHERE_LIMIT = 150_000; // Граница атмосферы (м)
export const REENTRY_ALTITUDE = 120_000; // Высота входа в атмосферу (м)
export const BURN_ALTITUDE = 80_000; // Высота полного сгорания (м)

// Орбитальные константы
export const LEO_ALT_MIN = 200_000; // МИН. высота НОО (м)
export const LEO_ALT_MAX = 2_000_000; // МАКС. высота НОО (м)
export const SSO_ALT = 700_000; // Высота ССО (м)
export const GEO_ALT = 35_786_000; // Высота ГСО (м)

// Типы орбит
export interface OrbitType {
  name: string;
  nameRu: string;
  altitude: number; // Высота в метрах
  inclination: number; // Наклонение в градусах
  eccentricity: number;
  description: string;
}

// Реальные типы орбит
export const ORBIT_TYPES: Record<string, OrbitType> = {
  LEO: {
    name: 'LEO',
    nameRu: 'Низкая околоземная орбита (НОО)',
    altitude: 400_000,
    inclination: 51.6,
    eccentricity: 0.001,
    description: '400 км, наклонение 51.6° — стандартная орбита МКС'
  },
  SSO: {
    name: 'SSO',
    nameRu: 'Солнечно-синхронная орбита (ССО)',
    altitude: 700_000,
    inclination: 98.2,
    eccentricity: 0.001,
    description: '700 км, наклонение 98.2° — для дистанционного зондирования'
  },
  POLAR: {
    name: 'POLAR',
    nameRu: 'Полярная орбита',
    altitude: 800_000,
    inclination: 90,
    eccentricity: 0.001,
    description: '800 км, наклонение 90° — проходит над полюсами Земли'
  },
  GTO: {
    name: 'GTO',
    nameRu: 'Геостационарная трансферная орбита (ГТО)',
    altitude: 35_786_000,
    inclination: 28.5,
    eccentricity: 0.73,
    description: 'Перигей 200 км, апогей 35 786 км — промежуточная для ГСО'
  },
};

// Орбитальные параметры (в единицах для визуализации)
export const VIS_SCALE = 1 / 1_000_000; // Масштаб для визуализации (1 единица = 1000 км)

// Типы объектов захвата
export type CaptureType = 'harpoon' | 'manipulator' | 'net';

// Типы спутников CubeSat
export type CubeSatType = '1U' | '2U' | '3U';

// Состояние игры
export type GameMode = 'nanosat' | 'janitor';
export type GameScreen = 'splash' | 'modeSelect' | 'missionSelect' | 'preConfig' | 'tutorial' | 'playing' | 'results' | 'leaderboard';
export type CameraView = 'orbital' | 'cockpit' | 'tug' | 'target';

// События
export type EventType = 'solarFlare' | 'micrometeorite' | 'engineFailure' | 'none';

// Масштаб времени для симуляции
// 1 реальная секунда = 50 секунд симуляции
// Орбитальный период на 400км ≈ 5543с → 5543/50 ≈ 111 сек реального (плавно!)
export const TIME_SCALE = 50; // 1 секунда реального = 50 секунд симуляции (орбитальный период ≈ 111 сек)

// Доступные множители времени для варпа
export const TIME_WARP_LEVELS = [1, 2, 5, 10] as const;
export type TimeWarpLevel = typeof TIME_WARP_LEVELS[number];
