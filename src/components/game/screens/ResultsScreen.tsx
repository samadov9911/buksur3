/**
 * Экран результатов — статистика, рейтинг
 */
'use client';

import { useGameStore } from '@/game/store/gameStore';
import { motion } from 'framer-motion';

const ratingColors: Record<string, { color: string; glow: string }> = {
  S: { color: 'text-yellow-400', glow: 'shadow-yellow-400/50' },
  A: { color: 'text-emerald-400', glow: 'shadow-emerald-400/50' },
  B: { color: 'text-cyan-400', glow: 'shadow-cyan-400/50' },
  C: { color: 'text-blue-400', glow: 'shadow-blue-400/50' },
  D: { color: 'text-orange-400', glow: 'shadow-orange-400/50' },
  F: { color: 'text-red-400', glow: 'shadow-red-400/50' },
};

export default function ResultsScreen() {
  const gameResults = useGameStore(s => s.gameResults);
  const gameMode = useGameStore(s => s.gameMode);
  const missionTime = useGameStore(s => s.missionTime);
  const usedDeltaV = useGameStore(s => s.usedDeltaV);
  const result = gameResults;
  const rc = ratingColors[result.rating] || ratingColors.C;

  const score = Math.floor(result.score);

  return (
    <div className="absolute inset-0 flex flex-col items-center pointer-events-auto bg-black/80 overflow-hidden" style={{ height: '100dvh', height: '100vh' }}>
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-4 safe-bottom overflow-y-auto scroll-inner">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-lg w-full text-center"
      >
        {/* Заголовок */}
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2">Миссия завершена!</h2>
        <p className="text-gray-400 mb-6">
          {gameMode === 'nanosat' ? '🛰 Наноспутник' : '🗑 Уборка мусора'}
        </p>

        {/* Рейтинг */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
          className={`text-7xl sm:text-8xl md:text-9xl font-black ${rc.color} mb-3 md:mb-4 drop-shadow-2xl ${rc.glow}`}
          style={{ textShadow: `0 0 40px currentColor` }}
        >
          {result.rating}
        </motion.div>

        {/* Статистика */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-6 md:mb-8 text-left">
          <StatCard label="Очки" value={score.toString()} icon="⭐" />
          <StatCard label="Время" value={`${Math.floor(missionTime / 60)}:${(missionTime % 60).toString().padStart(2, '0')}`} icon="⏱" />
          <StatCard label="Точность" value={`${Math.floor(result.accuracy)}%`} icon="🎯" />
          <StatCard label="Экономия топлива" value={`${Math.floor(result.fuelEfficiency)}%`} icon="⛽" />
          {gameMode === 'janitor' && (
            <StatCard label="Убрано мусора" value={`${Math.floor(result.debrisCleanedKg)} кг`} icon="🗑" />
          )}
          <StatCard label="ΔV использовано" value={`${Math.floor(usedDeltaV)} м/с`} icon="🚀" />
        </div>

        {/* Экологический посыл */}
        {gameMode === 'janitor' && result.debrisCleanedKg > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-6"
          >
            <p className="text-emerald-400 text-lg font-bold">🌍 Вы спасли орбиту от {Math.floor(result.debrisCleanedKg)} кг мусора!</p>
          </motion.div>
        )}

        {/* Кнопки */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-3 w-full max-w-md mx-auto pb-2">
          <button
            onClick={() => {
              useGameStore.getState().resetGame();
              useGameStore.getState().setScreen('missionSelect');
            }}
            className="px-6 sm:px-8 py-3 bg-cyan-500 text-white font-bold rounded-lg hover:bg-cyan-400 transition-colors shadow-lg text-sm sm:text-base w-full sm:w-auto min-h-[48px] touch-btn"
          >
            🔄 Ещё раз
          </button>
          <button
            onClick={() => useGameStore.getState().setScreen('leaderboard')}
            className="px-6 sm:px-8 py-3 border border-gray-600 text-gray-300 rounded-lg hover:border-gray-400 hover:text-white transition-colors text-sm sm:text-base w-full sm:w-auto min-h-[48px] touch-btn"
          >
            🏆 Лидерборд
          </button>
          <button
            onClick={() => {
              useGameStore.getState().resetGame();
              useGameStore.getState().setScreen('modeSelect');
            }}
            className="px-6 sm:px-8 py-3 border border-gray-600 text-gray-400 rounded-lg hover:border-gray-400 hover:text-white transition-colors text-sm w-full sm:w-auto min-h-[48px] touch-btn"
          >
            🏠 Главное меню
          </button>
        </div>
      </motion.div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-white/5 rounded-lg p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3">
      <span className="text-xl">{icon}</span>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-white">{value}</p>
      </div>
    </div>
  );
}
