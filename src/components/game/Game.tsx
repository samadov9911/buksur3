/**
 * Главный игровой компонент — управление экранами и игровым циклом
 */
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useGameStore } from '@/game/store/gameStore';
import { useGamepad, useKeyboardInput } from '@/hooks/useGamepad';
import { useGameEngine } from './GameEngine';
import SpaceScene from './scene/SpaceScene';
import * as THREE from 'three';
import { getMissionById } from '@/game/data/missions';
import { getDebrisById } from '@/game/data/debris';
import { altitudeKmToVisualOrbitRadius, circularOrbitalSpeed } from '@/game/engine/orbitalMechanics';
import { ORBIT_TYPES, R_EARTH } from '@/game/engine/constants';
import { DEPLOYER_TUG, JANITOR_TUG } from '@/game/data/satellites';

import SplashScreen from './screens/SplashScreen';
import ModeSelect from './screens/ModeSelect';
import MissionSelect from './screens/MissionSelect';
import PreConfigScreen from './screens/PreConfigScreen';
import TutorialScreen from './screens/TutorialScreen';
import ResultsScreen from './screens/ResultsScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import HUD from './hud/HUD';
import CockpitHUD from './hud/CockpitHUD';
import PauseMenu from './hud/PauseMenu';
import MobileJoystick from './hud/MobileJoystick';

class SceneErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null; retryCount: number }
> {
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[SpaceScene Error]', error, errorInfo);
    // Auto-retry after 2 seconds on mobile (touch devices often recover)
    const isMobile = typeof navigator !== 'undefined' && (
      /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || (navigator.maxTouchPoints > 1)
    );
    if (isMobile && this.state.retryCount < 3) {
      this.retryTimer = setTimeout(() => {
        this.setState(prev => ({
          hasError: false,
          error: null,
          retryCount: prev.retryCount + 1,
        }));
      }, 2000);
    }
  }
  componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }
  handleRetry = () => {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.setState(prev => ({ hasError: false, error: null, retryCount: prev.retryCount + 1 }));
  };
  handleGoHome = () => {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    try {
      const { useGameStore } = require('@/game/store/gameStore');
      const store = useGameStore.getState();
      store.resetGame();
      store.setScreen('splash');
    } catch (e) {
      console.error('[SceneErrorBoundary] reset failed:', e);
    }
    this.setState({ hasError: false, error: null, retryCount: 0 });
  };
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full bg-black flex items-center justify-center">
          <div className="text-center p-4 max-w-sm">
            <p className="text-red-400 text-sm font-bold mb-2">Ошибка 3D-сцены</p>
            <p className="text-gray-500 text-xs mb-1">{this.state.error?.message || 'Неизвестная ошибка'}</p>
            <p className="text-gray-600 text-[10px] mb-4 font-mono break-all max-h-16 overflow-y-auto">
              {this.state.error?.stack?.split('\n').slice(1, 4).join('\n') || ''}
            </p>
            <div className="flex flex-col gap-2 items-center">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-sm hover:bg-cyan-500/30 transition-colors min-h-[44px] min-w-[120px]"
              >
                🔄 Повторить
              </button>
              <button
                onClick={this.handleGoHome}
                className="px-4 py-2.5 rounded-lg bg-gray-500/10 border border-gray-500/30 text-gray-400 text-sm hover:bg-gray-500/20 transition-colors min-h-[44px] min-w-[120px]"
              >
                🏠 В меню
              </button>
            </div>
            {this.state.retryCount >= 2 && (
              <p className="text-[10px] text-gray-600 mt-3">
                Если ошибка повторяется, попробуйте другой браузер
              </p>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Game() {
  // WebGL detection — runs once during state initialization (not in effect)
  const [webglSupported] = useState(() => {
    if (typeof window === 'undefined') return true; // SSR guard
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch {
      return false;
    }
  });

  const screen = useGameStore(s => s.screen);
  const isPaused = useGameStore(s => s.isPaused);
  const isMobile = useIsMobile();
  const currentMissionId = useGameStore(s => s.currentMissionId);
  const restartVersion = useGameStore(s => s.restartVersion);
  const cameraView = useGameStore(s => s.cameraView);
  const gameMode = useGameStore(s => s.gameMode);
  const captureType = useGameStore(s => s.captureType);
  const cubeSatType = useGameStore(s => s.cubeSatType);
  const deployedSats = useGameStore(s => s.deployedSats);
  const selectedSatCount = useGameStore(s => s.selectedSatCount);
  const { input: gamepadInput, setOnButtonPress, connected: gamepadConnected, gamepadName } = useGamepad();
  const { keysRef: keyboardKeysRef } = useKeyboardInput();
  // Mobile joystick input ref (updated by MobileJoystick component via Zustand)
  const mobileInputRef = useRef({ orientX: 0, orientY: 0, thrustX: 0, thrustY: 0 });
  const { initMission, simulateStep } = useGameEngine();
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const lastInitMissionRef = useRef<string | null>(null);
  // Данные обломков для визуализации (заполняются при старте миссии)
  const debrisVisualRef = useRef({
    size: [0.01, 0.01, 0.01] as [number, number, number],
    color: '#888888',
    tumble: [0.5, 0.5, 0.5] as [number, number, number],
    type: 'dead_sat' as string,
  });

  // Стабильные рефы — предотвращают перезапуск игрового цикла при рендере
  const initMissionRef = useRef(initMission);
  const simulateStepRef = useRef(simulateStep);
  const gamepadInputRef = useRef(gamepadInput);
  const gamepadConnectedRef = useRef(gamepadConnected);
  // keyboardKeysRef — синхронный ref из useKeyboardInput, обновляется мгновенно

  // Сцена-пропсы (для Three.js)
  const [sceneProps, setSceneProps] = useState({
    tugPosition: new THREE.Vector3(0, 0, altitudeKmToVisualOrbitRadius(400)),
    tugRotation: new THREE.Euler(0, 0, 0),
    thrust: false,
    targetPosition: null as THREE.Vector3 | null,
    targetColor: '#888888',
    targetSize: [0.01, 0.01, 0.01] as [number, number, number],
    targetTumble: [0.5, 0.5, 0.5] as [number, number, number],
    currentOrbitRadius: altitudeKmToVisualOrbitRadius(400),
    targetOrbitRadius: altitudeKmToVisualOrbitRadius(500),
    currentOrbitInclination: 51.6,
    targetOrbitInclination: 51.6,
    targetOrbitRAAN: 0,
    showTarget: false,
    burning: false,
    altitude: 400_000,
    distanceToTarget: 0,
    relativeSpeed: 0,
    timeRemaining: 300,
    canCapture: false,
    canDeploy: false,
    captureProgress: 0,
    deployProgress: 0,
    captureState: 'approaching' as string,
    deploymentState: 'approaching' as string,
    targetDebrisType: 'dead_sat' as string,
    orbitPath: [] as number[],
  });

  // Синхронизируем реф-значения и подключение джойстика
  useEffect(() => {
    gamepadInputRef.current = gamepadInput;
    gamepadConnectedRef.current = gamepadConnected;
    useGameStore.getState().setGamepadConnected(gamepadConnected);
    useGameStore.getState().setGamepadName(gamepadName);
  }, [gamepadInput, gamepadConnected, gamepadName]);

  // Обработка нажатий джойстика
  useEffect(() => {
    setOnButtonPress((button: string) => {
      const gs = useGameStore.getState();
      if (gs.screen === 'splash') {
        if (button === 'buttonA' || button === 'buttonStart') {
          gs.setScreen('modeSelect');
        }
      } else if (gs.screen === 'modeSelect') {
        if (button === 'buttonA') {
          gs.setScreen('missionSelect');
        }
      } else if (gs.screen === 'playing') {
        if (button === 'buttonStart') {
          if (gs.isPaused) gs.resumeGame();
          else gs.pauseGame();
        }
        if (button === 'buttonY') {
          const views: Array<'orbital' | 'cockpit' | 'tug' | 'target'> = ['orbital', 'cockpit', 'tug', 'target'];
          const idx = views.indexOf(gs.cameraView);
          gs.setCameraView(views[(idx + 1) % views.length]);
        }
        if (button === 'buttonX') {
          if (gs.gameMode === 'janitor') {
            if (gs.captureState === 'approaching' && gs.canCapture) {
              gs.setCaptureState('capturing');
            } else if (gs.captureState === 'captured') {
              gs.setCaptureState('deorbiting');
            }
          } else if (gs.gameMode === 'nanosat') {
            if (gs.deploymentState === 'approaching' && gs.canDeploy) {
              gs.setDeploymentState('aligning');
            } else if (gs.deploymentState === 'undocked') {
              // Same as Space key - continue mission
              const remaining = (gs.selectedSatCount || 1) - gs.deployedSats;
              if (remaining > 0) {
                gs.setDeploymentState('approaching');
              } else {
                const mission = getMissionById(gs.currentMissionId || '');
                if (mission) {
                  const maxDv = gs.maxDeltaV || 1;
                  const score = Math.floor(10000 * mission.scoreMultiplier * (1 - gs.usedDeltaV / maxDv));
                  const fuelEff = gs.initialFuelMass > 0 ? (gs.fuelMass / gs.initialFuelMass * 100) : 0;
                  let rating: 'S' | 'A' | 'B' | 'C' | 'D' | 'F' = 'B';
                  if (score > 9000) rating = 'S';
                  else if (score > 7000) rating = 'A';
                  else if (score > 5000) rating = 'B';
                  else if (score > 3000) rating = 'C';
                  gs.setResults({ score, debrisCleanedKg: 0, accuracy: 100, fuelEfficiency: fuelEff, timeBonus: 0, rating });
                  gs.endGame();
                }
              }
            }
          }
        }
        if (button === 'buttonRB' || button === 'dpadDown') {
          const targets = gs.targetDebrisIds;
          const curIdx = targets.indexOf(gs.currentTargetId || '');
          if (curIdx < targets.length - 1) {
            gs.selectTarget(targets[curIdx + 1]);
          }
        }
        if (button === 'buttonLB' || button === 'dpadUp') {
          const targets = gs.targetDebrisIds;
          const curIdx = targets.indexOf(gs.currentTargetId || '');
          if (curIdx > 0) {
            gs.selectTarget(targets[curIdx - 1]);
          }
        }
        if (button === 'buttonSelect') {
          // SELECT открывает настройки
          if (gs.isPaused) gs.toggleSettings();
        }
      }
    });
  }, [setOnButtonPress]);

  // Клавиатурные горячие клавиши
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const gs = useGameStore.getState();

      // Глобальные горячие клавиши (работают на всех экранах)
      if (e.code === 'Escape') {
        if (gs.screen === 'playing') {
          if (gs.isPaused) {
            // Если настройки открыты — закрыть настройки
            if (gs.showSettings) {
              gs.toggleSettings();
            } else {
              gs.resumeGame();
            }
          } else {
            gs.pauseGame();
          }
        }
      }

      // На экранах меню
      if (gs.screen === 'splash' && e.code === 'Space') {
        e.preventDefault();
        gs.setScreen('modeSelect');
      }

      // В игре
      if (gs.screen === 'playing') {
        // V — переключение вида камеры
        if (e.code === 'KeyV') {
          e.preventDefault();
          const views: Array<'orbital' | 'cockpit' | 'tug' | 'target'> = ['cockpit', 'tug', 'target', 'orbital'];
          const idx = views.indexOf(gs.cameraView);
          gs.setCameraView(views[(idx + 1) % views.length]);
        }
        if (e.code === 'Digit1') { e.preventDefault(); gs.setCameraView('cockpit'); }
        if (e.code === 'Digit2') { e.preventDefault(); gs.setCameraView('tug'); }
        if (e.code === 'Digit3') { e.preventDefault(); gs.setCameraView('target'); }
        if (e.code === 'Digit4') { e.preventDefault(); gs.setCameraView('orbital'); }

        // Предотвращаем прокрутку для стрелок и клавиш управления
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'Space'].includes(e.code)) {
          e.preventDefault();
        }

        // Altitude control: +/= raise orbit, -/_ lower orbit
        // Inclination control: Shift++ increase, Shift+- decrease
        if (e.shiftKey && (e.code === 'Equal' || e.code === 'NumpadAdd')) {
          e.preventDefault();
          gs.requestInclinationChange(1);
        } else if (e.shiftKey && (e.code === 'Minus' || e.code === 'NumpadSubtract')) {
          e.preventDefault();
          gs.requestInclinationChange(-1);
        } else if (e.code === 'Equal' || e.code === 'NumpadAdd') {
          e.preventDefault();
          gs.requestAltitudeChange(10);
        } else if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
          e.preventDefault();
          gs.requestAltitudeChange(-10);
        }

        // Time warp: [ ] keys
        if (e.code === 'BracketLeft') {
          e.preventDefault();
          gs.decreaseTimeWarp();
        }
        if (e.code === 'BracketRight') {
          e.preventDefault();
          gs.increaseTimeWarp();
        }

        // Переключение типа захвата (janitor mode): Tab
        if (e.code === 'Tab' && gs.gameMode === 'janitor') {
          e.preventDefault();
          const types: Array<'harpoon' | 'manipulator' | 'net'> = ['harpoon', 'manipulator', 'net'];
          const curIdx = types.indexOf(gs.captureType || 'harpoon');
          gs.setCaptureType(types[(curIdx + 1) % types.length]);
        }

        if (e.code === 'Space' && !gs.isPaused) {
          e.preventDefault();
          e.stopPropagation();
          if (gs.gameMode === 'janitor') {
            if (gs.captureState === 'approaching' && gs.canCapture) {
              gs.setCaptureState('capturing');
            } else if (gs.captureState === 'captured') {
              gs.setCaptureState('deorbiting');
            }
          } else if (gs.gameMode === 'nanosat') {
            const deployState = gs.deploymentState;
            if (deployState === 'approaching' && gs.canDeploy) {
              // Operator reaches target orbit → start docking alignment
              gs.setDeploymentState('aligning');
            } else if (deployState === 'undocked') {
              // After undocking, operator confirms to continue mission
              const remaining = (gs.selectedSatCount || 1) - gs.deployedSats;
              if (remaining > 0) {
                gs.setDeploymentState('approaching');
              } else {
                // All satellites deployed — end mission
                const mission = getMissionById(gs.currentMissionId || '');
                if (mission) {
                  const maxDv = gs.maxDeltaV || 1;
                  const score = Math.floor(10000 * mission.scoreMultiplier * (1 - gs.usedDeltaV / maxDv));
                  const fuelEff = gs.initialFuelMass > 0 ? (gs.fuelMass / gs.initialFuelMass * 100) : 0;
                  let rating: 'S' | 'A' | 'B' | 'C' | 'D' | 'F' = 'B';
                  if (score > 9000) rating = 'S';
                  else if (score > 7000) rating = 'A';
                  else if (score > 5000) rating = 'B';
                  else if (score > 3000) rating = 'C';
                  gs.setResults({ score, debrisCleanedKg: 0, accuracy: 100, fuelEfficiency: fuelEff, timeBonus: 0, rating });
                  gs.endGame();
                }
              }
            }
          }
        }

        // Горячие клавиши в паузе
        if (gs.isPaused) {
          if (e.code === 'KeyS') gs.toggleSettings();
          if (e.code === 'KeyC') gs.toggleSettings();
          if (e.code === 'KeyT') gs.toggleTugConfig();
          if (e.code === 'KeyR') {
            gs.restartMission();
          }
          if (e.code === 'KeyQ') {
            gs.resetGame();
          }
        }
      }

      // На экране выбора миссии — назад
      if (gs.screen === 'missionSelect' && e.code === 'Escape') {
        gs.setScreen('modeSelect');
      }
      if (gs.screen === 'modeSelect' && e.code === 'Escape') {
        gs.setScreen('splash');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // При рестарте — сбрасываем кэш инициализации миссии и таймер игрового цикла
  useEffect(() => {
    if (restartVersion === 0) return;
    // Сбрасываем ref чтобы useEffect миссии заново вызвал initMission
    lastInitMissionRef.current = null;
    // Сбрасываем таймер чтобы не было огромного deltaTime в первом кадре
    lastTimeRef.current = 0;
  }, [restartVersion]);

  // Инициализация миссии
  useEffect(() => {
    if (screen !== 'playing') return;

    try {
      const gs = useGameStore.getState();
      const hasCustomTargets = gs.missionTargets.length > 0;

      // Handle custom missions (from PreConfigScreen)
      if (hasCustomTargets && !currentMissionId) {
        // Allow re-init if missionTime was reset (new game started)
        if (lastInitMissionRef.current === '__custom__' && gs.missionTime > 0) return;
        lastInitMissionRef.current = '__custom__';

        const firstTarget = gs.missionTargets[gs.currentTargetIndex] || gs.missionTargets[0];

        if (!firstTarget) {
          console.error('[MissionInit] No mission target found at index', gs.currentTargetIndex);
          return;
        }

        if (gs.gameMode === 'nanosat' && firstTarget.nanosat) {
          // Set satellite count and tolerance for HUD
          useGameStore.getState().setSelectedSatCount(gs.missionTargets.length);
        } else if (gs.gameMode === 'janitor' && firstTarget.debris) {
          const dc = firstTarget.debris;
          const debris = getDebrisById(dc.debrisId);
          if (debris) {
            useGameStore.getState().selectTarget(dc.debrisId);
            useGameStore.getState().setCaptureType(dc.captureType);
            debrisVisualRef.current = {
              size: [debris.size.x, debris.size.y, debris.size.z],
              color: debris.color,
              tumble: [debris.tumbleRate.x, debris.tumbleRate.y, debris.tumbleRate.z],
              type: debris.type,
            };
          }
        } else {
          return;
        }

        // Delegate to engine — it reads missionTargets[0] and handles RAAN, inclination, etc.
        try {
          initMissionRef.current('__custom__');
        } catch (initErr) {
          console.error('[MissionInit] Custom mission init error:', initErr);
        }
        return;
      }

      if (screen === 'playing' && currentMissionId) {
        // Reset ref if game was reset (state cleared but ref persists)
        if (useGameStore.getState().missionTime === 0 && useGameStore.getState().timeRemaining === (useGameStore.getState().currentMission?.timeLimit ?? 0)) {
          lastInitMissionRef.current = null;
        }
        if (lastInitMissionRef.current === currentMissionId) return;
        lastInitMissionRef.current = currentMissionId;

        try {
          initMissionRef.current(currentMissionId);
        } catch (initErr) {
          console.error('[MissionInit] Mission init error:', initErr);
          return;
        }

        const mission = getMissionById(currentMissionId);
        if (!mission) {
          console.error('[MissionInit] Mission not found:', currentMissionId);
          return;
        }

        if (mission.mode === 'janitor') {
          const jm = mission as any;
          const debris = getDebrisById(jm.targetDebrisId);
          if (debris) {
            useGameStore.getState().selectTarget(jm.targetDebrisId);
            useGameStore.getState().setCaptureType(jm.captureType || 'harpoon');
            // Сохранить данные обломков для визуализации (ref — не вызывает рендер)
            debrisVisualRef.current = {
              size: [debris.size.x, debris.size.y, debris.size.z],
              color: debris.color,
              tumble: [debris.tumbleRate.x, debris.tumbleRate.y, debris.tumbleRate.z],
              type: debris.type,
            };
          }
        }
      }
    } catch (err) {
      console.error('[MissionInit Error]', err);
    }
  }, [screen, currentMissionId, restartVersion]);

  // Игровой цикл
  useEffect(() => {
    if (screen !== 'playing' || isPaused) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const gameLoop = (time: number) => {
      try {
        if (lastTimeRef.current === 0) lastTimeRef.current = time;
        const dt = Math.min((time - lastTimeRef.current) / 1000, 0.05);
        lastTimeRef.current = time;

        // Читаем ввод из рефов (НЕ из замыкания!) — prevents game loop restart on every keypress
        // gamepadInputRef хранит полный объект GamepadInput, обновляется в useEffect
        const gpInput = gamepadInputRef.current?.connected ? gamepadInputRef.current : null;
        const kbInput = keyboardKeysRef.current;
        const result = simulateStepRef.current(dt, gpInput, kbInput);

        if (result) {
          // Guard against NaN values from simulation (mobile GPUs can produce NaN)
          const safe = (v: number) => (Number.isFinite(v) ? v : 0);
          const gs = useGameStore.getState();
          const mission = getMissionById(gs.currentMissionId || '');
          const isCustom = !gs.currentMissionId && gs.missionTargets.length > 0;
          let targetOrbR = altitudeKmToVisualOrbitRadius(500);
          let targetInc = 51.6;
          let targetRAAN = 0;

          if (isCustom) {
            // Read from custom mission targets
            const currentTarget = gs.missionTargets[gs.currentTargetIndex];
            if (currentTarget?.nanosat) {
              targetOrbR = altitudeKmToVisualOrbitRadius(currentTarget.nanosat.apogee);
              targetInc = currentTarget.nanosat.inclination;
              targetRAAN = currentTarget.nanosat.raan || 0;
            } else if (currentTarget?.debris) {
              const debris = getDebrisById(currentTarget.debris.debrisId);
              targetOrbR = altitudeKmToVisualOrbitRadius(debris?.orbit.altitude || 500);
              targetInc = debris?.orbit.inclination || 51.6;
            }
          } else if (mission?.mode === 'nanosat') {
            const nm = mission as any;
            const targetOrbitData = ORBIT_TYPES[nm.targetOrbitId];
            targetOrbR = altitudeKmToVisualOrbitRadius(targetOrbitData ? targetOrbitData.altitude / 1000 : 700);
            targetInc = nm.targetOrbitId === 'POLAR' ? 90 : nm.targetOrbitId === 'SSO' ? 98.2 : 51.6;
          } else if (mission?.mode === 'janitor') {
            const debris = getDebrisById((mission as any).targetDebrisId);
            targetOrbR = altitudeKmToVisualOrbitRadius(debris?.orbit.altitude || 500);
            targetInc = debris?.orbit.inclination || 51.6;
          }

          const safeVec = (x: number, y: number, z: number) => {
            const sx = Number.isFinite(x) ? x : 0;
            const sy = Number.isFinite(y) ? y : 0;
            const sz = Number.isFinite(z) ? z : 0;
            return new THREE.Vector3(sx, sy, sz);
          };
          const safeEuler = (p: number, y: number, r: number) =>
            new THREE.Euler(
              Number.isFinite(p) ? p : 0,
              Number.isFinite(y) ? y : 0,
              Number.isFinite(r) ? r : 0
            );

          setSceneProps(prev => ({
            tugPosition: safeVec(result.tugVisX, result.tugVisY, result.tugVisZ),
            tugRotation: safeEuler(result.tugPitch, result.tugYaw, result.tugRoll),
            thrust: gs.thrust,
            targetPosition: safeVec(result.targetVisX, result.targetVisY, result.targetVisZ),
            targetColor: debrisVisualRef.current.color,
            targetSize: debrisVisualRef.current.size as [number, number, number],
            targetTumble: debrisVisualRef.current.tumble as [number, number, number],
            currentOrbitRadius: altitudeKmToVisualOrbitRadius(safe(result.orbInfo.altitude)),
            targetOrbitRadius: targetOrbR,
            currentOrbitInclination: safe(result.orbInfo.inclination),
            targetOrbitInclination: targetInc,
            targetOrbitRAAN: targetRAAN,
            showTarget: gs.gameMode === 'janitor',
            burning: gs.captureState === 'burning',
            altitude: safe(result.altitude),
            distanceToTarget: safe(result.distanceToTarget),
            relativeSpeed: safe(result.relativeSpeed),
            timeRemaining: safe(result.timeRemaining),
            canCapture: !!result.canCapture,
            canDeploy: !!result.canDeploy,
            captureProgress: Number.isFinite(result.captureProgress) ? result.captureProgress : 0,
            deployProgress: Number.isFinite(result.deployProgress) ? result.deployProgress : 0,
            captureState: result.captureState || 'approaching',
            deploymentState: result.deploymentState || 'approaching',
            targetDebrisType: debrisVisualRef.current.type,
            orbitPath: Array.isArray(result.orbitPath) ? result.orbitPath : [],
          }));
        }
      } catch (err) {
        // Prevent game loop errors from crashing the entire app (critical for mobile)
        console.error('[GameLoop Error]', err);
      }

      rafRef.current = requestAnimationFrame(gameLoop);
    };

    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [screen, isPaused]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* 3D сцена */}
      <div className="absolute inset-0">
        {!webglSupported ? (
          <div className="w-full h-full bg-black flex items-center justify-center">
            <div className="text-center p-4 max-w-sm">
              <p className="text-red-400 text-sm font-bold mb-2">WebGL не поддерживается</p>
              <p className="text-gray-500 text-xs">Ваш браузер не поддерживает 3D-графику. Попробуйте Chrome или Safari.</p>
            </div>
          </div>
        ) : (
          <SceneErrorBoundary>
            <SpaceScene
              tugPosition={sceneProps.tugPosition}
              tugRotation={sceneProps.tugRotation}
              thrust={sceneProps.thrust}
              targetPosition={sceneProps.targetPosition}
              targetColor={sceneProps.targetColor}
              targetSize={sceneProps.targetSize}
              targetTumble={sceneProps.targetTumble}
              currentOrbitRadius={sceneProps.currentOrbitRadius}
              targetOrbitRadius={sceneProps.targetOrbitRadius}
              currentOrbitInclination={sceneProps.currentOrbitInclination}
              targetOrbitInclination={sceneProps.targetOrbitInclination}
              targetOrbitRAAN={sceneProps.targetOrbitRAAN}
              cameraView={cameraView}
              showTarget={sceneProps.showTarget}
              burning={sceneProps.burning}
              altitude={sceneProps.altitude}
              gameMode={gameMode}
              captureType={captureType}
              cubeSatType={cubeSatType}
              captureState={sceneProps.captureState}
              deploymentState={sceneProps.deploymentState}
              captureProgress={sceneProps.captureProgress}
              deployProgress={sceneProps.deployProgress}
              targetDebrisType={sceneProps.targetDebrisType}
              orbitPath={sceneProps.orbitPath}
              deployedSats={deployedSats}
              selectedSatCount={selectedSatCount}
            />
          </SceneErrorBoundary>
        )}
      </div>

      {/* UI экраны */}
      <div className="absolute inset-0 pointer-events-none">
        {screen === 'splash' && <SplashScreen />}
        {screen === 'modeSelect' && <ModeSelect />}
        {screen === 'missionSelect' && <MissionSelect />}
        {screen === 'preConfig' && <PreConfigScreen />}
        {screen === 'tutorial' && <TutorialScreen />}
        {screen === 'playing' && (
          <>
            {/* Cockpit HUD — military FPV overlay, replaces standard HUD in cockpit view */}
            {cameraView === 'cockpit' && !isPaused ? (
              <CockpitHUD />
            ) : (
              <HUD
                distanceToTarget={sceneProps.distanceToTarget}
                relativeSpeed={sceneProps.relativeSpeed}
                timeRemaining={sceneProps.timeRemaining}
                canCapture={sceneProps.canCapture}
                canDeploy={sceneProps.canDeploy}
                captureProgress={sceneProps.captureProgress}
                deployProgress={sceneProps.deployProgress}
                captureState={sceneProps.captureState}
                deploymentState={sceneProps.deploymentState}
              />
            )}
            {/* Кнопка паузы — только десктоп (на мобильном есть в MobileJoystick) */}
            {!isMobile && (
            <button
              onClick={() => useGameStore.getState().pauseGame()}
              className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-auto
                w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm border border-white/10
                flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all z-40"
              title="Пауза (ESC)"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="4" y="3" width="3.5" height="12" rx="1" fill="#9ca3af" />
                <rect x="10.5" y="3" width="3.5" height="12" rx="1" fill="#9ca3af" />
              </svg>
            </button>
            )}
            {/* Меню паузы (замещает старый простой оверлей) */}
            <PauseMenu />
            {/* Мобильный джойстик (только на смартфонах) */}
            <MobileJoystick />
          </>
        )}
        {screen === 'results' && <ResultsScreen />}
        {screen === 'leaderboard' && <LeaderboardScreen />}
      </div>
    </div>
  );
}
