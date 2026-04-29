/**
 * Экран обучения — интерактивная подсказка (30 секунд)
 */
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useGameStore } from '@/game/store/gameStore';
import { motion } from 'framer-motion';

interface TutorialStep {
  title: string;
  description: string;
  controls: string[];
  icon: string;
}

export default function TutorialScreen() {
  const gameMode = useGameStore(s => s.gameMode);
  const [step, setStep] = useState(0);
  const [countdown, setCountdown] = useState(10);

  const steps: TutorialStep[] = gameMode === 'janitor' ? [
    {
      title: 'Ваша миссия',
      description: 'Вы управляете космическим буксиром-уборщиком. Захватите мусор и верните его в атмосферу для сжигания.',
      controls: [],
      icon: '🗑',
    },
    {
      title: 'Ориентация буксира',
      description: 'Управляйте ориентацией буксира для наведения на цель.',
      controls: ['Левый стик / WASD — тангаж и рысканье', 'Правый стик X / A+D — крен'],
      icon: '🎮',
    },
    {
      title: 'Тяга',
      description: 'Используйте тягу для сближения с объектом. Следите за расходом топлива!',
      controls: ['Правый стик Y / ↑↓ — продольная тяга', 'Курки L2 R2 / Q E — вертикаль'],
      icon: '🔥',
    },
    {
      title: 'Захват',
      description: 'Сблизьтесь с объектом (скорость < 0.1 м/с) и нажмите кнопку захвата. Синхронизируйте вращение!',
      controls: ['□ / X / Пробел — захват', '○ / B — автопилот вращения'],
      icon: '🤖',
    },
    {
      title: 'Утилизация',
      description: 'После захвата снизьте орбиту. Объект сгорит в атмосфере! Следите, чтобы буксир не сгорел.',
      controls: ['После захвата — снижайте орбиту', 'Не опускайтесь ниже 120 км!'],
      icon: '🔥',
    },
  ] : [
    {
      title: 'Ваша миссия',
      description: 'Доставьте наноспутник CubeSat на заданную орбиту. Точное попадание = больше очков!',
      controls: [],
      icon: '🛰',
    },
    {
      title: 'Ориентация буксира',
      description: 'Управляйте ориентацией буксира для наведения на целевую орбиту.',
      controls: ['Левый стик / WASD — тангаж и рысканье', 'Правый стик X / A+D — крен'],
      icon: '🎮',
    },
    {
      title: 'Тяга и манёвры',
      description: 'Применяйте тяговые импульсы для изменения орбиты. Манёвр Хомана — самый экономный!',
      controls: ['↑↓ — тяга вперёд/назад', 'Q E — тяга вверх/вниз'],
      icon: '🚀',
    },
    {
      title: 'Ориентиры',
      description: 'Зелёная линия — текущая орбита. Оранжевая — целевая. Сведите их!',
      controls: ['1 2 3 4 — переключение камер', 'ESC / START — пауза'],
      icon: '📸',
    },
  ];

  const startGame = useCallback(() => {
    try {
      useGameStore.getState().startGame();
    } catch (err) {
      console.error('[TutorialScreen] Error in startGame store action:', err);
    }
  }, []);

  // Auto-start countdown — separate effect so we don't call side effects inside setState
  const hasStartedRef = useRef(false);
  useEffect(() => {
    if (countdown <= 0 && !hasStartedRef.current) {
      hasStartedRef.current = true;
      startGame();
      return;
    }
    if (countdown <= 0) return; // already started, skip
    const timer = setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown, startGame]);

  const nextStep = useCallback(() => {
    if (step < steps.length - 1) {
      setStep(step + 1);
      setCountdown(10);
    } else {
      setCountdown(0); // triggers auto-start via useEffect
    }
  }, [step, steps.length]);

  const prevStep = useCallback(() => {
    if (step > 0) {
      setStep(step - 1);
      setCountdown(10);
    }
  }, [step]);

  const skipTutorial = useCallback(() => {
    useGameStore.getState().completeTutorial();
    setCountdown(0); // triggers auto-start via useEffect
  }, []);

  const currentStep = steps[step];

  return (
    <div className="game-screen pointer-events-auto" style={{ background: 'rgba(0,0,0,0.8)' }}>
      <div className="game-screen-scroll">
      <motion.div
        key={step}
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -30 }}
        className="max-w-xl w-full text-center"
      >
        {/* Иконка */}
        <div className="text-5xl sm:text-6xl mb-3 md:mb-4">{currentStep.icon}</div>

        {/* Заголовок */}
        <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2 md:mb-3">{currentStep.title}</h3>

        {/* Описание */}
        <p className="text-gray-300 text-base md:text-lg mb-4 md:mb-6">{currentStep.description}</p>

        {/* Управление */}
        {currentStep.controls.length > 0 && (
          <div className="bg-white/5 rounded-xl p-3 md:p-4 mb-4 md:mb-6 text-left">
            <p className="text-sm text-gray-400 mb-2 font-semibold">Управление:</p>
            {currentStep.controls.map((ctrl, i) => (
              <p key={i} className="text-gray-300 text-sm mb-1">• {ctrl}</p>
            ))}
          </div>
        )}

        {/* Прогресс */}
        <div className="flex items-center justify-center gap-2 mb-4 md:mb-6">
          {steps.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full ${i === step ? 'bg-cyan-400' : i < step ? 'bg-cyan-400/40' : 'bg-gray-600'}`} />
          ))}
        </div>

        {/* Кнопки */}
        <div className="flex items-center justify-center gap-3">
          {step > 0 && (
            <button onClick={prevStep} className="px-5 py-2.5 sm:px-6 sm:py-3 rounded-lg border border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 transition-colors min-h-[44px] touch-btn">
              ← Назад
            </button>
          )}
          <button onClick={nextStep} className="px-7 py-2.5 sm:px-8 sm:py-3 rounded-lg bg-cyan-500 text-white font-bold hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20 min-h-[44px] touch-btn">
            {step === steps.length - 1 ? '🚀 НАЧАТЬ' : 'Далее →'}
          </button>
        </div>

        {/* Пропустить */}
        <button onClick={skipTutorial} className="mt-3 md:mt-4 text-gray-600 hover:text-gray-400 text-xs transition-colors py-2 px-4 touch-btn">
          Пропустить обучение ({countdown})
        </button>
      </motion.div>
      </div>
    </div>
  );
}
