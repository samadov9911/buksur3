/**
 * MobileJoystick — virtual controls for smartphones
 * Supports both portrait and landscape orientations
 * Layout:
 *   - Bottom-left: Orientation joystick (pitch/yaw)
 *   - Bottom-left below joystick: Roll buttons (↶/↷)
 *   - Bottom-right: Thrust + orbital adjustment buttons
 *   - Bottom-center: Context action button (ЗАХВАТ/СТЫКОВКА/СНИЖЕНИЕ/ДАЛЕЕ)
 * Camera/pause moved to HUD top bar — no duplicates here
 */
'use client';

import { useRef, useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useGameStore } from '@/game/store/gameStore';

function useIsPortrait() {
  const [isPortrait, setIsPortrait] = useState(false);
  useEffect(() => {
    const update = () => setIsPortrait(window.innerHeight > window.innerWidth);
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  return isPortrait;
}

interface JoystickState {
  active: boolean;
  x: number; // -1 to 1
  y: number; // -1 to 1
  touchId: number | null;
}

interface MobileJoystickProps {
  onOrientation?: (x: number, y: number) => void;
  onThrust?: (x: number, y: number) => void;
  onRoll?: (value: number) => void;
}

function VirtualJoystick({
  baseSize = 90,
  stickSize = 36,
  label,
  color = 'cyan',
  onMove,
}: {
  baseSize?: number;
  stickSize?: number;
  label: string;
  color?: 'cyan' | 'amber' | 'emerald';
  onMove: (x: number, y: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<JoystickState>({
    active: false,
    x: 0,
    y: 0,
    touchId: null,
  });

  const [stickPos, setStickPos] = useState({ x: 0, y: 0, active: false });

  const colorClasses = {
    cyan: {
      base: 'border-cyan-500/50 bg-cyan-950/40',
      stick: 'bg-cyan-400/80 border-cyan-400/70',
      label: 'text-cyan-400/80',
    },
    amber: {
      base: 'border-amber-500/50 bg-amber-950/40',
      stick: 'bg-amber-400/80 border-amber-400/70',
      label: 'text-amber-400/80',
    },
    emerald: {
      base: 'border-emerald-500/50 bg-emerald-950/40',
      stick: 'bg-emerald-400/80 border-emerald-400/70',
      label: 'text-emerald-400/80',
    },
  };

  const cc = colorClasses[color];
  const maxDist = baseSize / 2 - stickSize / 2 - 2;

  const getCenter = useCallback(() => {
    if (!containerRef.current) return { cx: 0, cy: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
  }, []);

  const handleStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (stateRef.current.active) return;

    const touch = e.changedTouches[0];
    stateRef.current = {
      active: true,
      x: 0,
      y: 0,
      touchId: touch.identifier,
    };
  }, []);

  const handleMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const state = stateRef.current;
    if (!state.active || state.touchId === null) return;

    let touch: React.Touch | null = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === state.touchId) {
        touch = e.touches[i];
        break;
      }
    }
    if (!touch) return;

    const { cx, cy } = getCenter();
    const dx = touch.clientX - cx;
    const dy = touch.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const clampedDist = Math.min(dist, maxDist);
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;

    state.x = nx * (clampedDist / maxDist);
    state.y = ny * (clampedDist / maxDist);

    onMove(state.x, -state.y);
  }, [maxDist, getCenter, onMove]);

  const handleEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    stateRef.current = {
      active: false,
      x: 0,
      y: 0,
      touchId: null,
    };
    onMove(0, 0);
    useGameStore.getState().setMobileInput({ orientX: 0, orientY: 0, thrustX: 0, thrustY: 0 });
  }, [onMove]);

  // Multi-touch global handlers
  useEffect(() => {
    const handleGlobalMove = (e: TouchEvent) => {
      if (!stateRef.current.active || stateRef.current.touchId === null) return;
      let touch: Touch | null = null;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === stateRef.current.touchId) {
          touch = e.touches[i];
          break;
        }
      }
      if (!touch) return;

      const { cx, cy } = getCenter();
      const dx = touch.clientX - cx;
      const dy = touch.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const clampedDist = Math.min(dist, maxDist);
      const nx = dist > 0 ? dx / dist : 0;
      const ny = dist > 0 ? dy / dist : 0;

      stateRef.current.x = nx * (clampedDist / maxDist);
      stateRef.current.y = ny * (clampedDist / maxDist);
      setStickPos({ x: nx * (clampedDist / maxDist), y: -ny * (clampedDist / maxDist), active: true });
      onMove(stateRef.current.x, -stateRef.current.y);
    };

    const handleGlobalEnd = (e: TouchEvent) => {
      if (!stateRef.current.active) return;
      let found = false;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === stateRef.current.touchId) {
          found = true;
          break;
        }
      }
      if (!found) {
        stateRef.current = { active: false, x: 0, y: 0, touchId: null };
        setStickPos({ x: 0, y: 0, active: false });
        onMove(0, 0);
      }
    };

    window.addEventListener('touchmove', handleGlobalMove, { passive: false });
    window.addEventListener('touchend', handleGlobalEnd, { passive: false });
    window.addEventListener('touchcancel', handleGlobalEnd, { passive: false });

    return () => {
      window.removeEventListener('touchmove', handleGlobalMove);
      window.removeEventListener('touchend', handleGlobalEnd);
      window.removeEventListener('touchcancel', handleGlobalEnd);
    };
  }, [maxDist, getCenter, onMove]);

  const stickX = stickPos.x * maxDist;
  const stickY = stickPos.y * maxDist;

  return (
    <div className="flex flex-col items-center">
      <span className={`text-[7px] font-semibold tracking-wider ${cc.label} mb-0.5`}>{label}</span>
      <div
        ref={containerRef}
        className={`relative rounded-full border ${cc.base}`}
        style={{
          width: baseSize,
          height: baseSize,
          boxShadow: `0 0 16px rgba(${color === 'cyan' ? '0,200,255' : color === 'amber' ? '250,180,0' : '50,220,150'},0.15), inset 0 0 12px rgba(${color === 'cyan' ? '0,200,255' : color === 'amber' ? '250,180,0' : '50,220,150'},0.08)`,
        }}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        onTouchCancel={handleEnd}
      >
        {/* Crosshair guides */}
        <div className="absolute top-1/2 left-2 right-2 h-px bg-white/10 -translate-y-1/2" />
        <div className="absolute left-1/2 top-2 bottom-2 w-px bg-white/10 -translate-x-1/2" />

        {/* Stick */}
        <div
          className={`absolute rounded-full border ${cc.stick} transition-shadow duration-100`}
          style={{
            width: stickSize,
            height: stickSize,
            left: `calc(50% - ${stickSize / 2}px + ${stickX}px)`,
            top: `calc(50% - ${stickSize / 2}px + ${stickY}px)`,
            boxShadow: stickPos.active ? `0 0 12px rgba(${color === 'cyan' ? '0,200,255' : color === 'amber' ? '250,180,0' : '50,220,150'},0.4)` : 'none',
          }}
        />
      </div>
    </div>
  );
}

/** Action buttons for mobile — bottom right area */
function ActionButtons({ isPortrait }: { isPortrait: boolean }) {
  const [thrustActive, setThrustActive] = useState(false);

  const handleThrustStart = useCallback(() => {
    setThrustActive(true);
    useGameStore.getState().setThrust(true);
  }, []);

  const handleThrustEnd = useCallback(() => {
    setThrustActive(false);
    useGameStore.getState().setThrust(false);
  }, []);

  // Ultra-compact buttons — 40% smaller
  const btnH = isPortrait ? 'h-7' : 'h-8';
  const btnW = isPortrait ? 'w-7' : 'w-8';
  const textSize = isPortrait ? 'text-[7px]' : 'text-[8px]';

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Row 1: H+/H- + i+/i- — 2x2 grid */}
      <div className="grid grid-cols-2 gap-0.5">
        <button
          onTouchStart={(e) => { e.preventDefault(); useGameStore.getState().requestAltitudeChange(10); }}
          className={`${btnW} ${btnH} rounded flex items-center justify-center font-bold active:scale-90 transition-all bg-emerald-950/30 border border-emerald-500/30 text-emerald-400 active:bg-emerald-500/20 ${textSize}`}
        >
          H+
        </button>
        <button
          onTouchStart={(e) => { e.preventDefault(); useGameStore.getState().requestAltitudeChange(-10); }}
          className={`${btnW} ${btnH} rounded flex items-center justify-center font-bold active:scale-90 transition-all bg-red-950/30 border border-red-500/30 text-red-400 active:bg-red-500/20 ${textSize}`}
        >
          H−
        </button>
        <button
          onTouchStart={(e) => { e.preventDefault(); useGameStore.getState().requestInclinationChange(1); }}
          className={`${btnW} ${btnH} rounded flex items-center justify-center font-bold active:scale-90 transition-all bg-amber-950/30 border border-amber-500/30 text-amber-400 active:bg-amber-500/20 ${textSize}`}
        >
          i+
        </button>
        <button
          onTouchStart={(e) => { e.preventDefault(); useGameStore.getState().requestInclinationChange(-1); }}
          className={`${btnW} ${btnH} rounded flex items-center justify-center font-bold active:scale-90 transition-all bg-orange-950/30 border border-orange-500/30 text-orange-400 active:bg-orange-500/20 ${textSize}`}
        >
          i−
        </button>
      </div>

      {/* Row 2: Thrust forward/reverse — prominent buttons */}
      <div className="flex gap-0.5">
        <button
          onTouchStart={(e) => { e.preventDefault(); useGameStore.getState().setThrust(true); }}
          onTouchEnd={(e) => { e.preventDefault(); useGameStore.getState().setThrust(false); }}
          onTouchCancel={() => useGameStore.getState().setThrust(false)}
          className={`${isPortrait ? 'w-10' : 'w-11'} ${btnH} rounded border flex items-center justify-center transition-all bg-red-950/30 border-red-500/30 active:bg-red-500/25`}
        >
          <svg width={isPortrait ? 10 : 12} height={isPortrait ? 10 : 12} viewBox="0 0 16 16" fill="none">
            <path d="M4 12 L8 4 L12 12" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          onTouchStart={handleThrustStart}
          onTouchEnd={handleThrustEnd}
          onTouchCancel={handleThrustEnd}
          className={`${isPortrait ? 'w-10' : 'w-11'} ${btnH} rounded border flex items-center justify-center transition-all ${
            thrustActive
              ? 'bg-cyan-500/30 border-cyan-400/60 shadow-lg shadow-cyan-500/20'
              : 'bg-cyan-950/30 border-cyan-500/30'
          }`}
        >
          <svg width={isPortrait ? 10 : 12} height={isPortrait ? 10 : 12} viewBox="0 0 16 16" fill="none">
            <path d="M4 4 L8 12 L12 4" stroke={thrustActive ? '#22d3ee' : '#67e8f9'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Row 3: Time warp — only in portrait (more screen space) */}
      {isPortrait && (
        <div className="flex gap-0.5">
          <button
            onTouchStart={(e) => { e.preventDefault(); useGameStore.getState().decreaseTimeWarp(); }}
            className="w-8 h-6 rounded bg-gray-800/40 border border-white/10 flex items-center justify-center text-gray-400 text-[7px] font-bold active:scale-90 transition-all"
          >
            W−
          </button>
          <button
            onTouchStart={(e) => { e.preventDefault(); useGameStore.getState().increaseTimeWarp(); }}
            className="w-8 h-6 rounded bg-gray-800/40 border border-white/10 flex items-center justify-center text-gray-400 text-[7px] font-bold active:scale-90 transition-all"
          >
            W+
          </button>
        </div>
      )}
    </div>
  );
}

/** Roll buttons — below the orientation joystick */
function RollButtons({ isPortrait }: { isPortrait: boolean }) {
  const btnSize = isPortrait ? 'w-7 h-7' : 'w-8 h-8';
  const textSize = isPortrait ? 'text-[8px]' : 'text-[9px]';

  return (
    <div className="flex items-center gap-0.5 mt-0.5">
      <button
        onTouchStart={(e) => { e.preventDefault(); useGameStore.getState().setMobileRoll(-1); }}
        onTouchEnd={(e) => { e.preventDefault(); useGameStore.getState().setMobileRoll(0); }}
        onTouchCancel={() => useGameStore.getState().setMobileRoll(0)}
        className={`${btnSize} rounded border flex items-center justify-center active:scale-90 transition-all bg-purple-950/25 border-purple-500/25 active:bg-purple-500/20 ${textSize} text-purple-300 font-bold`}
      >
        ↶
      </button>
      <span className="text-[6px] text-purple-500/50 font-semibold tracking-wider">КРЕН</span>
      <button
        onTouchStart={(e) => { e.preventDefault(); useGameStore.getState().setMobileRoll(1); }}
        onTouchEnd={(e) => { e.preventDefault(); useGameStore.getState().setMobileRoll(0); }}
        onTouchCancel={() => useGameStore.getState().setMobileRoll(0)}
        className={`${btnSize} rounded border flex items-center justify-center active:scale-90 transition-all bg-purple-950/25 border-purple-500/25 active:bg-purple-500/20 ${textSize} text-purple-300 font-bold`}
      >
        ↷
      </button>
    </div>
  );
}

/** Detect touch-capable mobile device (works in portrait AND landscape) */
function useIsTouchDevice() {
  // useSyncExternalStore avoids the setState-in-effect lint warning
  // and is the recommended React pattern for client-only derived values
  return useSyncExternalStore(
    () => () => {}, // subscribe — no-op, touch capability doesn't change at runtime
    () => {
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isMobileUA = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      return hasTouch && (isMobileUA || window.innerWidth < 1024);
    },
    () => false, // SSR fallback
  );
}

export default function MobileJoystick({ onOrientation, onThrust, onRoll }: MobileJoystickProps) {
  const isMobile = useIsTouchDevice();
  const isPortrait = useIsPortrait();
  const orientationRef = useRef(onOrientation);
  const thrustRef = useRef(onThrust);
  const rollRef = useRef(onRoll);

  useEffect(() => { orientationRef.current = onOrientation; }, [onOrientation]);
  useEffect(() => { thrustRef.current = onThrust; }, [onThrust]);
  useEffect(() => { rollRef.current = onRoll; }, [onRoll]);

  const handleOrientationMove = useCallback((x: number, y: number) => {
    orientationRef.current?.(x, y);
    useGameStore.getState().setMobileInput({
      orientX: x,
      orientY: y,
      thrustX: 0,
      thrustY: 0,
    });
  }, []);

  if (!isMobile) return null;

  // Ultra-compact sizes: 40% smaller
  const joystickBase = isPortrait ? 64 : 80;
  const joystickStick = isPortrait ? 26 : 30;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 40 }}>
      {/* ═══════════════════════════════════════════════════════
           BOTTOM-LEFT: Orientation joystick + Roll buttons
           BOTTOM-RIGHT: Thrust + orbital adjustment buttons
           BOTTOM-CENTER: Context action button (ЗАХВАТ/СТЫКОВКА)
           ═══════════════════════════════════════════════════════ */}

      {/* Left: Orientation joystick + Roll */}
      <div className="absolute left-1.5 pointer-events-auto" style={{ bottom: 'max(0.5rem, calc(0.5rem + env(safe-area-inset-bottom, 0px)))' }}>
        <VirtualJoystick
          baseSize={joystickBase}
          stickSize={joystickStick}
          label="ОРИЕНТ"
          color="cyan"
          onMove={handleOrientationMove}
        />
        <RollButtons isPortrait={isPortrait} />
      </div>

      {/* Right: Action buttons */}
      <div className="absolute right-1.5 pointer-events-auto" style={{ bottom: 'max(0.5rem, calc(0.5rem + env(safe-area-inset-bottom, 0px)))' }}>
        <ActionButtons isPortrait={isPortrait} />
      </div>

      {/* Center: Context action button */}
      <MobileActionButton isPortrait={isPortrait} />
    </div>
  );
}

/** Central action button (equivalent to SPACE key) — ЗАХВАТ / СТЫКОВКА / СНИЖЕНИЕ / ДАЛЕЕ */
function MobileActionButton({ isPortrait }: { isPortrait: boolean }) {
  const gameMode = useGameStore(s => s.gameMode);
  const canCapture = useGameStore(s => s.canCapture);
  const canDeploy = useGameStore(s => s.canDeploy);
  const captureState = useGameStore(s => s.captureState);
  const deploymentState = useGameStore(s => s.deploymentState);

  const getAction = () => {
    if (gameMode === 'janitor') {
      if (canCapture && captureState === 'approaching') return { label: '🤖 ЗАХВАТ', color: 'emerald' as const };
      if (captureState === 'captured') return { label: '🔥 СНИЖЕНИЕ', color: 'red' as const };
      return null;
    }
    if (gameMode === 'nanosat') {
      if (canDeploy && deploymentState === 'approaching') return { label: '🛰 СТЫКОВКА', color: 'cyan' as const };
      if (deploymentState === 'undocked') return { label: '➡️ ДАЛЕЕ', color: 'emerald' as const };
      return null;
    }
    return null;
  };

  const action = getAction();
  if (!action) return null;

  const handleAction = () => {
    const gs = useGameStore.getState();
    if (gameMode === 'janitor') {
      if (canCapture && captureState === 'approaching') gs.setCaptureState('capturing');
      if (captureState === 'captured') gs.setCaptureState('deorbiting');
    } else if (gameMode === 'nanosat') {
      if (canDeploy && deploymentState === 'approaching') gs.setDeploymentState('aligning');
      if (deploymentState === 'undocked') {
        const remaining = (gs.selectedSatCount || 1) - gs.deployedSats;
        if (remaining > 0) {
          gs.setDeploymentState('approaching');
        }
      }
    }
  };

  const colorMap = {
    cyan: 'bg-cyan-500/30 border-cyan-400/60 text-cyan-200 shadow-lg shadow-cyan-500/15',
    emerald: 'bg-emerald-500/30 border-emerald-400/60 text-emerald-200 shadow-lg shadow-emerald-500/15 animate-pulse',
    red: 'bg-red-500/30 border-red-400/60 text-red-200 shadow-lg shadow-red-500/15',
  };

  // Ultra-compact: 40% smaller
  const btnSize = isPortrait
    ? 'px-3 py-2 text-[9px]'
    : 'px-4 py-2.5 text-[10px]';

  return (
    <div className="absolute left-1/2 -translate-x-1/2 pointer-events-auto z-40" style={{ bottom: 'max(0.5rem, calc(0.5rem + env(safe-area-inset-bottom, 0px)))' }}>
      <button
        onTouchStart={(e) => { e.preventDefault(); handleAction(); }}
        className={`rounded-lg border font-bold tracking-wide active:scale-95 transition-all min-h-[36px] ${btnSize} ${colorMap[action.color]}`}
      >
        {action.label}
      </button>
    </div>
  );
}
