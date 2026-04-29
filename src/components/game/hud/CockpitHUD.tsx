/**
 * CockpitHUD — military fighter-jet style HUD overlay for cockpit (1st person) view
 * Displays: pitch ladder, heading tape, altitude/speed deviation bars,
 * target orbit deviation, thrust indicator, ΔV, timer
 *
 * Green phosphor aesthetic — classic fighter HUD look
 */
'use client';

import { useMemo } from 'react';
import { useGameStore } from '@/game/store/gameStore';
import { getMissionById } from '@/game/data/missions';
import { ORBIT_TYPES } from '@/game/engine/constants';

export default function CockpitHUD() {
  const orbInfo = useGameStore(s => s.orbitalInfo);
  const thrust = useGameStore(s => s.thrust);
  const remainingDeltaV = useGameStore(s => s.remainingDeltaV);
  const maxDeltaV = useGameStore(s => s.maxDeltaV);
  const fuelMass = useGameStore(s => s.fuelMass);
  const timeRemaining = useGameStore(s => s.timeRemaining);
  const timeWarp = useGameStore(s => s.timeWarp);
  const gameMode = useGameStore(s => s.gameMode);
  const currentMissionId = useGameStore(s => s.currentMissionId);
  const missionTargets = useGameStore(s => s.missionTargets);
  const currentTargetIndex = useGameStore(s => s.currentTargetIndex);
  const tugRotation = useGameStore(s => s.tugRotation);

  // Target orbit data
  const { targetAlt, targetInc, targetSpeed, altDev, incDev, speedDev } = useMemo(() => {
    let tAlt = 0, tInc = 0, tSpd = 0;

    if (gameMode === 'nanosat') {
      const mission = currentMissionId ? getMissionById(currentMissionId) : null;
      if (mission) {
        const nm = mission as any;
        const targetOrbit = ORBIT_TYPES[nm.targetOrbitId];
        if (targetOrbit) {
          tAlt = targetOrbit.altitude;
          tInc = targetOrbit.inclination;
          tSpd = targetOrbit.speed;
        }
      }
    } else if (missionTargets.length > 0) {
      const target = missionTargets[currentTargetIndex];
      if (target?.orbit) {
        tAlt = target.orbit.altitude;
        tInc = target.orbit.inclination;
        tSpd = target.orbit.speed;
      }
    }

    return {
      targetAlt: tAlt,
      targetInc: tInc,
      targetSpeed: tSpd,
      altDev: orbInfo.altitude > 0 ? orbInfo.altitude - tAlt : 0,
      incDev: orbInfo.inclination > 0 ? orbInfo.inclination - tInc : 0,
      speedDev: orbInfo.speed > 0 ? orbInfo.speed - tSpd : 0,
    };
  }, [orbInfo, gameMode, currentMissionId, missionTargets, currentTargetIndex]);

  // Tug pitch angle (simplified from Euler Y)
  const pitchDeg = tugRotation?.x ?? 0;
  const yawDeg = tugRotation?.y ?? 0;
  const rollDeg = tugRotation?.z ?? 0;

  // ΔV percentage
  const dvPercent = maxDeltaV > 0 ? (remainingDeltaV / maxDeltaV) * 100 : 0;
  const dvColor = dvPercent > 50 ? '#00ff88' : dvPercent > 20 ? '#ffcc00' : '#ff4444';

  // Timer
  const mins = Math.floor(Math.max(0, timeRemaining) / 60);
  const secs = Math.floor(Math.max(0, timeRemaining) % 60);
  const timerStr = `${mins}:${secs.toString().padStart(2, '0')}`;

  // Altitude deviation color
  const altDevColor = Math.abs(altDev) < 5 ? '#00ff88' : Math.abs(altDev) < 30 ? '#ffcc00' : '#ff4444';
  const incDevColor = Math.abs(incDev) < 0.2 ? '#00ff88' : Math.abs(incDev) < 1 ? '#ffcc00' : '#ff4444';
  const spdDevColor = Math.abs(speedDev) < 10 ? '#00ff88' : Math.abs(speedDev) < 50 ? '#ffcc00' : '#ff4444';

  // Current heading (yaw mapped to 0-360)
  const heading = ((yawDeg % 360) + 360) % 360;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ fontFamily: 'monospace' }}>
      {/* Scanline overlay for CRT effect */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,136,0.15) 2px, rgba(0,255,136,0.15) 4px)',
        }}
      />

      {/* ===== TOP: Heading tape + Timer ===== */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2">
        <div className="flex items-center gap-3">
          {/* Time warp badge */}
          {timeWarp > 1 && (
            <div className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ color: '#ff8800', border: '1px solid rgba(255,136,0,0.5)', background: 'rgba(255,136,0,0.1)' }}>
              ×{timeWarp}
            </div>
          )}
          {/* Heading indicator */}
          <div className="flex items-center gap-2 px-3 py-1 rounded" style={{ background: 'rgba(0,20,10,0.5)', border: '1px solid rgba(0,255,136,0.2)' }}>
            <span className="text-[9px]" style={{ color: 'rgba(0,255,136,0.5)' }}>HDG</span>
            <span className="text-sm font-bold tracking-wider" style={{ color: '#00ff88' }}>
              {heading.toFixed(0).padStart(3, '0')}°
            </span>
          </div>
          {/* Mission timer */}
          <div className="flex items-center gap-2 px-3 py-1 rounded" style={{ background: 'rgba(0,20,10,0.5)', border: '1px solid rgba(0,255,136,0.2)' }}>
            <span className="text-[9px]" style={{ color: 'rgba(0,255,136,0.5)' }}>T</span>
            <span className="text-sm font-bold tracking-wider" style={{ color: timeRemaining < 60 ? '#ff4444' : '#00ff88' }}>
              {timerStr}
            </span>
          </div>
        </div>
      </div>

      {/* ===== CENTER: Flight Path Reticle ===== */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <svg width="120" height="120" viewBox="-60 -60 120 120" className="opacity-80">
          {/* Outer circle */}
          <circle cx="0" cy="0" r="40" fill="none" stroke="rgba(0,255,136,0.3)" strokeWidth="1" strokeDasharray="4 4" />
          {/* Inner cross */}
          <line x1="-15" y1="0" x2="-6" y2="0" stroke="#00ff88" strokeWidth="1.5" />
          <line x1="6" y1="0" x2="15" y2="0" stroke="#00ff88" strokeWidth="1.5" />
          <line x1="0" y1="-15" x2="0" y2="-6" stroke="#00ff88" strokeWidth="1.5" />
          <line x1="0" y1="6" x2="0" y2="15" stroke="#00ff88" strokeWidth="1.5" />
          {/* Center dot */}
          <circle cx="0" cy="0" r="2" fill="#00ff88" />
          {/* Corner brackets */}
          <path d="M-45,-30 L-45,-45 L-30,-45" fill="none" stroke="rgba(0,255,136,0.4)" strokeWidth="1" />
          <path d="M30,-45 L45,-45 L45,-30" fill="none" stroke="rgba(0,255,136,0.4)" strokeWidth="1" />
          <path d="M-45,30 L-45,45 L-30,45" fill="none" stroke="rgba(0,255,136,0.4)" strokeWidth="1" />
          <path d="M30,45 L45,45 L45,30" fill="none" stroke="rgba(0,255,136,0.4)" strokeWidth="1" />
          {/* Thrust arrow (bottom) */}
          {thrust && (
            <>
              <line x1="0" y1="20" x2="0" y2="45" stroke="#00ccff" strokeWidth="2" opacity="0.8">
                <animate attributeName="opacity" values="0.4;1;0.4" dur="0.5s" repeatCount="indefinite" />
              </line>
              <polygon points="-5,42 5,42 0,50" fill="#00ccff" opacity="0.8">
                <animate attributeName="opacity" values="0.4;1;0.4" dur="0.5s" repeatCount="indefinite" />
              </polygon>
              <text x="12" y="48" fontSize="9" fill="#00ccff" fontFamily="monospace">THR</text>
            </>
          )}
        </svg>
      </div>

      {/* ===== LEFT: Altitude deviation bar ===== */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2">
        {/* Current altitude */}
        <div className="mb-3 px-2 py-1 rounded" style={{ background: 'rgba(0,20,10,0.5)', border: '1px solid rgba(0,255,136,0.15)' }}>
          <div className="text-[8px]" style={{ color: 'rgba(0,255,136,0.5)' }}>ALT</div>
          <div className="text-sm font-bold" style={{ color: '#00ff88' }}>
            {(orbInfo.altitude / 1000).toFixed(1)}
          </div>
          <div className="text-[8px]" style={{ color: 'rgba(0,255,136,0.5)' }}>km</div>
        </div>

        {/* Altitude deviation scale */}
        <div className="flex items-center gap-1.5">
          <div className="relative w-8 h-32 rounded" style={{ background: 'rgba(0,20,10,0.4)', border: '1px solid rgba(0,255,136,0.15)' }}>
            {/* Center line (target) */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-px" style={{ height: '1px', background: 'rgba(0,255,136,0.3)' }} />
            {/* Tick marks */}
            {[-3, -2, -1, 0, 1, 2, 3].map(i => (
              <div key={i} className="absolute left-0 right-0" style={{
                top: `${50 + i * 12.5}%`,
                height: i === 0 ? '2px' : '1px',
                background: i === 0 ? 'rgba(0,255,136,0.5)' : 'rgba(0,255,136,0.15)',
              }} />
            ))}
            {/* Deviation marker */}
            <div className="absolute left-0 right-0 -translate-y-1/2 transition-all duration-300" style={{
              top: `${50 - Math.max(-100, Math.min(100, altDev / 2)) * 0.5}%`,
            }}>
              <div className="w-full h-1.5 rounded-sm" style={{ background: altDevColor }} />
            </div>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-[8px]" style={{ color: 'rgba(0,255,136,0.5)' }}>ΔH</span>
            <span className="text-xs font-bold" style={{ color: altDevColor }}>
              {altDev > 0 ? '+' : ''}{altDev.toFixed(0)}
            </span>
            <span className="text-[7px]" style={{ color: 'rgba(0,255,136,0.4)' }}>km</span>
          </div>
        </div>

        {/* Target altitude */}
        <div className="mt-2 text-center px-2 py-1 rounded" style={{ background: 'rgba(0,20,10,0.3)', border: '1px solid rgba(0,255,136,0.1)' }}>
          <span className="text-[8px]" style={{ color: 'rgba(0,255,136,0.4)' }}>TGT </span>
          <span className="text-[10px] font-bold" style={{ color: 'rgba(0,255,136,0.7)' }}>
            {(targetAlt / 1000).toFixed(0)} km
          </span>
        </div>
      </div>

      {/* ===== RIGHT: Inclination deviation + Speed deviation ===== */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2">
        {/* Speed */}
        <div className="mb-3 px-2 py-1 rounded text-right" style={{ background: 'rgba(0,20,10,0.5)', border: '1px solid rgba(0,255,136,0.15)' }}>
          <div className="text-[8px]" style={{ color: 'rgba(0,255,136,0.5)' }}>SPD</div>
          <div className="text-sm font-bold" style={{ color: '#00ff88' }}>
            {orbInfo.speed.toFixed(0)}
          </div>
          <div className="text-[8px]" style={{ color: 'rgba(0,255,136,0.5)' }}>m/s</div>
        </div>

        {/* Speed deviation */}
        <div className="flex items-center gap-1.5 mb-4">
          <div className="flex flex-col items-end">
            <span className="text-[8px]" style={{ color: 'rgba(0,255,136,0.5)' }}>ΔV</span>
            <span className="text-xs font-bold" style={{ color: spdDevColor }}>
              {speedDev > 0 ? '+' : ''}{speedDev.toFixed(0)}
            </span>
            <span className="text-[7px]" style={{ color: 'rgba(0,255,136,0.4)' }}>m/s</span>
          </div>
          <div className="relative w-8 h-20 rounded" style={{ background: 'rgba(0,20,10,0.4)', border: '1px solid rgba(0,255,136,0.15)' }}>
            <div className="absolute left-0 right-0 top-1/2 -translate-y-px" style={{ height: '1px', background: 'rgba(0,255,136,0.3)' }} />
            <div className="absolute left-0 right-0 -translate-y-1/2 transition-all duration-300" style={{
              top: `${50 - Math.max(-100, Math.min(100, speedDev / 20)) * 0.5}%`,
            }}>
              <div className="w-full h-1.5 rounded-sm" style={{ background: spdDevColor }} />
            </div>
          </div>
        </div>

        {/* Inclination */}
        <div className="px-2 py-1 rounded text-right" style={{ background: 'rgba(0,20,10,0.5)', border: '1px solid rgba(0,255,136,0.15)' }}>
          <div className="text-[8px]" style={{ color: 'rgba(0,255,136,0.5)' }}>INC</div>
          <div className="text-sm font-bold" style={{ color: '#00ff88' }}>
            {orbInfo.inclination.toFixed(2)}°
          </div>
        </div>

        {/* Inclination deviation */}
        <div className="flex items-center gap-1.5 mt-2">
          <div className="flex flex-col items-end">
            <span className="text-[8px]" style={{ color: 'rgba(0,255,136,0.5)' }}>ΔI</span>
            <span className="text-xs font-bold" style={{ color: incDevColor }}>
              {incDev > 0 ? '+' : ''}{incDev.toFixed(2)}°
            </span>
          </div>
          <div className="relative w-8 h-16 rounded" style={{ background: 'rgba(0,20,10,0.4)', border: '1px solid rgba(0,255,136,0.15)' }}>
            <div className="absolute left-0 right-0 top-1/2 -translate-y-px" style={{ height: '1px', background: 'rgba(0,255,136,0.3)' }} />
            <div className="absolute left-0 right-0 -translate-y-1/2 transition-all duration-300" style={{
              top: `${50 - Math.max(-100, Math.min(100, incDev * 20)) * 0.5}%`,
            }}>
              <div className="w-full h-1.5 rounded-sm" style={{ background: incDevColor }} />
            </div>
          </div>
        </div>

        {/* Target inclination */}
        <div className="mt-2 text-center px-2 py-1 rounded" style={{ background: 'rgba(0,20,10,0.3)', border: '1px solid rgba(0,255,136,0.1)' }}>
          <span className="text-[8px]" style={{ color: 'rgba(0,255,136,0.4)' }}>TGT </span>
          <span className="text-[10px] font-bold" style={{ color: 'rgba(0,255,136,0.7)' }}>
            {targetInc.toFixed(1)}°
          </span>
        </div>
      </div>

      {/* ===== BOTTOM LEFT: ΔV bar ===== */}
      <div className="absolute bottom-16 left-4">
        <div className="px-2 py-1.5 rounded" style={{ background: 'rgba(0,20,10,0.5)', border: '1px solid rgba(0,255,136,0.15)' }}>
          <div className="flex items-center gap-2">
            <div className="text-[8px]" style={{ color: 'rgba(0,255,136,0.5)' }}>ΔV</div>
            <div className="w-24 h-2 rounded-sm overflow-hidden" style={{ background: 'rgba(0,255,136,0.1)' }}>
              <div className="h-full rounded-sm transition-all duration-500" style={{
                width: `${dvPercent}%`,
                background: dvColor,
              }} />
            </div>
            <div className="text-[10px] font-bold" style={{ color: dvColor }}>
              {remainingDeltaV.toFixed(0)}
            </div>
            <div className="text-[7px]" style={{ color: 'rgba(0,255,136,0.4)' }}>m/s</div>
          </div>
        </div>
      </div>

      {/* ===== BOTTOM RIGHT: Fuel ===== */}
      <div className="absolute bottom-16 right-4">
        <div className="px-2 py-1.5 rounded" style={{ background: 'rgba(0,20,10,0.5)', border: '1px solid rgba(0,255,136,0.15)' }}>
          <div className="flex items-center gap-2">
            <div className="text-[8px]" style={{ color: 'rgba(0,255,136,0.5)' }}>FUEL</div>
            <div className="text-[10px] font-bold" style={{ color: fuelMass > 5 ? '#00ff88' : '#ff4444' }}>
              {fuelMass.toFixed(0)} kg
            </div>
          </div>
        </div>
      </div>

      {/* ===== BOTTOM CENTER: Status line ===== */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <div className="flex items-center gap-4 px-4 py-1.5 rounded-full" style={{ background: 'rgba(0,20,10,0.4)', border: '1px solid rgba(0,255,136,0.15)' }}>
          <span className="text-[9px]" style={{ color: 'rgba(0,255,136,0.6)' }}>
            APG {orbInfo.altitude > 0 ? (orbInfo.altitude / 1000).toFixed(1) : '---'} / 
            PPG {(orbInfo.perigee / 1000).toFixed(0)} / 
            APG {(orbInfo.apogee / 1000).toFixed(0)}
          </span>
          <div className="w-px h-3" style={{ background: 'rgba(0,255,136,0.2)' }} />
          <span className="text-[9px]" style={{ color: 'rgba(0,255,136,0.6)' }}>
            T+ {Math.floor((orbInfo.period || 0) / 60)}:{(Math.floor(orbInfo.period || 0) % 60).toString().padStart(2, '0')}
          </span>
          <div className="w-px h-3" style={{ background: 'rgba(0,255,136,0.2)' }} />
          <span className="text-[9px]" style={{ color: thrust ? '#00ccff' : 'rgba(0,255,136,0.4)' }}>
            {thrust ? '■ ENGINE ON' : '□ COAST'}
          </span>
        </div>
      </div>

      {/* ===== TOP LEFT: Mode indicator ===== */}
      <div className="absolute top-3 left-4">
        <div className="px-2 py-1 rounded" style={{ background: 'rgba(0,20,10,0.4)', border: '1px solid rgba(0,255,136,0.1)' }}>
          <span className="text-[8px]" style={{ color: 'rgba(0,255,136,0.5)' }}>
            {gameMode === 'nanosat' ? 'DEPLOYER' : 'JANITOR'} • FPV
          </span>
        </div>
      </div>

      {/* ===== TOP RIGHT: Orbit shape indicator ===== */}
      <div className="absolute top-3 right-4">
        <div className="px-2 py-1 rounded" style={{ background: 'rgba(0,20,10,0.4)', border: '1px solid rgba(0,255,136,0.1)' }}>
          <span className="text-[8px]" style={{ color: 'rgba(0,255,136,0.5)' }}>
            ECC {orbInfo.eccentricity.toFixed(4)} • {(orbInfo.period / 60).toFixed(0)} min
          </span>
        </div>
      </div>

      {/* ===== Pitch Ladder (left-center) ===== */}
      <div className="absolute left-20 top-1/2 -translate-y-1/2">
        <PitchLadder pitch={pitchDeg} />
      </div>
    </div>
  );
}

/** Pitch ladder — horizontal lines showing pitch angle */
function PitchLadder({ pitch }: { pitch: number }) {
  // Show pitch lines from -30° to +30° in 10° steps
  const lines = [-30, -20, -10, 0, 10, 20, 30];
  const visibleRange = 30; // degrees visible on screen

  return (
    <svg width="60" height="200" viewBox="-30 -100 60 200" className="opacity-60">
      {lines.map(deg => {
        // Position: 0° = center, each 10° = 30px
        const y = -(deg * (80 / visibleRange));
        const isCenter = deg === 0;
        const halfWidth = isCenter ? 25 : 18;

        return (
          <g key={deg}>
            <line
              x1={-halfWidth} y1={y} x2={halfWidth} y2={y}
              stroke={isCenter ? '#00ff88' : 'rgba(0,255,136,0.4)'}
              strokeWidth={isCenter ? 1.5 : 1}
            />
            {/* Degree label */}
            {deg !== 0 && (
              <text
                x={halfWidth + 3} y={y + 3}
                fontSize="7" fill="rgba(0,255,136,0.5)" fontFamily="monospace"
              >
                {deg}
              </text>
            )}
          </g>
        );
      })}
      {/* Current pitch indicator (small triangle) */}
      <polygon
        points="0,-2 -3,4 3,4"
        fill="#00ff88"
        transform={`translate(0, ${-(pitch * (80 / visibleRange))})`}
      />
    </svg>
  );
}
