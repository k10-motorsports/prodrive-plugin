/**
 * WebGL Provider Component
 * Manages WebGL effects initialization and provides methods to child components
 * Uses React Context to expose WebGL control methods
 */

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useSettings } from '@hooks/useSettings';
import { WebGLManager } from '@lib/webgl/WebGLManager';

interface WebGLContextType {
  manager: WebGLManager | null;
}

const WebGLContext = createContext<WebGLContextType>({ manager: null });

export function useWebGLManager(): WebGLManager | null {
  const { manager } = useContext(WebGLContext);
  return manager;
}

interface WebGLProviderProps {
  children: ReactNode;
}

export function WebGLProvider({ children }: WebGLProviderProps) {
  const { settings } = useSettings();
  const managerRef = useRef<WebGLManager | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  // State to force re-render when manager is initialized so context consumers get the instance
  const [managerReady, setManagerReady] = useState(false);

  useEffect(() => {
    // Skip if WebGL effects are disabled
    if (!settings.showWebGL) {
      // Clean up if previously initialized
      if (managerRef.current) {
        managerRef.current.dispose();
        managerRef.current = null;
        setManagerReady(false);
      }
      return;
    }

    // Defer initialization to allow all canvas elements to be rendered
    const initTimer = setTimeout(() => {
      if (managerRef.current) {
        // Already initialized
        return;
      }

      // Collect all canvas elements
      const canvasMap: Record<string, HTMLCanvasElement> = {};
      const canvasIds = [
        'tachoGlCanvas',
        'pedalsGlCanvas',
        'flagGlCanvas',
        'lbPlayerGlCanvas',
        'lbEventGlCanvas',
        'k10LogoGlCanvas',
        'spotterGlCanvas',
        'commentaryGlCanvas',
        'pitGlCanvas',
        'incGlCanvas',
        'gridFlagGlCanvas',
      ];

      let validCanvasCount = 0;
      canvasIds.forEach((id) => {
        const canvas = document.getElementById(id) as HTMLCanvasElement;
        if (canvas instanceof HTMLCanvasElement) {
          canvasMap[id] = canvas;
          validCanvasCount++;
        }
      });

      if (validCanvasCount === 0) {
        console.warn('WebGLProvider: No canvas elements found');
        return;
      }

      console.log(`WebGLProvider: Initialized ${validCanvasCount} canvas elements`);

      // Initialize WebGL manager
      const manager = new WebGLManager();
      manager.init(canvasMap);
      managerRef.current = manager;
      setManagerReady(true);

      // Start RAF loop
      const animationLoop = (now: number) => {
        if (managerRef.current) {
          const dt = lastTimeRef.current > 0 ? (now - lastTimeRef.current) / 1000 : 0;
          lastTimeRef.current = now;
          managerRef.current.updateFrame(dt);
        }
        rafRef.current = requestAnimationFrame(animationLoop);
      };

      rafRef.current = requestAnimationFrame(animationLoop);
    }, 200); // Slightly longer delay to ensure all canvases are mounted

    return () => {
      clearTimeout(initTimer);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [settings.showWebGL]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (managerRef.current) {
        managerRef.current.dispose();
        managerRef.current = null;
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <WebGLContext.Provider value={{ manager: managerReady ? managerRef.current : null }}>
      {children}
    </WebGLContext.Provider>
  );
}
