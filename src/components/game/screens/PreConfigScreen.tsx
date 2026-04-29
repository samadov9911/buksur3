/**
 * PreConfigScreen — конфигурация миссии перед стартом
 * Позволяет выбрать количество и параметры целей:
 *   - Наноспутники: тип орбиты, CubeSat, КЕО (апогей/перигей/наклонение/RAAN/ω) для каждого
 *   - Космический мусор: выбор объектов для утилизации, тип захвата
 *
 * Все элементы орбиты редактируемые. Выбор типа орбиты заполняет значения по умолчанию,
 * но игрок может их изменить для любого типа.
 */
'use client';

import { useState, useMemo } from 'react';
import { useGameStore } from '@/game/store/gameStore';
import { ORBIT_TYPES } from '@/game/engine/constants';
import { DEBRIS_DATABASE } from '@/game/data/debris';
import { DEPLOYER_TUG, JANITOR_TUG } from '@/game/data/satellites';
import { motion, AnimatePresence } from 'framer-motion';
import type { NanoSatTargetConfig, DebrisTargetConfig, MissionTargetConfig } from '@/game/store/gameStore';
import type { CaptureType } from '@/game/engine/constants';

const ORBIT_OPTIONS = Object.entries(ORBIT_TYPES).map(([key, val]) => ({
  id: key,
  name: val.nameRu,
  altitude: val.altitude / 1000,
  inclination: val.inclination,
}));

const CUBESAT_OPTIONS = [
  { type: '1U' as const, label: '1U', mass: '1.3 кг', desc: '10×10×11.3 см' },
  { type: '2U' as const, label: '2U', mass: '2.7 кг', desc: '10×10×22.7 см' },
  { type: '3U' as const, label: '3U', mass: '4.0 кг', desc: '10×10×34 см' },
];

const CAPTURE_TYPES: { type: CaptureType; label: string; icon: string }[] = [
  { type: 'harpoon', label: 'Гарпун', icon: '🏹' },
  { type: 'manipulator', label: 'Манипулятор', icon: '🦾' },
  { type: 'net', label: 'Сеть', icon: '🕸' },
];

export default function PreConfigScreen() {
  const gameMode = useGameStore(s => s.gameMode);
  const [step, setStep] = useState<'count' | 'configure'>('count');
  const [targetCount, setTargetCount] = useState(1);

  // ---- NANOSAT MODE STATE ----
  const [nanoConfigs, setNanoConfigs] = useState<NanoSatTargetConfig[]>([
    createDefaultNanoConfig(0),
  ]);

  // ---- JANITOR MODE STATE ----
  const [debrisConfigs, setDebrisConfigs] = useState<DebrisTargetConfig[]>([
    { debrisId: DEBRIS_DATABASE[0].id, captureType: DEBRIS_DATABASE[0].recommendedCapture },
  ]);

  // ---- COUNT SELECTION ----
  const handleSetCount = (count: number) => {
    setTargetCount(count);
    if (gameMode === 'nanosat') {
      const configs = Array.from({ length: count }, (_, i) =>
        nanoConfigs[i] || createDefaultNanoConfig(i)
      );
      setNanoConfigs(configs);
    } else {
      const configs = Array.from({ length: count }, (_, i) =>
        debrisConfigs[i] || {
          debrisId: DEBRIS_DATABASE[i % DEBRIS_DATABASE.length].id,
          captureType: DEBRIS_DATABASE[i % DEBRIS_DATABASE.length].recommendedCapture,
        }
      );
      setDebrisConfigs(configs);
    }
    setStep('configure');
  };

  // ---- NANOSAT CONFIG HELPERS ----
  const updateNanoConfig = (index: number, updates: Partial<NanoSatTargetConfig>) => {
    setNanoConfigs(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      // Auto-fill orbital parameters when orbit type changes (preset as defaults, still editable)
      if (updates.orbitType && updates.orbitType !== 'CUSTOM') {
        const orbit = ORBIT_TYPES[updates.orbitType];
        if (orbit) {
          next[index].apogee = orbit.altitude / 1000;
          next[index].perigee = orbit.altitude / 1000;
          next[index].inclination = orbit.inclination;
          next[index].tolerance = {
            altitude: orbit.altitude < 500000 ? 15 : orbit.altitude < 1000000 ? 30 : 100,
            inclination: orbit.inclination > 90 ? 1 : 2,
          };
        }
      }
      return next;
    });
  };

  // ---- DEBRIS CONFIG HELPERS ----
  const updateDebrisConfig = (index: number, updates: Partial<DebrisTargetConfig>) => {
    setDebrisConfigs(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      // Auto-set recommended capture type when debris changes
      if (updates.debrisId) {
        const debris = DEBRIS_DATABASE.find(d => d.id === updates.debrisId);
        if (debris && !updates.captureType) {
          next[index].captureType = debris.recommendedCapture;
        }
      }
      return next;
    });
  };

  // ---- START MISSION ----
  const handleStartMission = () => {
    const gs = useGameStore.getState();
    const targets: MissionTargetConfig[] = [];

    if (gameMode === 'nanosat') {
      nanoConfigs.forEach(cfg => {
        targets.push({ nanosat: cfg });
      });
    } else {
      debrisConfigs.forEach(cfg => {
        targets.push({ debris: cfg });
      });
    }

    gs.setMissionTargets(targets);

    // Set up tug specs for custom missions (fuel, delta-V, etc.)
    // Without this, fuelMass stays at 0 and the end condition triggers immediately
    const tugSpec = gameMode === 'janitor' ? JANITOR_TUG : DEPLOYER_TUG;
    const g0 = 9.80665;
    const maxDv = tugSpec.isp * g0 * Math.log(tugSpec.totalMass / tugSpec.dryMass);
    const firstNanoTarget = targets[0]?.nanosat;

    useGameStore.setState({
      currentMissionId: null,
      currentMission: null,
      fuelMass: tugSpec.fuelMass,
      initialFuelMass: tugSpec.fuelMass,
      maxDeltaV: maxDv,
      usedDeltaV: 0,
      remainingDeltaV: maxDv,
      captureState: 'approaching',
      deploymentState: 'approaching',
      deployedSats: 0,
      capturedDebris: [],
      capturedMass: 0,
      canCapture: false,
      canDeploy: false,
      captureProgress: 0,
      deployProgress: 0,
      currentTargetIndex: 0,
      cubeSatType: gameMode === 'nanosat' ? (firstNanoTarget?.cubeSatType || '1U') : null,
      gameResults: { score: 0, debrisCleanedKg: 0, accuracy: 0, fuelEfficiency: 100, timeBonus: 0, rating: 'F' },
    });

    // Generate a dynamic mission based on configuration
    const totalDifficulty = gameMode === 'janitor'
      ? debrisConfigs.reduce((sum, cfg) => {
          const d = DEBRIS_DATABASE.find(dd => dd.id === cfg.debrisId);
          return sum + (d?.difficulty || 1);
        }, 0) / debrisConfigs.length
      : nanoConfigs.reduce((sum, cfg) => {
          const orbit = cfg.orbitType !== 'CUSTOM' ? ORBIT_TYPES[cfg.orbitType] : null;
          return sum + (cfg.cubeSatType === '3U' ? 3 : cfg.cubeSatType === '2U' ? 2 : 1) + (orbit?.altitude > 1000000 ? 2 : 0);
        }, 0) / nanoConfigs.length;

    const scoreMultiplier = Math.max(1, Math.min(5, totalDifficulty * targetCount * 0.5));
    const timeLimit = gameMode === 'janitor'
      ? 300 + debrisConfigs.length * 180
      : 240 + nanoConfigs.length * 120;

    gs.setScreen('tutorial');
  };

  // ---- RENDER ----
  return (
    <div className="absolute inset-0 flex flex-col items-center pointer-events-auto bg-black/80 overflow-hidden">
      <div className="flex flex-col items-center w-full max-w-4xl px-4 py-6 md:px-8 md:py-8 safe-bottom md:min-h-0 flex-1 overflow-y-auto scroll-inner md:overflow-hidden">
      <AnimatePresence mode="wait">
        {step === 'count' ? (
          <CountStep
            key="count"
            gameMode={gameMode!}
            onSelect={handleSetCount}
          />
        ) : gameMode === 'nanosat' ? (
          <NanoSatConfigStep
            key="nano-config"
            configs={nanoConfigs}
            onUpdate={updateNanoConfig}
            onStart={handleStartMission}
            onBack={() => setStep('count')}
          />
        ) : (
          <DebrisConfigStep
            key="debris-config"
            configs={debrisConfigs}
            onUpdate={updateDebrisConfig}
            onStart={handleStartMission}
            onBack={() => setStep('count')}
          />
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}

// ============================================================
// COUNT SELECTION STEP
// ============================================================
function CountStep({ gameMode, onSelect }: { gameMode: string; onSelect: (count: number) => void }) {
  return (
    <motion.div
      key="count"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-2xl text-center overflow-y-auto scroll-inner flex-1 min-h-0"
    >
      <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
        {gameMode === 'nanosat' ? '🛰 Количество наноспутников' : '🗑 Количество объектов мусора'}
      </h2>
      <p className="text-gray-400 mb-8 text-sm">
        {gameMode === 'nanosat'
          ? 'Выберите, сколько наноспутников CubeSat вы планируете вывести на орбиту. Для каждого вы сможете выбрать тип орбиты и все элементы орбиты.'
          : 'Выберите, сколько объектов космического мусора вы планируете утилизировать. Для каждого выберите цель и тип захвата.'}
      </p>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 max-w-lg mx-auto mb-8">
        {[1, 2, 3, 4, 5, 6].map((count) => (
          <motion.button
            key={count}
            whileHover={{ scale: 1.08, y: -4 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(count)}
            className="py-6 rounded-xl bg-gradient-to-br from-cyan-600/30 to-teal-700/30
              border border-cyan-400/30 hover:border-cyan-400/60 hover:from-cyan-600/50 hover:to-teal-700/50
              transition-all group"
          >
            <span className="text-3xl md:text-4xl font-black text-white group-hover:text-cyan-300 transition-colors">
              {count}
            </span>
          </motion.button>
        ))}
      </div>

      <button
        onClick={() => useGameStore.getState().setScreen('missionSelect')}
        className="text-gray-500 hover:text-gray-300 transition-colors text-sm"
      >
        ← Назад к миссиям
      </button>
    </motion.div>
  );
}

// ============================================================
// NANOSAT CONFIGURATION STEP — с полным набором КЕО
// ============================================================
function NanoSatConfigStep({
  configs,
  onUpdate,
  onStart,
  onBack,
}: {
  configs: NanoSatTargetConfig[];
  onUpdate: (index: number, updates: Partial<NanoSatTargetConfig>) => void;
  onStart: () => void;
  onBack: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeConfig = configs[activeIndex] || configs[0];

  // Check if current config has been manually modified from preset
  const isModified = useMemo(() => {
    if (activeConfig.orbitType === 'CUSTOM') return true;
    const orbit = ORBIT_TYPES[activeConfig.orbitType];
    if (!orbit) return true;
    return (
      Math.abs(activeConfig.apogee - orbit.altitude / 1000) > 0.5 ||
      Math.abs(activeConfig.perigee - orbit.altitude / 1000) > 0.5 ||
      Math.abs(activeConfig.inclination - orbit.inclination) > 0.05 ||
      activeConfig.raan !== 0 ||
      activeConfig.argPerigee !== 0
    );
  }, [activeConfig]);

  const allValid = useMemo(() => {
    return configs.every(c =>
      c.apogee >= 200 && c.perigee >= 150 && c.perigee <= c.apogee &&
      c.inclination >= 0 && c.inclination <= 180 &&
      c.raan >= 0 && c.raan <= 360 &&
      c.argPerigee >= 0 && c.argPerigee <= 360
    );
  }, [configs]);

  // Calculate derived orbital parameters for display
  const derivedParams = useMemo(() => {
    const R_E = 6371; // km
    const ra = R_E + activeConfig.apogee;
    const rp = R_E + activeConfig.perigee;
    const a = (ra + rp) / 2; // semi-major axis (km)
    const e = (ra - rp) / (ra + rp); // eccentricity
    const mu = 398600.4418; // km³/s²
    const period = 2 * Math.PI * Math.sqrt(a * a * a / mu) / 60; // minutes
    const vApogee = Math.sqrt(mu * (2 / ra - 1 / a)); // km/s
    const vPerigee = Math.sqrt(mu * (2 / rp - 1 / a)); // km/s
    return { semiMajorAxis: a, eccentricity: e, period, vApogee, vPerigee };
  }, [activeConfig.apogee, activeConfig.perigee]);

  return (
    <motion.div
      key="nano-config"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="w-full max-w-4xl flex flex-col md:flex-1 md:min-h-0"
    >
      <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors text-sm mb-3 flex items-center gap-1 md:shrink-0">
        ← Изменить количество
      </button>

      <h2 className="text-2xl md:text-3xl font-bold text-white mb-1 md:shrink-0">
        🛰 Конфигурация наноспутников
      </h2>
      <p className="text-gray-400 text-sm mb-4 md:shrink-0">
        Настройте тип орбиты и все элементы орбиты для каждого наноспутника
      </p>

      {/* Target selector tabs */}
      <div className="flex gap-1.5 mb-4 flex-wrap md:shrink-0">
        {configs.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveIndex(i)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all border ${
              activeIndex === i
                ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-300'
                : 'bg-black/40 border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20'
            }`}
          >
            #{i + 1}
          </button>
        ))}
      </div>

      {/* Scrollable content area */}
      <div className="pr-1 md:flex-1 md:overflow-y-auto md:min-h-0 scroll-inner">
        <div className="rounded-xl border border-gray-600/30 bg-gray-900/50 p-4 md:p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-white">
              Наноспутник #{activeIndex + 1}
            </h3>
            {isModified && activeConfig.orbitType !== 'CUSTOM' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold">
                ОТРЕДАКТИРОВАНО
              </span>
            )}
          </div>

          {/* Orbit type */}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 font-semibold mb-1.5 tracking-wider">
              ТИП ОРБИТЫ
              <span className="ml-2 text-gray-600 font-normal normal-case">— шаблон (можно изменить любые параметры ниже)</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {[
                ...ORBIT_OPTIONS.map(o => ({ id: o.id, name: o.name })),
                { id: 'CUSTOM', name: '✏️ Произвольная' },
              ].map(orbit => (
                <button
                  key={orbit.id}
                  onClick={() => {
                    if (orbit.id !== 'CUSTOM') {
                      const orb = ORBIT_TYPES[orbit.id];
                      if (orb) {
                        onUpdate(activeIndex, {
                          orbitType: orbit.id,
                          apogee: orb.altitude / 1000,
                          perigee: orb.altitude / 1000,
                          inclination: orb.inclination,
                          raan: 0,
                          argPerigee: 0,
                          tolerance: {
                            altitude: orb.altitude < 500000 ? 15 : orb.altitude < 1000000 ? 30 : 100,
                            inclination: orb.inclination > 90 ? 1 : 2,
                          },
                        });
                      }
                    } else {
                      onUpdate(activeIndex, {
                        orbitType: 'CUSTOM',
                        apogee: 500,
                        perigee: 400,
                        inclination: 51.6,
                        raan: 0,
                        argPerigee: 0,
                        tolerance: { altitude: 20, inclination: 2 },
                      });
                    }
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold text-left border transition-all ${
                    activeConfig.orbitType === orbit.id
                      ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-300'
                      : 'bg-black/30 border-white/10 text-gray-400 hover:text-gray-200 hover:border-white/20'
                  }`}
                >
                  {orbit.name}
                  {orbit.id !== 'CUSTOM' && ORBIT_TYPES[orbit.id] && (
                    <span className="block text-[10px] text-gray-500 mt-0.5">
                      {(ORBIT_TYPES[orbit.id].altitude / 1000).toFixed(0)} км, {ORBIT_TYPES[orbit.id].inclination}°
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* CubeSat type */}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 font-semibold mb-1.5 tracking-wider">ТИП CUBESAT</label>
            <div className="flex gap-2">
              {CUBESAT_OPTIONS.map(opt => (
                <button
                  key={opt.type}
                  onClick={() => onUpdate(activeIndex, { cubeSatType: opt.type })}
                  className={`flex-1 px-3 py-2 rounded-lg border text-center transition-all ${
                    activeConfig.cubeSatType === opt.type
                      ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                      : 'bg-black/30 border-white/10 text-gray-400 hover:text-gray-200 hover:border-white/20'
                  }`}
                >
                  <div className="text-sm font-bold">{opt.label}</div>
                  <div className="text-[10px] text-gray-500">{opt.mass}</div>
                  <div className="text-[9px] text-gray-600">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ---- KEPLERIAN ORBITAL ELEMENTS ---- */}
          <div className="mb-3">
            <label className="block text-xs text-gray-500 font-semibold mb-1.5 tracking-wider">
              ЭЛЕМЕНТЫ ОРБИТЫ (КЕО)
            </label>

            {/* Row 1: Apogee, Perigee, Inclination */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="bg-black/30 rounded-lg p-2.5">
                <div className="text-[10px] text-gray-500 mb-1 flex items-center justify-between">
                  <span>Апогей (км)</span>
                  <span className="text-gray-600">hₐ</span>
                </div>
                <input
                  type="number"
                  value={Math.round(activeConfig.apogee)}
                  onChange={e => onUpdate(activeIndex, { apogee: Number(e.target.value) })}
                  className="w-full bg-transparent text-white font-mono text-sm font-bold outline-none border-b border-cyan-400/20 focus:border-cyan-400/50 transition-colors"
                  min={200}
                  max={40000}
                />
              </div>
              <div className="bg-black/30 rounded-lg p-2.5">
                <div className="text-[10px] text-gray-500 mb-1 flex items-center justify-between">
                  <span>Перигей (км)</span>
                  <span className="text-gray-600">hₚ</span>
                </div>
                <input
                  type="number"
                  value={Math.round(activeConfig.perigee)}
                  onChange={e => onUpdate(activeIndex, { perigee: Number(e.target.value) })}
                  className="w-full bg-transparent text-white font-mono text-sm font-bold outline-none border-b border-cyan-400/20 focus:border-cyan-400/50 transition-colors"
                  min={150}
                  max={40000}
                />
              </div>
              <div className="bg-black/30 rounded-lg p-2.5">
                <div className="text-[10px] text-gray-500 mb-1 flex items-center justify-between">
                  <span>Наклонение (°)</span>
                  <span className="text-gray-600">i</span>
                </div>
                <input
                  type="number"
                  value={activeConfig.inclination.toFixed(1)}
                  onChange={e => onUpdate(activeIndex, { inclination: Number(e.target.value) })}
                  className="w-full bg-transparent text-white font-mono text-sm font-bold outline-none border-b border-cyan-400/20 focus:border-cyan-400/50 transition-colors"
                  min={0}
                  max={180}
                  step={0.1}
                />
              </div>
            </div>

            {/* Row 2: RAAN, ArgPerigee */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-black/30 rounded-lg p-2.5">
                <div className="text-[10px] text-gray-500 mb-1 flex items-center justify-between">
                  <span>RAAN — Долгота восход. узла (°)</span>
                  <span className="text-gray-600">Ω</span>
                </div>
                <input
                  type="number"
                  value={Math.round(activeConfig.raan)}
                  onChange={e => onUpdate(activeIndex, { raan: Math.max(0, Math.min(360, Number(e.target.value))) })}
                  className="w-full bg-transparent text-white font-mono text-sm font-bold outline-none border-b border-cyan-400/20 focus:border-cyan-400/50 transition-colors"
                  min={0}
                  max={360}
                  step={1}
                />
                <div className="text-[9px] text-gray-600 mt-1">Вращение плоскости орбиты (0–360°)</div>
              </div>
              <div className="bg-black/30 rounded-lg p-2.5">
                <div className="text-[10px] text-gray-500 mb-1 flex items-center justify-between">
                  <span>Аргумент перигея (°)</span>
                  <span className="text-gray-600">ω</span>
                </div>
                <input
                  type="number"
                  value={Math.round(activeConfig.argPerigee)}
                  onChange={e => onUpdate(activeIndex, { argPerigee: Math.max(0, Math.min(360, Number(e.target.value))) })}
                  className="w-full bg-transparent text-white font-mono text-sm font-bold outline-none border-b border-cyan-400/20 focus:border-cyan-400/50 transition-colors"
                  min={0}
                  max={360}
                  step={1}
                />
                <div className="text-[9px] text-gray-600 mt-1">Поворот эллипса в плоскости (0–360°)</div>
              </div>
            </div>
          </div>

          {/* ---- DERIVED PARAMETERS (read-only) ---- */}
          <div className="rounded-lg bg-black/20 border border-gray-700/30 p-3">
            <div className="text-[10px] text-gray-500 font-semibold mb-2 tracking-wider">ПРОИЗВОДНЫЕ ПАРАМЕТРЫ</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>
                <div className="text-[9px] text-gray-600">Большая полуось</div>
                <div className="text-xs text-gray-300 font-mono">{derivedParams.semiMajorAxis.toFixed(0)} км</div>
              </div>
              <div>
                <div className="text-[9px] text-gray-600">Эксцентриситет</div>
                <div className="text-xs text-gray-300 font-mono">{derivedParams.eccentricity.toFixed(4)}</div>
              </div>
              <div>
                <div className="text-[9px] text-gray-600">Период обращения</div>
                <div className="text-xs text-gray-300 font-mono">{derivedParams.period.toFixed(1)} мин</div>
              </div>
              <div>
                <div className="text-[9px] text-gray-600">V пери/апо</div>
                <div className="text-xs text-gray-300 font-mono">{derivedParams.vPerigee.toFixed(2)} / {derivedParams.vApogee.toFixed(2)} км/с</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary (always visible) */}
      <div className="rounded-xl border border-gray-600/20 bg-gray-900/30 p-3 mb-4 max-h-16 overflow-y-auto overscroll-contain scroll-inner summary-scroll md:max-h-none md:overflow-visible">
        <h4 className="text-xs text-gray-500 font-semibold mb-2 tracking-wider">
          ИТОГО: {configs.length} наноспутник{configs.length > 1 ? 'ов' : ''}
        </h4>
        <div className="space-y-1">
          {configs.map((cfg, i) => {
            const orbitName = cfg.orbitType !== 'CUSTOM' ? ORBIT_TYPES[cfg.orbitType]?.nameRu || cfg.orbitType : 'Произвольная';
            const isCurrentPreset = cfg.orbitType !== 'CUSTOM';
            const orb = isCurrentPreset ? ORBIT_TYPES[cfg.orbitType] : null;
            const isSatModified = isCurrentPreset && orb && (
              Math.abs(cfg.apogee - orb.altitude / 1000) > 0.5 ||
              Math.abs(cfg.perigee - orb.altitude / 1000) > 0.5 ||
              Math.abs(cfg.inclination - orb.inclination) > 0.05 ||
              cfg.raan !== 0 ||
              cfg.argPerigee !== 0
            );
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0 ${i === activeIndex ? 'bg-cyan-500/30 text-cyan-400' : 'bg-gray-800 text-gray-500'}`}>
                  {i + 1}
                </span>
                <span className="text-gray-300 shrink-0">{cfg.cubeSatType}</span>
                <span className="text-gray-500 shrink-0">→</span>
                <span className="text-gray-300 shrink-0">{orbitName}</span>
                <span className="text-gray-500 text-[10px]">
                  {cfg.apogee.toFixed(0)}×{cfg.perigee.toFixed(0)} км, {cfg.inclination.toFixed(1)}°
                </span>
                {(cfg.raan !== 0 || cfg.argPerigee !== 0) && (
                  <span className="text-amber-400/70 text-[10px] shrink-0">
                    Ω{cfg.raan.toFixed(0)}° ω{cfg.argPerigee.toFixed(0)}°
                  </span>
                )}
                {isSatModified && (
                  <span className="text-amber-400 text-[9px] shrink-0">✎</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Validation warning */}
      {!allValid && (
        <div className="text-red-400 text-xs mb-3 md:shrink-0">
          ⚠ Проверьте параметры: перигей ≥ 150 км, апогей ≥ 200 км, перигей ≤ апогей, наклонение 0–180°
        </div>
      )}

      {/* Start button */}
      <div className="flex justify-center gap-4 md:shrink-0 pt-2 pb-4">
        <button
          onClick={onStart}
          disabled={!allValid}
          className={`px-8 py-3 rounded-xl font-bold text-lg transition-all hover:scale-105 touch-btn ${
            allValid
              ? 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg hover:shadow-cyan-500/30'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          🚀 Начать миссию ({configs.length} спутник{configs.length > 1 ? 'ов' : ''})
        </button>
      </div>
    </motion.div>
  );
}

// ============================================================
// DEBRIS CONFIGURATION STEP
// ============================================================
function DebrisConfigStep({
  configs,
  onUpdate,
  onStart,
  onBack,
}: {
  configs: DebrisTargetConfig[];
  onUpdate: (index: number, updates: Partial<DebrisTargetConfig>) => void;
  onStart: () => void;
  onBack: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeConfig = configs[activeIndex] || configs[0];
  const activeDebris = DEBRIS_DATABASE.find(d => d.id === activeConfig.debrisId);

  const totalMass = useMemo(() => {
    return configs.reduce((sum, cfg) => {
      const d = DEBRIS_DATABASE.find(dd => dd.id === cfg.debrisId);
      return sum + (d?.mass || 0);
    }, 0);
  }, [configs]);

  const difficultyColors: Record<number, { text: string; bg: string }> = {
    1: { text: 'text-green-400', bg: 'bg-green-500/20' },
    2: { text: 'text-yellow-400', bg: 'bg-yellow-500/20' },
    3: { text: 'text-orange-400', bg: 'bg-orange-500/20' },
    4: { text: 'text-red-400', bg: 'bg-red-500/20' },
    5: { text: 'text-purple-400', bg: 'bg-purple-500/20' },
  };

  return (
    <motion.div
      key="debris-config"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="w-full max-w-3xl flex flex-col md:flex-1 md:min-h-0"
    >
      <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors text-sm mb-3 flex items-center gap-1 md:shrink-0">
        ← Изменить количество
      </button>

      <h2 className="text-2xl md:text-3xl font-bold text-white mb-1 md:shrink-0">
        🗑 Выбор объектов для утилизации
      </h2>
      <p className="text-gray-400 text-sm mb-4 md:shrink-0">
        Выберите космический мусор и тип захватного устройства для каждого объекта. Общая масса: <span className="text-orange-400 font-bold">{totalMass.toFixed(0)} кг</span>
      </p>

      {/* Target selector tabs */}
      <div className="flex gap-1.5 mb-4 flex-wrap md:shrink-0">
        {configs.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveIndex(i)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all border ${
              activeIndex === i
                ? 'bg-orange-500/20 border-orange-400/60 text-orange-300'
                : 'bg-black/40 border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20'
            }`}
          >
            #{i + 1}
          </button>
        ))}
      </div>

      {/* Scrollable content — single scroll context, no nesting conflicts */}
      <div className="scroll-inner pr-1 md:flex-1 md:overflow-y-auto md:min-h-0">
        <div className="rounded-xl border border-gray-600/30 bg-gray-900/50 p-4 md:p-5 mb-4">
          <h3 className="text-lg font-bold text-white mb-3">
            Цель #{activeIndex + 1}
          </h3>

          {/* Debris selection grid */}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 font-semibold mb-1.5 tracking-wider">ОБЪЕКТ МУСОРА</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {DEBRIS_DATABASE.map(debris => {
                const dc = difficultyColors[debris.difficulty] || difficultyColors[3];
                const isSelected = activeConfig.debrisId === debris.id;
                return (
                  <button
                    key={debris.id}
                    onClick={() => onUpdate(activeIndex, {
                      debrisId: debris.id,
                      captureType: debris.recommendedCapture,
                    })}
                    className={`text-left px-3 py-2 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-orange-500/15 border-orange-400/60'
                        : 'bg-black/30 border-white/10 hover:border-white/20 hover:bg-black/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`text-xs font-bold ${isSelected ? 'text-orange-300' : 'text-white'}`}>
                        {debris.name}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${dc.bg} ${dc.text} border border-current/20`}>
                        {'★'.repeat(debris.difficulty)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] text-gray-500">
                      <span>{debris.mass} кг</span>
                      <span>{debris.orbit.altitude} км</span>
                      <span>{debris.orbit.inclination}°</span>
                      <span className="text-gray-600">{debris.origin}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Capture type */}
          <div className="mb-3">
            <label className="block text-xs text-gray-500 font-semibold mb-1.5 tracking-wider">МЕХАНИЗМ ЗАХВАТА</label>
            <div className="flex gap-2">
              {CAPTURE_TYPES.map(ct => (
                <button
                  key={ct.type}
                  onClick={() => onUpdate(activeIndex, { captureType: ct.type })}
                  className={`flex-1 px-3 py-2 rounded-lg border text-center transition-all ${
                    activeConfig.captureType === ct.type
                      ? 'bg-cyan-500/15 border-cyan-400/60 text-cyan-300'
                      : 'bg-black/30 border-white/10 text-gray-400 hover:text-gray-200 hover:border-white/20'
                  }`}
                >
                  <div className="text-lg mb-0.5">{ct.icon}</div>
                  <div className="text-xs font-bold">{ct.label}</div>
                  {activeDebris?.recommendedCapture === ct.type && (
                    <div className="text-[9px] text-yellow-400 mt-0.5">РЕКОМЕНДОВАН</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Selected debris info */}
          {activeDebris && (
            <div className="bg-black/30 rounded-lg p-3 text-xs text-gray-400">
              <p className="text-gray-300 mb-1">{activeDebris.description}</p>
              <div className="flex flex-wrap gap-3">
                <span>Тип: {activeDebris.type === 'rocket_stage' ? 'Ступень РН' : activeDebris.type === 'dead_sat' ? 'Спутник' : 'Фрагмент'}</span>
                <span>Материал: {activeDebris.material}</span>
                <span>Вращение: {(activeDebris.tumbleRate.x + activeDebris.tumbleRate.y + activeDebris.tumbleRate.z).toFixed(1)} °/с</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-gray-600/20 bg-gray-900/30 p-3 mb-4 max-h-16 overflow-y-auto overscroll-contain scroll-inner summary-scroll md:max-h-none md:overflow-visible">
        <h4 className="text-xs text-gray-500 font-semibold mb-2 tracking-wider">ИТОГО: {configs.length} объектов ({totalMass.toFixed(0)} кг)</h4>
        <div className="space-y-1">
          {configs.map((cfg, i) => {
            const d = DEBRIS_DATABASE.find(dd => dd.id === cfg.debrisId);
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${i === activeIndex ? 'bg-orange-500/30 text-orange-400' : 'bg-gray-800 text-gray-500'}`}>
                  {i + 1}
                </span>
                <span className="text-gray-300">{d?.name || 'Не выбран'}</span>
                <span className="text-gray-500">{d?.mass} кг</span>
                <span className="text-gray-600 ml-auto">
                  {cfg.captureType === 'harpoon' ? '🏹' : cfg.captureType === 'manipulator' ? '🦾' : '🕸️'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Start button */}
      <div className="flex justify-center gap-4 md:shrink-0 pt-2 pb-4">
        <button
          onClick={onStart}
          className="px-8 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold text-lg transition-all hover:scale-105 shadow-lg hover:shadow-orange-500/30 touch-btn"
        >
          🚀 Начать миссию ({configs.length} объект{configs.length > 1 ? 'ов' : ''})
        </button>
      </div>
    </motion.div>
  );
}

// ============================================================
// HELPERS
// ============================================================
function createDefaultNanoConfig(index: number): NanoSatTargetConfig {
  const defaultOrbit = ORBIT_OPTIONS[index % ORBIT_OPTIONS.length];
  return {
    cubeSatType: '1U',
    orbitType: defaultOrbit.id,
    apogee: defaultOrbit.altitude,
    perigee: defaultOrbit.altitude,
    inclination: defaultOrbit.inclination,
    raan: 0,
    argPerigee: 0,
    tolerance: {
      altitude: defaultOrbit.altitude < 500 ? 15 : 30,
      inclination: 2,
    },
  };
}
