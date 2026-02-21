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
}

export const MilkDropVisualizer: React.FC<MilkDropVisualizerProps> = ({
  isActive,
  audioContext,
  analyserNode,
  trackTitle,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visualizerRef = useRef<ButterchurnVisualizerInstance | null>(null);
  const animationRef = useRef<number | null>(null);
  const presetIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectedAnalyserRef = useRef<AnalyserNode | null>(null);
  const presetsRef = useRef<Record<string, object> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const butterchurnRef = useRef<any>(null);
  const localAudioContextRef = useRef<AudioContext | null>(null);
  const [currentPresetIndex, setCurrentPresetIndex] = useState(0);
  const [allPresetKeys, setAllPresetKeys] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLibraryLoaded, setIsLibraryLoaded] = useState(false);

  // Load butterchurn libraries dynamically (client-side only)
  useEffect(() => {
    console.log('MilkDrop: Library load effect', { isActive, isLibraryLoaded });
    if (!isActive || isLibraryLoaded) return;

    const loadLibraries = async () => {
      console.log('MilkDrop: Loading butterchurn libraries...');
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

        console.log('MilkDrop: Libraries loaded', { 
          hasButterchurn: !!butterchurnModule.default,
          presetCount: Object.keys(allPresets).length 
        });

        // Store for later use
        butterchurnRef.current = butterchurnModule.default;
        presetsRef.current = allPresets;

        const keys = Object.keys(allPresets);
        console.log('MilkDrop: Total presets available:', keys.length);
        console.log('MilkDrop: Sample preset names:', keys.slice(0, 5));
        
        // Use all available presets, shuffled
        if (keys.length > 0) {
          const shuffled = [...keys].sort(() => Math.random() - 0.5);
          setAllPresetKeys(shuffled);
          console.log('MilkDrop: Using', shuffled.length, 'presets');
        } else {
          console.error('MilkDrop: No presets found in bundle!');
        }

        setIsLibraryLoaded(true);
        console.log('MilkDrop: Library loading complete');
      } catch (error) {
        console.error('Failed to load butterchurn libraries:', error);
      }
    };

    loadLibraries();
  }, [isActive, isLibraryLoaded]);

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
      const pixelRatio = window.devicePixelRatio || 1;
      
      console.log('MilkDrop resize:', { width, height, pixelRatio });
      
      // Set canvas dimensions
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
    console.log('MilkDrop: Init effect', { 
      isActive, 
      hasCanvas: !!canvasRef.current, 
      isLibraryLoaded, 
      presetCount: allPresetKeys.length,
      hasVisualizer: !!visualizerRef.current
    });
    
    if (!isActive || !canvasRef.current || !containerRef.current || !isLibraryLoaded || allPresetKeys.length === 0) {
      console.log('MilkDrop: Init skipped - missing requirements');
      return;
    }

    // Skip if already initialized
    if (visualizerRef.current) {
      console.log('MilkDrop: Already initialized');
      return;
    }

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const butterchurn = butterchurnRef.current;
    
    if (!butterchurn) {
      console.log('MilkDrop: No butterchurn ref');
      return;
    }

    // Function to actually create the visualizer once we have valid dimensions
    const createVisualizerWithDimensions = (width: number, height: number) => {
      if (visualizerRef.current) return; // Already created
      
      console.log('MilkDrop: Creating visualizer with dimensions:', { width, height });
      
      try {
        // Use provided audioContext or create our own
        let ctx = audioContext;
        if (!ctx) {
          ctx = new AudioContext();
          localAudioContextRef.current = ctx;
          console.log('MilkDrop: Created local AudioContext');
        }

        const pixelRatio = window.devicePixelRatio || 1;
        const physicalWidth = Math.floor(width * pixelRatio);
        const physicalHeight = Math.floor(height * pixelRatio);
        
        // Set canvas size
        canvas.width = physicalWidth;
        canvas.height = physicalHeight;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        
        // Create visualizer - butterchurn expects physical pixel dimensions
        const visualizer = butterchurn.createVisualizer(ctx, canvas, {
          width: physicalWidth,
          height: physicalHeight,
          meshWidth: 64,
          meshHeight: 48,
        });

        console.log('MilkDrop: Visualizer created successfully');
        visualizerRef.current = visualizer;
        
        // Load initial preset
        const presets = presetsRef.current;
        if (presets) {
          const initialPreset = presets[allPresetKeys[0]];
          if (initialPreset) {
            visualizer.loadPreset(initialPreset, 0);
            console.log('MilkDrop: Loaded initial preset:', allPresetKeys[0]);
          }
        }

        setIsInitialized(true);
        console.log('MilkDrop: Initialization complete');
      } catch (error) {
        console.error('Failed to initialize MilkDrop visualizer:', error);
      }
    };

    // Use ResizeObserver to wait for container to have valid dimensions
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        console.log('MilkDrop: ResizeObserver detected:', { width, height });
        
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
      
      console.log('MilkDrop: Fallback dimension check:', { width, height });
      
      if (width >= 100 && height >= 100) {
        resizeObserver.disconnect();
        createVisualizerWithDimensions(width, height);
      }
    }, 100);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(fallbackTimeout);
    };
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
    
    // Also listen to window resize and visualViewport changes
    window.addEventListener('resize', handleResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
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
        console.error('Failed to connect audio to visualizer:', error);
      }
    }
  }, [analyserNode, isInitialized]);

  // Animation loop
  useEffect(() => {
    console.log('MilkDrop Animation effect:', { isActive, isInitialized, hasVisualizer: !!visualizerRef.current });
    
    if (!isActive || !isInitialized) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    console.log('MilkDrop: Starting animation loop');
    let frameCount = 0;
    
    const render = () => {
      if (visualizerRef.current) {
        visualizerRef.current.render();
        frameCount++;
        if (frameCount === 1 || frameCount % 300 === 0) {
          console.log('MilkDrop: Rendered', frameCount, 'frames');
        }
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

  // Auto-cycle presets every 30 seconds
  useEffect(() => {
    if (!isActive || !isInitialized || allPresetKeys.length === 0) {
      if (presetIntervalRef.current) {
        clearInterval(presetIntervalRef.current);
        presetIntervalRef.current = null;
      }
      return;
    }

    const cyclePreset = () => {
      const nextIndex = (currentPresetIndex + 1) % allPresetKeys.length;
      setCurrentPresetIndex(nextIndex);
      
      const presets = presetsRef.current;
      if (presets) {
        const nextPreset = presets[allPresetKeys[nextIndex]];
        
        if (visualizerRef.current && nextPreset) {
          // Smooth transition over 2 seconds
          visualizerRef.current.loadPreset(nextPreset, 2.0);
        }
      }
    };

    presetIntervalRef.current = setInterval(cyclePreset, 30000);

    return () => {
      if (presetIntervalRef.current) {
        clearInterval(presetIntervalRef.current);
        presetIntervalRef.current = null;
      }
    };
  }, [isActive, isInitialized, currentPresetIndex, allPresetKeys]);

  // Show track title animation when track changes
  useEffect(() => {
    if (!isActive || !isInitialized || !trackTitle || !visualizerRef.current) return;

    visualizerRef.current.launchSongTitleAnim(trackTitle);
  }, [trackTitle, isActive, isInitialized]);

  // Manual preset navigation
  const nextPreset = useCallback(() => {
    if (!isInitialized || allPresetKeys.length === 0) return;
    
    const nextIndex = (currentPresetIndex + 1) % allPresetKeys.length;
    setCurrentPresetIndex(nextIndex);
    
    const presets = presetsRef.current;
    if (presets) {
      const preset = presets[allPresetKeys[nextIndex]];
      
      if (visualizerRef.current && preset) {
        visualizerRef.current.loadPreset(preset, 1.0);
      }
    }
  }, [currentPresetIndex, allPresetKeys, isInitialized]);

  const prevPreset = useCallback(() => {
    if (!isInitialized || allPresetKeys.length === 0) return;
    
    const prevIndex = currentPresetIndex === 0 ? allPresetKeys.length - 1 : currentPresetIndex - 1;
    setCurrentPresetIndex(prevIndex);
    
    const presets = presetsRef.current;
    if (presets) {
      const preset = presets[allPresetKeys[prevIndex]];
      
      if (visualizerRef.current && preset) {
        visualizerRef.current.loadPreset(preset, 1.0);
      }
    }
  }, [currentPresetIndex, allPresetKeys, isInitialized]);

  // Keyboard navigation for presets
  useEffect(() => {
    if (!isActive || !isInitialized) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        nextPreset();
      } else if (e.key === 'ArrowLeft' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        prevPreset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, isInitialized, nextPreset, prevPreset]);

  // Cleanup on unmount or when deactivated
  useEffect(() => {
    // When isActive becomes false, cleanup the visualizer so it can be re-created
    if (!isActive) {
      console.log('MilkDrop: Deactivated, cleaning up...');
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (presetIntervalRef.current) {
        clearInterval(presetIntervalRef.current);
        presetIntervalRef.current = null;
      }
      if (connectedAnalyserRef.current && visualizerRef.current) {
        try {
          visualizerRef.current.disconnectAudio(connectedAnalyserRef.current);
        } catch {
          // Ignore
        }
      }
      // Close local audio context if we created one
      if (localAudioContextRef.current) {
        try {
          localAudioContextRef.current.close();
        } catch {
          // Ignore
        }
        localAudioContextRef.current = null;
      }
      visualizerRef.current = null;
      connectedAnalyserRef.current = null;
      setIsInitialized(false);
    }
  }, [isActive]);

  if (!isActive) {
    return null;
  }

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
        pointerEvents: 'none',
        overflow: 'hidden',
        background: '#000', // Black fallback background
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
      
      {/* Preset navigation controls */}
      {isInitialized && (
        <div 
          className="absolute bottom-4 right-4 flex items-center gap-2"
          style={{ pointerEvents: 'auto', zIndex: 10 }}
        >
          <button
            onClick={prevPreset}
            className="p-2 rounded-full bg-black/70 text-white/80 hover:bg-black/90 hover:text-white transition-all duration-200 backdrop-blur-sm"
            title="Previous Preset (← or P)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <span className="text-white/80 text-sm px-3 py-1.5 bg-black/70 rounded backdrop-blur-sm max-w-62.5 truncate">
            {allPresetKeys[currentPresetIndex] || 'Loading...'}
          </span>
          
          <button
            onClick={nextPreset}
            className="p-2 rounded-full bg-black/70 text-white/80 hover:bg-black/90 hover:text-white transition-all duration-200 backdrop-blur-sm"
            title="Next Preset (→ or N)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};
