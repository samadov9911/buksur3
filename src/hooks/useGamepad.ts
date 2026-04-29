/**
 * Крюк для работы с Gamepad API
 * Поддержка Xbox, PlayStation, универсальных USB-джойстиков
 * Автоопределение — управление по умолчанию, джойстик при подключении
 */
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface GamepadInput {
  leftStickX: number;
  leftStickY: number;
  rightStickX: number;
  rightStickY: number;
  leftTrigger: number;
  rightTrigger: number;
  buttonA: boolean;
  buttonB: boolean;
  buttonX: boolean;
  buttonY: boolean;
  buttonLB: boolean;
  buttonRB: boolean;
  buttonStart: boolean;
  buttonSelect: boolean;
  dpadUp: boolean;
  dpadDown: boolean;
  dpadLeft: boolean;
  dpadRight: boolean;
  connected: boolean;
  name: string;
}

const DEFAULT_INPUT: GamepadInput = {
  leftStickX: 0, leftStickY: 0,
  rightStickX: 0, rightStickY: 0,
  leftTrigger: 0, rightTrigger: 0,
  buttonA: false, buttonB: false, buttonX: false, buttonY: false,
  buttonLB: false, buttonRB: false,
  buttonStart: false, buttonSelect: false,
  dpadUp: false, dpadDown: false, dpadLeft: false, dpadRight: false,
  connected: false,
  name: '',
};

export function useGamepad() {
  const [input, setInput] = useState<GamepadInput>(DEFAULT_INPUT);
  const [connected, setConnected] = useState(false);
  const [gamepadName, setGamepadName] = useState('');
  const rafRef = useRef<number>(0);
  const prevInputRef = useRef<GamepadInput>(DEFAULT_INPUT);
  const onButtonPressRef = useRef<((button: string) => void) | null>(null);
  const pollRef = useRef<() => void>(() => {});

  // Слушатели подключения/отключения джойстика
  useEffect(() => {
    const handleConnect = (e: GamepadEvent) => {
      const gp = e.gamepad;
      setConnected(true);
      setGamepadName(gp.id || 'Gamepad');
      console.log('[Gamepad] Подключён:', gp.id);
    };
    const handleDisconnect = () => {
      setConnected(false);
      setGamepadName('');
      setInput(DEFAULT_INPUT);
      console.log('[Gamepad] Отключён');
    };

    window.addEventListener('gamepadconnected', handleConnect);
    window.addEventListener('gamepaddisconnected', handleDisconnect);

    // Проверка уже подключённого джойстика при монтировании
    const checkExisting = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i] && gamepads[i].connected) {
          setConnected(true);
          setGamepadName(gamepads[i]!.id || 'Gamepad');
          break;
        }
      }
    };
    checkExisting();

    return () => {
      window.removeEventListener('gamepadconnected', handleConnect);
      window.removeEventListener('gamepaddisconnected', handleDisconnect);
    };
  }, []);

  const pollGamepad = useCallback(() => {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gamepad: Gamepad | null = null;

    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (gp && gp.connected) {
        gamepad = gp;
        break;
      }
    }

    if (gamepad) {
      const deadzone = 0.15;
      const applyDeadzone = (v: number): number => Math.abs(v) < deadzone ? 0 : v;
      const applyTriggerDeadzone = (v: number): number => v < 0.1 ? 0 : v;

      const newInput: GamepadInput = {
        leftStickX: applyDeadzone(gamepad.axes[0] || 0),
        leftStickY: applyDeadzone(gamepad.axes[1] || 0),
        rightStickX: applyDeadzone(gamepad.axes[2] || 0),
        rightStickY: applyDeadzone(gamepad.axes[3] || 0),
        leftTrigger: applyTriggerDeadzone(gamepad.buttons[6]?.value || 0),
        rightTrigger: applyTriggerDeadzone(gamepad.buttons[7]?.value || 0),
        buttonA: gamepad.buttons[0]?.pressed || false,
        buttonB: gamepad.buttons[1]?.pressed || false,
        buttonX: gamepad.buttons[2]?.pressed || false,
        buttonY: gamepad.buttons[3]?.pressed || false,
        buttonLB: gamepad.buttons[4]?.pressed || false,
        buttonRB: gamepad.buttons[5]?.pressed || false,
        buttonStart: gamepad.buttons[9]?.pressed || false,
        buttonSelect: gamepad.buttons[8]?.pressed || false,
        dpadUp: gamepad.buttons[12]?.pressed || false,
        dpadDown: gamepad.buttons[13]?.pressed || false,
        dpadLeft: gamepad.buttons[14]?.pressed || false,
        dpadRight: gamepad.buttons[15]?.pressed || false,
        connected: true,
        name: gamepad.id,
      };

      const prev = prevInputRef.current;
      if (onButtonPressRef.current) {
        if (newInput.buttonX && !prev.buttonX) onButtonPressRef.current('buttonX');
        if (newInput.buttonY && !prev.buttonY) onButtonPressRef.current('buttonY');
        if (newInput.buttonA && !prev.buttonA) onButtonPressRef.current('buttonA');
        if (newInput.buttonB && !prev.buttonB) onButtonPressRef.current('buttonB');
        if (newInput.buttonLB && !prev.buttonLB) onButtonPressRef.current('buttonLB');
        if (newInput.buttonRB && !prev.buttonRB) onButtonPressRef.current('buttonRB');
        if (newInput.buttonStart && !prev.buttonStart) onButtonPressRef.current('buttonStart');
        if (newInput.buttonSelect && !prev.buttonSelect) onButtonPressRef.current('buttonSelect');
        if (newInput.dpadUp && !prev.dpadUp) onButtonPressRef.current('dpadUp');
        if (newInput.dpadDown && !prev.dpadDown) onButtonPressRef.current('dpadDown');
      }

      prevInputRef.current = newInput;
      setInput(newInput);
    } else {
      setInput(prev => prev.connected ? { ...DEFAULT_INPUT } : prev);
    }

    rafRef.current = requestAnimationFrame(pollRef.current);
  }, []);

  useEffect(() => {
    pollRef.current = pollGamepad;
  }, [pollGamepad]);

  const setOnButtonPress = useCallback((handler: (button: string) => void) => {
    onButtonPressRef.current = handler;
  }, []);

  useEffect(() => {
    pollRef.current();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return { input, setOnButtonPress, connected, gamepadName };
}

/**
 * Крюк для клавиатурного управления (основной ввод по умолчанию)
 * Использует синхронный ref для мгновенного доступа из игрового цикла
 */
export function useKeyboardInput() {
  // Синхронный ref — обновляется СРАЗУ при keydown/keyup, без задержки React
  const keysRef = useRef<Record<string, boolean>>({});
  // React state для подписки компонентов (HUD и т.д.)
  const [input, setInput] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      setInput(prev => ({ ...prev, [e.code]: true }));
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
      setInput(prev => ({ ...prev, [e.code]: false }));
    };
    // Clear all keys when window loses focus (prevents stuck keys)
    const handleBlur = () => {
      Object.keys(keysRef.current).forEach(key => {
        keysRef.current[key] = false;
      });
      setInput({});
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const isPressed = useCallback((code: string) => {
    return !!input[code];
  }, [input]);

  return { input, keysRef, isPressed };
}
