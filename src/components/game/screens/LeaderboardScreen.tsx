/**
 * Таблица лидеров — лучшие результаты (реальные данные из API)
 */
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/game/store/gameStore';

interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  score: number;
  mission: string;
  rating: string;
  createdAt: string;
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);

  if (diffMin < 1) return 'Только что';
  if (diffMin < 60) return `${diffMin} мин назад`;
  if (diffHr < 24) return `${diffHr} ч назад`;
  if (diffHr < 48) return 'Вчера';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export default function LeaderboardScreen() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [playerName] = useState(() => useGameStore.getState().playerName);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(res => res.json())
      .then(data => {
        const ranked = (Array.isArray(data) ? data : []).map((item: any, idx: number) => ({
          ...item,
          rank: idx + 1,
        }));
        setEntries(ranked);
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  const medalEmoji = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const ratingBg = (rating: string) => {
    switch (rating) {
      case 'S': return 'bg-yellow-500/20 text-yellow-400';
      case 'A': return 'bg-emerald-500/20 text-emerald-400';
      case 'B': return 'bg-cyan-500/20 text-cyan-400';
      case 'C': return 'bg-blue-500/20 text-blue-400';
      case 'D': return 'bg-orange-500/20 text-orange-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center pointer-events-auto bg-black/80">
        {/* Fixed header */}
        <div className="shrink-0 w-full max-w-2xl mx-auto px-4 pt-4">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 text-center">🏆 Таблица лидеров</h2>
          {playerName ? (
            <p className="text-gray-500 text-center mb-3 md:mb-4 text-sm">Игрок: <span className="text-cyan-400 font-medium">{playerName}</span></p>
          ) : (
            <p className="text-gray-500 text-center mb-3 md:mb-4 text-sm">Лучшие результаты</p>
          )}
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto w-full max-w-2xl mx-auto min-h-0 scroll-inner px-4 md:px-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500 text-lg mb-2">Пока нет записей</p>
              <p className="text-gray-600 text-sm">Завершите миссию, чтобы попасть в таблицу лидеров!</p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/5">
              {/* Заголовок */}
              <div className="grid grid-cols-12 gap-1 sm:gap-2 p-2 sm:p-3 bg-white/5 text-[10px] sm:text-xs text-gray-500 font-semibold sticky top-0 z-10">
                <div className="col-span-1">#</div>
                <div className="col-span-4">Игрок</div>
                <div className="col-span-3 hidden sm:block">Миссия</div>
                <div className="col-span-3 sm:col-span-2 text-right">Очки</div>
                <div className="col-span-2 sm:col-span-2 text-center">Рейтинг</div>
              </div>

              {/* Записи */}
              {entries.map((entry, idx) => {
                const isPlayer = entry.name === playerName;
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`grid grid-cols-12 gap-1 sm:gap-2 p-2 sm:p-3 border-t border-white/5 hover:bg-white/5 transition-colors ${isPlayer ? 'bg-cyan-500/10' : ''}`}
                  >
                    <div className="col-span-1 text-base sm:text-lg">{medalEmoji(entry.rank)}</div>
                    <div className="col-span-4">
                      <p className={`text-xs sm:text-sm font-medium ${isPlayer ? 'text-cyan-400' : 'text-white'} truncate`}>{entry.name}</p>
                      <p className="text-gray-600 text-[10px] sm:text-xs">{formatDate(entry.createdAt)}</p>
                    </div>
                    <div className="col-span-3 text-gray-400 text-xs sm:text-sm truncate hidden sm:block">{entry.mission}</div>
                    <div className="col-span-3 sm:col-span-2 text-right text-white font-bold text-sm">{entry.score}</div>
                    <div className="col-span-2 text-center">
                      <span className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold ${ratingBg(entry.rating)}`}>
                        {entry.rating}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Fixed footer buttons — always visible at bottom */}
        <div className="shrink-0 flex items-center justify-center gap-3 sm:gap-4 mt-3 md:mt-6 pb-1 safe-bottom px-4">
          <button
            onClick={() => useGameStore.getState().setScreen('results')}
            className="px-5 sm:px-6 py-2.5 border border-gray-600 text-gray-400 rounded-lg hover:border-gray-400 hover:text-white transition-colors text-sm touch-btn"
          >
            ← Результаты
          </button>
          <button
            onClick={() => {
              useGameStore.getState().resetGame();
              useGameStore.getState().setScreen('modeSelect');
            }}
            className="px-5 sm:px-6 py-2.5 bg-cyan-500 text-white font-bold rounded-lg hover:bg-cyan-400 transition-colors text-sm touch-btn"
          >
            🚀 Новая игра
          </button>
        </div>
    </div>
  );
}
