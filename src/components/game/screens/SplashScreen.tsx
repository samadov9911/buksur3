/**
 * Стартовый экран — логотип, кнопка СТАРТ, автоопределение джойстика
 */
'use client';

import { useEffect, useState, useRef } from 'react';
import { useGameStore } from '@/game/store/gameStore';
import { motion } from 'framer-motion';

export default function SplashScreen() {
  const [gamepadStatus, setGamepadStatus] = useState<'checking' | 'keyboard' | 'gamepad'>('checking');
  const [nickname, setNickname] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('orbital-tug-nickname') || '';
  });
  const [nicknameSaved, setNicknameSaved] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('orbital-tug-nickname');
  });
  const initialized = useRef(false);

  // Set player name from saved nickname on first render
  useEffect(() => {
    if (!initialized.current && nickname) {
      initialized.current = true;
      useGameStore.getState().setPlayerName(nickname);
    }
  }, [nickname]);

  useEffect(() => {
    // Проверяем наличие джойстика через Gamepad API
    const check = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i] && gamepads[i].connected) {
          setGamepadStatus('gamepad');
          return;
        }
      }
      setGamepadStatus('keyboard');
    };

    // Слушаем подключение
    const onConnect = () => setGamepadStatus('gamepad');
    window.addEventListener('gamepadconnected', onConnect);

    // Проверяем через 500мс (браузер может ещё не инициализировать)
    setTimeout(check, 500);
    check();

    return () => window.removeEventListener('gamepadconnected', onConnect);
  }, []);

  const handleSaveNickname = () => {
    const name = nickname.trim();
    if (!name) return;
    useGameStore.getState().setPlayerName(name);
    localStorage.setItem('orbital-tug-nickname', name);
    setNicknameSaved(true);
  };

  const handleStart = () => {
    const name = nickname.trim();
    if (!name) return;
    if (!nicknameSaved) handleSaveNickname();
    useGameStore.getState().setScreen('modeSelect');
  };

  return (
    <div className="game-screen pointer-events-auto" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), rgba(0,0,0,0.5), rgba(0,0,0,0.8))' }}>
      <div className="game-screen-scroll">
      {/* Логотип */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1 }}
        className="mb-4 md:mb-8"
      >
        <div className="relative">
          <div className="absolute inset-0 blur-3xl bg-cyan-500/20 rounded-full scale-150" />
          <h1 className="relative text-5xl sm:text-6xl md:text-8xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500">
            ORBITAL
          </h1>
        </div>
        <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-[0.3em] text-orange-400 mt-2 text-center">
          TUG
        </h2>
      </motion.div>

      {/* Подзаголовок */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="text-base sm:text-xl md:text-2xl text-gray-300 mb-4 md:mb-6 text-center"
      >
        Симулятор космического буксира
      </motion.p>

      {/* Поле ввода никнейма */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.5 }}
        className="w-full max-w-xs mb-4 md:mb-6"
      >
        <label className="block text-xs text-gray-500 mb-1.5 text-center tracking-wider font-semibold">
          ВАШ НИКНЕЙМ
        </label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => {
            setNickname(e.target.value);
            setNicknameSaved(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && nickname.trim()) handleSaveNickname();
          }}
          placeholder="Введите никнейм..."
          maxLength={20}
          className="w-full px-4 py-2.5 bg-black/60 border border-white/15 rounded-lg text-white text-center
            text-base font-medium placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50
            focus:ring-1 focus:ring-cyan-500/30 transition-all"
        />
        {!nicknameSaved && nickname.trim() && (
          <button
            onClick={handleSaveNickname}
            className="mt-2 w-full py-1.5 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400
              text-sm font-semibold rounded-lg hover:bg-cyan-500/30 transition-all"
          >
            ✓ Сохранить
          </button>
        )}
        {nicknameSaved && (
          <p className="mt-1.5 text-xs text-emerald-400/70 text-center">Сохранено ✓</p>
        )}
      </motion.div>

      {/* Кнопка СТАРТ */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.5 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleStart}
        disabled={!nickname.trim()}
        className={`px-10 sm:px-12 py-4 sm:py-5 text-white text-xl sm:text-2xl font-bold rounded-xl
          transition-all shadow-lg border
          ${nickname.trim()
            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-cyan-500/30 border-cyan-400/30'
            : 'bg-gray-700 border-gray-600 opacity-50 cursor-not-allowed'
          }`}
      >
        СТАРТ
      </motion.button>

      {/* Подсказка с автоопределением устройства */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 0.5 }}
        className="mt-4 md:mt-6 flex flex-col items-center gap-2"
      >
        <div className="flex items-center gap-2 text-sm text-gray-400">
          {gamepadStatus === 'checking' && (
            <>
              <div className="w-4 h-4 border-2 border-gray-500 border-t-cyan-400 rounded-full animate-spin" />
              <span>Определение устройства...</span>
            </>
          )}
          {gamepadStatus === 'keyboard' && (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="5" width="6" height="8" rx="1" stroke="#9ca3af" strokeWidth="1.5" fill="none" />
                <rect x="10" y="5" width="6" height="8" rx="1" stroke="#9ca3af" strokeWidth="1.5" fill="none" />
                <line x1="4" y1="7.5" x2="6" y2="7.5" stroke="#9ca3af" strokeWidth="1" />
                <line x1="12" y1="10.5" x2="14" y2="10.5" stroke="#9ca3af" strokeWidth="1" />
                <line x1="13" y1="9" x2="13" y2="12" stroke="#9ca3af" strokeWidth="1" />
              </svg>
              <span>Управление по умолчанию</span>
              <span className="text-gray-600">|</span>
              <span className="text-xs text-gray-600">Подключите джойстик для автоматического переключения</span>
            </>
          )}
          {gamepadStatus === 'gamepad' && (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="4" width="14" height="10" rx="2.5" stroke="#4ade80" strokeWidth="1.5" fill="none" />
                <circle cx="5.5" cy="8.5" r="1.5" fill="#4ade80" />
                <circle cx="11" cy="7" r="0.8" fill="#4ade80" />
                <circle cx="12.5" cy="9" r="0.8" fill="#4ade80" />
                <circle cx="11" cy="11" r="0.8" fill="#4ade80" />
              </svg>
              <span className="text-emerald-400">Джойстик подключён</span>
            </>
          )}
        </div>
      </motion.div>

      {/* Логотип разработчика */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ delay: 2.5 }}
        className="shrink-0 mt-2 md:mt-4"
      >
        <p className="text-xs text-gray-600">А-Рокетс. Автор: Махди Самадов</p>
      </motion.div>
      </div>
    </div>
  );
}
