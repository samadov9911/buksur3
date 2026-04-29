/**
 * HUD — интерфейс в игровом процессе
 * Орбитальные параметры, дельта-V, расстояние, мини-карта
 * Иконки паузы и настроек
 */
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useGameStore } from '@/game/store/gameStore';
import { getMissionById } from '@/game/data/missions';
import { getDebrisById, DEBRIS_DATABASE } from '@/game/data/debris';
import { PHYSICS_FORMULAS, FUN_FACTS } from '@/game/data/knowledge';
import { DEPLOYER_TUG, JANITOR_TUG } from '@/game/data/satellites';
import { ORBIT_TYPES } from '@/game/engine/constants';
import InclinationCompass from './InclinationCompass';

interface HUDProps {
  distanceToTarget: number;
  relativeSpeed: number;
  timeRemaining: number;
  canCapture?: boolean;
  canDeploy?: boolean;
  captureProgress?: number;
  deployProgress?: number;
  captureState?: string;
  deploymentState?: string;
}

export default function HUD({ distanceToTarget, relativeSpeed, timeRemaining, canCapture, canDeploy, captureProgress, deployProgress, captureState, deploymentState }: HUDProps) {
  const [hoveredCaptureType, setHoveredCaptureType] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const CAPTURE_SPEED_LIMIT_DISPLAY = 500; // m/s, matches engine
  const orbInfo = useGameStore(s => s.orbitalInfo);
  const currentMissionId = useGameStore(s => s.currentMissionId);
  const gameMode = useGameStore(s => s.gameMode);
  const capturedDebris = useGameStore(s => s.capturedDebris);
  const cubeSatType = useGameStore(s => s.cubeSatType);
  const showFormulas = useGameStore(s => s.showFormulas);
  const showKnowledgePanel = useGameStore(s => s.showKnowledgePanel);
  const activeEvent = useGameStore(s => s.activeEvent);
  const fuelMass = useGameStore(s => s.fuelMass);
  const initialFuelMass = useGameStore(s => s.initialFuelMass);
  const usedDeltaV = useGameStore(s => s.usedDeltaV);
  const gamepadConnected = useGameStore(s => s.gamepadConnected);
  const currentTargetId = useGameStore(s => s.currentTargetId);
  const cameraView = useGameStore(s => s.cameraView);
  const thrust = useGameStore(s => s.thrust);
  const deployedSats = useGameStore(s => s.deployedSats);
  const timeWarp = useGameStore(s => s.timeWarp);
  const timeWarpIndex = useGameStore(s => s.timeWarpIndex);
  const captureType = useGameStore(s => s.captureType);
  const selectedSatCount = useGameStore(s => s.selectedSatCount);
  const missionTargets = useGameStore(s => s.missionTargets);
  const currentTargetIndex = useGameStore(s => s.currentTargetIndex);

  const mission = currentMissionId ? getMissionById(currentMissionId) : null;
  const isMultiTarget = missionTargets.length > 1;

  // Масса захваченного мусора для индикатора (janitor mode)
  const capturedMassKg = useMemo(() => {
    if (gameMode !== 'janitor') return 0;
    return capturedDebris.reduce((sum, id) => {
      const d = getDebrisById(id);
      return sum + (d?.mass || 0);
    }, 0);
  }, [gameMode, capturedDebris]);

  // Текущая цель из массива missionTargets
  const currentMissionTarget = missionTargets[currentTargetIndex] ?? null;
  const currentTargetDebris = useMemo(() => {
    if (!currentMissionTarget?.debris?.debrisId) return null;
    return getDebrisById(currentMissionTarget.debris.debrisId) ?? null;
  }, [currentMissionTarget]);

  // Индикатор близости (capture distance = 100 km)
  const proximityLevel = useMemo(() => {
    if (distanceToTarget >= 150000) return { level: 'far' as const, color: 'text-gray-400', bg: '', label: '' };
    if (distanceToTarget >= 120000) return { level: 'caution' as const, color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'СБЛИЖЕНИЕ' };
    if (distanceToTarget >= 100000) return { level: 'warning' as const, color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'ПОЧТИ В ЗОНЕ' };
    return { level: 'close' as const, color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'В ЗОНЕ ЗАХВАТА!' };
  }, [distanceToTarget]);

  // Кольцо дистанции захвата (SVG, 100км = полная заливка)
  const captureRingFill = useMemo(() => {
    if (distanceToTarget >= 100000) return 0;
    return Math.min(1, Math.max(0, 1 - distanceToTarget / 100000));
  }, [distanceToTarget]);

  // Описание типов захвата (детальное для тултипов)
  const captureTypeDescriptions: Record<string, { short: string; detailed: string }> = {
    harpoon: {
      short: 'Для крупных объектов',
      detailed: 'Гарпунный захват — для крупных обломков (РН, спутники). Высоко надёжный, требует точного попадания в цель.',
    },
    manipulator: {
      short: 'Точное захват',
      detailed: 'Робот-манипулятор — для средних объектов и точных стыковок. Максимальная точность, меньшая скорость захвата.',
    },
    net: {
      short: 'Для быстро вращающихся',
      detailed: 'Сетевой захват — для быстро вращающихся обломков и мелких фрагментов. Не требует точной ориентации цели.',
    },
  };


  const fuelPercent = initialFuelMass > 0 ? (fuelMass / initialFuelMass) * 100 : 0;
  const maxDv = tsiolkovskyDv();

  // Цвет топлива
  const fuelColor = fuelPercent > 50 ? 'text-emerald-400' : fuelPercent > 25 ? 'text-yellow-400' : 'text-red-400';
  const fuelBg = fuelPercent > 50 ? 'bg-emerald-500' : fuelPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';

  // Время
  const mins = Math.floor(Math.max(0, timeRemaining) / 60);
  const secs = Math.floor(Math.max(0, timeRemaining) % 60);
  const timeColor = timeRemaining > 60 ? 'text-white' : timeRemaining > 30 ? 'text-yellow-400' : 'text-red-400';

  // Режим захвата
  const captureStates: Record<string, { label: string; color: string; bg: string }> = {
    approaching: { label: 'СБЛИЖЕНИЕ', color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
    matching: { label: 'СИНХРОНИЗАЦИЯ', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
    capturing: { label: 'ЗАХВАТ!', color: 'text-orange-400', bg: 'bg-orange-500/20' },
    captured: { label: 'ЗАХВАЧЕНО', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    deorbiting: { label: 'СНИЖЕНИЕ ОРБИТЫ', color: 'text-red-400', bg: 'bg-red-500/20' },
    burning: { label: 'ГОРЕНИЕ!', color: 'text-red-500', bg: 'bg-red-500/30' },
    none: { label: '', color: '', bg: '' },
  };

  const capState = captureStates[captureState ?? 'none'] || captureStates.none;

  // Название вида камеры
  const cameraViewNames: Record<string, string> = {
    orbital: 'Орбитальный',
    cockpit: 'Кабина (1-е лицо)',
    tug: 'Преследование',
    target: 'Свободная камера',
  };

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Камера + Time warp — только десктоп */}
      {!isMobile && (
      <div className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-auto">
        <div className="flex items-center gap-3">
          {(['cockpit', 'tug', 'target', 'orbital'] as const).map((view) => (
            <button
              key={view}
              onClick={() => useGameStore.getState().setCameraView(view)}
              className={`px-1.5 py-0.5 rounded-md text-[9px] font-semibold tracking-wide transition-all border {
                cameraView === view
                  ? 'bg-cyan-500/30 border-cyan-400/60 text-cyan-300'
                  : 'bg-black/50 border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20'
              }`}
            >
              {view === 'cockpit' ? '1' : view === 'tug' ? '2' : view === 'target' ? '3' : '4'}
            </button>
          ))}
          <span className="text-[9px] text-gray-500 font-medium">
            {cameraViewNames[cameraView] || cameraView} (V)
          </span>
          {/* Separator */}
          <div className="w-px h-6 bg-white/10" />
          {/* Time warp */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => useGameStore.getState().decreaseTimeWarp()}
              disabled={timeWarpIndex <= 0}
              className={`w-7 h-7 rounded-lg border flex items-center justify-center text-sm font-bold transition-all ${
                timeWarpIndex <= 0
                  ? 'bg-black/40 border-white/5 text-gray-700 cursor-not-allowed'
                  : 'bg-gray-800 border-white/10 text-gray-300 hover:text-white hover:border-white/30 active:scale-95'
              }`}
            >
              −
            </button>
            <span className={`text-xs font-mono font-bold min-w-[60px] text-center ${
              timeWarp <= 1 ? 'text-cyan-400' :
              timeWarp <= 5 ? 'text-yellow-400' :
              'text-orange-400'
            }`}>
              ×{timeWarp.toLocaleString('en')}
            </span>
            <button
              onClick={() => useGameStore.getState().increaseTimeWarp()}
              disabled={timeWarpIndex >= 3}
              className={`w-7 h-7 rounded-lg border flex items-center justify-center text-sm font-bold transition-all ${
                timeWarpIndex >= 3
                  ? 'bg-black/40 border-white/5 text-gray-700 cursor-not-allowed'
                  : 'bg-gray-800 border-white/10 text-gray-300 hover:text-white hover:border-white/30 active:scale-95'
              }`}
            >
              +
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Прицел / перекрестие в виде из кабины */}
      {cameraView === 'cockpit' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {/* Рамка кабины (визуальный эффект 1-го лица) */}
          <div className="absolute inset-0">
            {/* Верхняя перекладина */}
            <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-black/40 to-transparent" />
            {/* Нижняя панель приборов */}
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/50 to-transparent" />
            {/* Боковые рамки */}
            <div className="absolute top-0 bottom-0 left-0 w-6 bg-gradient-to-r from-black/30 to-transparent" />
            <div className="absolute top-0 bottom-0 right-0 w-6 bg-gradient-to-l from-black/30 to-transparent" />
          </div>
          {/* Перекрестие прицела */}
          <div className="relative">
            <div className="w-8 h-px bg-cyan-400/50" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-8 bg-cyan-400/50" />
            <div className="absolute -top-1 -left-1 w-2 h-2 border-t border-l border-cyan-400/40" />
            <div className="absolute -top-1 -right-1 w-2 h-2 border-t border-r border-cyan-400/40" />
            <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b border-l border-cyan-400/40" />
            <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b border-r border-cyan-400/40" />
          </div>
        </div>
      )}

      {/* Индикатор тяги — только десктоп */}
      {thrust && !isMobile && (
        <div className="flex absolute top-1/2 left-4 -translate-y-1/2 flex-col items-center gap-1">
          <div className="w-2 h-16 bg-gray-800 rounded-full overflow-hidden">
            <div className="w-full h-3/4 bg-cyan-400 rounded-full animate-pulse" />
          </div>
          <span className="text-[9px] text-cyan-400 font-bold">ТЯГА</span>
        </div>
      )}
      {/* ═══════════════════════════════════════════════════════════════════════
           МОБИЛЬНЫЙ КОМПАКТНЫЙ HUD — один ультракомпактный ряд, max ~7% экрана
           ═══════════════════════════════════════════════════════════════════════ */}
      {isMobile && (
      <div className="absolute top-0 left-0 right-0 pointer-events-auto z-20">
        {/* Row 1: Single unified top bar — all essential info in one line */}
        <div className="flex items-center justify-between gap-0.5 px-1 py-0.5">
          {/* Fullscreen toggle */}
          <MobileFullscreenButton />
          {/* Telemetry block: H/V/i */}
          <div className="flex items-center gap-0.5 text-[8px] font-mono shrink-0">
            <span className="text-gray-500">H</span><span className="text-cyan-400 font-bold">{orbInfo.altitude.toFixed(0)}</span>
            <span className="text-gray-600">·</span>
            <span className="text-gray-500">V</span><span className="text-white">{orbInfo.speed.toFixed(0)}</span>
            <span className="text-gray-600">·</span>
            <span className="text-gray-500">i</span><span className="text-amber-400">{orbInfo.inclination.toFixed(1)}°</span>
          </div>
          {/* Fuel mini-bar */}
          <div className="flex items-center gap-1 shrink-0">
            <div className="w-8 h-1 bg-gray-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${fuelBg}`} style={{ width: `${Math.max(0, fuelPercent)}%` }} />
            </div>
            <span className={`text-[8px] font-mono font-bold ${fuelColor}`}>{fuelPercent.toFixed(0)}%</span>
          </div>
          {/* Timer */}
          <span className={`text-[10px] font-mono font-bold ${timeColor} shrink-0`}>{mins}:{secs.toString().padStart(2, '0')}</span>
          {/* Camera + Pause buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {(['cockpit', 'tug', 'target', 'orbital'] as const).map((view) => {
              const labels: Record<string, string> = { cockpit: '📷', tug: '🚀', target: '🎯', orbital: '🌍' };
              const nums: Record<string, string> = { cockpit: '1', tug: '2', target: '3', orbital: '4' };
              return (
                <button
                  key={view}
                  onTouchStart={(e) => { e.preventDefault(); useGameStore.getState().setCameraView(view); }}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                    cameraView === view
                      ? 'bg-cyan-500/30 border border-cyan-400/60 shadow-sm shadow-cyan-500/20'
                      : 'bg-black/60 border border-white/15 active:bg-white/10'
                  }`}
                  title={`${nums[view]} — Камера`}
                >
                  <span className="text-sm leading-none">{labels[view]}</span>
                </button>
              );
            })}
            <button
              onTouchStart={(e) => { e.preventDefault(); useGameStore.getState().pauseGame(); }}
              className="w-8 h-8 rounded-lg bg-black/60 border border-white/15 flex items-center justify-center active:bg-white/10 transition-all"
              title="Пауза"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="2" y="1.5" width="3" height="9" rx="0.5" fill="#9ca3af" />
                <rect x="7" y="1.5" width="3" height="9" rx="0.5" fill="#9ca3af" />
              </svg>
            </button>
          </div>
        </div>

        {/* Row 2: Status bar — contextual info (janitor: target/distance, nanosat: target orbit) */}
        <div className="flex items-center justify-between gap-1 px-1 pb-0.5">
          {/* Mission multi-target indicator */}
          {isMultiTarget && (
            <div className="flex items-center gap-1 text-[8px]">
              <span className="text-cyan-400 font-bold">{currentTargetIndex + 1}/{missionTargets.length}</span>
              <div className="flex gap-0.5">
                {missionTargets.map((_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-sm ${i < currentTargetIndex ? 'bg-emerald-500' : i === currentTargetIndex ? 'bg-cyan-400 animate-pulse' : 'bg-gray-700'}`} />
                ))}
              </div>
            </div>
          )}
          {/* Janitor: distance + proximity */}
          {gameMode === 'janitor' && !isMultiTarget && (
            <div className="flex items-center gap-1 text-[8px]">
              <span className="text-gray-500">D:</span>
              <span className={`font-mono font-bold ${distanceToTarget < 100000 ? 'text-emerald-400' : distanceToTarget < 150000 ? 'text-orange-400' : 'text-white'}`}>
                {distanceToTarget < 1000 ? `${Math.round(distanceToTarget)}м` : `${(distanceToTarget / 1000).toFixed(0)}км`}
              </span>
              {proximityLevel.label && (
                <span className={`${proximityLevel.bg} rounded px-1 text-[7px] font-bold ${proximityLevel.color} ${proximityLevel.level === 'warning' ? 'animate-pulse' : ''}`}>
                  {proximityLevel.label}
                </span>
              )}
            </div>
          )}
          {/* Janitor + multi: current target name */}
          {gameMode === 'janitor' && isMultiTarget && currentTargetDebris && (
            <div className="flex items-center gap-1 text-[8px]">
              <span className="text-gray-500">D:</span>
              <span className={`font-mono font-bold ${distanceToTarget < 100000 ? 'text-emerald-400' : 'text-white'}`}>
                {distanceToTarget < 1000 ? `${Math.round(distanceToTarget)}м` : `${(distanceToTarget / 1000).toFixed(0)}км`}
              </span>
              {proximityLevel.label && (
                <span className={`${proximityLevel.bg} rounded px-1 text-[7px] font-bold ${proximityLevel.color}`}>
                  {proximityLevel.label}
                </span>
              )}
            </div>
          )}
          {/* Nanosat: target orbit info */}
          {gameMode === 'nanosat' && (
            <div className="flex items-center gap-1 text-[8px]">
              <span className="text-yellow-400">{getTargetOrbitName()}</span>
              <span className="text-gray-600">·</span>
              <span className="text-gray-500">{getTargetAltitude()}км</span>
              <span className="text-gray-600">·</span>
              <span className="text-gray-500">±{getTargetTolerance()}км</span>
            </div>
          )}
          {/* Capture/deploy state indicator — compact */}
          {(capState.label && gameMode === 'janitor' && captureState !== 'capturing') && (
            <span className={`${capState.bg} rounded px-1.5 py-px text-[7px] font-bold ${capState.color}`}>
              {capState.label}
            </span>
          )}
          {/* Nanosat deployment states */}
          {gameMode === 'nanosat' && (deploymentState === 'aligning' || deploymentState === 'deploying') && (
            <div className="flex items-center gap-1">
              <span className="bg-orange-500/20 text-orange-400 rounded px-1.5 py-px text-[7px] font-bold">
                {deploymentState === 'aligning' ? 'СТЫКОВКА' : 'РАЗВЁРТЫВАНИЕ'}
              </span>
              <div className="w-10 h-1 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${((deploymentState === 'aligning' ? deployProgress : deployProgress) || 0) * 100}%` }} />
              </div>
            </div>
          )}
          {gameMode === 'nanosat' && (deploymentState === 'deployed' || deploymentState === 'undocked') && (
            <span className="bg-emerald-500/20 text-emerald-400 rounded px-1.5 py-px text-[7px] font-bold">
              {deploymentState === 'deployed' ? 'ОТСТЫКОВКА' : 'ЗАПУЩЕН ✓'}
            </span>
          )}
          {/* Time warp indicator */}
          {timeWarp > 1 && (
            <span className={`rounded px-1 py-px text-[7px] font-bold ${
              timeWarp <= 5 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-orange-500/20 text-orange-400'
            }`}>
              ×{timeWarp}
            </span>
          )}
        </div>
      </div>
      )}

      {/* Верхняя панель (только десктоп) */}
      {!isMobile && (
      <div className="absolute top-10 left-0 right-0 flex items-start justify-between px-4">
        {/* Лево: орбитальные параметры */}
        <div className="flex flex-col gap-2">
          <div className="bg-black/60 backdrop-blur-sm rounded-xl border border-white/10 p-1.5 min-w-[160px] pointer-events-auto">
            <h3 className="text-[10px] text-gray-500 font-semibold mb-1 tracking-wider">ОРБИТАЛЬНЫЕ ПАРАМЕТРЫ</h3>
            <div className="space-y-0.5">
              <ParamRow label="Высота" value={`${orbInfo.altitude.toFixed(1)} км`} color="text-cyan-400" />
              <ParamRow label="Апогей" value={`${orbInfo.apogee.toFixed(1)} км`} />
              <ParamRow label="Перигей" value={`${orbInfo.perigee.toFixed(1)} км`} />
              <ParamRow label="Наклонение" value={`${orbInfo.inclination.toFixed(2)}°`} />
              <ParamRow label="Эксцентриситет" value={orbInfo.eccentricity.toFixed(4)} />
              <ParamRow label="Скорость" value={`${orbInfo.speed.toFixed(0)} м/с`} />
              <ParamRow label="Период" value={`${orbInfo.period.toFixed(1)} мин`} />
            </div>
          </div>

          {/* Inclination compass — always visible */}
          <InclinationCompass />

          {/* Orbital elements of target nanosatellite (nanosat mode only) */}
          {gameMode === 'nanosat' && (
            <NanosatOrbitPanel />
          )}
        </div>

        {/* Центр: таймер и миссия */}
        <div className="text-center">
          <div className="bg-black/60 backdrop-blur-sm rounded-xl border border-white/10 px-3 py-1.5">
            <p className="text-[10px] text-gray-500 mb-0.5">{mission?.name || 'Миссия'}</p>
            <p className={`text-xl font-mono font-bold ${timeColor}`}>
              {mins}:{secs.toString().padStart(2, '0')}
            </p>
          </div>
          {/* Индикатор множественных целей — только для мультимиссий */}
          {isMultiTarget && (
            <div className="mt-1.5 bg-black/60 backdrop-blur-sm rounded-lg border border-white/10 px-3 py-1">
              <div className="flex items-center justify-center gap-2">
                {/* Текст счётчика */}
                <span className="text-[10px] font-bold text-cyan-400">
                  {gameMode === 'janitor' ? '🎯' : '🛰'}{' '}
                  {gameMode === 'janitor' ? 'Цель' : 'Спутник'}{' '}
                  <span className="font-mono text-white">{currentTargetIndex + 1}</span>
                  <span className="text-gray-500">/</span>
                  <span className="font-mono text-gray-300">{missionTargets.length}</span>
                </span>
                {/* Индикатор точек */}
                <div className="flex items-center gap-0.5">
                  {missionTargets.map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-sm transition-all duration-300 ${
                        i < currentTargetIndex
                          ? 'bg-emerald-500'
                          : i === currentTargetIndex
                            ? 'bg-cyan-400 animate-pulse'
                            : 'bg-gray-700'
                      }`}
                    />
                  ))}
                </div>
                {/* Дополнительная информация */}
                <div className="w-px h-3 bg-white/10" />
                <span className="text-[10px] text-gray-400">
                  {gameMode === 'janitor'
                    ? `${capturedMassKg.toLocaleString('ru-RU')} кг убрано`
                    : `${deployedSats} запущено`
                  }
                </span>
              </div>
              {/* Текущая цель — название обломка (janitor mode) */}
              {gameMode === 'janitor' && currentTargetDebris && (
                <div className="mt-1 flex items-center justify-center gap-2">
                  <span className="text-[9px] text-gray-500">Текущая цель:</span>
                  <span className="text-[10px] text-white font-medium">{currentTargetDebris.name}</span>
                  <span className="text-[9px] text-gray-600">•</span>
                  <span className="text-[9px] text-gray-400">{currentTargetDebris.mass.toLocaleString('ru-RU')} кг</span>
                </div>
              )}
            </div>
          )}
          {/* Состояние захвата — стандартные состояния */}
          {capState.label && gameMode === 'janitor' && captureState !== 'capturing' && (
            <div className={`mt-2 ${capState.bg} rounded-lg px-4 py-1.5 border border-white/10`}>
              <p className={`text-sm font-bold ${capState.color}`}>{capState.label}</p>
            </div>
          )}
          {/* Состояние развёртывания */}
          {gameMode === 'nanosat' && deploymentState === 'aligning' && (
            <div className="mt-2 bg-orange-500/20 rounded-lg px-4 py-1.5 border border-white/10">
              <p className="text-sm font-bold text-orange-400">СТЫКОВКА...</p>
              <div className="mt-1.5 w-32 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-orange-400 rounded-full transition-all duration-200"
                  style={{ width: `${(deployProgress || 0) * 100}%` }} />
              </div>
            </div>
          )}
          {gameMode === 'nanosat' && deploymentState === 'deploying' && (
            <div className="mt-2 bg-orange-500/20 rounded-lg px-4 py-1.5 border border-white/10">
              <p className="text-sm font-bold text-orange-400">РАЗВЁРТЫВАНИЕ...</p>
              <div className="mt-1.5 w-32 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-400 rounded-full transition-all duration-200"
                  style={{ width: `${(deployProgress || 0) * 100}%` }} />
              </div>
            </div>
          )}
          {gameMode === 'nanosat' && (deploymentState === 'deployed' || deploymentState === 'undocked') && (
            <div className="mt-2 bg-emerald-500/20 rounded-lg px-4 py-1.5 border border-white/10">
              <p className="text-sm font-bold text-emerald-400">
                {deploymentState === 'deployed' ? '✓ ОТСТЫКОВКА...' : '✓ ЗАПУЩЕН!'}
              </p>
              {deploymentState === 'undocked' && (
                <p className="text-emerald-300/70 text-[10px] mt-1">НАЖМИТЕ SPACE ДЛЯ ПРОДОЛЖЕНИЯ</p>
              )}
            </div>
          )}
        </div>

        {/* Право: управление + информация о цели + кнопки */}
        <div className="flex flex-col gap-2">
          {/* Управление высотой и наклонением */}
          <div className="bg-black/60 backdrop-blur-sm rounded-xl border border-white/10 p-1.5 min-w-[150px] pointer-events-auto">
            {/* Altitude control */}
            <div className="mb-1.5">
              <span className="text-[8px] text-emerald-400/70 font-semibold tracking-wider">ВЫСОТА</span>
              <div className="flex items-center gap-1 mt-1">
                <button
                  onClick={() => useGameStore.getState().requestAltitudeChange(-10)}
                  className="flex-1 h-6 rounded-lg border flex items-center justify-center text-xs font-bold transition-all bg-gray-800 border-red-400/30 text-red-300 hover:text-red-200 hover:border-red-400/50 hover:bg-red-500/10 active:scale-95"
                  title="Снизить орбиту (−10 км)"
                >
                  −10
                </button>
                <button
                  onClick={() => useGameStore.getState().requestAltitudeChange(10)}
                  className="flex-1 h-6 rounded-lg border flex items-center justify-center text-xs font-bold transition-all bg-gray-800 border-emerald-400/30 text-emerald-300 hover:text-emerald-200 hover:border-emerald-400/50 hover:bg-emerald-500/10 active:scale-95"
                  title="Повысить орбиту (+10 км)"
                >
                  +10 км
                </button>
              </div>
            </div>
            {/* Inclination control */}
            <div>
              <span className="text-[8px] text-amber-400/70 font-semibold tracking-wider">НАКЛОНЕНИЕ</span>
              <div className="flex items-center gap-1 mt-1">
                <button
                  onClick={() => useGameStore.getState().requestInclinationChange(-1)}
                  className="flex-1 h-6 rounded-lg border flex items-center justify-center text-xs font-bold transition-all bg-gray-800 border-orange-400/30 text-orange-300 hover:text-orange-200 hover:border-orange-400/50 hover:bg-orange-500/10 active:scale-95"
                  title="Уменьшить наклонение (−1°)"
                >
                  −1°
                </button>
                <button
                  onClick={() => useGameStore.getState().requestInclinationChange(1)}
                  className="flex-1 h-6 rounded-lg border flex items-center justify-center text-xs font-bold transition-all bg-gray-800 border-amber-400/30 text-amber-300 hover:text-amber-200 hover:border-amber-400/50 hover:bg-amber-500/10 active:scale-95"
                  title="Увеличить наклонение (+1°)"
                >
                  +1°
                </button>
              </div>
            </div>
          </div>

          {/* Satellite count selector (nanosat mode only) */}
          {gameMode === 'nanosat' && (
            <div className="bg-black/60 backdrop-blur-sm rounded-xl border border-cyan-500/20 p-1.5 min-w-[150px] pointer-events-auto">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[10px] text-gray-500 font-semibold tracking-wider">СПУТНИКИ</h3>
                <span className="text-[8px] text-gray-600">Выбор</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">Запущено:</span>
                <span className="text-sm font-mono font-bold text-cyan-400">{deployedSats}/{selectedSatCount}</span>
              </div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs text-gray-400">Осталось:</span>
                <span className={`text-sm font-mono font-bold ${selectedSatCount - deployedSats > 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
                  {selectedSatCount - deployedSats}
                </span>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5, 6].map((count) => (
                  <button
                    key={count}
                    onClick={() => useGameStore.getState().setSelectedSatCount(count)}
                    disabled={deployedSats > 0}
                    className={`w-6 h-6 rounded-lg border text-xs font-bold font-mono transition-all flex items-center justify-center ${
                      selectedSatCount === count
                        ? 'bg-cyan-500/30 border-cyan-400/60 text-cyan-300'
                        : deployedSats > 0
                          ? 'bg-black/30 border-white/5 text-gray-700 cursor-not-allowed'
                          : 'bg-black/40 border-white/10 text-gray-400 hover:text-gray-200 hover:border-white/20'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-black/60 backdrop-blur-sm rounded-xl border border-white/10 p-1.5 min-w-[150px]">
            <h3 className="text-[10px] text-gray-500 font-semibold mb-1 tracking-wider">
              {gameMode === 'janitor' ? 'ЦЕЛЬ' : 'СПУТНИК'}
            </h3>
            {gameMode === 'janitor' && (
              <div className="space-y-0.5">
                <p className="text-white text-xs mb-1">{getDebrisName(currentTargetId)}</p>
                {/* Индикатор близости */}
                {proximityLevel.label && (
                  <div className={`${proximityLevel.bg} rounded-md px-2 py-0.5 mb-1 text-center`}>
                    <p className={`text-[10px] font-bold ${proximityLevel.color} ${proximityLevel.level === 'warning' ? 'animate-pulse' : ''}`}>
                      {proximityLevel.label}
                    </p>
                  </div>
                )}
                <ParamRow label="Расстояние" value={formatDistance(distanceToTarget)} color={distanceToTarget < 100000 ? 'text-emerald-400' : distanceToTarget < 150000 ? 'text-orange-400' : distanceToTarget < 200000 ? 'text-yellow-400' : 'text-white'} />
                <ParamRow label="V отн." value={`${relativeSpeed < 1000 ? `${relativeSpeed.toFixed(1)} м/с` : `${(relativeSpeed / 1000).toFixed(2)} км/с`}`} color={relativeSpeed < CAPTURE_SPEED_LIMIT_DISPLAY ? 'text-emerald-400' : relativeSpeed < CAPTURE_SPEED_LIMIT_DISPLAY * 2 ? 'text-yellow-400' : 'text-red-400'} />
                {/* Активный тип захвата с индикатором */}
                <div className={`flex justify-between items-center rounded-md px-1.5 py-0.5 ${
                  captureType === 'harpoon' ? 'bg-red-500/10 border border-red-500/30' :
                  captureType === 'manipulator' ? 'bg-cyan-500/10 border border-cyan-500/30' :
                  captureType === 'net' ? 'bg-emerald-500/10 border border-emerald-500/30' :
                  'bg-gray-800/50'
                }`}>
                  <span className="text-gray-500 text-xs">Тип захвата</span>
                  <span className={`text-xs font-bold ${
                    captureType === 'harpoon' ? 'text-red-400' :
                    captureType === 'manipulator' ? 'text-cyan-400' :
                    captureType === 'net' ? 'text-emerald-400' :
                    'text-gray-400'
                  }`}>
                    {captureType === 'harpoon' ? '🎯 Гарпун' :
                     captureType === 'manipulator' ? '🦾 Манипулятор' :
                     captureType === 'net' ? '🕸️ Сеть' :
                     'Не выбран'}
                  </span>
                </div>
                {capturedDebris.length > 0 && (
                  <ParamRow label="Захвачено" value={`${capturedDebris.length} объектов`} color="text-emerald-400" />
                )}
              </div>
            )}
            {gameMode === 'nanosat' && (
              <div className="space-y-1.5">
                <ParamRow label="CubeSat" value={cubeSatType || '-'} color="text-cyan-400" />
                <ParamRow label="Целевая орбита" value={getTargetOrbitName()} color="text-yellow-400" />
                <ParamRow label="Целевая высота" value={`${getTargetAltitude()} км`} color="text-yellow-400" />
                <ParamRow label="Допуск" value={`±${getTargetTolerance()} км`} color="text-gray-400" />
                <ParamRow label="Состояние" value={deployStateName()} />
              </div>
            )}
          </div>

          {/* Селектор типа захвата (janitor) */}
          {gameMode === 'janitor' && (
            <div className="bg-black/60 backdrop-blur-sm rounded-xl border border-white/10 p-1.5 min-w-[150px]">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[10px] text-gray-500 font-semibold tracking-wider">МЕХАНИЗМ ЗАХВАТА</h3>
                <span className="text-[9px] text-gray-600">TAB</span>
              </div>
              <div className="flex gap-1">
                {([
                  { type: 'harpoon' as const, icon: '🎯', label: 'Гарпун', desc: 'Для крупных объектов' },
                  { type: 'manipulator' as const, icon: '🦾', label: 'Манипулятор', desc: 'Точное захват' },
                  { type: 'net' as const, icon: '🕸️', label: 'Сеть', desc: 'Для быстро вращающихся' },
                ]).map((opt) => (
                  <button
                    key={opt.type}
                    onClick={() => useGameStore.getState().setCaptureType(opt.type)}
                    onMouseEnter={() => setHoveredCaptureType(opt.type)}
                    onMouseLeave={() => setHoveredCaptureType(null)}
                    className={`relative flex-1 rounded-lg border px-1 py-1 text-center transition-all ${
                      captureType === opt.type
                        ? opt.type === 'harpoon' ? 'bg-red-500/20 border-red-400/60 text-red-300' :
                          opt.type === 'manipulator' ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-300' :
                          'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                        : 'bg-black/40 border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20'
                    }`}
                  >
                    {/* Индикатор активного типа — точка сверху */}
                    {captureType === opt.type && (
                      <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 border-black/50 animate-pulse"
                        style={{ backgroundColor: opt.type === 'harpoon' ? '#ef4444' : opt.type === 'manipulator' ? '#22d3ee' : '#34d399' }}
                      />
                    )}
                    <div className="text-sm leading-none mb-0.5">{opt.icon}</div>
                    <div className="text-[9px] font-semibold leading-tight">{opt.label}</div>
                  </button>
                ))}
              </div>
              {/* Кольцо дистанции захвата + описание */}
              <div className="mt-2 flex items-center gap-2.5">
                {/* Кольцо дистанции */}
                <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
                  {/* Фон кольца */}
                  <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                  {/* Заливка кольца (зависит от дистанции) */}
                  {captureRingFill > 0 && (
                    <circle
                      cx="22" cy="22" r="18" fill="none"
                      stroke={distanceToTarget < 30000 ? '#34d399' : distanceToTarget < 60000 ? '#facc15' : '#fb923c'}
                      strokeWidth="3" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 18}`}
                      strokeDashoffset={`${2 * Math.PI * 18 * (1 - captureRingFill)}`}
                      transform="rotate(-90 22 22)"
                      className="transition-all duration-300"
                    />
                  )}
                  {/* Текст дистанции */}
                  <text x="22" y="18" textAnchor="middle" fill={distanceToTarget < 100000 ? '#34d399' : '#9ca3af'} className="text-[9px] font-mono" fontSize="7" fontWeight="bold">
                    {distanceToTarget < 1000 ? `${Math.round(distanceToTarget)}` : `${(distanceToTarget / 1000).toFixed(0)}`}
                  </text>
                  <text x="22" y="29" textAnchor="middle" fill={distanceToTarget < 100000 ? '#34d399' : '#6b7280'} fontSize="6">
                    {distanceToTarget < 1000 ? 'м' : 'км'}
                  </text>
                </svg>
                <div className="flex-1">
                  <p className={`text-[9px] font-semibold leading-tight ${
                    hoveredCaptureType
                      ? hoveredCaptureType === 'harpoon' ? 'text-red-400' :
                        hoveredCaptureType === 'manipulator' ? 'text-cyan-400' :
                        'text-emerald-400'
                      : 'text-gray-500'
                  }`}>
                    {hoveredCaptureType
                      ? captureTypeDescriptions[hoveredCaptureType]?.short || 'Выберите механизм'
                      : captureTypeDescriptions[captureType || '']?.short || 'Выберите механизм'
                    }
                  </p>
                  {hoveredCaptureType && captureTypeDescriptions[hoveredCaptureType] && (
                    <p className="text-[8px] text-gray-400 mt-0.5 leading-tight">
                      {captureTypeDescriptions[hoveredCaptureType].detailed}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Кнопки справа */}
          <div className="flex gap-2 pointer-events-auto">
            <HUDButton
              onClick={() => useGameStore.getState().toggleFormulas()}
              active={showFormulas}
              icon={
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 4 L6 4 L4 7 L8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="9" cy="3" r="2" stroke="currentColor" strokeWidth="1" fill="none" />
                  <path d="M5 10 C5 10 6 12 7 10 C8 8 9 10 9 10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                </svg>
              }
              tooltip="Формулы"
            />
            {gameMode === 'janitor' && (
              <HUDButton
                onClick={() => useGameStore.getState().toggleKnowledgePanel()}
                active={showKnowledgePanel}
                icon={
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    <line x1="7" y1="6" x2="7" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="7" cy="4.5" r="0.5" fill="currentColor" />
                  </svg>
                }
                tooltip="Справка"
              />
            )}
          </div>
        </div>
      </div>
      )}

      {/* Случайное событие — уведомление */}
      {activeEvent !== 'none' && (
        <div className={`absolute ${isMobile ? 'top-12' : 'top-14'} left-1/2 -translate-x-1/2 pointer-events-none z-50`}>
          <div className={`border rounded-lg px-4 py-2 text-center animate-pulse ${
            activeEvent === 'solarFlare' ? 'bg-yellow-500/20 border-yellow-400/40' :
            activeEvent === 'micrometeorite' ? 'bg-orange-500/20 border-orange-400/40' :
            'bg-red-500/20 border-red-400/40'
          }`}>
            <p className={`text-sm font-bold ${
              activeEvent === 'solarFlare' ? 'text-yellow-400' :
              activeEvent === 'micrometeorite' ? 'text-orange-400' :
              'text-red-400'
            }`}>
              {activeEvent === 'solarFlare' && '⚠️ СОЛНЕЧНАЯ ВСПЫШКА'}
              {activeEvent === 'micrometeorite' && '☄️ МИКРОМЕТЕОРИТ'}
              {activeEvent === 'engineFailure' && '🔧 СБОЙ ДВИГАТЕЛЯ'}
            </p>
            <p className={`text-[10px] mt-0.5 ${
              activeEvent === 'solarFlare' ? 'text-yellow-300/70' :
              activeEvent === 'micrometeorite' ? 'text-orange-300/70' :
              'text-red-300/70'
            }`}>
              {activeEvent === 'solarFlare' && 'Повышенная радиация, панели работают на 60%'}
              {activeEvent === 'micrometeorite' && 'Микроудар по корпусу, начальная скорость изменена'}
              {activeEvent === 'engineFailure' && 'Двигатель работает с пониженной тягой'}
            </p>
          </div>
        </div>
      )}

      {/* Подсказка действия (внизу по центру) — только десктоп */}
      {!isMobile && (
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 pointer-events-none">
        {canCapture && gameMode === 'janitor' && (
          <div className="bg-emerald-500/20 border border-emerald-400/40 rounded-lg px-6 py-3 text-center animate-pulse">
            <p className="text-emerald-400 text-sm font-bold">НАЖМИТЕ <kbd className="px-1.5 py-0.5 bg-emerald-500/30 rounded text-emerald-300 text-xs font-mono mx-1">SPACE</kbd> ДЛЯ ЗАХВАТА</p>
            <p className="text-emerald-300/70 text-[10px] mt-1">Сближение завершено, относительная скорость в допуске</p>
          </div>
        )}
        {gameMode === 'nanosat' && (deploymentState === 'approaching') && (
          <div className={`border rounded-lg px-6 py-3 text-center pointer-events-none ${
            canDeploy
              ? 'bg-cyan-500/20 border-cyan-400/40 animate-pulse'
              : 'bg-gray-500/20 border-gray-400/40'
          }`}>
            <button
              onClick={() => {
                const gs = useGameStore.getState();
                if (gs.canDeploy) gs.setDeploymentState('aligning');
              }}
              className="w-full pointer-events-auto"
              disabled={!canDeploy}
            >
              <p className={`text-sm font-bold ${canDeploy ? 'text-cyan-400' : 'text-gray-500'}`}>
                {canDeploy ? (
                  <>НАЖМИТЕ <kbd className="px-1.5 py-0.5 bg-cyan-500/30 rounded text-cyan-300 text-xs font-mono mx-1">SPACE</kbd> ДЛЯ СТЫКОВКИ</>
                ) : (
                  'ВЫВЕДИТЕ НА ЦЕЛЕВУЮ ОРБИТУ'
                )}
              </p>
              <p className={`text-[10px] mt-1 ${canDeploy ? 'text-cyan-300/70' : 'text-gray-500'}`}>
                {canDeploy ? 'Орбита в допуске — начните стыковку' : `Допуск: ±${getTargetTolerance()} км по высоте`}
              </p>
            </button>
          </div>
        )}
        {gameMode === 'nanosat' && deploymentState === 'aligning' && (
          <div className="bg-orange-500/20 border border-orange-400/40 rounded-lg px-6 py-3 text-center pointer-events-none">
            <p className="text-orange-400 text-sm font-bold">СТЫКОВКА... {((deployProgress || 0) * 100).toFixed(0)}%</p>
            <p className="text-orange-300/70 text-[10px] mt-1">Выравнивание орбиты и стыковка спутника</p>
          </div>
        )}
        {gameMode === 'nanosat' && deploymentState === 'deploying' && (
          <div className="bg-orange-500/20 border border-orange-400/40 rounded-lg px-6 py-3 text-center pointer-events-none">
            <p className="text-orange-400 text-sm font-bold">РАЗВЁРТЫВАНИЕ... {((deployProgress || 0) * 100).toFixed(0)}%</p>
          </div>
        )}
        {gameMode === 'nanosat' && deploymentState === 'deployed' && (
          <div className="bg-emerald-500/20 border border-emerald-400/40 rounded-lg px-6 py-3 text-center pointer-events-none">
            <p className="text-emerald-400 text-sm font-bold">✓ ОТСТЫКОВКА...</p>
            <p className="text-emerald-300/70 text-[10px] mt-1">Наноспутник отделяется от буксира</p>
          </div>
        )}
        {gameMode === 'nanosat' && deploymentState === 'undocked' && (
          <div className="bg-emerald-500/20 border border-emerald-400/40 rounded-lg px-6 py-3 text-center pointer-events-auto">
            <button
              onClick={() => {
                const gs = useGameStore.getState();
                const remaining = (gs.selectedSatCount || 1) - gs.deployedSats;
                if (remaining > 0) {
                  gs.setDeploymentState('approaching');
                } else {
                  const mission = gs.currentMissionId ? getMissionById(gs.currentMissionId) : null;
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
              }}
              className="w-full"
            >
              <p className="text-emerald-400 text-sm font-bold">✓ НАНОСПУТНИК ЗАПУЩЕН!</p>
              <p className="text-emerald-300/70 text-[10px] mt-1">НАЖМИТЕ <kbd className="px-1.5 py-0.5 bg-emerald-500/30 rounded text-emerald-300 text-xs font-mono mx-1">SPACE</kbd> ДЛЯ ПРОДОЛЖЕНИЯ</p>
            </button>
          </div>
        )}
        {captureState === 'captured' && gameMode === 'janitor' && (
          <div className="bg-emerald-500/20 border border-emerald-400/40 rounded-lg px-6 py-3 text-center">
            <p className="text-emerald-400 text-sm font-bold">НАЖМИТЕ <kbd className="px-1.5 py-0.5 bg-emerald-500/30 rounded text-emerald-300 text-xs font-mono mx-1">SPACE</kbd> ДЛЯ СНИЖЕНИЯ ОРБИТЫ</p>
            <p className="text-emerald-300/70 text-[10px] mt-1">Мусор захвачен. Тормозной импульс для входа в атмосферу</p>
          </div>
        )}
      </div>
      )}

      {/* Нижняя панель — только десктоп */}
      {!isMobile && (
      <div className="flex absolute bottom-0 left-0 right-0 items-end justify-between p-4">
        {/* Лево: топливо */}
        <div className="bg-black/60 backdrop-blur-sm rounded-xl border border-white/10 p-1.5 min-w-[130px]">
          <h3 className="text-[10px] text-gray-500 font-semibold mb-1 tracking-wider">ТОПЛИВО</h3>
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-0.5">
            <div
              className={`h-full ${fuelBg} rounded-full transition-all duration-300`}
              style={{ width: `${Math.max(0, fuelPercent)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs">
            <span className={fuelColor}>{fuelPercent.toFixed(1)}%</span>
            <span className="text-gray-400">{fuelMass.toFixed(0)} кг</span>
          </div>
          <div className="mt-2 pt-2 border-t border-white/10">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">ΔV осталось</span>
              <span className={fuelColor}>{(maxDv - usedDeltaV).toFixed(0)} м/с</span>
            </div>
          </div>
        </div>

        {/* Центр: пусто — упрощённая нижняя панель */}

        {/* Право: индикатор ввода */}
        <div className="bg-black/60 backdrop-blur-sm rounded-xl border border-white/10 px-2 py-1.5 flex items-center gap-2 min-w-[100px]">
          {gamepadConnected ? (
            <>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="4" width="16" height="12" rx="3" stroke="#4ade80" strokeWidth="1.5" fill="none" />
                <circle cx="6" cy="9" r="1.5" fill="#4ade80" />
                <circle cx="12" cy="7" r="1" fill="#4ade80" />
                <circle cx="14" cy="9" r="1" fill="#4ade80" />
                <circle cx="12" cy="11" r="1" fill="#4ade80" />
              </svg>
              <div>
                <p className="text-xs text-emerald-400 font-medium">Gamepad</p>
                <p className="text-[10px] text-gray-500">Подключён</p>
              </div>
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="5" width="7" height="10" rx="1" stroke="#9ca3af" strokeWidth="1.5" fill="none" />
                <rect x="11" y="5" width="7" height="10" rx="1" stroke="#9ca3af" strokeWidth="1.5" fill="none" />
                <line x1="4" y1="8" x2="7" y2="8" stroke="#9ca3af" strokeWidth="1" />
                <line x1="13" y1="12" x2="16" y2="12" stroke="#9ca3af" strokeWidth="1" />
                <line x1="14.5" y1="10.5" x2="14.5" y2="13.5" stroke="#9ca3af" strokeWidth="1" />
              </svg>
              <div>
                <p className="text-xs text-gray-400 font-medium">По умолчанию</p>
                <p className="text-[10px] text-gray-600">Управление</p>
              </div>
            </>
          )}
        </div>
      </div>
      )}

      {/* Драматическая анимация ЗАХВАТ В ПРОЦЕССЕ */}
      {captureState === 'capturing' && gameMode === 'janitor' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          {/* Полупрозрачный фон */}
          <div className="absolute inset-0 bg-orange-500/5" />
          {/* Радиальное кольцо прогресса */}
          <div className="relative">
            <svg width="200" height="200" viewBox="0 0 200 200" className="drop-shadow-lg">
              {/* Фоновое кольцо */}
              <circle cx="100" cy="100" r="85" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
              {/* Кольцо прогресса */}
              <circle
                cx="100" cy="100" r="85" fill="none"
                stroke={captureProgress !== undefined && captureProgress > 0.7 ? '#34d399' : '#fb923c'}
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 85}`}
                strokeDashoffset={`${2 * Math.PI * 85 * (1 - (captureProgress || 0))}`}
                transform="rotate(-90 100 100)"
                className="transition-all duration-200"
              />
              {/* Внутреннее кольцо — тонкий декоративный */}
              <circle cx="100" cy="100" r="75" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4 4" />
            </svg>
            {/* Текст внутри кольца */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-orange-400 text-lg font-black tracking-[0.2em] animate-pulse">
                ЗАХВАТ
              </p>
              <p className="text-orange-300/70 text-[10px] font-bold tracking-[0.3em] mt-0.5">
                В ПРОЦЕССЕ
              </p>
              <p className="text-white font-mono text-2xl font-bold mt-2">
                {((captureProgress || 0) * 100).toFixed(0)}%
              </p>
              {/* Индикатор типа захвата */}
              <div className="mt-1.5 flex items-center gap-1">
                <span className="text-sm">
                  {captureType === 'harpoon' ? '🎯' : captureType === 'manipulator' ? '🦾' : '🕸️'}
                </span>
                <span className="text-[9px] text-gray-400 font-semibold">
                  {captureType === 'harpoon' ? 'Гарпун' : captureType === 'manipulator' ? 'Манипулятор' : 'Сеть'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Панель формул — адаптивная для мобильных */}
      {showFormulas && (
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 backdrop-blur-md rounded-xl border border-white/10 overflow-y-auto pointer-events-auto ${isMobile ? 'p-3 w-[calc(100%-1.5rem)] max-h-[60vh]' : 'p-4 max-w-md max-h-[50vh]'}`}>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white font-bold">Формулы орбитальной механики</h3>
            <button onClick={() => useGameStore.getState().toggleFormulas()} className="text-gray-400 hover:text-white">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4 L4 12 M4 4 L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
          {PHYSICS_FORMULAS.map((f, i) => (
            <div key={i} className="mb-4">
              <p className="text-cyan-400 text-sm font-semibold">{f.name}</p>
              <p className="text-white font-mono text-sm my-1 bg-white/5 p-2 rounded">{f.formula}</p>
              <p className="text-gray-400 text-xs">{f.description}</p>
              <p className="text-gray-600 text-xs mt-1 italic">{f.variables}</p>
            </div>
          ))}
        </div>
      )}

      {/* Панель знаний (о мусоре) */}
      {showKnowledgePanel && gameMode === 'janitor' && <KnowledgePanel />}
    </div>
  );
}

/** Кнопка на HUD */
/** Panel showing target nanosatellite orbital elements for operator guidance */
function NanosatOrbitPanel() {
  const orbInfo = useGameStore(s => s.orbitalInfo);
  const currentMissionId = useGameStore(s => s.currentMissionId);

  const mission = currentMissionId ? getMissionById(currentMissionId) : null;
  if (!mission || mission.mode !== 'nanosat') return null;

  const nm = mission as any;
  const targetOrbit = ORBIT_TYPES[nm.targetOrbitId];
  if (!targetOrbit) return null;

  const targetAltKm = targetOrbit.altitude / 1000;
  const targetIncDeg = targetOrbit.inclination;
  const altTol = nm.tolerance?.altitude || 15;
  const incTol = nm.tolerance?.inclination || 2;

  // Compute deviation from target orbit
  const altDeviation = orbInfo.altitude - targetAltKm;
  const incDeviation = orbInfo.inclination - targetIncDeg;

  // Color coding based on tolerance
  const altInTolerance = Math.abs(altDeviation) < altTol;
  const incInTolerance = Math.abs(incDeviation) < incTol;

  const altColor = altInTolerance ? 'text-emerald-400' : Math.abs(altDeviation) < altTol * 2 ? 'text-yellow-400' : 'text-red-400';
  const incColor = incInTolerance ? 'text-emerald-400' : Math.abs(incDeviation) < incTol * 2 ? 'text-yellow-400' : 'text-red-400';

  const altBg = altInTolerance ? 'bg-emerald-500/10 border-emerald-500/30' : Math.abs(altDeviation) < altTol * 2 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-red-500/10 border-red-500/30';
  const incBg = incInTolerance ? 'bg-emerald-500/10 border-emerald-500/30' : Math.abs(incDeviation) < incTol * 2 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-red-500/10 border-red-500/30';

  const allInTolerance = altInTolerance && incInTolerance;

  return (
    <div className="bg-black/60 backdrop-blur-sm rounded-xl border border-yellow-500/20 p-1.5 min-w-[160px]">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[10px] text-gray-500 font-semibold tracking-wider">ЦЕЛЕВАЯ ОРБИТА</h3>
        <span className={`text-[9px] font-bold ${allInTolerance ? 'text-emerald-400' : 'text-yellow-500'}`}>
          {allInTolerance ? '✓ В ДОПУСКЕ' : 'НАВЕДЕНИЕ'}
        </span>
      </div>

      {/* Target orbit parameters */}
      <div className="space-y-1 mb-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-gray-500">Тип орбиты</span>
          <span className="text-xs font-bold text-yellow-400">{getTargetOrbitName()}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-gray-500">Целевая высота</span>
          <span className="text-xs font-mono font-bold text-yellow-300">{targetAltKm.toFixed(0)} км</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-gray-500">Целевое наклонение</span>
          <span className="text-xs font-mono font-bold text-yellow-300">{targetIncDeg.toFixed(1)}°</span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-white/10 my-2" />

      {/* Current vs Target comparison */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-gray-500">Текущая высота</span>
          <span className={`text-xs font-mono font-bold ${altColor}`}>{orbInfo.altitude.toFixed(1)} км</span>
        </div>
        {/* Altitude deviation bar */}
        <div className={`flex items-center gap-2 rounded-md px-2 py-1 border ${altBg}`}>
          <span className="text-[9px] text-gray-500 w-12 shrink-0">ΔH</span>
          <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden relative">
            {/* Center marker */}
            <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-white/30" />
            {/* Deviation bar */}
            <div
              className={`absolute top-0 h-full rounded-full transition-all duration-200 ${altInTolerance ? 'bg-emerald-500' : 'bg-yellow-500'}`}
              style={{
                left: altDeviation >= 0 ? '50%' : `${50 + (altDeviation / (altTol * 3)) * 50}%`,
                width: `${Math.min(50, (Math.abs(altDeviation) / (altTol * 3)) * 50)}%`,
              }}
            />
          </div>
          <span className={`text-[9px] font-mono font-bold w-14 text-right ${altColor}`}>
            {altDeviation >= 0 ? '+' : ''}{altDeviation.toFixed(1)} км
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-[10px] text-gray-500">Текущее наклонение</span>
          <span className={`text-xs font-mono font-bold ${incColor}`}>{orbInfo.inclination.toFixed(2)}°</span>
        </div>
        {/* Inclination deviation bar */}
        <div className={`flex items-center gap-2 rounded-md px-2 py-1 border ${incBg}`}>
          <span className="text-[9px] text-gray-500 w-12 shrink-0">Δi</span>
          <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden relative">
            <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-white/30" />
            <div
              className={`absolute top-0 h-full rounded-full transition-all duration-200 ${incInTolerance ? 'bg-emerald-500' : 'bg-yellow-500'}`}
              style={{
                left: incDeviation >= 0 ? '50%' : `${50 + (incDeviation / (incTol * 3)) * 50}%`,
                width: `${Math.min(50, (Math.abs(incDeviation) / (incTol * 3)) * 50)}%`,
              }}
            />
          </div>
          <span className={`text-[9px] font-mono font-bold w-14 text-right ${incColor}`}>
            {incDeviation >= 0 ? '+' : ''}{incDeviation.toFixed(2)}°
          </span>
        </div>
      </div>

      {/* Tolerance info */}
      <div className="mt-2 pt-2 border-t border-white/10">
        <div className="flex justify-between text-[9px]">
          <span className="text-gray-600">Допуск: ±{altTol} км по высоте</span>
          <span className="text-gray-600">±{incTol}° по наклонению</span>
        </div>
      </div>
    </div>
  );
}

function HUDButton({ onClick, active, icon, tooltip }: {
  onClick: () => void;
  active: boolean;
  icon: React.ReactNode;
  tooltip: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-all ${
        active
          ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-400'
          : 'bg-black/60 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
      }`}
      title={tooltip}
    >
      {icon}
    </button>
  );
}

/** Mobile fullscreen toggle button — tiny, fits in top bar row */
function MobileFullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    // webkitfullscreenchange for iOS Safari
    document.addEventListener('webkitfullscreenchange', h as any);
    return () => {
      document.removeEventListener('fullscreenchange', h);
      document.removeEventListener('webkitfullscreenchange', h as any);
    };
  }, []);

  const toggleFullscreen = () => {
    try {
      const el = document.documentElement as any;
      if (!document.fullscreenElement && !el.webkitFullscreenElement) {
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (req) (req as any).call(el).catch(() => {});
      } else {
        const exit = document.exitFullscreen || (document as any).webkitExitFullscreen;
        if (exit) exit.call(document).catch(() => {});
      }
    } catch {}
  };
  return (
    <button
      onTouchStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFullscreen();
      }}
      className="w-5 h-5 rounded bg-black/50 border border-white/10 flex items-center justify-center shrink-0 active:scale-90 transition-all"
    >
      <svg width="8" height="8" viewBox="0 0 14 14" fill="none">
        {isFullscreen ? (
          <>
            <path d="M5 2 L2 2 L2 5" stroke="#9ca3af" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 2 L12 2 L12 5" stroke="#9ca3af" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 12 L2 12 L2 9" stroke="#9ca3af" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 12 L12 12 L12 9" stroke="#9ca3af" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          <>
            <path d="M2 4 L2 2 L4 2" stroke="#9ca3af" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M10 2 L12 2 L12 4" stroke="#9ca3af" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M2 10 L2 12 L4 12" stroke="#9ca3af" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M10 12 L12 12 L12 10" stroke="#9ca3af" strokeWidth="1.2" strokeLinecap="round" />
          </>
        )}
      </svg>
    </button>
  );
}

function ParamRow({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className={`text-sm font-mono ${color}`}>{value}</span>
    </div>
  );
}

function formatDistance(d: number): string {
  if (d > 1000) return `${(d / 1000).toFixed(2)} км`;
  return `${d.toFixed(1)} м`;
}

function getDebrisName(id: string | null): string {
  if (!id) return 'Не выбрана';
  const debris = getDebrisById(id);
  return debris?.name || id;
}

function captureTypeName(): string {
  const ct = useGameStore.getState().captureType;
  switch (ct) {
    case 'harpoon': return 'Гарпун';
    case 'manipulator': return 'Манипулятор';
    case 'net': return 'Сеть';
    default: return 'Не выбран';
  }
}

function deployStateName(): string {
  const ds = useGameStore.getState().deploymentState;
  switch (ds) {
    case 'approaching': return 'Сближение';
    case 'aligning': return 'Стыковка...';
    case 'deploying': return 'Развёртывание';
    case 'deployed': return 'Отстыковка...';
    case 'undocked': return 'Запущен ✓';
    default: return 'В полёте';
  }
}

function tsiolkovskyDv(): number {
  const store = useGameStore.getState();
  const spec = store.gameMode === 'nanosat' ? DEPLOYER_TUG : JANITOR_TUG;
  const g0 = 9.80665;
  return spec.isp * g0 * Math.log(spec.totalMass / spec.dryMass);
}

function getTargetOrbitName(): string {
  const gs = useGameStore.getState();
  const mission = gs.currentMissionId ? getMissionById(gs.currentMissionId) : null;
  if (!mission || mission.mode !== 'nanosat') return '-';
  const nm = mission as any;
  const orbitTypes: Record<string, string> = {
    LEO: 'НОО (400 км)',
    SSO: 'ССО (700 км)',
    POLAR: 'Полярная (800 км)',
    GTO: 'ГТО (35 786 км)',
  };
  return orbitTypes[nm.targetOrbitId] || nm.targetOrbitId;
}

function getTargetAltitude(): string {
  const gs = useGameStore.getState();
  const mission = gs.currentMissionId ? getMissionById(gs.currentMissionId) : null;
  if (!mission || mission.mode !== 'nanosat') return '-';
  const nm = mission as any;
  const target = ORBIT_TYPES[nm.targetOrbitId];
  return target ? (target.altitude / 1000).toFixed(0) : '?';
}

function getTargetTolerance(): string {
  const gs = useGameStore.getState();
  const mission = gs.currentMissionId ? getMissionById(gs.currentMissionId) : null;
  if (!mission || mission.mode !== 'nanosat') return '-';
  const nm = mission as any;
  return String(nm.tolerance?.altitude || 15);
}

function KnowledgePanel() {
  const isMobile = useIsMobile();
  const store = useGameStore.getState();
  const debris = store.currentTargetId ? getDebrisById(store.currentTargetId) : null;
  const fact = FUN_FACTS[Math.floor(Date.now() / 10000) % FUN_FACTS.length];

  return (
    <div className={`absolute top-1/2 ${isMobile ? 'left-1/2 -translate-x-1/2' : 'left-auto right-4 translate-x-0'} -translate-y-1/2 bg-black/80 backdrop-blur-md rounded-xl border border-white/10 overflow-y-auto pointer-events-auto ${isMobile ? 'p-3 w-[calc(100%-1.5rem)]' : 'p-4 max-w-sm'}`}>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-white font-bold">Информация</h3>
        <button onClick={() => useGameStore.getState().toggleKnowledgePanel()} className="text-gray-400 hover:text-white">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4 L4 12 M4 4 L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
      </div>

      {debris && (
        <div className="mb-4">
          <p className="text-cyan-400 font-semibold text-sm">{debris.name}</p>
          <p className="text-gray-300 text-xs mt-1">{debris.description}</p>
          <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
            <span className="text-gray-500">Страна:</span><span className="text-white">{debris.origin}</span>
            <span className="text-gray-500">Год:</span><span className="text-white">{debris.launchYear}</span>
            <span className="text-gray-500">Масса:</span><span className="text-white">{debris.mass} кг</span>
            <span className="text-gray-500">Причина:</span><span className="text-white">{debris.reason}</span>
          </div>
        </div>
      )}

      <div className="border-t border-white/10 pt-3">
        <p className="text-yellow-400 text-xs font-semibold mb-1">Знаете ли вы?</p>
        <p className="text-gray-300 text-xs">{fact}</p>
      </div>
    </div>
  );
}
