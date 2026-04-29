/**
 * Меню паузы — классический стиль с иконками
 * Настройки: управление, музыка, звуки, возврат
 */
'use client';

import { useGameStore } from '@/game/store/gameStore';
import TugConfigPanel from './TugConfigPanel';

export default function PauseMenu() {
  const isPaused = useGameStore(s => s.isPaused);
  const showSettings = useGameStore(s => s.showSettings);
  const showTugConfig = useGameStore(s => s.showTugConfig);
  const musicVolume = useGameStore(s => s.musicVolume);
  const sfxVolume = useGameStore(s => s.sfxVolume);
  const gamepadConnected = useGameStore(s => s.gamepadConnected);
  const gamepadName = useGameStore(s => s.gamepadName);
  const screen = useGameStore(s => s.screen);

  if (!isPaused) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-auto"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Затемнение фона */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className="relative z-10">
        {showTugConfig ? <TugConfigPanel onClose={() => useGameStore.getState().toggleTugConfig()} /> : showSettings ? <SettingsPanel /> : <PausePanel />}
      </div>
    </div>
  );
}

/** Главная панель паузы */
function PausePanel() {
  const gs = useGameStore.getState;

  return (
    <div className="bg-gray-900/95 border border-gray-700 rounded-2xl p-5 md:p-8 w-[calc(100%-2rem)] md:w-[420px] max-w-[420px] max-h-dvh overflow-y-auto screen-scroll shadow-2xl shadow-black/50">
      {/* Заголовок */}
      <div className="flex items-center justify-center mb-6">
        <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center mr-3">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="3" y="2" width="4" height="16" rx="1" fill="#9ca3af" />
            <rect x="13" y="2" width="4" height="16" rx="1" fill="#9ca3af" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-white tracking-wider">ПАУЗА</h2>
      </div>

      {/* Кнопки меню */}
      <div className="space-y-3">
        <PauseButton
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <polygon points="5,2 18,10 5,18" fill="#4ade80" />
            </svg>
          }
          label="Продолжить"
          shortcut="ESC"
          onClick={() => gs().resumeGame()}
          primary
        />

        <PauseButton
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 2 L4 18 L11 11 L11 18 L18 2 L18 18" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          }
          label="Рестарт"
          shortcut="R"
          onClick={() => gs().restartMission()}
        />

        <PauseButton
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="3" stroke="#60a5fa" strokeWidth="1.5" fill="none" />
              <circle cx="10" cy="3" r="1.5" fill="#60a5fa" />
              <circle cx="16.5" cy="13" r="1.5" fill="#60a5fa" />
              <circle cx="3.5" cy="13" r="1.5" fill="#60a5fa" />
              <circle cx="10" cy="10" r="8" stroke="#60a5fa" strokeWidth="1" fill="none" strokeDasharray="2 2" />
            </svg>
          }
          label="Настройки"
          shortcut="S"
          onClick={() => gs().toggleSettings()}
        />

        <PauseButton
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 10 L10 3 L17 10 L10 17 Z" stroke="#fbbf24" strokeWidth="1.5" fill="none" />
              <circle cx="10" cy="10" r="2" fill="#fbbf24" />
            </svg>
          }
          label="Управление"
          shortcut="C"
          onClick={() => gs().toggleSettings()}
        />

        <PauseButton
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="3" stroke="#f97316" strokeWidth="1.5" fill="none" />
              <circle cx="10" cy="10" r="7" stroke="#f97316" strokeWidth="1" fill="none" strokeDasharray="2 2" />
              <line x1="10" y1="2" x2="10" y2="5" stroke="#f97316" strokeWidth="1" />
              <line x1="10" y1="15" x2="10" y2="18" stroke="#f97316" strokeWidth="1" />
              <line x1="2" y1="10" x2="5" y2="10" stroke="#f97316" strokeWidth="1" />
              <line x1="15" y1="10" x2="18" y2="10" stroke="#f97316" strokeWidth="1" />
            </svg>
          }
          label="Характеристики буксира"
          shortcut="T"
          onClick={() => gs().toggleTugConfig()}
        />

        <div className="border-t border-gray-700 my-4" />

        <PauseButton
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="4" width="16" height="12" rx="2" stroke="#f87171" strokeWidth="1.5" fill="none" />
              <line x1="2" y1="8" x2="18" y2="8" stroke="#f87171" strokeWidth="1" />
              <circle cx="5" cy="12" r="1" fill="#f87171" />
              <circle cx="8" cy="12" r="1" fill="#f87171" />
            </svg>
          }
          label="В главное меню"
          shortcut="Q"
          onClick={() => {
            gs().resetGame();
          }}
          danger
        />
      </div>

      {/* Подсказка управления */}
      <div className="mt-6 pt-4 border-t border-gray-800 safe-bottom">
        <p className="text-center text-xs text-gray-500">
          Продолжить &bull; Рестарт &bull; Настройки &bull; Характеристики &bull; Выход
        </p>
      </div>
    </div>
  );
}

/** Панель настроек */
function SettingsPanel() {
  const musicVolume = useGameStore(s => s.musicVolume);
  const sfxVolume = useGameStore(s => s.sfxVolume);
  const inputSensitivity = useGameStore(s => s.inputSensitivity);
  const gamepadConnected = useGameStore(s => s.gamepadConnected);
  const gamepadName = useGameStore(s => s.gamepadName);

  return (
    <div className="bg-gray-900/95 border border-gray-700 rounded-2xl p-5 md:p-8 w-[calc(100%-2rem)] md:w-[460px] max-w-[460px] max-h-dvh overflow-y-auto screen-scroll shadow-2xl shadow-black/50">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center mr-3">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="2" fill="#60a5fa" />
              <circle cx="10" cy="10" r="6" stroke="#60a5fa" strokeWidth="1" fill="none" />
              <line x1="10" y1="2" x2="10" y2="5" stroke="#60a5fa" strokeWidth="1" />
              <line x1="10" y1="15" x2="10" y2="18" stroke="#60a5fa" strokeWidth="1" />
              <line x1="2" y1="10" x2="5" y2="10" stroke="#60a5fa" strokeWidth="1" />
              <line x1="15" y1="10" x2="18" y2="10" stroke="#60a5fa" strokeWidth="1" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-wider">НАСТРОЙКИ</h2>
        </div>
        <button
          onClick={() => useGameStore.getState().toggleSettings()}
          className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 4 L4 12 M4 4 L12 12" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Громкость музыки */}
      <div className="space-y-5">
        <VolumeSlider
          icon={
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 7 L6 7 L10 3 L10 15 L6 11 L2 11 Z" fill="#a78bfa" />
              <path d="M13 6 C14.5 7.5 14.5 10.5 13 12" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M15 4 C18 7 18 11 15 14" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
          label="Музыка"
          value={musicVolume}
          onChange={(v) => useGameStore.getState().setMusicVolume(v)}
        />

        <VolumeSlider
          icon={
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 7 L6 7 L10 3 L10 15 L6 11 L2 11 Z" fill="#f472b6" />
              <path d="M13 6.5 C14 7.5 14 10.5 13 11.5" stroke="#f472b6" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="14" cy="9" r="0.5" fill="#f472b6" />
            </svg>
          }
          label="Звуковые эффекты"
          value={sfxVolume}
          onChange={(v) => useGameStore.getState().setSfxVolume(v)}
        />

        {/* Чувствительность управления */}
        <SensitivitySlider
          value={inputSensitivity}
          onChange={(v) => useGameStore.getState().setInputSensitivity(v)}
        />

        <div className="border-t border-gray-800 pt-4">
          {/* Статус джойстика */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="3" width="14" height="10" rx="3" stroke={gamepadConnected ? '#4ade80' : '#6b7280'} strokeWidth="1.5" fill="none" />
                  <circle cx="5" cy="8" r="1.5" fill={gamepadConnected ? '#4ade80' : '#6b7280'} />
                  <circle cx="11" cy="6" r="1" fill={gamepadConnected ? '#4ade80' : '#6b7280'} />
                  <circle cx="13" cy="8" r="1" fill={gamepadConnected ? '#4ade80' : '#6b7280'} />
                  <circle cx="11" cy="10" r="1" fill={gamepadConnected ? '#4ade80' : '#6b7280'} />
                </svg>
              </div>
              <span className="text-white text-sm">Устройство ввода</span>
            </div>
            <span className={`text-sm font-medium ${gamepadConnected ? 'text-emerald-400' : 'text-gray-400'}`}>
              {gamepadConnected ? `Джойстик: ${gamepadName.length > 30 ? gamepadName.slice(0, 30) + '...' : gamepadName}` : 'Управление по умолчанию'}
            </span>
          </div>

          <p className="text-xs text-gray-500 mt-1">
            Джойстик определяется автоматически при подключении
          </p>
        </div>

        {/* Схема управления */}
        <div className="border-t border-gray-800 pt-4">
          <h3 className="text-xs text-gray-500 font-semibold mb-3 tracking-wider">УПРАВЛЕНИЕ МЫШЬЮ</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <ControlRow keys="Колёсико" action="Зум камеры" />
            <ControlRow keys="ПКМ + тянуть" action="Вращение камеры" />
          </div>
        </div>

        <div className="border-t border-gray-800 pt-4">
          <h3 className="text-xs text-gray-500 font-semibold mb-3 tracking-wider">УПРАВЛЕНИЕ ДЖОЙСТИКОМ</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <ControlRow keys="Л. стик" action="Ориентация" />
            <ControlRow keys="П. стик Y" action="Тяга" />
            <ControlRow keys="R2 / L2" action="Боковая тяга" />
            <ControlRow keys="X" action="Захват" />
            <ControlRow keys="Y" action="Камера" />
            <ControlRow keys="START" action="Пауза" />
            <ControlRow keys="LB / RB" action="Сменить цель" />
          </div>
        </div>
      </div>

      {/* Кнопка назад */}
      <div className="mt-6 pt-4 border-t border-gray-800 safe-bottom">
        <button
          onClick={() => useGameStore.getState().toggleSettings()}
          className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors text-sm font-medium min-h-[48px]"
        >
          ← Назад к паузе
        </button>
      </div>
    </div>
  );
}

/** Слайдер громкости */
function VolumeSlider({ icon, label, value, onChange }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <span className="text-white text-sm w-32 shrink-0">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-2 bg-gray-700 rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
          [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer"
      />
      <span className="text-gray-400 text-sm font-mono w-10 text-right">{value}%</span>
    </div>
  );
}

/** Кнопка в меню паузы */
function PauseButton({ icon, label, shortcut, onClick, primary, danger }: {
  icon: React.ReactNode;
  label: string;
  shortcut: string;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
}) {
  const colorClass = primary
    ? 'bg-emerald-600/20 border-emerald-500/50 hover:bg-emerald-600/30 hover:border-emerald-400/70'
    : danger
    ? 'bg-red-600/10 border-red-500/30 hover:bg-red-600/20 hover:border-red-400/50'
    : 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-700/50 hover:border-gray-600/70';

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl border transition-all min-h-[52px] ${colorClass}`}
    >
      <div className="w-10 h-10 rounded-lg bg-gray-800/80 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <span className={`font-medium ${primary ? 'text-emerald-400' : danger ? 'text-red-400' : 'text-white'}`}>
        {label}
      </span>
      <span className="ml-auto text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded max-sm:hidden">{shortcut}</span>
    </button>
  );
}

/** Строка управления */
function ControlRow({ keys, action }: { keys: string; action: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-cyan-400 font-mono bg-gray-800 px-1.5 py-0.5 rounded text-[11px]">{keys}</span>
      <span className="text-gray-400">{action}</span>
    </div>
  );
}

/** Слайдер чувствительности управления */
function SensitivitySlider({ value, onChange }: {
  value: number;
  onChange: (v: number) => void;
}) {
  const label = value < 0.5 ? 'Низкая' : value < 1.0 ? 'Средне-низкая' : value < 1.5 ? 'Средняя' : value < 1.8 ? 'Высокая' : 'Очень высокая';
  return (
    <div className="flex items-center gap-4">
      <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="3" stroke="#fbbf24" strokeWidth="1.5" fill="none" />
          <line x1="9" y1="1" x2="9" y2="4" stroke="#fbbf24" strokeWidth="1" />
          <line x1="9" y1="14" x2="9" y2="17" stroke="#fbbf24" strokeWidth="1" />
          <line x1="1" y1="9" x2="4" y2="9" stroke="#fbbf24" strokeWidth="1" />
          <line x1="14" y1="9" x2="17" y2="9" stroke="#fbbf24" strokeWidth="1" />
          <circle cx="9" cy="9" r="7" stroke="#fbbf24" strokeWidth="1" fill="none" strokeDasharray="2 3" />
        </svg>
      </div>
      <span className="text-white text-sm w-32 shrink-0">Чувствительность</span>
      <input
        type="range"
        min={0.2}
        max={2.0}
        step={0.1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-2 bg-gray-700 rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-yellow-400
          [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer"
      />
      <span className="text-gray-400 text-sm font-mono w-16 text-right">{value.toFixed(1)}x</span>
    </div>
  );
}
