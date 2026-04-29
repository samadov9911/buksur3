/**
 * InclinationCompass — KSP-style inclination indicator widget
 * Shows current orbital inclination vs target inclination
 * Displays a futuristic circular compass with needle
 */
'use client';

import { useGameStore } from '@/game/store/gameStore';
import { useMemo } from 'react';

interface InclinationCompassProps {
  targetInclination?: number;
}

export default function InclinationCompass({ targetInclination }: InclinationCompassProps) {
  const orbInfo = useGameStore(s => s.orbitalInfo);
  const currentInc = orbInfo.inclination;
  const target = targetInclination ?? 51.6;

  const diff = currentInc - target;
  const absDiff = Math.abs(diff);

  // Normalize inclination to 0-180 for display
  const normalizedCurrent = Math.max(0, Math.min(180, currentInc));
  const normalizedTarget = Math.max(0, Math.min(180, target));

  // Compass angle: map 0-180° to 0-360° (left semicircle = 0-90, right = 90-180)
  const currentAngle = normalizedCurrent * 2;
  const targetAngle = normalizedTarget * 2;

  // Status color
  const statusColor = absDiff < 0.5 ? 'text-emerald-400' : absDiff < 2 ? 'text-yellow-400' : absDiff < 5 ? 'text-orange-400' : 'text-red-400';
  const statusGlow = absDiff < 0.5 ? 'shadow-emerald-500/30' : absDiff < 2 ? 'shadow-yellow-500/30' : 'shadow-orange-500/30';

  // Delta-V estimate for inclination change (approximate: dv ≈ v * sin(Δi))
  const speed = orbInfo.speed || 7600;
  const dvEstimate = speed * Math.sin(absDiff * Math.PI / 180);

  // Generate tick marks for the compass
  const ticks = useMemo(() => {
    const result: { angle: number; label: string; major: boolean }[] = [];
    for (let deg = 0; deg <= 180; deg += 10) {
      result.push({
        angle: deg * 2,
        label: `${deg}°`,
        major: deg % 30 === 0,
      });
    }
    return result;
  }, []);

  return (
    <div className={`bg-black/70 backdrop-blur-sm rounded-xl border border-cyan-500/20 p-3 min-w-[200px] shadow-lg ${statusGlow}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] text-cyan-400/80 font-semibold tracking-wider">НАКЛОНЕНИЕ ОРБИТЫ</h3>
        <div className={`text-[9px] font-mono font-bold ${statusColor}`}>
          {diff >= 0 ? '+' : ''}{diff.toFixed(2)}°
        </div>
      </div>

      {/* Compass visualization */}
      <div className="flex items-center gap-3">
        {/* SVG Compass */}
        <div className="relative w-[140px] h-[80px] shrink-0">
          <svg viewBox="0 0 140 80" className="w-full h-full">
            <defs>
              <linearGradient id="compassBg" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0a1628" />
                <stop offset="100%" stopColor="#050d1a" />
              </linearGradient>
              <filter id="needleGlow">
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="targetGlow">
                <feGaussianBlur stdDeviation="1" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Background arc */}
            <path
              d="M 10 70 A 60 60 0 0 1 130 70"
              fill="none"
              stroke="rgba(0,180,255,0.08)"
              strokeWidth="20"
            />

            {/* Outer ring */}
            <path
              d="M 10 70 A 60 60 0 0 1 130 70"
              fill="none"
              stroke="rgba(0,200,255,0.2)"
              strokeWidth="1.5"
            />

            {/* Inner ring */}
            <path
              d="M 10 70 A 60 60 0 0 1 130 70"
              fill="none"
              stroke="rgba(0,200,255,0.08)"
              strokeWidth="0.5"
            />

            {/* Tick marks */}
            {ticks.map((tick) => {
              const rad = (tick.angle - 180) * Math.PI / 180;
              const cx = 70 + Math.cos(rad) * 55;
              const cy = 70 + Math.sin(rad) * 55;
              const ix = 70 + Math.cos(rad) * (tick.major ? 45 : 48);
              const iy = 70 + Math.sin(rad) * (tick.major ? 45 : 48);

              return (
                <g key={tick.angle}>
                  <line
                    x1={ix} y1={iy} x2={cx} y2={cy}
                    stroke={tick.major ? 'rgba(0,200,255,0.5)' : 'rgba(0,200,255,0.2)'}
                    strokeWidth={tick.major ? 1.5 : 0.8}
                  />
                  {tick.major && (
                    <text
                      x={70 + Math.cos(rad) * 36}
                      y={70 + Math.sin(rad) * 36 + 3}
                      textAnchor="middle"
                      fill="rgba(150,200,255,0.5)"
                      fontSize="6"
                      fontFamily="monospace"
                    >
                      {tick.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Target inclination arc */}
            {(() => {
              const tRad = (targetAngle - 180) * Math.PI / 180;
              const tx = 70 + Math.cos(tRad) * 50;
              const ty = 70 + Math.sin(tRad) * 50;
              return (
                <g filter="url(#targetGlow)">
                  {/* Target marker (diamond) */}
                  <polygon
                    points={`${tx},${ty - 4} ${tx + 3},${ty} ${tx},${ty + 4} ${tx - 3},${ty}`}
                    fill="#f59e0b"
                    opacity={0.9}
                  />
                </g>
              );
            })()}

            {/* Delta arc between current and target */}
            {absDiff > 0.1 && (() => {
              const startA = Math.min(currentAngle, targetAngle);
              const endA = Math.max(currentAngle, targetAngle);
              // Convert SVG arc angles (0=top, CW) — our angles are 0-360 from left
              const startSvg = startA - 180;
              const endSvg = endA - 180;
              const r = 50;
              const x1 = 70 + r * Math.cos(startSvg * Math.PI / 180);
              const y1 = 70 + r * Math.sin(startSvg * Math.PI / 180);
              const x2 = 70 + r * Math.cos(endSvg * Math.PI / 180);
              const y2 = 70 + r * Math.sin(endSvg * Math.PI / 180);
              const largeArc = endA - startA > 180 ? 1 : 0;

              return (
                <path
                  d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
                  fill="none"
                  stroke={absDiff < 0.5 ? 'rgba(52,211,153,0.3)' : absDiff < 2 ? 'rgba(250,204,21,0.3)' : 'rgba(251,146,60,0.3)'}
                  strokeWidth="3"
                  strokeDasharray="3 3"
                />
              );
            })()}

            {/* Current inclination needle */}
            {(() => {
              const cRad = (currentAngle - 180) * Math.PI / 180;
              const nx = 70 + Math.cos(cRad) * 52;
              const ny = 70 + Math.sin(cRad) * 52;
              const bx = 70 + Math.cos(cRad) * 38;
              const by = 70 + Math.sin(cRad) * 38;

              return (
                <g filter="url(#needleGlow)">
                  {/* Needle line */}
                  <line
                    x1={70 + Math.cos(cRad) * 15}
                    y1={70 + Math.sin(cRad) * 15}
                    x2={nx}
                    y2={ny}
                    stroke="#00e5ff"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  {/* Needle tip */}
                  <circle cx={nx} cy={ny} r={2.5} fill="#00e5ff" />
                  {/* Base dot */}
                  <circle cx={bx} cy={by} r={1.5} fill="rgba(0,229,255,0.5)" />
                </g>
              );
            })()}

            {/* Center point */}
            <circle cx="70" cy="70" r="3" fill="#0a1628" stroke="rgba(0,200,255,0.3)" strokeWidth="1" />
            <circle cx="70" cy="70" r="1" fill="rgba(0,200,255,0.6)" />

            {/* Label: 0° and 180° */}
            <text x="10" y="79" fill="rgba(0,200,255,0.4)" fontSize="6" fontFamily="monospace">0°</text>
            <text x="123" y="79" fill="rgba(0,200,255,0.4)" fontSize="6" fontFamily="monospace">180°</text>
          </svg>
        </div>

        {/* Numeric display */}
        <div className="flex flex-col gap-1.5 flex-1">
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-gray-500">Текущее</span>
            <span className="text-sm font-mono font-bold text-cyan-400">{currentInc.toFixed(2)}°</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-gray-500">Целевое</span>
            <span className="text-sm font-mono font-bold text-amber-400">{target.toFixed(1)}°</span>
          </div>
          <div className="h-px bg-white/10" />
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-gray-500">ΔV оценка</span>
            <span className={`text-xs font-mono font-semibold ${statusColor}`}>
              {dvEstimate < 10 ? dvEstimate.toFixed(1) : Math.round(dvEstimate)} м/с
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-gray-500">Статус</span>
            <span className={`text-[10px] font-bold ${statusColor}`}>
              {absDiff < 0.5 ? '✓ СОВПАДАЕТ' : absDiff < 2 ? 'БЛИЗКО' : absDiff < 5 ? 'КОРРЕКЦИЯ' : 'МАНЁВР'}
            </span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/5">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-cyan-400" />
          <span className="text-[8px] text-gray-500">Текущее</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-0 bg-amber-400 rotate-45" style={{ width: 6, height: 6 }} />
          <span className="text-[8px] text-gray-500">Целевое</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0 border-t-2 border-dashed border-orange-400/50" />
          <span className="text-[8px] text-gray-500">ΔV</span>
        </div>
      </div>
    </div>
  );
}
