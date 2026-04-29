/**
 * Магазин игрового состояния — Zustand
 *
 * Центральное хранилище всех данных симуляции «ORBITAL TUG».
 * Управляет потоком игры, состоянием буксира, цели, HUD, событиями,
 * результатами и обучением.
 */

import { create } from 'zustand';

// Типы из движка
import type { GameMode, GameScreen, CameraView, CaptureType, CubeSatType, EventType } from '@/game/engine/constants';
import type { OrbitalInfo } from '@/game/engine/orbitalMechanics';
import type { Mission } from '@/game/data/missions';
import { getMissionById } from '@/game/data/missions';
import { DEPLOYER_TUG, JANITOR_TUG } from '@/game/data/satellites';

// ============================================================
// Вспомогательные типы
// ============================================================

/** Трёхмерный вектор */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Углы Эйлера (тангаж, рыскание, крен) */
export interface EulerAngles {
  pitch: number;
  yaw: number;
  roll: number;
}

/** Состояние захвата (для режима janitor) */
export type CaptureState = 'approaching' | 'matching' | 'capturing' | 'captured' | 'deorbiting' | 'burning';

/** Состояние развёртывания (для режима nanosat) */
export type DeploymentState = 'approaching' | 'aligning' | 'deploying' | 'deployed' | 'undocked';

/** Целевая орбита для режима наноспутников */
export interface TargetOrbit {
  apogee: number;       // Апогей (км)
  perigee: number;      // Перигей (км)
  inclination: number;  // Наклонение (градусы)
}

/** Допуски орбиты при развёртывании */
export interface OrbitTolerance {
  altitude: number;     // Допуск по высоте (км)
  inclination: number;  // Допуск по наклонению (градусы)
}

/** Configuration for a nanosatellite deployment target */
export interface NanoSatTargetConfig {
  cubeSatType: '1U' | '2U' | '3U';
  orbitType: string; // key from ORBIT_TYPES or 'CUSTOM'
  apogee: number; // km
  perigee: number; // km
  inclination: number; // degrees
  raan: number; // RAAN — Right Ascension of Ascending Node (degrees, 0-360)
  argPerigee: number; // Argument of Perigee (degrees, 0-360)
  tolerance: { altitude: number; inclination: number };
}

/** Configuration for a debris deorbit target */
export interface DebrisTargetConfig {
  debrisId: string;
  captureType: 'harpoon' | 'manipulator' | 'net';
}

/** A single mission target (either nanosat or debris) */
export interface MissionTargetConfig {
  nanosat?: NanoSatTargetConfig;
  debris?: DebrisTargetConfig;
}

/** Результаты миссии */
export interface GameResults {
  score: number;
  debrisCleanedKg: number;
  accuracy: number;       // 0–100
  fuelEfficiency: number; // 0–100
  timeBonus: number;
  rating: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
}

// ============================================================
// Интерфейс состояния
// ============================================================

export interface GameState {
  // ---- Поток игры ------------------------------------------------
  /** Имя игрока для лидерборда */
  playerName: string;
  /** Текущий экран */
  screen: GameScreen;
  /** Режим игры: наноспутник или уборщик */
  gameMode: GameMode | null;
  /** ID выбранной миссии */
  currentMissionId: string | null;
  /** Выбранная миссия (объект) */
  currentMission: Mission | null;
  /** Пауза */
  isPaused: boolean;
  /** Конец игры */
  isGameOver: boolean;

  // ---- Состояние буксира ------------------------------------------
  /** Позиция буксира (м) */
  tugPosition: Vec3;
  /** Скорость буксира (м/с) */
  tugVelocity: Vec3;
  /** Ориентация буксира (рад) */
  tugRotation: EulerAngles;
  /** Угловая скорость буксира (рад/с) */
  tugAngularVelocity: Vec3;
  /** Текущая масса топлива (кг) */
  fuelMass: number;
  /** Начальная масса топлива (кг) */
  initialFuelMass: number;
  /** Максимальный запас характеристической скорости (м/с) */
  maxDeltaV: number;
  /** Израсходованная характеристическая скорость (м/с) */
  usedDeltaV: number;
  /** Двигатель включён */
  thrust: boolean;
  /** Направление тяги (нормализованный вектор) */
  thrustDirection: Vec3;

  // ---- Состояние цели (режим janitor) ----------------------------
  /** ID мусорных объектов для очистки */
  targetDebrisIds: string[];
  /** ID текущей цели */
  currentTargetId: string | null;
  /** Позиция цели (м) */
  targetPosition: Vec3;
  /** Скорость цели (м/с) */
  targetVelocity: Vec3;
  /** Ориентация цели (рад) */
  targetRotation: EulerAngles;
  /** Угловая скорость цели (рад/с) */
  targetAngularVelocity: Vec3;
  /** Расстояние до цели (м) */
  distanceToTarget: number;
  /** Относительная скорость сближения (м/с) */
  relativeSpeed: number;
  /** Фаза захвата */
  captureState: CaptureState;
  /** Тип захватного устройства */
  captureType: CaptureType | null;
  /** Стабильность захвата (0–100) */
  captureStability: number;
  /** ID уже захваченных объектов */
  capturedDebris: string[];

  // ---- Состояние спутника (режим nanosat) ------------------------
  /** Тип CubeSat */
  cubeSatType: CubeSatType | null;
  /** Целевая орбита для развёртывания */
  targetOrbit: TargetOrbit;
  /** Текущая орбитальная информация */
  currentOrbitalInfo: OrbitalInfo;
  /** Фаза развёртывания */
  deploymentState: DeploymentState;
  /** Допустимые отклонения орбиты */
  orbitTolerance: OrbitTolerance;

  // ---- HUD -------------------------------------------------------
  /** Орбитальные параметры для отображения */
  orbitalInfo: OrbitalInfo;
  /** Оставшийся delta-V (м/с) */
  remainingDeltaV: number;
  /** Время миссии (секунды) */
  missionTime: number;
  /** Оставшееся время (секунды) */
  timeRemaining: number;
  /** Текущий вид камеры */
  cameraView: CameraView;
  /** Показывать формулы на экране */
  showFormulas: boolean;
  /** Показывать панель знаний */
  showKnowledgePanel: boolean;

  // ---- События ---------------------------------------------------
  /** Активное событие */
  activeEvent: EventType;
  /** Таймер события (секунды) */
  eventTimer: number;

  // ---- Результаты ------------------------------------------------
  /** Очки */
  score: number;
  /** Убрано мусора (кг) */
  debrisCleanedKg: number;
  /** Точность (0–100) */
  accuracy: number;
  /** Эффективность топлива (0–100) */
  fuelEfficiency: number;
  /** Бонус за время */
  timeBonus: number;
  /** Рейтинг */
  rating: GameResults['rating'];

  // ---- Обучение --------------------------------------------------
  /** Текущий шаг обучения */
  tutorialStep: number;
  /** Обучение завершено */
  tutorialComplete: boolean;

  // ---- Время -----------------------------------------------------
  /** Множитель времени (time warp) */
  timeWarp: number;
  /** Индекс текущего уровня варпа */
  timeWarpIndex: number;
  /** Итоговые результаты миссии */
  gameResults: GameResults;

  // ---- Настройки -------------------------------------------------
  /** Громкость музыки (0–100) */
  musicVolume: number;
  /** Громкость эффектов (0–100) */
  sfxVolume: number;
  /** Показать панель настроек */
  showSettings: boolean;

  // ---- Управление -----------------------------------------------
  /** Чувствительность ввода (0.2 — 2.0, default 1.0) */
  inputSensitivity: number;

  // ---- Пользовательские характеристики буксира -----------------
  /** Масса полезной нагрузки (кг), default 0 */
  tugPayloadMass: number;
  /** Пользовательская тяга (Н), null = использовать стандартную */
  tugThrustOverride: number | null;
  /** Пользовательский удельный импульс (с), null = использовать стандартный */
  tugIspOverride: number | null;
  /** Запас топлива (кг), default 23 */
  tugFuelReserve: number;
  /** Показать панель характеристик буксира */
  showTugConfig: boolean;

  // ---- Механики миссий ---------------------------------------------
  /** Можно ли начать захват (близко к мусору и малая отн. скорость) */
  canCapture: boolean;
  /** Можно ли начать развёртывание (орбита в допуске) */
  canDeploy: boolean;
  /** Прогресс захвата (0–1) */
  captureProgress: number;
  /** Прогресс развёртывания (0–1) */
  deployProgress: number;
  /** Количество развёрнутых спутников */
  deployedSats: number;
  /** Выбранное количество спутников для развёртывания (nanosat mode) */
  selectedSatCount: number;
  /** Масса захваченного мусора (кг) */
  capturedMass: number;

  // ---- Рестарт --------------------------------------------------
  /** Версия рестарта — увеличивается при каждом рестарте миссии */
  restartVersion: number;

  // ---- Многоцелевые миссии -----------------------------------------
  /** List of targets for multi-target missions */
  missionTargets: MissionTargetConfig[];
  /** Index of current target being processed (0-based) */
  currentTargetIndex: number;

  // ---- Прямое управление орбитой (выставочный режим) ----------
  /** Запрошенное изменение высоты (м). Движок применяет Δv и сбрасывает в 0. */
  pendingAltitudeChange: number;
  /** Запрошенное изменение наклонения (градусы). Движок применяет Δv и сбрасывает в 0. */
  pendingInclinationChange: number;
}

// ============================================================
// Начальное состояние
// ============================================================

/** Начальные координаты — начало координат инерциальной системы */
const ZERO_VEC3: Vec3 = { x: 0, y: 0, z: 0 };
const ZERO_ROTATION: EulerAngles = { pitch: 0, yaw: 0, roll: 0 };

/** Начальная орбитальная информация (заглушка) */
const EMPTY_ORBITAL_INFO: OrbitalInfo = {
  apogee: 0,
  perigee: 0,
  altitude: 0,
  inclination: 0,
  eccentricity: 0,
  period: 0,
  speed: 0,
};

const initialState: GameState = {
  // Поток игры
  playerName: '',

  screen: 'splash' as GameScreen,
  gameMode: null,
  currentMissionId: null,
  currentMission: null,
  isPaused: false,
  isGameOver: false,

  // Буксир
  tugPosition: { ...ZERO_VEC3 },
  tugVelocity: { ...ZERO_VEC3 },
  tugRotation: { ...ZERO_ROTATION },
  tugAngularVelocity: { ...ZERO_VEC3 },
  fuelMass: 0,
  initialFuelMass: 0,
  maxDeltaV: 0,
  usedDeltaV: 0,
  thrust: false,
  thrustDirection: { x: 0, y: 0, z: 1 },

  // Цель (janitor)
  targetDebrisIds: [],
  currentTargetId: null,
  targetPosition: { ...ZERO_VEC3 },
  targetVelocity: { ...ZERO_VEC3 },
  targetRotation: { ...ZERO_ROTATION },
  targetAngularVelocity: { ...ZERO_VEC3 },
  distanceToTarget: 0,
  relativeSpeed: 0,
  captureState: 'approaching' as CaptureState,
  captureType: null,
  captureStability: 0,
  capturedDebris: [],

  // Спутник (nanosat)
  cubeSatType: null,
  targetOrbit: { apogee: 0, perigee: 0, inclination: 0 },
  currentOrbitalInfo: { ...EMPTY_ORBITAL_INFO },
  deploymentState: 'approaching' as DeploymentState,
  orbitTolerance: { altitude: 0, inclination: 0 },

  // HUD
  orbitalInfo: { ...EMPTY_ORBITAL_INFO },
  remainingDeltaV: 0,
  missionTime: 0,
  timeRemaining: 0,
  cameraView: 'tug' as CameraView,
  showFormulas: false,
  showKnowledgePanel: false,

  // События
  activeEvent: 'none' as EventType,
  eventTimer: 0,

  // Результаты
  gameResults: { score: 0, debrisCleanedKg: 0, accuracy: 0, fuelEfficiency: 100, timeBonus: 0, rating: 'F' as GameResults['rating'] },

  // Обучение
  tutorialStep: 0,
  tutorialComplete: false,

  // Time warp
  timeWarp: 1,
  timeWarpIndex: 0,

  // Разное
  gamepadConnected: false,
  gamepadName: '',

  // Настройки
  musicVolume: 50,
  sfxVolume: 70,
  showSettings: false,

  // Управление
  inputSensitivity: 1.0,

  // Пользовательские характеристики буксира
  tugPayloadMass: 0,
  tugThrustOverride: null,
  tugIspOverride: null,
  tugFuelReserve: 23,
  showTugConfig: false,

  // Механики миссий
  canCapture: false,
  canDeploy: false,
  captureProgress: 0,
  deployProgress: 0,
  deployedSats: 0,
  selectedSatCount: 1,
  capturedMass: 0,

  // Рестарт
  restartVersion: 0,

  // Многоцелевые миссии
  missionTargets: [],
  currentTargetIndex: 0,

  // Мобильный джойстик (ввод с тач-экрана)
  mobileInput: { orientX: 0, orientY: 0, thrustX: 0, thrustY: 0 },

  // Прямое управление высотой (выставочный режим)
  pendingAltitudeChange: 0,
  // Прямое управление наклонением (выставочный режим)
  pendingInclinationChange: 0,
};

// ============================================================
// Тип действий
// ============================================================

export interface GameActions {
  // ---- Управление потоком игры -----------------------------------
  /** Переключить экран */
  setScreen: (screen: GameScreen) => void;
  /** Установить режим игры */
  setGameMode: (mode: GameMode) => void;
  /** Выбрать миссию по ID (автоматический поиск) */
  selectMission: (missionId: string) => void;
  /** Запустить игру */
  startGame: () => void;
  /** Поставить на паузу */
  pauseGame: () => void;
  /** Снять с паузы */
  resumeGame: () => void;
  /** Завершить игру */
  endGame: () => void;

  // ---- Буксир ---------------------------------------------------
  /** Обновить позицию буксира */
  updateTugPosition: (pos: Vec3) => void;
  /** Обновить скорость буксира */
  updateTugVelocity: (vel: Vec3) => void;
  /** Обновить ориентацию буксира */
  updateTugRotation: (rot: EulerAngles) => void;
  /** Расход топлива — принять deltaV и списать */
  consumeFuel: (deltaV: number) => void;
  /** Включить/выключить тягу, опционально задать направление */
  setThrust: (on: boolean, direction?: Vec3) => void;

  // ---- Цель (janitor) --------------------------------------------
  /** Выбрать цель по ID */
  selectTarget: (id: string | null) => void;
  /** Обновить позицию цели */
  updateTargetPosition: (pos: Vec3) => void;
  /** Обновить скорость цели */
  updateTargetVelocity: (vel: Vec3) => void;
  /** Обновить ориентацию цели */
  updateTargetRotation: (rot: EulerAngles) => void;
  /** Установить фазу захвата */
  setCaptureState: (state: CaptureState) => void;
  /** Установить тип захватного устройства */
  setCaptureType: (type: CaptureType | null) => void;
  /** Обновить стабильность захвата (0–100) */
  updateCaptureStability: (value: number) => void;
  /** Добавить ID захваченного мусора */
  addCapturedDebris: (id: string) => void;

  // ---- Спутник (nanosat) -----------------------------------------
  /** Установить целевую орбиту */
  setTargetOrbit: (orbit: TargetOrbit) => void;
  /** Установить фазу развёртывания */
  setDeploymentState: (state: DeploymentState) => void;

  // ---- HUD -------------------------------------------------------
  /** Обновить орбитальную информацию */
  updateOrbitalInfo: (info: OrbitalInfo) => void;
  /** Переключить вид камеры */
  setCameraView: (view: CameraView) => void;
  /** Показать/скрыть формулы */
  toggleFormulas: () => void;
  /** Показать/скрыть панель знаний */
  toggleKnowledgePanel: () => void;

  // ---- События ---------------------------------------------------
  /** Запустить событие */
  triggerEvent: (event: EventType) => void;
  /** Очистить событие */
  clearEvent: () => void;

  // ---- Время -----------------------------------------------------
  /** Обновить время миссии */
  updateMissionTime: (delta: number) => void;

  // ---- Результаты ------------------------------------------------
  /** Установить очки */
  setScore: (score: number) => void;
  /** Установить итоговые результаты */
  setResults: (results: GameResults) => void;

  // ---- Обучение --------------------------------------------------
  /** Перейти к шагу обучения */
  setTutorialStep: (step: number) => void;
  /** Завершить обучение */
  completeTutorial: () => void;

  // ---- Сброс -----------------------------------------------------
  /** Полный сброс игрового состояния */
  resetGame: () => void;
  /** Рестарт текущей миссии (сбросить прогресс, но сохранить миссию и настройки) */
  restartMission: () => void;

  // ---- Джойстик --------------------------------------------------
  /** Установить статус подключения джойстика */
  setGamepadConnected: (connected: boolean) => void;
  /** Установить имя джойстика */
  setGamepadName: (name: string) => void;

  // ---- Настройки -------------------------------------------------
  /** Установить громкость музыки */
  setMusicVolume: (volume: number) => void;
  /** Установить громкость эффектов */
  setSfxVolume: (volume: number) => void;
  /** Переключить панель настроек */
  toggleSettings: () => void;

  // ---- Управление (чувствительность) -----------------------------
  /** Установить чувствительность ввода */
  setInputSensitivity: (sensitivity: number) => void;

  // ---- Time warp -------------------------------------------------
  /** Увеличить time warp */
  increaseTimeWarp: () => void;
  /** Уменьшить time warp */
  decreaseTimeWarp: () => void;

  // ---- Пользовательские характеристики буксира ------------------
  /** Установить массу полезной нагрузки (кг) */
  setTugPayloadMass: (mass: number) => void;
  /** Установить пользовательскую тягу (Н), null для сброса */
  setTugThrustOverride: (thrust: number | null) => void;
  /** Установить пользовательский Isp (с), null для сброса */
  setTugIspOverride: (isp: number | null) => void;
  /** Установить запас топлива (кг) */
  setTugFuelReserve: (mass: number) => void;
  /** Показать/скрыть панель характеристик буксира */
  toggleTugConfig: () => void;

  // ---- Механики миссий --------------------------------------------
  /** Установить флаг возможности захвата */
  setCanCapture: (can: boolean) => void;
  /** Установить флаг возможности развёртывания */
  setCanDeploy: (can: boolean) => void;
  /** Установить прогресс захвата (0–1) */
  setCaptureProgress: (progress: number) => void;
  /** Установить прогресс развёртывания (0–1) */
  setDeployProgress: (progress: number) => void;
  /** Увеличить счётчик развёрнутых спутников */
  incrementDeployedSats: () => void;
  /** Установить массу захваченного мусора */
  setCapturedMass: (mass: number) => void;

  // ---- Многоцелевые миссии ----------------------------------------
  /** Set the list of mission targets */
  setMissionTargets: (targets: MissionTargetConfig[]) => void;
  /** Advance to the next target (returns false if no more targets) */
  advanceToNextTarget: () => boolean;
  /** Set current target index */
  setCurrentTargetIndex: (index: number) => void;

  // ---- Развёртывание наноспутников -----------------------------
  /** Установить количество спутников для развёртывания */
  setSelectedSatCount: (count: number) => void;

  // ---- Прямое управление орбитой (выставочный режим) ----------
  /** Запросить изменение высоты орбиты (+км для повышения, -км для понижения) */
  requestAltitudeChange: (deltaKm: number) => void;
  /** Сбросить запрос на изменение высоты (вызывается движком после применения) */
  clearAltitudeChange: () => void;
  /** Запросить изменение наклонения орбиты (+град для повышения, -град для понижения) */
  requestInclinationChange: (deltaDeg: number) => void;
  /** Сбросить запрос на изменение наклонения (вызывается движком после применения) */
  clearInclinationChange: () => void;
  /** Установить мобильный джойстик ввод */
  setMobileInput: (input: { orientX: number; orientY: number; thrustX: number; thrustY: number }) => void;
}

// ============================================================
// Zustand-хук
// ============================================================

export type GameStore = GameState & GameActions;

/**
 * Основной хук игрового магазина.
 *
 * Используется во всех компонентах для чтения и записи состояния:
 *   const screen = useGameStore(s => s.screen);
 *   const { setScreen, setGameMode } = useGameStore();
 */
export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  // ============================================================
  // Управление потоком игры
  // ============================================================

  setPlayerName: (name: string) => set({ playerName: name }),

  setScreen: (screen) => set({ screen }),

  setGameMode: (mode) => set({ gameMode: mode }),

  selectMission: (missionId) => {
    const mission = getMissionById(missionId);
    if (mission) {
      const tugSpec = mission.mode === 'nanosat' ? DEPLOYER_TUG : JANITOR_TUG;
      const g0 = 9.80665;
      const fuelReserve = get().tugFuelReserve;
      const totalMass = tugSpec.dryMass + fuelReserve;
      const maxDv = tugSpec.isp * g0 * Math.log(totalMass / tugSpec.dryMass);
      set({
        currentMissionId: missionId,
        currentMission: mission,
        fuelMass: fuelReserve,
        initialFuelMass: fuelReserve,
        maxDeltaV: maxDv,
        usedDeltaV: 0,
        remainingDeltaV: maxDv,
        gameMode: mission.mode,
        captureState: 'approaching',
        deploymentState: 'approaching',
        // Set CubeSat type from mission definition
        cubeSatType: mission.mode === 'nanosat' ? (mission as any).cubeSatType : null,
      });
    }
  },

  startGame: () =>
    set((state) => {
      // Compute effective time limit for both predefined and custom missions
      const isCustom = !state.currentMissionId && state.missionTargets.length > 0;
      const effectiveTimeLimit = isCustom
        ? (state.gameMode === 'janitor'
          ? 300 + state.missionTargets.length * 180
          : 240 + state.missionTargets.length * 120)
        : (state.currentMission?.timeLimit ?? 300);

      return {
        screen: 'playing' as GameScreen,
        isPaused: false,
        isGameOver: false,
        missionTime: 0,
        timeRemaining: effectiveTimeLimit,
        cameraView: 'tug' as CameraView,
        // Reset ALL mission-specific state to prevent stale data from previous games
        deployedSats: 0,
        capturedDebris: [],
        capturedMass: 0,
        canCapture: false,
        canDeploy: false,
        captureProgress: 0,
        deployProgress: 0,
        captureState: 'approaching' as CaptureState,
        deploymentState: 'approaching' as DeploymentState,
        // Don't reset missionTargets/currentTargetIndex — they may be needed for multi-target missions
      };
    }),

  pauseGame: () => set({ isPaused: true }),

  resumeGame: () => set({ isPaused: false }),

  endGame: () =>
    set((state) => {
      // Save score to leaderboard API (fire-and-forget)
      if (state.playerName && state.gameResults.score > 0) {
        fetch('/api/leaderboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: state.playerName,
            score: state.gameResults.score,
            mission: state.currentMission?.name || 'Неизвестная миссия',
            rating: state.gameResults.rating,
          }),
        }).catch(() => {});
      }
      return {
        isGameOver: true,
        isPaused: true,
        thrust: false,
        screen: 'results' as GameScreen,
        // Stop all capture/deploy animations on game end
        captureState: 'approaching' as CaptureState,
        deploymentState: 'approaching' as DeploymentState,
      };
    }),

  // ============================================================
  // Буксир
  // ============================================================

  updateTugPosition: (pos) =>
    set({
      tugPosition: { x: pos.x, y: pos.y, z: pos.z },
    }),

  updateTugVelocity: (vel) =>
    set({
      tugVelocity: { x: vel.x, y: vel.y, z: vel.z },
    }),

  updateTugRotation: (rot) =>
    set({
      tugRotation: { pitch: rot.pitch, yaw: rot.yaw, roll: rot.roll },
    }),

  consumeFuel: (massKg) =>
    set((state) => {
      const newFuel = Math.max(0, state.fuelMass - massKg);
      const tugSpec = state.gameMode === 'nanosat' ? DEPLOYER_TUG : JANITOR_TUG;
      const g0 = 9.80665;
      const currentMass = tugSpec.dryMass + newFuel;
      const usedDv = tugSpec.isp * g0 * Math.log(tugSpec.totalMass / Math.max(currentMass, 1));
      return {
        fuelMass: newFuel,
        usedDeltaV: usedDv,
        remainingDeltaV: Math.max(0, state.maxDeltaV - usedDv),
      };
    }),

  setThrust: (on, direction) =>
    set({
      thrust: on,
      ...(direction && {
        thrustDirection: { x: direction.x, y: direction.y, z: direction.z },
      }),
    }),

  // ============================================================
  // Цель (режим janitor)
  // ============================================================

  selectTarget: (id) =>
    set({ currentTargetId: id }),

  updateTargetPosition: (pos) =>
    set({
      targetPosition: { x: pos.x, y: pos.y, z: pos.z },
    }),

  updateTargetVelocity: (vel) =>
    set({
      targetVelocity: { x: vel.x, y: vel.y, z: vel.z },
    }),

  updateTargetRotation: (rot) =>
    set({
      targetRotation: { pitch: rot.pitch, yaw: rot.yaw, roll: rot.roll },
    }),

  setCaptureState: (captureState) =>
    set({ captureState }),

  setCaptureType: (captureType) =>
    set({ captureType }),

  updateCaptureStability: (value) =>
    set({
      captureStability: Math.max(0, Math.min(100, value)),
    }),

  addCapturedDebris: (id) =>
    set((state) => ({
      capturedDebris: state.capturedDebris.includes(id)
        ? state.capturedDebris
        : [...state.capturedDebris, id],
    })),

  // ============================================================
  // Спутник (режим nanosat)
  // ============================================================

  setTargetOrbit: (orbit) =>
    set({
      targetOrbit: { apogee: orbit.apogee, perigee: orbit.perigee, inclination: orbit.inclination },
    }),

  setDeploymentState: (deploymentState) =>
    set({ deploymentState }),

  // ============================================================
  // HUD
  // ============================================================

  updateOrbitalInfo: (info) =>
    set({
      orbitalInfo: {
        apogee: info.apogee,
        perigee: info.perigee,
        altitude: info.altitude,
        inclination: info.inclination,
        eccentricity: info.eccentricity,
        period: info.period,
        speed: info.speed,
      },
      // Текущая орбитальная информация — то же, что и в HUD
      currentOrbitalInfo: {
        apogee: info.apogee,
        perigee: info.perigee,
        altitude: info.altitude,
        inclination: info.inclination,
        eccentricity: info.eccentricity,
        period: info.period,
        speed: info.speed,
      },
    }),

  setCameraView: (view) =>
    set({ cameraView: view }),

  toggleFormulas: () =>
    set((state) => ({ showFormulas: !state.showFormulas })),

  toggleKnowledgePanel: () =>
    set((state) => ({ showKnowledgePanel: !state.showKnowledgePanel })),

  // ============================================================
  // События
  // ============================================================

  triggerEvent: (event) =>
    set({ activeEvent: event, eventTimer: 0 }),

  clearEvent: () =>
    set({ activeEvent: 'none', eventTimer: 0 }),

  // ============================================================
  // Время
  // ============================================================

  updateMissionTime: (delta) =>
    set((state) => {
      const newMissionTime = state.missionTime + delta;
      const newTimeRemaining = Math.max(0, (state.timeRemaining ?? 0) - delta);
      return {
        missionTime: newMissionTime,
        timeRemaining: newTimeRemaining,
      };
    }),

  // ============================================================
  // Результаты
  // ============================================================

  setScore: (score) =>
    set({ score }),

  setResults: (results) =>
    set({
      gameResults: results,
    }),

  // ============================================================
  // Обучение
  // ============================================================

  setTutorialStep: (tutorialStep) =>
    set({ tutorialStep }),

  completeTutorial: () =>
    set({ tutorialComplete: true, tutorialStep: 0 }),

  // ============================================================
  // Сброс
  // ============================================================

  restartMission: () => {
    const state = get();
    // Сохраняем текущую миссию, режим, настройки буксира и версию
    const currentMissionId = state.currentMissionId;
    const currentMission = state.currentMission;
    const gameMode = state.gameMode;
    const tugFuelReserve = state.tugFuelReserve;
    const tugPayloadMass = 0; // сбрасываем захваченный мусор
    const tugThrustOverride = state.tugThrustOverride;
    const tugIspOverride = state.tugIspOverride;
    const missionTargets = state.missionTargets;
    const isCustom = !currentMissionId && missionTargets.length > 0;

    // Пересчитываем delta-V
    const tugSpec = gameMode === 'nanosat' ? DEPLOYER_TUG : JANITOR_TUG;
    const g0 = 9.80665;
    const totalMass = tugSpec.dryMass + tugFuelReserve;
    const maxDv = tugSpec.isp * g0 * Math.log(totalMass / tugSpec.dryMass);

    set({
      // Сохраняем настройки и миссию
      currentMissionId,
      currentMission,
      gameMode,
      missionTargets,
      // Сохраняем пользовательские настройки
      tugFuelReserve,
      tugThrustOverride,
      tugIspOverride,
      // Топливо и delta-V — сброс
      fuelMass: tugFuelReserve,
      initialFuelMass: tugFuelReserve,
      maxDeltaV: maxDv,
      usedDeltaV: 0,
      remainingDeltaV: maxDv,
      // Сбросываем состояние миссии
      isPaused: false,
      isGameOver: false,
      screen: 'playing' as GameScreen,
      missionTime: 0,
      thrust: false,
      tugPayloadMass: 0,
      // Capture state
      captureState: 'approaching' as CaptureState,
      deploymentState: 'approaching' as DeploymentState,
      capturedDebris: [],
      capturedMass: 0,
      canCapture: false,
      canDeploy: false,
      captureProgress: 0,
      deployProgress: 0,
      deployedSats: 0,
      currentTargetIndex: 0,
      // Time warp
      timeWarp: 1,
      timeWarpIndex: 0,
      // Results
      score: 0,
      gameResults: { score: 0, debrisCleanedKg: 0, accuracy: 0, fuelEfficiency: 100, timeBonus: 0, rating: 'F' as GameResults['rating'] },
      // Время
      timeRemaining: isCustom
        ? (gameMode === 'janitor' ? 300 + missionTargets.length * 180 : 240 + missionTargets.length * 120)
        : (currentMission?.timeLimit ?? 300),
      // Инкрементируем версию рестарта для триггера в Game.tsx
      restartVersion: state.restartVersion + 1,
      // Закрываем панели
      showSettings: false,
      showTugConfig: false,
    });
  },

  resetGame: () => {
    // Use spread of initialState but ensure complex nested objects are fresh copies
    set({
      ...initialState,
      // Deep-copy mutable objects to avoid shared references
      tugPosition: { ...initialState.tugPosition },
      tugVelocity: { ...initialState.tugVelocity },
      tugRotation: { ...initialState.tugRotation },
      tugAngularVelocity: { ...initialState.tugAngularVelocity },
      thrustDirection: { ...initialState.thrustDirection },
      targetPosition: { ...initialState.targetPosition },
      targetVelocity: { ...initialState.targetVelocity },
      targetRotation: { ...initialState.targetRotation },
      targetAngularVelocity: { ...initialState.targetAngularVelocity },
      targetOrbit: { ...initialState.targetOrbit },
      currentOrbitalInfo: { ...initialState.currentOrbitalInfo },
      orbitalInfo: { ...initialState.orbitalInfo },
      orbitTolerance: { ...initialState.orbitTolerance },
      mobileInput: { ...initialState.mobileInput },
      gameResults: { ...initialState.gameResults },
    });
  },

  setGamepadConnected: (connected) => set({ gamepadConnected: connected }),
  setGamepadName: (name) => set({ gamepadName: name }),

  // ============================================================
  // Настройки
  // ============================================================

  setMusicVolume: (volume) => set({ musicVolume: Math.max(0, Math.min(100, volume)) }),
  setSfxVolume: (volume) => set({ sfxVolume: Math.max(0, Math.min(100, volume)) }),
  toggleSettings: () => set((state) => ({ showSettings: !state.showSettings })),

  // Чувствительность
  setInputSensitivity: (sensitivity) =>
    set({ inputSensitivity: Math.max(0.2, Math.min(2.0, sensitivity)) }),

  // Time warp — reasonable levels that keep physics stable
  // TIME_SCALE=500 already provides 1 orbit ≈ 11s. These multipliers
  // give additional speedup while keeping subDt manageable.
  // Max totalSimDt per frame: ~80s (subDt=8s with 10 substeps) → stable
  increaseTimeWarp: () =>
    set((state) => {
      const levels = [1, 2, 5, 10];
      const maxIdx = levels.length - 1;
      const newIdx = Math.min(state.timeWarpIndex + 1, maxIdx);
      return { timeWarpIndex: newIdx, timeWarp: levels[newIdx] };
    }),
  decreaseTimeWarp: () =>
    set((state) => {
      const levels = [1, 2, 5, 10];
      const newIdx = Math.max(state.timeWarpIndex - 1, 0);
      return { timeWarpIndex: newIdx, timeWarp: levels[newIdx] };
    }),

  // Пользовательские характеристики буксира
  setTugPayloadMass: (mass) =>
    set({ tugPayloadMass: Math.max(0, Math.min(5000, mass)) }),

  setTugThrustOverride: (thrust) =>
    set({ tugThrustOverride: thrust !== null ? Math.max(0.01, Math.min(50, thrust)) : null }),

  setTugIspOverride: (isp) =>
    set({ tugIspOverride: isp !== null ? Math.max(100, Math.min(10000, isp)) : null }),

  setTugFuelReserve: (mass) =>
    set({ tugFuelReserve: Math.max(1, Math.min(5000, mass)) }),

  toggleTugConfig: () => set((state) => ({ showTugConfig: !state.showTugConfig })),

  // Механики миссий
  setCanCapture: (can) => set({ canCapture: can }),
  setCanDeploy: (can) => set({ canDeploy: can }),
  setCaptureProgress: (progress) =>
    set({ captureProgress: Math.max(0, Math.min(1, progress)) }),
  setDeployProgress: (progress) =>
    set({ deployProgress: Math.max(0, Math.min(1, progress)) }),
  incrementDeployedSats: () =>
    set((state) => ({ deployedSats: state.deployedSats + 1 })),
  setCapturedMass: (mass) =>
    set((state) => ({ capturedMass: state.capturedMass + mass })),

  // Многоцелевые миссии
  setMissionTargets: (targets) => set({ missionTargets: targets, currentTargetIndex: 0 }),
  advanceToNextTarget: () => {
    const state = useGameStore.getState();
    const nextIndex = state.currentTargetIndex + 1;
    if (nextIndex >= state.missionTargets.length) return false;
    set({ currentTargetIndex: nextIndex });
    return true;
  },
  setCurrentTargetIndex: (index) => set({ currentTargetIndex: index }),

  // Развёртывание наноспутников
  setSelectedSatCount: (count) =>
    set({ selectedSatCount: Math.max(1, Math.min(6, count)) }),

  // Прямое управление высотой (выставочный режим)
  requestAltitudeChange: (deltaKm) =>
    set((state) => ({ pendingAltitudeChange: state.pendingAltitudeChange + deltaKm * 1000 })),
  clearAltitudeChange: () =>
    set({ pendingAltitudeChange: 0 }),
  // Прямое управление наклонением (выставочный режим)
  requestInclinationChange: (deltaDeg) =>
    set((state) => ({ pendingInclinationChange: state.pendingInclinationChange + deltaDeg })),
  clearInclinationChange: () =>
    set({ pendingInclinationChange: 0 }),
  // Мобильный джойстик ввод
  setMobileInput: (input) =>
    set({ mobileInput: { ...input } }),
}));
