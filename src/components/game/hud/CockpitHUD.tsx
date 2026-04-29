/**
 * CockpitHUD — панель пилота (кабина) в стиле военного истребителя
 * Все подписи на русском языке, зелёный фосфорный стиль
 *
 * Панели:
 *  - Скорость, Высота, Наклонение — основные полётные данные
 *  - Апогей, Перигей, Эксцентриситет, Период — параметры орбиты
 *  - Тангаж, Крен, Рыскание — ориентация
 *  - ΔV запас, Топливо — ресурсы
 *  - Отклонения от целевой орбиты — дельты
 *  - Тяга, Таймер, Warp — статус миссии
 */
'use client';

import { useMemo } from 'react';
import { useGameStore } from '@/game/store/gameStore';
import { getMissionById } from '@/game/data/missions';
import { ORBIT_TYPES } from '@/game/engine/constants';

/** Безопасное форматирование числа — заменяет NaN/undefined на '---' */
function safeNum(v: number, decimals: number = 0): string {
  if (v == null || Number.isNaN(v) || !Number.isFinite(v)) return '---';
  return v.toFixed(decimals);
}

/** Стандартный CSS-стиль для панели-карточки */
const PANEL = {
  background: 'rgba(0, 20, 10, 0.6)',
  border: '1px solid rgba(0, 255, 136, 0.18)',
};

const LABEL_CLR = 'rgba(0, 255, 136, 0.55)';
const VALUE_CLR = '#00ff88';
const WARN_CLR = '#ffcc00';
const CRIT_CLR = '#ff4444';

export default function CockpitHUD() {
  const orbInfo = useGameStore(s => s.orbitalInfo);
  const thrust = useGameStore(s => s.thrust);
  const remainingDeltaV = useGameStore(s => s.remainingDeltaV);
  const maxDeltaV = useGameStore(s => s.maxDeltaV);
  const fuelMass = useGameStore(s => s.fuelMass);
  const initialFuelMass = useGameStore(s => s.initialFuelMass);
  const timeRemaining = useGameStore(s => s.timeRemaining);
  const timeWarp = useGameStore(s => s.timeWarp);
  const gameMode = useGameStore(s => s.gameMode);
  const currentMissionId = useGameStore(s => s.currentMissionId);
  const missionTargets = useGameStore(s => s.missionTargets);
  const currentTargetIndex = useGameStore(s => s.currentTargetIndex);
  const tugRotation = useGameStore(s => s.tugRotation);
  const distanceToTarget = useGameStore(s => s.distanceToTarget);
  const relativeSpeed = useGameStore(s => s.relativeSpeed);
  const missionTime = useGameStore(s => s.missionTime);

  // ---- Целевая орбита ----
  const { targetAltKm, targetInc, altDev, incDev } = useMemo(() => {
    let tAltM = 0, tInc = 0;

    if (gameMode === 'nanosat') {
      const mission = currentMissionId ? getMissionById(currentMissionId) : null;
      if (mission) {
        const nm = mission as any;
        const targetOrbit = ORBIT_TYPES[nm.targetOrbitId];
        if (targetOrbit) {
          tAltM = targetOrbit.altitude;   // метры
          tInc = targetOrbit.inclination; // градусы
        }
      }
    } else if (missionTargets.length > 0) {
      const target = missionTargets[currentTargetIndex];
      if (target?.nanosat) {
        tAltM = target.nanosat.apogee * 1000;  // apogee в км → метры
        tInc = target.nanosat.inclination;       // градусы
      }
    }

    const tAltKm = tAltM / 1000;
    const curAlt = Number.isFinite(orbInfo.altitude) ? orbInfo.altitude : 0;
    const curInc = Number.isFinite(orbInfo.inclination) ? orbInfo.inclination : 0;

    return {
      targetAltKm: tAltKm,
      targetInc: tInc,
      altDev: tAltKm > 0 ? curAlt - tAltKm : 0,
      incDev: tInc > 0 ? curInc - tInc : 0,
    };
  }, [orbInfo, gameMode, currentMissionId, missionTargets, currentTargetIndex]);

  // ---- Ориентация (рад → градусы) ----
  const pitchDeg = Number.isFinite(tugRotation?.pitch ?? 0) ? tugRotation.pitch : 0;
  const yawDeg = Number.isFinite(tugRotation?.yaw ?? 0) ? tugRotation.yaw : 0;
  const rollDeg = Number.isFinite(tugRotation?.roll ?? 0) ? tugRotation.roll : 0;

  // Реальные углы по осям X, Y, Z в градусах (из движка: pitch → X, yaw → Y, roll → Z)
  const rotX = pitchDeg * 180 / Math.PI;
  const rotY = yawDeg * 180 / Math.PI;
  const rotZ = rollDeg * 180 / Math.PI;

  // ---- Цвет отклонений ----
  const altDevColor = Math.abs(altDev) < 5 ? VALUE_CLR : Math.abs(altDev) < 30 ? WARN_CLR : CRIT_CLR;
  const incDevColor = Math.abs(incDev) < 0.5 ? VALUE_CLR : Math.abs(incDev) < 2 ? WARN_CLR : CRIT_CLR;

  // ---- ΔV ----
  const dvPercent = maxDeltaV > 0 ? (remainingDeltaV / maxDeltaV) * 100 : 0;
  const dvColor = dvPercent > 50 ? VALUE_CLR : dvPercent > 20 ? WARN_CLR : CRIT_CLR;

  // ---- Топливо ----
  const fuelPercent = initialFuelMass > 0 ? (fuelMass / initialFuelMass) * 100 : 0;
  const fuelColor = fuelPercent > 30 ? VALUE_CLR : fuelPercent > 10 ? WARN_CLR : CRIT_CLR;

  // ---- Таймер ----
  const mins = Math.floor(Math.max(0, timeRemaining) / 60);
  const secs = Math.floor(Math.max(0, timeRemaining) % 60);
  const timerStr = `${mins}:${secs.toString().padStart(2, '0')}`;

  // Миссия время T+
  const mTime = Math.max(0, missionTime || 0);
  const mMin = Math.floor(mTime / 60);
  const mSec = Math.floor(mTime % 60);
  const missionTimerStr = `${mMin}:${mSec.toString().padStart(2, '0')}`;

  // ---- Курс ----
  const heading = (((yawDeg * 180 / Math.PI) % 360) + 360) % 360;

  // ---- Безопасные значения orbInfo ----
  const altitude = Number.isFinite(orbInfo.altitude) ? orbInfo.altitude : 0;
  const speed = Number.isFinite(orbInfo.speed) ? orbInfo.speed : 0;
  const inclination = Number.isFinite(orbInfo.inclination) ? orbInfo.inclination : 0;
  const apogee = Number.isFinite(orbInfo.apogee) ? orbInfo.apogee : 0;
  const perigee = Number.isFinite(orbInfo.perigee) ? orbInfo.perigee : 0;
  const eccentricity = Number.isFinite(orbInfo.eccentricity) ? orbInfo.eccentricity : 0;
  const period = Number.isFinite(orbInfo.period) ? orbInfo.period : 0;

  return (
    <div className="absolute inset-0 pointer-events-none select-none" style={{ fontFamily: "'JetBrains Mono', 'Consolas', 'Courier New', monospace" }}>
      {/* Эффект сканлайнов CRT */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,136,0.15) 2px, rgba(0,255,136,0.15) 4px)',
        }}
      />

      {/* ===== ВЕРХНЯЯ ПАНЕЛЬ: Курс + Таймер + Warp + Режим ===== */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2">
        <div className="flex items-center gap-2">
          {/* Режим */}
          <div className="px-2 py-1 rounded text-[9px] font-bold" style={{ ...PANEL, color: VALUE_CLR }}>
            {gameMode === 'nanosat' ? 'РАЗВЁРТЫВАНИЕ' : 'УБОРКА МУСОРА'}
          </div>
          {/* Warp */}
          {timeWarp > 1 && (
            <div className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ color: WARN_CLR, border: `1px solid rgba(255,204,0,0.5)`, background: 'rgba(255,204,0,0.1)' }}>
              ×{timeWarp}
            </div>
          )}
          {/* Курс */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded" style={PANEL}>
            <span className="text-[8px]" style={{ color: LABEL_CLR }}>КУРС</span>
            <span className="text-sm font-bold tracking-wider" style={{ color: VALUE_CLR }}>
              {safeNum(heading, 0).padStart(3, '0')}°
            </span>
          </div>
          {/* Оставшееся время */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded" style={PANEL}>
            <span className="text-[8px]" style={{ color: LABEL_CLR }}>ОСТ</span>
            <span className="text-sm font-bold tracking-wider" style={{ color: timeRemaining < 60 ? CRIT_CLR : VALUE_CLR }}>
              {timerStr}
            </span>
          </div>
          {/* Миссия время */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded" style={PANEL}>
            <span className="text-[8px]" style={{ color: LABEL_CLR }}>Т+</span>
            <span className="text-sm font-bold tracking-wider" style={{ color: VALUE_CLR }}>
              {missionTimerStr}
            </span>
          </div>
        </div>
      </div>

      {/* ===== ЦЕНТР: Прицел + Стрелка тяги ===== */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <svg width="120" height="120" viewBox="-60 -60 120 120" className="opacity-80">
          {/* Внешний круг */}
          <circle cx="0" cy="0" r="40" fill="none" stroke="rgba(0,255,136,0.3)" strokeWidth="1" strokeDasharray="4 4" />
          {/* Крест */}
          <line x1="-15" y1="0" x2="-6" y2="0" stroke={VALUE_CLR} strokeWidth="1.5" />
          <line x1="6" y1="0" x2="15" y2="0" stroke={VALUE_CLR} strokeWidth="1.5" />
          <line x1="0" y1="-15" x2="0" y2="-6" stroke={VALUE_CLR} strokeWidth="1.5" />
          <line x1="0" y1="6" x2="0" y2="15" stroke={VALUE_CLR} strokeWidth="1.5" />
          {/* Центральная точка */}
          <circle cx="0" cy="0" r="2" fill={VALUE_CLR} />
          {/* Угловые скобки */}
          <path d="M-45,-30 L-45,-45 L-30,-45" fill="none" stroke="rgba(0,255,136,0.4)" strokeWidth="1" />
          <path d="M30,-45 L45,-45 L45,-30" fill="none" stroke="rgba(0,255,136,0.4)" strokeWidth="1" />
          <path d="M-45,30 L-45,45 L-30,45" fill="none" stroke="rgba(0,255,136,0.4)" strokeWidth="1" />
          <path d="M30,45 L45,45 L45,30" fill="none" stroke="rgba(0,255,136,0.4)" strokeWidth="1" />
          {/* Стрелка тяги */}
          {thrust && (
            <>
              <line x1="0" y1="20" x2="0" y2="45" stroke="#00ccff" strokeWidth="2" opacity="0.8">
                <animate attributeName="opacity" values="0.4;1;0.4" dur="0.5s" repeatCount="indefinite" />
              </line>
              <polygon points="-5,42 5,42 0,50" fill="#00ccff" opacity="0.8">
                <animate attributeName="opacity" values="0.4;1;0.4" dur="0.5s" repeatCount="indefinite" />
              </polygon>
              <text x="12" y="48" fontSize="9" fill="#00ccff" fontFamily="monospace">ТЯГА</text>
            </>
          )}
        </svg>
      </div>

      {/* ===== ЛЕВАЯ ПАНЕЛЬ: Высота + Отклонение высоты ===== */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2">
        {/* Высота */}
        <div className="mb-2 px-2 py-1.5 rounded" style={PANEL}>
          <div className="text-[8px]" style={{ color: LABEL_CLR }}>ВЫСОТА</div>
          <div className="text-lg font-bold leading-tight" style={{ color: VALUE_CLR }}>
            {safeNum(altitude, 1)}
          </div>
          <div className="text-[8px]" style={{ color: LABEL_CLR }}>км</div>
        </div>

        {/* Отклонение высоты */}
        <div className="flex items-center gap-1.5 mb-2">
          <div className="relative w-6 h-24 rounded" style={{ background: 'rgba(0,20,10,0.4)', border: '1px solid rgba(0,255,136,0.12)' }}>
            <div className="absolute left-0 right-0 top-1/2 -translate-y-px" style={{ height: '1px', background: 'rgba(0,255,136,0.3)' }} />
            {/* Маркер отклонения */}
            <div className="absolute left-0 right-0 -translate-y-1/2 transition-all duration-300" style={{
              top: `${50 - Math.max(-100, Math.min(100, altDev / 2)) * 0.5}%`,
            }}>
              <div className="w-full h-1.5 rounded-sm" style={{ background: altDevColor }} />
            </div>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-[8px]" style={{ color: LABEL_CLR }}>ΔH</span>
            <span className="text-[11px] font-bold" style={{ color: altDevColor }}>
              {Number.isFinite(altDev) ? (altDev > 0 ? '+' : '') + safeNum(altDev, 0) : '---'}
            </span>
            <span className="text-[7px]" style={{ color: LABEL_CLR }}>км</span>
          </div>
        </div>

        {/* Целевая высота */}
        <div className="text-center px-2 py-1 rounded" style={{ background: 'rgba(0,20,10,0.3)', border: '1px solid rgba(0,255,136,0.1)' }}>
          <span className="text-[8px]" style={{ color: LABEL_CLR }}>ЦЕЛЬ </span>
          <span className="text-[10px] font-bold" style={{ color: 'rgba(0,255,136,0.7)' }}>
            {safeNum(targetAltKm, 0)} км
          </span>
        </div>
      </div>

      {/* ===== ЛЕВО-ЦЕНТР: Шкала тангажа ===== */}
      <div className="absolute left-24 top-1/2 -translate-y-1/2">
        <PitchLadder pitch={pitchDeg} />
      </div>

      {/* ===== ПРАВАЯ ПАНЕЛЬ: Все основные параметры ===== */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 items-end">
        {/* Скорость */}
        <div className="px-2 py-1.5 rounded text-right" style={PANEL}>
          <div className="text-[8px]" style={{ color: LABEL_CLR }}>СКОРОСТЬ</div>
          <div className="text-lg font-bold leading-tight" style={{ color: VALUE_CLR }}>
            {safeNum(speed, 0)}
          </div>
          <div className="text-[8px]" style={{ color: LABEL_CLR }}>м/с</div>
        </div>

        {/* Наклонение */}
        <div className="px-2 py-1 rounded text-right" style={PANEL}>
          <div className="flex items-center justify-end gap-1">
            <div className="text-[8px]" style={{ color: LABEL_CLR }}>НАКЛ</div>
            <div className="text-sm font-bold" style={{ color: VALUE_CLR }}>
              {safeNum(inclination, 2)}°
            </div>
          </div>
          {/* Отклонение наклонения */}
          {targetInc > 0 && (
            <div className="flex items-center justify-end gap-1 mt-0.5">
              <div className="text-[8px]" style={{ color: LABEL_CLR }}>ΔI</div>
              <div className="text-[10px] font-bold" style={{ color: incDevColor }}>
                {Number.isFinite(incDev) ? (incDev > 0 ? '+' : '') + safeNum(incDev, 2) + '°' : '---'}
              </div>
            </div>
          )}
        </div>

        {/* Апогей / Перигей */}
        <div className="px-2 py-1 rounded text-right" style={PANEL}>
          <div className="flex items-center justify-end gap-2">
            <div>
              <div className="text-[8px]" style={{ color: LABEL_CLR }}>АПОГЕЙ</div>
              <div className="text-xs font-bold" style={{ color: VALUE_CLR }}>{safeNum(apogee, 0)} км</div>
            </div>
            <div className="w-px h-6" style={{ background: 'rgba(0,255,136,0.2)' }} />
            <div>
              <div className="text-[8px]" style={{ color: LABEL_CLR }}>ПЕРИГЕЙ</div>
              <div className="text-xs font-bold" style={{ color: perigee < 80 ? CRIT_CLR : VALUE_CLR }}>{safeNum(perigee, 0)} км</div>
            </div>
          </div>
        </div>

        {/* Эксцентриситет + Период */}
        <div className="px-2 py-1 rounded text-right" style={PANEL}>
          <div className="flex items-center justify-end gap-2">
            <div>
              <div className="text-[8px]" style={{ color: LABEL_CLR }}>ЭКСЦ</div>
              <div className="text-xs font-bold" style={{ color: VALUE_CLR }}>{safeNum(eccentricity, 4)}</div>
            </div>
            <div className="w-px h-6" style={{ background: 'rgba(0,255,136,0.2)' }} />
            <div>
              <div className="text-[8px]" style={{ color: LABEL_CLR }}>ПЕРИОД</div>
              <div className="text-xs font-bold" style={{ color: VALUE_CLR }}>{safeNum(period, 0)} мин</div>
            </div>
          </div>
        </div>

        {/* Ориентация: X, Y, Z */}
        <div className="px-2 py-1 rounded text-right" style={PANEL}>
          <div className="text-[8px] mb-0.5" style={{ color: LABEL_CLR }}>ОРИЕНТАЦИЯ</div>
          <div className="flex items-center justify-end gap-2">
            <div>
              <div className="text-[7px]" style={{ color: LABEL_CLR }}>X</div>
              <div className="text-[10px] font-bold" style={{ color: VALUE_CLR }}>{safeNum(rotX, 1)}°</div>
            </div>
            <div>
              <div className="text-[7px]" style={{ color: LABEL_CLR }}>Y</div>
              <div className="text-[10px] font-bold" style={{ color: VALUE_CLR }}>{safeNum(rotY, 1)}°</div>
            </div>
            <div>
              <div className="text-[7px]" style={{ color: LABEL_CLR }}>Z</div>
              <div className="text-[10px] font-bold" style={{ color: VALUE_CLR }}>{safeNum(rotZ, 1)}°</div>
            </div>
          </div>
        </div>

        {/* Расстояние до цели (janitor) */}
        {gameMode === 'janitor' && (
          <div className="px-2 py-1 rounded text-right" style={PANEL}>
            <div className="text-[8px]" style={{ color: LABEL_CLR }}>РАССТ</div>
            <div className="text-xs font-bold" style={{ color: distanceToTarget < 50 ? '#00ccff' : VALUE_CLR }}>
              {safeNum(distanceToTarget, 0)} м
            </div>
            <div className="text-[8px]" style={{ color: LABEL_CLR }}>ΔV отн {safeNum(relativeSpeed, 1)} м/с</div>
          </div>
        )}
      </div>

      {/* ===== НИЖНЯЯ ЛЕВАЯ: ΔV запас ===== */}
      <div className="absolute bottom-16 left-3">
        <div className="px-2.5 py-2 rounded" style={PANEL}>
          <div className="flex items-center gap-2">
            <div className="text-[8px]" style={{ color: LABEL_CLR }}>ΔV</div>
            <div className="w-24 h-2.5 rounded-sm overflow-hidden" style={{ background: 'rgba(0,255,136,0.1)' }}>
              <div className="h-full rounded-sm transition-all duration-500" style={{
                width: `${Math.min(100, dvPercent)}%`,
                background: dvColor,
              }} />
            </div>
            <div className="text-[10px] font-bold" style={{ color: dvColor }}>
              {safeNum(remainingDeltaV, 0)}
            </div>
            <div className="text-[7px]" style={{ color: LABEL_CLR }}>м/с</div>
          </div>
        </div>
      </div>

      {/* ===== НИЖНЯЯ ЦЕНТР: Статусная строка ===== */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <div className="flex items-center gap-3 px-4 py-1.5 rounded-full" style={{ background: 'rgba(0,20,10,0.5)', border: '1px solid rgba(0,255,136,0.15)' }}>
          <span className="text-[9px]" style={{ color: 'rgba(0,255,136,0.6)' }}>
            АПГ {safeNum(apogee, 0)} / ППГ {safeNum(perigee, 0)} км
          </span>
          <div className="w-px h-3" style={{ background: 'rgba(0,255,136,0.2)' }} />
          <span className="text-[9px]" style={{ color: 'rgba(0,255,136,0.6)' }}>
            ПЕРИОД {safeNum(period, 0)} мин
          </span>
          <div className="w-px h-3" style={{ background: 'rgba(0,255,136,0.2)' }} />
          <span className="text-[9px] font-bold" style={{ color: thrust ? '#00ccff' : 'rgba(0,255,136,0.4)' }}>
            {thrust ? '■ ДВИГАТЕЛЬ ВКЛ' : '□ ПОЛЁТ'}
          </span>
        </div>
      </div>

      {/* ===== НИЖНЯЯ ПРАВАЯ: Топливо ===== */}
      <div className="absolute bottom-16 right-3">
        <div className="px-2.5 py-2 rounded" style={PANEL}>
          <div className="flex items-center gap-2 mb-1">
            <div className="text-[8px]" style={{ color: LABEL_CLR }}>ТОПЛИВО</div>
            <div className="text-[10px] font-bold" style={{ color: fuelColor }}>
              {safeNum(fuelMass, 1)} кг
            </div>
          </div>
          {/* Полоса топлива */}
          <div className="w-20 h-1.5 rounded-sm overflow-hidden" style={{ background: 'rgba(0,255,136,0.1)' }}>
            <div className="h-full rounded-sm transition-all duration-500" style={{
              width: `${Math.min(100, fuelPercent)}%`,
              background: fuelColor,
            }} />
          </div>
        </div>
      </div>

      {/* ===== ВЕРХНИЙ ЛЕВЫЙ УГОЛ: Режим FPV ===== */}
      <div className="absolute top-2 left-3">
        <div className="px-2 py-1 rounded" style={{ background: 'rgba(0,20,10,0.3)', border: '1px solid rgba(0,255,136,0.1)' }}>
          <span className="text-[8px]" style={{ color: LABEL_CLR }}>
            КАБИНА • ПЕРВЫМ ЛИЦОМ
          </span>
        </div>
      </div>

      {/* ===== ВЕРХНИЙ ПРАВЫЙ УГОЛ: Эксцентриситет ===== */}
      <div className="absolute top-2 right-3">
        <div className="px-2 py-1 rounded" style={{ background: 'rgba(0,20,10,0.3)', border: '1px solid rgba(0,255,136,0.1)' }}>
          <span className="text-[8px]" style={{ color: LABEL_CLR }}>
            ЭКСЦ {safeNum(eccentricity, 4)} • {safeNum(period, 0)} мин
          </span>
        </div>
      </div>
    </div>
  );
}

/** Шкала тангажа — горизонтальные линии показывающие угол тангажа */
function PitchLadder({ pitch }: { pitch: number }) {
  const lines = [-30, -20, -10, 0, 10, 20, 30];
  const visibleRange = 30;

  return (
    <svg width="50" height="180" viewBox="-25 -90 50 180" className="opacity-60">
      {lines.map(deg => {
        const y = -(deg * (70 / visibleRange));
        const isCenter = deg === 0;
        const halfWidth = isCenter ? 22 : 15;

        return (
          <g key={deg}>
            <line
              x1={-halfWidth} y1={y} x2={halfWidth} y2={y}
              stroke={isCenter ? VALUE_CLR : 'rgba(0,255,136,0.4)'}
              strokeWidth={isCenter ? 1.5 : 1}
            />
            {deg !== 0 && (
              <text
                x={halfWidth + 3} y={y + 3}
                fontSize="7" fill="rgba(0,255,136,0.5)" fontFamily="monospace"
              >
                {deg}°
              </text>
            )}
          </g>
        );
      })}
      {/* Индикатор текущего тангажа */}
      <polygon
        points="0,-2 -3,4 3,4"
        fill={VALUE_CLR}
        transform={`translate(0, ${-(pitch * (70 / visibleRange))})`}
      />
    </svg>
  );
}
