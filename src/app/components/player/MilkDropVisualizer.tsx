'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

// Re-declare the interface locally since it's from ambient declarations
interface ButterchurnVisualizerInstance {
  setRendererSize(width: number, height: number, opts?: { pixelRatio?: number }): void;
  loadPreset(preset: object, blendTime?: number): void;
  launchSongTitleAnim(title: string): void;
  render(): void;
  connectAudio(audioNode: AnalyserNode): void;
  disconnectAudio(audioNode: AnalyserNode): void;
}

interface MilkDropVisualizerProps {
  isActive: boolean;
  audioContext: AudioContext | null;
  analyserNode: AnalyserNode | null;
  trackTitle?: string;
  activePreset?: string;
  onPresetsLoaded?: (presets: string[]) => void;
}

export const MilkDropVisualizer: React.FC<MilkDropVisualizerProps> = ({
  isActive,
  audioContext,
  analyserNode,
  trackTitle: _trackTitle,
  activePreset,
  onPresetsLoaded,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visualizerRef = useRef<ButterchurnVisualizerInstance | null>(null);
  const animationRef = useRef<number | null>(null);
  const connectedAnalyserRef = useRef<AnalyserNode | null>(null);
  const presetsRef = useRef<Record<string, object> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const butterchurnRef = useRef<any>(null);
  const [allPresetKeys, setAllPresetKeys] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLibraryLoaded, setIsLibraryLoaded] = useState(false);
  const presetsLoadedFired = useRef(false);

  // Load butterchurn libraries dynamically (client-side only)
  useEffect(() => {

    if (!isActive || isLibraryLoaded) return;

    const loadLibraries = async () => {

      try {
        // Import butterchurn
        const butterchurnModule = await import('butterchurn');

        // Import presets from specific bundle files
        const [presetsBaseModule, presetsExtraModule] = await Promise.all([
          import('butterchurn-presets/lib/butterchurnPresets.min.js'),
          import('butterchurn-presets/lib/butterchurnPresetsExtra.min.js'),
        ]);

        // Get presets - these modules export a default object with getPresets() method
        const presetsBase = presetsBaseModule.default.getPresets();
        const presetsExtra = presetsExtraModule.default.getPresets();

        // Merge all presets
        const allPresets = {
          ...presetsBase,
          ...presetsExtra,
        };



        // Store for later use
        butterchurnRef.current = butterchurnModule.default;
        presetsRef.current = allPresets;

        const keys = Object.keys(allPresets);


        // Use all available presets, shuffled
        if (keys.length > 0) {
          const shuffled = [...keys].sort(() => Math.random() - 0.5);
          setAllPresetKeys(shuffled);

        } else {
          console.error('Visualizer: No presets found');
        }

        setIsLibraryLoaded(true);


        // Notify parent if callbacks are waiting
        if (onPresetsLoaded && !presetsLoadedFired.current) {
          onPresetsLoaded(keys);
          presetsLoadedFired.current = true;
        }
      } catch (error) {
        console.error('Visualizer: Failed to load libraries', error);
      }
    };

    loadLibraries();
  }, [isActive, isLibraryLoaded, onPresetsLoaded]);

  // Handle resize - use container's actual dimensions
  const handleResize = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const visualizer = visualizerRef.current;

    if (container && canvas && visualizer) {
      // Get actual rendered dimensions from container (CSS handles viewport calculation)
      const rect = container.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      // Set canvas dimensions (capped at 2x to limit GPU load on high-DPI screens)
      const physicalWidth = Math.floor(width * pixelRatio);
      const physicalHeight = Math.floor(height * pixelRatio);

      canvas.width = physicalWidth;
      canvas.height = physicalHeight;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      // butterchurn expects physical pixel dimensions
      visualizer.setRendererSize(physicalWidth, physicalHeight);
    }
  }, []);

  // Initialize visualizer - wait for container to have valid dimensions
  useEffect(() => {


    if (!isActive || !canvasRef.current || !containerRef.current || !isLibraryLoaded || allPresetKeys.length === 0) {

      return;
    }

    // Skip if already initialized
    if (visualizerRef.current) {

      return;
    }

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const butterchurn = butterchurnRef.current;

    if (!butterchurn) {

      return;
    }

    // Function to actually create the visualizer once we have valid dimensions
    const createVisualizerWithDimensions = (width: number, height: number) => {
      if (visualizerRef.current) return; // Already created

      try {
        // Use provided audioContext — it is always set because useAudioManager
        // eagerly creates one on mount. If somehow null, bail out gracefully.
        if (!audioContext) {
          console.warn('Visualizer: audioContext not yet available, will retry on next activation');
          return;
        }

        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const physicalWidth = Math.floor(width * pixelRatio);
        const physicalHeight = Math.floor(height * pixelRatio);

        // Set canvas size
        canvas.width = physicalWidth;
        canvas.height = physicalHeight;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        // Create visualizer - butterchurn expects physical pixel dimensions
        const visualizer = butterchurn.createVisualizer(audioContext, canvas, {
          width: physicalWidth,
          height: physicalHeight,
          meshWidth: 64,
          meshHeight: 48,
        });


        visualizerRef.current = visualizer;

        // Load initial preset
        const presets = presetsRef.current;
        if (presets && allPresetKeys.length > 0) {
          const initialPresetKey = activePreset || allPresetKeys[0];
          const initialPreset = presets[initialPresetKey] || presets[allPresetKeys[0]];

          if (initialPreset) {
            visualizer.loadPreset(initialPreset, 0);

          }
        }

        setIsInitialized(true);

      } catch (error) {
        console.error('Visualizer: Failed to initialize', error);
      }
    };

    // Use ResizeObserver to wait for container to have valid dimensions
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;


        // Only initialize once we have valid dimensions (at least 100x100)
        if (width >= 100 && height >= 100 && !visualizerRef.current) {
          resizeObserver.disconnect(); // Stop observing after init
          createVisualizerWithDimensions(Math.floor(width), Math.floor(height));
        }
      }
    });

    resizeObserver.observe(container);

    // Fallback: check dimensions after a short delay in case ResizeObserver doesn't fire
    const fallbackTimeout = setTimeout(() => {
      if (visualizerRef.current) return; // Already initialized

      const rect = container.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);



      if (width >= 100 && height >= 100) {
        resizeObserver.disconnect();
        createVisualizerWithDimensions(width, height);
      }
    }, 100);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(fallbackTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, isLibraryLoaded, allPresetKeys, audioContext]);

  // Handle resize after initialization
  useEffect(() => {
    if (!isInitialized || !containerRef.current) return;

    const container = containerRef.current;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width >= 100 && height >= 100) {
          handleResize();
        }
      }
    });

    resizeObserver.observe(container);

    // ResizeObserver alone covers window resize and visual viewport changes
    return () => {
      resizeObserver.disconnect();
    };
  }, [isInitialized, handleResize]);

  // Connect/disconnect analyser
  useEffect(() => {
    const visualizer = visualizerRef.current;

    if (!visualizer || !isInitialized) return;

    // Disconnect previous analyser if different
    if (connectedAnalyserRef.current && connectedAnalyserRef.current !== analyserNode) {
      try {
        visualizer.disconnectAudio(connectedAnalyserRef.current);
      } catch {
        // Ignore disconnect errors
      }
      connectedAnalyserRef.current = null;
    }

    // Connect new analyser
    if (analyserNode && !connectedAnalyserRef.current) {
      try {
        visualizer.connectAudio(analyserNode);
        connectedAnalyserRef.current = analyserNode;
      } catch (error) {
        console.error('Visualizer: Failed to connect audio', error);
      }
    }
  }, [analyserNode, isInitialized]);

  // Animation loop
  useEffect(() => {


    if (!isActive || !isInitialized) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    console.info('Visualizer: Rendering started');

    const render = () => {
      if (visualizerRef.current) {
        visualizerRef.current.render();
      }
      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isActive, isInitialized]);

  // Respond to activePreset prop changes
  useEffect(() => {
    if (!isInitialized || !visualizerRef.current || !presetsRef.current || !activePreset) return;

    const presets = presetsRef.current;
    if (presets[activePreset]) {
      visualizerRef.current.loadPreset(presets[activePreset], 2.0); // 2 second blend

    }
  }, [activePreset, isInitialized]);

  // Removed auto-cycle presets interval and manual keyboard navigation
  // as preset authority now lies with Player.tsx and VisualizerPopup


  // Cleanup on unmount or when deactivated
  useEffect(() => {
    // When isActive becomes false, delay cleanup so the CSS fade-out can finish
    if (!isActive) {

      const cleanupTimer = setTimeout(() => {

        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
        if (connectedAnalyserRef.current && visualizerRef.current) {
          try {
            visualizerRef.current.disconnectAudio(connectedAnalyserRef.current);
          } catch {
            // Ignore
          }
        }
        visualizerRef.current = null;
        connectedAnalyserRef.current = null;
        setIsInitialized(false);
      }, 3100); // slightly longer than the 3s CSS transition

      return () => clearTimeout(cleanupTimer);
    }
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100dvh', // Dynamic viewport height for mobile (accounts for URL bar)
        zIndex: 5, // Above page background, below player UI (z-40) and navbar (z-50)
        pointerEvents: isActive ? 'auto' : 'none',
        overflow: 'hidden',
        background: '#000', // Black fallback background
        opacity: isActive ? 1 : 0,
        transition: isActive ? 'opacity 3.0s ease-in' : 'opacity 3.0s ease-out',
        visibility: isActive || isInitialized ? 'visible' : 'hidden'
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
      />

      {/* Loading indicator */}
      {!isInitialized && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white/70 text-lg font-medium p-4 bg-black/50 rounded-lg backdrop-blur-sm">
            Loading visualizer...
          </div>
        </div>
      )}
    </div>
  );
};
