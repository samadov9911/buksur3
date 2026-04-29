/**
 * Определения миссий для обоих режимов игры
 */

import { ORBIT_TYPES } from '../engine/constants';
import { DEBRIS_DATABASE } from './debris';
import { CUBESAT_SPECS, DEPLOYER_TUG, JANITOR_TUG } from './satellites';
import type { GameMode, CaptureType } from '../engine/constants';

export interface MissionBase {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  difficultyLabel: string;
  /** Время на миссию (секунды реального времени) */
  timeLimit: number;
  /** Бонус к рейтингу за сложность */
  scoreMultiplier: number;
}

export interface NanoSatMission extends MissionBase {
  mode: 'nanosat';
  cubeSatType: '1U' | '2U' | '3U';
  targetOrbitId: string;
  /** Допустимое отклонение от целевой орбиты (км) */
  tolerance: {
    altitude: number;
    inclination: number;
  };
  /** Требуемый delta-V (м/с) — рассчитывается по манёвру Хомана */
  requiredDeltaV: number;
  /** Начальная орбита буксира */
  startOrbit: {
    altitude: number;
    inclination: number;
  };
}

export interface JanitorMission extends MissionBase {
  mode: 'janitor';
  targetDebrisId: string;
  captureType: CaptureType;
  /** Сложность захвата — требования к скорости контакта (м/с) */
  contactSpeedLimit: number;
  /** Количество объектов */
  debrisCount: number;
  /** Дополнительные объекты (ID) */
  additionalDebrisIds?: string[];
}

export type Mission = NanoSatMission | JanitorMission;

// ============================================================
// Миссии режима «NANOSAT DEPLOYER»
// ============================================================

const nanosatMissions: NanoSatMission[] = [
  {
    id: 'nano_1',
    name: 'Первый запуск',
    description: 'Доставьте 1U CubeSat на низкую околоземную орбиту. Идеальная миссия для обучения основам орбитального маневрирования.',
    mode: 'nanosat',
    cubeSatType: '1U',
    targetOrbitId: 'LEO',
    tolerance: { altitude: 15, inclination: 1.5 },
    requiredDeltaV: 150,
    startOrbit: { altitude: 250, inclination: 51.6 },
    difficulty: 'easy',
    difficultyLabel: 'Легко',
    timeLimit: 300,
    scoreMultiplier: 1.0
  },
  {
    id: 'nano_2',
    name: 'Солнечно-синхронная',
    description: 'Доставьте 2U CubeSat на солнечно-синхронную орбиту 700 км. Требуется значительное изменение наклонения.',
    mode: 'nanosat',
    cubeSatType: '2U',
    targetOrbitId: 'SSO',
    tolerance: { altitude: 10, inclination: 0.5 },
    requiredDeltaV: 800,
    startOrbit: { altitude: 400, inclination: 51.6 },
    difficulty: 'medium',
    difficultyLabel: 'Средне',
    timeLimit: 420,
    scoreMultiplier: 1.5
  },
  {
    id: 'nano_3',
    name: 'Полярная станция',
    description: 'Доставьте 3U CubeSat на полярную орбиту 800 км. Требуется полное изменение плоскости орбиты на 90°.',
    mode: 'nanosat',
    cubeSatType: '3U',
    targetOrbitId: 'POLAR',
    tolerance: { altitude: 8, inclination: 0.3 },
    requiredDeltaV: 1200,
    startOrbit: { altitude: 400, inclination: 28.5 },
    difficulty: 'hard',
    difficultyLabel: 'Сложно',
    timeLimit: 540,
    scoreMultiplier: 2.0
  },
  {
    id: 'nano_4',
    name: 'Трансфер на ГСО',
    description: 'Доставьте 2U CubeSat на геостационарную трансферную орбиту. Длительная миссия с двумя включениями двигателя.',
    mode: 'nanosat',
    cubeSatType: '2U',
    targetOrbitId: 'GTO',
    tolerance: { altitude: 100, inclination: 0.5 },
    requiredDeltaV: 2500,
    startOrbit: { altitude: 380, inclination: 28.5 },
    difficulty: 'expert',
    difficultyLabel: 'Эксперт',
    timeLimit: 600,
    scoreMultiplier: 3.0
  },
];

// ============================================================
// Миссии режима «SPACE JANITOR»
// ============================================================

const janitorMissions: JanitorMission[] = [
  {
    id: 'j_1',
    name: 'Первый захват',
    description: 'Захватите нерабочий спутник Starlink и верните его в атмосферу. Простая миссия для обучения захвату.',
    mode: 'janitor',
    targetDebrisId: 'starlink_v2mini',
    captureType: 'manipulator',
    contactSpeedLimit: 0.1,
    debrisCount: 1,
    difficulty: 'easy',
    difficultyLabel: 'Легко',
    timeLimit: 360,
    scoreMultiplier: 1.0
  },
  {
    id: 'j_2',
    name: 'Контейнер Iridium',
    description: 'Захватите быстро вращающийся контейнер-«гроб» Iridium с помощью сети.',
    mode: 'janitor',
    targetDebrisId: 'iridium_coffin',
    captureType: 'net',
    contactSpeedLimit: 0.05,
    debrisCount: 1,
    difficulty: 'easy',
    difficultyLabel: 'Легко',
    timeLimit: 300,
    scoreMultiplier: 1.2
  },
  {
    id: 'j_3',
    name: 'Арианская ступень',
    description: 'Захватите верхнюю ступень «Ариан-5» на эллиптической орбите. Используйте гарпун для захвата крупного объекта.',
    mode: 'janitor',
    targetDebrisId: 'ariane5_stage',
    captureType: 'harpoon',
    contactSpeedLimit: 0.08,
    debrisCount: 1,
    difficulty: 'medium',
    difficultyLabel: 'Средне',
    timeLimit: 420,
    scoreMultiplier: 1.5
  },
  {
    id: 'j_4',
    name: 'Следы столкновения',
    description: 'Очистите район столкновения «Космос-2251» и Iridium 33. Захватите обломки обоих спутников.',
    mode: 'janitor',
    targetDebrisId: 'cosmos2251',
    captureType: 'net',
    contactSpeedLimit: 0.05,
    debrisCount: 2,
    additionalDebrisIds: ['iridium33'],
    difficulty: 'medium',
    difficultyLabel: 'Средне',
    timeLimit: 540,
    scoreMultiplier: 1.8
  },
  {
    id: 'j_5',
    name: 'Космический великан',
    description: 'Захватите спутник Envisat — крупнейший объект на НОО. 8 тонн, 10 метров длиной.',
    mode: 'janitor',
    targetDebrisId: 'envisat',
    captureType: 'manipulator',
    contactSpeedLimit: 0.03,
    debrisCount: 1,
    difficulty: 'hard',
    difficultyLabel: 'Сложно',
    timeLimit: 600,
    scoreMultiplier: 2.5
  },
  {
    id: 'j_6',
    name: 'Последствия ПРО',
    description: 'Уберите обломки китайского испытания ПРО «Фэнъюнь-1С». Быстро вращающийся фрагмент!',
    mode: 'janitor',
    targetDebrisId: 'fengyun1c',
    captureType: 'net',
    contactSpeedLimit: 0.02,
    debrisCount: 1,
    difficulty: 'hard',
    difficultyLabel: 'Сложно',
    timeLimit: 480,
    scoreMultiplier: 2.5
  },
  {
    id: 'j_7',
    name: 'Большая уборка',
    description: 'Уберите 3 объекта с одной орбиты: ступень «Циклон-3», ступень «Слёва» и обломок «Космос-1275».',
    mode: 'janitor',
    targetDebrisId: 'cyclone3_stage',
    captureType: 'harpoon',
    contactSpeedLimit: 0.05,
    debrisCount: 3,
    additionalDebrisIds: ['sl6_stage', 'kosmos1275'],
    difficulty: 'expert',
    difficultyLabel: 'Эксперт',
    timeLimit: 600,
    scoreMultiplier: 3.5
  },
];

// ============================================================
// Экспорт
// ============================================================

export const MISSIONS: Record<GameMode, Mission[]> = {
  nanosat: nanosatMissions,
  janitor: janitorMissions,
};

export function getMissionById(id: string): Mission | undefined {
  return [...nanosatMissions, ...janitorMissions].find(m => m.id === id);
}

export function getMissionsForMode(mode: GameMode): Mission[] {
  return MISSIONS[mode];
}
