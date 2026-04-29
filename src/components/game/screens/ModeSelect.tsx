/**
 * Выбор режима — две большие плитки
 */
'use client';

import { useGameStore } from '@/game/store/gameStore';
import { motion } from 'framer-motion';

export default function ModeSelect() {
  const gameMode = useGameStore(s => s.gameMode);

  const modes = [
    {
      id: 'nanosat' as const,
      title: '🛰 NANOSAT DEPLOYER',
      subtitle: 'Доставка наноспутников',
      description: 'Выберите орбиту, возьмите спутник CubeSat (1U/2U/3U) и выведите его на точную орбиту с заданными параметрами. Реалистичная орбитальная механика, расход топлива по формуле Циолковского.',
      features: ['4 орбиты (НОО, ССО, полярная, ГТО)', '3 типа CubeSat', 'Расчёт дельта-V', 'Случайные события'],
      color: 'from-emerald-500 to-teal-600',
      borderColor: 'border-emerald-400/30',
      glowColor: 'shadow-emerald-500/20',
    },
    {
      id: 'janitor' as const,
      title: '🗑 SPACE JANITOR',
      subtitle: 'Уборка космического мусора',
      description: 'Управляйте буксиром-уборщиком с манипулятором, гарпуном или сетью. Захватывайте реальный космический мусор и утилизируйте его в атмосфере.',
      features: ['24 реальных объекта мусора', '3 типа захвата', 'Стабилизация вращения', 'Сгорание в атмосфере'],
      color: 'from-orange-500 to-red-600',
      borderColor: 'border-orange-400/30',
      glowColor: 'shadow-orange-500/20',
    },
  ];

  return (
    <div className="absolute inset-0 flex flex-col items-center pointer-events-auto bg-black/60 overflow-hidden">
      <div className="flex flex-col items-center w-full px-4 pt-4 pb-2 md:px-8 md:py-8 min-h-0 flex-1 overflow-y-auto scroll-inner" style={{ paddingBottom: 'max(1rem, calc(1rem + env(safe-area-inset-bottom, 0px)))' }}>
      <h2 className="text-xl sm:text-2xl md:text-4xl font-bold text-white mb-3 md:mb-8">Выберите режим</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6 max-w-5xl w-full">
        {modes.map((mode) => (
          <motion.div
            key={mode.id}
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              useGameStore.getState().setGameMode(mode.id);
              useGameStore.getState().setScreen('missionSelect');
            }}
            className={`relative cursor-pointer rounded-xl md:rounded-2xl border ${mode.borderColor} bg-gradient-to-br ${mode.color} p-4 md:p-8 shadow-xl ${mode.glowColor} overflow-hidden group active:scale-[0.98] transition-transform`}
          >
            {/* Фоновый паттерн */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0" style={{
                backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.3) 1px, transparent 0)',
                backgroundSize: '20px 20px'
              }} />
            </div>

            <div className="relative z-10">
              <h3 className="text-lg sm:text-xl md:text-3xl font-bold text-white mb-0.5 md:mb-2">{mode.title}</h3>
              <p className="text-sm md:text-lg text-white/80 mb-1 md:mb-4">{mode.subtitle}</p>
              <p className="text-[11px] sm:text-sm text-white/70 mb-2 md:mb-6 line-clamp-2 md:line-clamp-none">{mode.description}</p>

              <ul className="space-y-1 md:space-y-2">
                {mode.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-2 text-white/90 text-xs md:text-sm">
                    <span className="text-base md:text-lg">✓</span> {feat}
                  </li>
                ))}
              </ul>
            </div>

            {/* Стрелка */}
            <div className="absolute top-3 right-3 md:top-4 md:right-4 text-white/50 text-2xl md:text-3xl group-hover:text-white/80 transition-colors">
              →
            </div>
          </motion.div>
        ))}
      </div>

      <button
        onClick={() => useGameStore.getState().setScreen('splash')}
        className="mt-4 md:mt-8 mb-2 text-gray-500 hover:text-gray-300 active:text-gray-200 transition-colors text-sm py-2 touch-btn"
      >
        ← Назад
      </button>
      </div>
    </div>
  );
}
