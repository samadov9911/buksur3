/**
 * Главная страница приложения — симулятор ORBITAL TUG
 * Всё рендерится на одном маршруте /
 */
'use client';

import dynamic from 'next/dynamic';
import React, { useEffect } from 'react';

// Динамический импорт без SSR (Three.js требует window/document)
const Game = dynamic(() => import('@/components/game/Game'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl font-black text-cyan-400 mb-4 tracking-wider">ORBITAL TUG</div>
        <div className="animate-pulse text-gray-400">Загрузка симулятора...</div>
        <div className="mt-4 w-48 h-1 bg-gray-800 rounded-full mx-auto overflow-hidden">
          <div className="h-full bg-cyan-500 rounded-full animate-pulse" style={{ width: '60%' }} />
        </div>
      </div>
    </div>
  ),
});

// Client-side error boundary — catches render errors and shows recoverable UI
class GameErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null; errorInfo: string | null }
> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Game Error Boundary]', error, errorInfo);
    // Store error info for display
    const info = errorInfo.componentStack
      ? errorInfo.componentStack.split('\n').slice(0, 5).join('\n')
      : error.message;
    this.setState({ errorInfo: info });
  }
  handleReset = () => {
    this.retryCount++;
    if (this.retryCount >= this.maxRetries) {
      // Too many retries — do full reset
      this.handleFullReset();
      return;
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
  };
  handleFullReset = () => {
    this.retryCount = 0;
    // Full reset: clear all game state and go to splash
    try {
      const { useGameStore } = require('@/game/store/gameStore');
      const store = useGameStore.getState();
      store.resetGame();
      store.setScreen('splash');
    } catch (resetErr) {
      console.error('[GameErrorBoundary] Reset failed:', resetErr);
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
  };
  render() {
    if (this.state.hasError) {
      const error = this.state.error;
      const isWebGLError = error?.message?.includes('WebGL')
        || error?.message?.includes('canvas')
        || error?.message?.includes('context')
        || error?.message?.includes('GPU')
        || error?.message?.includes('renderer');
      return (
        <div className="w-full h-screen bg-black flex items-center justify-center p-4 overflow-y-auto">
          <div className="text-center max-w-md">
            <div className="text-3xl font-black text-cyan-400 mb-2 tracking-wider">ORBITAL TUG</div>
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-red-400 mb-2">Ошибка симулятора</h2>
            <p className="text-sm text-gray-400 mb-3">
              Произошла ошибка. Попробуйте перезапустить.
            </p>

            {/* Error details — always visible for debugging */}
            <div className="bg-gray-900/80 rounded-lg border border-white/10 p-3 mb-4 text-left max-h-32 overflow-y-auto">
              <p className="text-[10px] text-gray-500 font-semibold mb-1 tracking-wider">ДЕТАЛИ ОШИБКИ</p>
              <p className="text-xs text-red-300 font-mono break-all leading-relaxed">
                {error?.message || 'Неизвестная ошибка'}
              </p>
              {this.state.errorInfo && (
                <details className="mt-2">
                  <summary className="text-[10px] text-gray-600 cursor-pointer">Стек вызовов</summary>
                  <pre className="text-[9px] text-gray-500 font-mono mt-1 whitespace-pre-wrap break-all">{this.state.errorInfo}</pre>
                </details>
              )}
            </div>

            {/* WebGL hint */}
            {isWebGLError && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4 text-left">
                <p className="text-xs text-amber-400 font-semibold mb-1">Проблема с 3D-графикой:</p>
                <p className="text-xs text-gray-400">
                  Ваше устройство не поддерживает WebGL. Попробуйте обновить браузер или использовать Chrome/Safari.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2 items-center">
              <button
                onClick={this.handleReset}
                className="px-6 py-2.5 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-bold text-sm hover:bg-cyan-500/30 active:scale-95 transition-all"
              >
                🔄 Повторить ({this.maxRetries - this.retryCount})
              </button>
              <button
                onClick={this.handleFullReset}
                className="px-6 py-2.5 rounded-lg bg-gray-500/10 border border-gray-500/30 text-gray-400 font-bold text-sm hover:bg-gray-500/20 active:scale-95 transition-all"
              >
                🏠 В главное меню
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Home() {
  // Global error handlers — catch errors from setTimeout, rAF, event handlers, etc.
  // These are NOT caught by React error boundaries
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('[Global Error]', event.error);
      // Prevent default browser error handling for game errors
      if (event.message && (
        event.message.includes('WebGL') ||
        event.message.includes('canvas') ||
        event.message.includes('context') ||
        event.message.includes('renderer') ||
        event.message.includes('orbit') ||
        event.message.includes('mission')
      )) {
        event.preventDefault();
      }
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('[Global Unhandled Rejection]', event.reason);
      event.preventDefault();
    };
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return (
    <main className="w-full h-screen overflow-hidden">
      <GameErrorBoundary>
        <Game />
      </GameErrorBoundary>
    </main>
  );
}
