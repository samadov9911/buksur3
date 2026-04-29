'use client';

import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ORBITAL TUG] Client error:', error);
  }, [error]);

  return (
    <div className="w-full h-screen bg-black flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {/* Logo */}
        <div className="text-3xl font-black text-cyan-400 mb-2 tracking-wider">ORBITAL TUG</div>
        <div className="text-sm text-gray-500 mb-6">Симулятор космического буксира</div>

        {/* Error icon */}
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        {/* Error message */}
        <h2 className="text-lg font-bold text-red-400 mb-2">Ошибка приложения</h2>
        <p className="text-sm text-gray-400 mb-2">
          Произошла ошибка при загрузке симулятора.
        </p>

        {/* Show error details on desktop */}
        <div className="hidden sm:block bg-gray-900/80 rounded-lg border border-white/10 p-3 mb-4 text-left">
          <p className="text-[10px] text-gray-500 font-semibold mb-1 tracking-wider">ДЕТАЛИ ОШИБКИ</p>
          <p className="text-xs text-red-300 font-mono break-all">{error.message}</p>
          {error.digest && (
            <p className="text-[10px] text-gray-600 mt-1">Digest: {error.digest}</p>
          )}
        </div>

        {/* WebGL hint */}
        {error.message?.includes('WebGL') || error.message?.includes('canvas') ? (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4 text-left">
            <p className="text-xs text-amber-400 font-semibold mb-1">Возможная причина:</p>
            <p className="text-xs text-gray-400">
              Ваш браузер не поддерживает WebGL или 3D-графику. Попробуйте обновить браузер или использовать Chrome/Safari.
            </p>
          </div>
        ) : null}

        {/* Retry button */}
        <button
          onClick={reset}
          className="px-6 py-2.5 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-bold text-sm tracking-wide hover:bg-cyan-500/30 hover:border-cyan-400/60 active:scale-95 transition-all"
        >
          Перезапустить симулятор
        </button>

        <p className="text-[10px] text-gray-600 mt-4">
          Если ошибка повторяется, попробуйте открыть страницу в другом браузере.
        </p>
      </div>
    </div>
  );
}
