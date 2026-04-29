/**
 * Выбор миссии — список с уровнем сложности
 * Для janitor-миссий: выбор типа захвата
 */
'use client';

import { useState } from 'react';
import { useGameStore } from '@/game/store/gameStore';
import { getMissionsForMode } from '@/game/data/missions';
import { getDebrisById } from '@/game/data/debris';
import type { CaptureType } from '@/game/engine/constants';
import { motion, AnimatePresence } from 'framer-motion';

const difficultyColors = {
  easy: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  hard: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
  expert: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
};

const captureTypes: { type: CaptureType; label: string; icon: string; description: string }[] = [
  {
    type: 'harpoon',
    label: 'Гарпун',
    icon: '🏹',
    description: 'Быстрый захват на расстоянии. Лучше для крупных объектов (ступени ракет)',
  },
  {
    type: 'manipulator',
    label: 'Манипулятор',
    icon: '🦾',
    description: 'Точное захватывающее устройство. Лучше для крупных спутников с плавным вращением',
  },
  {
    type: 'net',
    label: 'Сеть',
    icon: '🕸',
    description: 'Улавливает быстро вращающиеся объекты и фрагменты. Лучше для обломков',
  },
];

export default function MissionSelect() {
  const gameMode = useGameStore(s => s.gameMode);
  const missions = getMissionsForMode(gameMode || 'nanosat');
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [playerCaptureType, setPlayerCaptureType] = useState<CaptureType | null>(null);

  const selectedMission = selectedMissionId ? missions.find(m => m.id === selectedMissionId) : null;
  const isJanitor = selectedMission?.mode === 'janitor';
  const recommendedCapture = isJanitor ? (selectedMission as any).captureType as CaptureType : null;
  const debrisInfo = selectedMission?.mode === 'janitor'
    ? getDebrisById((selectedMission as any).targetDebrisId)
    : null;

  const handleSelectMission = (missionId: string) => {
    try {
      setSelectedMissionId(missionId);
      setPlayerCaptureType(null); // Reset capture type on mission change
      const mission = missions.find(m => m.id === missionId);
      if (mission?.mode === 'janitor') {
        // Auto-set to recommended capture type
        const recommended = (mission as any).captureType as CaptureType;
        setPlayerCaptureType(recommended || 'harpoon');
      }
    } catch (err) {
      console.error('[MissionSelect] Error selecting mission:', err);
    }
  };

  const handleStartMission = () => {
    try {
      if (!selectedMission || !selectedMissionId) return;

      const gs = useGameStore.getState();

      // For janitor missions: ensure capture type is set (fall back to recommended or harpoon)
      if (isJanitor) {
        const captureToUse = playerCaptureType
          || (selectedMission as any).captureType as CaptureType
          || 'harpoon';
        gs.setCaptureType(captureToUse);
      }

      // Reset stale mission state from previous games
      gs.setThrust(false);

      // Select mission and transition to tutorial
      gs.selectMission(selectedMissionId);
      gs.setScreen('tutorial');
    } catch (err) {
      console.error('[MissionSelect] Error starting mission:', err);
    }
  };

  const handleBack = () => {
    if (selectedMissionId) {
      setSelectedMissionId(null);
      setPlayerCaptureType(null);
    } else {
      useGameStore.getState().setScreen('modeSelect');
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center pointer-events-auto bg-black/70 overflow-hidden">
      <AnimatePresence mode="wait">
        {!selectedMission ? (
          /* ===== СПИСОК МИССИЙ ===== */
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -30 }}
            className="w-full max-w-3xl flex-1 flex flex-col min-h-0 h-full"
          >
            {/* Fixed header */}
            <div className="shrink-0 w-full max-w-3xl px-4 md:px-0">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">
              {gameMode === 'nanosat' ? '🛰 Миссии по развёртыванию' : '🗑 Миссии по уборке'}
            </h2>
            <p className="text-gray-400 mb-4 md:mb-6 text-sm">Выберите миссию или настройте свою</p>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto min-h-0 px-4 md:px-0 scroll-inner pb-20 md:pb-4" style={{ paddingBottom: 'max(5rem, calc(5rem + env(safe-area-inset-bottom, 0px)))' }}>

            {/* Custom mission button */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              whileHover={{ scale: 1.01, x: 4 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => useGameStore.getState().setScreen('preConfig')}
              className={`cursor-pointer rounded-xl border border-cyan-400/30 bg-gradient-to-r from-cyan-500/20 to-teal-500/20 p-4 md:p-5 mb-3 transition-all hover:from-cyan-500/30 hover:to-teal-500/30`}
            >
              <div className="flex items-center gap-4">
                <div className="text-3xl">⭐</div>
                <div>
                  <h3 className="text-lg font-bold text-white">Своё задание</h3>
                  <p className="text-sm text-cyan-300/70">
                    {gameMode === 'nanosat'
                      ? 'Выберите количество наноспутников, тип орбиты и параметры для каждого'
                      : 'Выберите количество объектов мусора и метод утилизации'}
                  </p>
                </div>
                <div className="text-gray-500 text-2xl ml-auto">→</div>
              </div>
            </motion.div>

            <div className="text-xs text-gray-600 mb-3 flex items-center gap-2">
              <div className="h-px flex-1 bg-gray-700/50" />
              <span>ИЛИ ВЫБЕРИТЕ ГОТОВУЮ МИССИЮ</span>
              <div className="h-px flex-1 bg-gray-700/50" />
            </div>

            <div className="space-y-3">
              {missions.map((mission, idx) => {
                const dc = difficultyColors[mission.difficulty];
                const debris = mission.mode === 'janitor' ? getDebrisById((mission as any).targetDebrisId) : null;

                return (
                  <motion.div
                    key={mission.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.08 }}
                    whileHover={{ scale: 1.01, x: 4 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => handleSelectMission(mission.id)}
                    className={`cursor-pointer rounded-xl border ${dc.border} ${dc.bg} p-4 md:p-5 transition-all hover:bg-opacity-30`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg md:text-xl font-bold text-white">{mission.name}</h3>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${dc.text} border ${dc.border}`}>
                            {mission.difficultyLabel}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300 mb-2">{mission.description}</p>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                          <span>⏱ {Math.floor(mission.timeLimit / 60)}:{(mission.timeLimit % 60).toString().padStart(2, '0')}</span>
                          <span>×{mission.scoreMultiplier} очков</span>
                          {mission.mode === 'nanosat' && (
                            <span>📦 {(mission as any).cubeSatType} CubeSat</span>
                          )}
                          {mission.mode === 'janitor' && debris && (
                            <span>🎯 {debris.name} ({debris.mass} кг)</span>
                          )}
                          {mission.mode === 'janitor' && (
                            <span>
                              🔧 Рекомендован: {
                                (mission as any).captureType === 'harpoon' ? 'гарпун' :
                                (mission as any).captureType === 'manipulator' ? 'манипулятор' : 'сеть'
                              }
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-gray-500 text-2xl">→</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            </div>

            {/* Fixed footer */}
            <button
              onClick={() => useGameStore.getState().setScreen('modeSelect')}
              className="mt-2 text-gray-500 hover:text-gray-300 transition-colors text-sm shrink-0 py-3 px-4 touch-btn safe-bottom-spacer"
            >
              ← Выбрать другой режим
            </button>
          </motion.div>
        ) : (
          /* ===== ДЕТАЛИ МИССИИ + ВЫБОР ЗАХВАТА ===== */
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            className="w-full max-w-3xl flex-1 flex flex-col min-h-0 h-full"
          >
            <button
              onClick={handleBack}
              className="text-gray-400 hover:text-white transition-colors text-sm mb-3 flex items-center gap-1 shrink-0"
            >
              ← Назад к списку
            </button>

            {/* Scrollable content area — mission info + capture type selection */}
            <div className="flex-1 overflow-y-auto min-h-0 px-4 md:px-0 scroll-inner safe-bottom" style={{ paddingBottom: 'max(1rem, calc(1rem + env(safe-area-inset-bottom, 0px)))' }}>
              <div className="rounded-xl border border-gray-600/30 bg-gray-900/50 p-4 md:p-6 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-2xl md:text-3xl font-bold text-white">{selectedMission.name}</h2>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${difficultyColors[selectedMission.difficulty].text} border ${difficultyColors[selectedMission.difficulty].border}`}>
                    {selectedMission.difficultyLabel}
                  </span>
                </div>
                <p className="text-gray-300 mb-4">{selectedMission.description}</p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="bg-black/30 rounded-lg p-3">
                    <div className="text-gray-500 text-xs mb-1">Время</div>
                    <div className="text-white font-mono">{Math.floor(selectedMission.timeLimit / 60)}:{(selectedMission.timeLimit % 60).toString().padStart(2, '0')}</div>
                  </div>
                  <div className="bg-black/30 rounded-lg p-3">
                    <div className="text-gray-500 text-xs mb-1">Множитель</div>
                    <div className="text-yellow-400 font-bold">×{selectedMission.scoreMultiplier}</div>
                  </div>
                  {selectedMission.mode === 'nanosat' && (
                    <div className="bg-black/30 rounded-lg p-3">
                      <div className="text-gray-500 text-xs mb-1">CubeSat</div>
                      <div className="text-blue-400 font-bold">{(selectedMission as any).cubeSatType}</div>
                    </div>
                  )}
                  {selectedMission.mode === 'nanosat' && (
                    <div className="bg-black/30 rounded-lg p-3">
                      <div className="text-gray-500 text-xs mb-1">ΔV требуется</div>
                      <div className="text-green-400 font-bold">{(selectedMission as any).requiredDeltaV} м/с</div>
                    </div>
                  )}
                  {isJanitor && debrisInfo && (
                    <div className="bg-black/30 rounded-lg p-3">
                      <div className="text-gray-500 text-xs mb-1">Цель</div>
                      <div className="text-orange-400 font-bold">{debrisInfo.mass} кг</div>
                    </div>
                  )}
                  {isJanitor && debrisInfo && (
                    <div className="bg-black/30 rounded-lg p-3">
                      <div className="text-gray-500 text-xs mb-1">Высота</div>
                      <div className="text-cyan-400 font-bold">{debrisInfo.orbit.altitude} км</div>
                    </div>
                  )}
                  {isJanitor && (
                    <div className="bg-black/30 rounded-lg p-3">
                      <div className="text-gray-500 text-xs mb-1">Объекты</div>
                      <div className="text-white font-bold">{(selectedMission as any).debrisCount}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* ===== ВЫБОР ЗАХВАТНОГО УСТРОЙСТВА (только janitor) ===== */}
              {isJanitor && (
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-white mb-1">Выберите захватное устройство</h3>
                  <p className="text-sm text-gray-400 mb-3">
                    Рекомендован: <span className="text-yellow-400 font-semibold">
                      {captureTypes.find(c => c.type === recommendedCapture)?.label}
                    </span>
                    {debrisInfo && (
                      <span className="text-gray-500 ml-1">
                        (для {debrisInfo.name})
                      </span>
                    )}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {captureTypes.map((ct) => {
                      const isSelected = playerCaptureType === ct.type;
                      const isRecommended = ct.type === recommendedCapture;

                      return (
                        <motion.div
                          key={ct.type}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setPlayerCaptureType(ct.type)}
                          className={`cursor-pointer rounded-xl border p-4 transition-all ${
                            isSelected
                              ? 'border-cyan-400/60 bg-cyan-500/10 shadow-lg shadow-cyan-500/10'
                              : 'border-gray-600/30 bg-gray-900/30 hover:border-gray-500/50 hover:bg-gray-900/50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-2xl">{ct.icon}</span>
                            <div className="flex items-center gap-2">
                              {isRecommended && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-semibold">
                                  РЕКОМЕНДОВАН
                                </span>
                              )}
                              {isSelected && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-semibold">
                                  ВЫБРАН
                                </span>
                              )}
                            </div>
                          </div>
                          <h4 className="text-base font-bold text-white mb-1">{ct.label}</h4>
                          <p className="text-xs text-gray-400 leading-relaxed">{ct.description}</p>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ===== КНОПКА СТАРТА (всегда видна внизу) ===== */}
            <div className="flex justify-center gap-4 shrink-0 pt-2 pb-2 safe-bottom px-4 md:px-0">
              <button
                onClick={handleStartMission}
                onTouchEnd={(e) => { e.preventDefault(); handleStartMission(); }}
                className="px-8 py-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-black font-bold text-lg transition-all hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-cyan-500/30 min-h-[48px] touch-btn"
              >
                🚀 Начать миссию
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
