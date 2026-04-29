/**
 * Панель характеристик буксира — настройка параметров
 * Доступна из меню паузы
 */
'use client';

import { useState } from 'react';
import { useGameStore } from '@/game/store/gameStore';
import { DEPLOYER_TUG, JANITOR_TUG } from '@/game/data/satellites';

export default function TugConfigPanel({ onClose }: { onClose: () => void }) {
  const gameMode = useGameStore(s => s.gameMode);
  const tugPayloadMass = useGameStore(s => s.tugPayloadMass);
  const tugThrustOverride = useGameStore(s => s.tugThrustOverride);
  const tugIspOverride = useGameStore(s => s.tugIspOverride);
  const fuelMass = useGameStore(s => s.fuelMass);
  const captureType = useGameStore(s => s.captureType);

  const baseSpec = gameMode === 'janitor' ? JANITOR_TUG : DEPLOYER_TUG;
  const effectiveThrust = tugThrustOverride ?? baseSpec.thrust;
  const effectiveIsp = tugIspOverride ?? baseSpec.isp;
  const currentMass = baseSpec.dryMass + fuelMass + tugPayloadMass;
  const g0 = 9.80665;
  const maxDv = effectiveIsp * g0 * Math.log(currentMass / baseSpec.dryMass);

  return (
    <div className="bg-gray-900/95 border border-gray-700 rounded-2xl p-4 md:p-6 w-[calc(100%-2rem)] md:w-[480px] max-w-[480px] max-h-[80vh] overflow-y-auto shadow-2xl shadow-black/50 pointer-events-auto"
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-orange-500/20 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 2 L9 6 M9 12 L9 16 M2 9 L6 9 M12 9 L16 9" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="9" cy="9" r="4" stroke="#f97316" strokeWidth="1.5" fill="none" />
              <circle cx="9" cy="9" r="1.5" fill="#f97316" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide">ХАРАКТЕРИСТИКИ БУКСИРА</h2>
            <p className="text-[10px] text-gray-500">{gameMode === 'janitor' ? 'Режим: Уборщик' : 'Режим: Развертыватель'}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 4 L4 12 M4 4 L12 12" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        {/* === ТЯГА === */}
        <ConfigSlider
          label="Тяга двигателя"
          unit="Н"
          min={0.1}
          max={10}
          step={0.1}
          value={tugThrustOverride ?? baseSpec.thrust}
          defaultValue={baseSpec.thrust}
          onChange={(v) => useGameStore.getState().setTugThrustOverride(v)}
          onReset={() => useGameStore.getState().setTugThrustOverride(null)}
          color="cyan"
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2 L8 8 L12 8" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 10 L8 8 L10 10" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="8" cy="5" r="2" stroke="#22d3ee" strokeWidth="1" fill="none" />
            </svg>
          }
        />

        {/* === УДЕЛЬНЫЙ ИМПУЛЬС === */}
        <ConfigSlider
          label="Удельный импульс (Isp)"
          unit="с"
          min={100}
          max={10000}
          step={50}
          value={tugIspOverride ?? baseSpec.isp}
          defaultValue={baseSpec.isp}
          onChange={(v) => useGameStore.getState().setTugIspOverride(v)}
          onReset={() => useGameStore.getState().setTugIspOverride(null)}
          color="emerald"
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 12 Q8 2 12 12" stroke="#34d399" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              <circle cx="4" cy="12" r="1" fill="#34d399" />
              <circle cx="12" cy="12" r="1" fill="#34d399" />
            </svg>
          }
        />

        {/* === МАССА ПОЛЕЗНОЙ НАГРУЗКИ === */}
        <ConfigSlider
          label="Масса полезной нагрузки"
          unit="кг"
          min={0}
          max={3000}
          step={10}
          value={tugPayloadMass}
          defaultValue={0}
          onChange={(v) => useGameStore.getState().setTugPayloadMass(v)}
          onReset={() => useGameStore.getState().setTugPayloadMass(0)}
          color="amber"
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="5" width="10" height="6" rx="1" stroke="#fbbf24" strokeWidth="1.5" fill="none" />
              <line x1="3" y1="8" x2="13" y2="8" stroke="#fbbf24" strokeWidth="1" />
            </svg>
          }
        />

        {/* === ТИП ЗАХВАТА (только для janitor) === */}
        {gameMode === 'janitor' && (
          <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl border border-gray-700/50">
            <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="5" stroke="#a78bfa" strokeWidth="1.5" fill="none" />
                <circle cx="8" cy="8" r="2" stroke="#a78bfa" strokeWidth="1" fill="none" />
              </svg>
            </div>
            <span className="text-white text-sm w-40 shrink-0">Тип захвата</span>
            <div className="flex gap-1.5">
              {(['harpoon', 'manipulator', 'net'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => useGameStore.getState().setCaptureType(type)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                    captureType === type
                      ? 'bg-purple-500/30 border-purple-400/60 text-purple-300'
                      : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-white hover:border-gray-500'
                  }`}
                >
                  {type === 'harpoon' ? 'Гарпун' : type === 'manipulator' ? 'Манипулятор' : 'Сеть'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* === РАСЧЁТНЫЕ ПАРАМЕТРЫ === */}
        <div className="border-t border-gray-700 pt-3">
          <h3 className="text-[10px] text-gray-500 font-semibold mb-2 tracking-wider">РАСЧЁТНЫЕ ПАРАМЕТРЫ</h3>
          <div className="grid grid-cols-2 gap-2">
            <CalcParam label="Сухая масса" value={`${baseSpec.dryMass} кг`} />
            <CalcParam label="Масса топлива" value={`${fuelMass.toFixed(0)} кг`} />
            <CalcParam label="Масса нагрузки" value={`${tugPayloadMass} кг`} />
            <CalcParam
              label="Полная масса"
              value={`${currentMass.toFixed(0)} кг`}
              highlight={tugPayloadMass > 0}
            />
            <CalcParam
              label="Ускорение"
              value={`${(effectiveThrust / currentMass * 1000).toFixed(2)} мм/с²`}
            />
            <CalcParam
              label="Макс. ΔV"
              value={`${maxDv.toFixed(0)} м/с`}
              color={maxDv > 2000 ? 'text-emerald-400' : maxDv > 1000 ? 'text-yellow-400' : 'text-red-400'}
            />
          </div>
        </div>

        {/* === СПРАВКА === */}
        <div className="border-t border-gray-700 pt-3">
          <h3 className="text-[10px] text-gray-500 font-semibold mb-2 tracking-wider">СПРАВКА</h3>
          <div className="text-[11px] text-gray-400 space-y-1 bg-gray-800/30 rounded-lg p-3">
            <p>• <span className="text-gray-300">Тяга</span> — сила плазменного двигателя (Hall-effect)</p>
            <p>• <span className="text-gray-300">Isp</span> — удельный импульс, определяет эффективность расхода топлива</p>
            <p>• <span className="text-gray-300">Нагрузка</span> — масса спутника или захваченного мусора</p>
            <p>• <span className="text-gray-300">ΔV</span> — запас характеристической скорости (формула Циолковского)</p>
          </div>
        </div>
      </div>

      {/* Кнопка сброса */}
      <div className="mt-4 pt-3 border-t border-gray-800 flex gap-2">
        <button
          onClick={() => {
            useGameStore.getState().setTugThrustOverride(null);
            useGameStore.getState().setTugIspOverride(null);
            useGameStore.getState().setTugPayloadMass(0);
          }}
          className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors text-sm font-medium"
        >
          ↺ Сбросить всё
        </button>
        <button
          onClick={onClose}
          className="flex-1 py-2 bg-cyan-600/30 hover:bg-cyan-600/40 border border-cyan-500/50 text-cyan-300 rounded-xl transition-colors text-sm font-medium"
        >
          Готово
        </button>
      </div>
    </div>
  );
}

function ConfigSlider({ label, unit, min, max, step, value, defaultValue, onChange, onReset, color, icon }: {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
  defaultValue: number;
  onChange: (v: number) => void;
  onReset: () => void;
  color: 'cyan' | 'emerald' | 'amber';
  icon: React.ReactNode;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const isModified = Math.abs(value - defaultValue) > 0.001;
  const colorClasses = {
    cyan: { track: 'accent-cyan-400', thumb: '[&::-webkit-slider-thumb]:bg-cyan-400 [&::-moz-range-thumb]:bg-cyan-400', text: 'text-cyan-400', border: 'border-cyan-500/40', bg: 'bg-cyan-900/50', focus: 'focus:border-cyan-400' },
    emerald: { track: 'accent-emerald-400', thumb: '[&::-webkit-slider-thumb]:bg-emerald-400 [&::-moz-range-thumb]:bg-emerald-400', text: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-900/50', focus: 'focus:border-emerald-400' },
    amber: { track: 'accent-amber-400', thumb: '[&::-webkit-slider-thumb]:bg-amber-400 [&::-moz-range-thumb]:bg-amber-400', text: 'text-amber-400', border: 'border-amber-500/40', bg: 'bg-amber-900/50', focus: 'focus:border-amber-400' },
  }[color];

  const handleInputFocus = () => {
    setIsEditing(true);
    setInputValue(value.toFixed(step < 1 ? 2 : 0));
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed));
      onChange(clamped);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  return (
    <div className={`p-3 bg-gray-800/50 rounded-xl border ${isModified ? 'border-gray-600' : 'border-gray-700/50'}`}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-white text-xs font-medium">{label}</span>
            <div className="flex items-center gap-1.5">
              {/* Editable number input */}
              <div className="relative">
                <input
                  type="number"
                  min={min}
                  max={max}
                  step={step}
                  value={isEditing ? inputValue : value.toFixed(step < 1 ? (step < 0.5 ? 1 : 0) : 0)}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  onKeyDown={handleInputKeyDown}
                  onChange={(e) => setInputValue(e.target.value)}
                  className={`w-20 h-7 text-right text-xs font-mono ${colorClasses.text} bg-gray-900/80 border rounded-lg px-2 py-1 outline-none transition-all cursor-text
                    ${colorClasses.border} ${colorClasses.focus} ${isEditing ? `${colorClasses.bg} shadow-inner` : 'hover:bg-gray-800'}`}
                />
              </div>
              <span className="text-[10px] text-gray-500 w-6 text-left">{unit}</span>
            </div>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className={`w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/30
              [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0
              ${colorClasses.thumb}`}
          />
          {isModified && (
            <button
              onClick={onReset}
              className="mt-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              ↺ Сброс ({defaultValue.toFixed(step < 1 ? 1 : 0)} {unit})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CalcParam({ label, value, color = 'text-gray-300', highlight = false }: {
  label: string;
  value: string;
  color?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center py-1 px-2 rounded ${highlight ? 'bg-amber-500/10' : ''}`}>
      <span className="text-gray-500 text-[11px]">{label}</span>
      <span className={`text-xs font-mono ${color}`}>{value}</span>
    </div>
  );
}
