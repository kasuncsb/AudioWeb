import { EqualizerSettings } from './types';
import { ResizablePopup } from './ResizablePopup';
import { EQUALIZER_BANDS, EQUALIZER_PRESETS } from '@/config/constants';
import { useState, useEffect } from 'react';

interface EqualizerPopupProps {
  show: boolean;
  position: { x: number; y: number };
  settings: EqualizerSettings;
  onClose: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onUpdateSettings: (settings: EqualizerSettings) => void;
  showVisualization?: boolean;
}

export const EqualizerPopup: React.FC<EqualizerPopupProps> = ({
  show,
  position,
  settings,
  onClose,
  onMouseDown,
  onUpdateSettings,
  showVisualization = false
}) => {
  // Detect mobile device based on window width
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => setIsMobileDevice(e.matches);
    onChange(mql);
    mql.addEventListener('change', onChange as (e: MediaQueryListEvent) => void);
    return () => mql.removeEventListener('change', onChange as (e: MediaQueryListEvent) => void);
  }, []);

  if (!show) return null;

  const handlePresetChange = (presetKey: string) => {
    if (!settings.enabled) return;
    const preset = EQUALIZER_PRESETS[presetKey as keyof typeof EQUALIZER_PRESETS];
    if (!preset) return;

    // Apply preset gains to all bands + tone controls
    const newSettings: EqualizerSettings = {
      band32: preset.gains[0],
      band64: preset.gains[1],
      band125: preset.gains[2],
      band250: preset.gains[3],
      band500: preset.gains[4],
      band1k: preset.gains[5],
      band2k: preset.gains[6],
      band4k: preset.gains[7],
      band8k: preset.gains[8],
      band16k: preset.gains[9],
      bassTone: preset.bassTone,
      trebleTone: preset.trebleTone,
      normalizerEnabled: settings.normalizerEnabled,
      preset: presetKey,
      enabled: settings.enabled,
    };

    onUpdateSettings(newSettings);
  };

  const handleSliderChange = (key: keyof EqualizerSettings, value: number) => {
    if (key === 'preset' || key === 'enabled') return;

    onUpdateSettings({
      ...settings,
      [key]: value,
      preset: 'custom' // Switch to custom when manually adjusting
    });
  };

  const handleResetAll = () => {
    onUpdateSettings({
      band32: 0,
      band64: 0,
      band125: 0,
      band250: 0,
      band500: 0,
      band1k: 0,
      band2k: 0,
      band4k: 0,
      band8k: 0,
      band16k: 0,
      bassTone: 0,
      trebleTone: 0,
      normalizerEnabled: settings.normalizerEnabled,
      preset: 'flat',
      enabled: settings.enabled,
    });
  };

  const handleToggleEnabled = () => {
    onUpdateSettings({
      ...settings,
      enabled: !settings.enabled,
    });
  };

  const handleToggleNormalizer = () => {
    if (!settings.enabled) return;
    onUpdateSettings({
      ...settings,
      normalizerEnabled: !settings.normalizerEnabled,
    });
  };

  // Calculate fill percentage correctly
  const getSliderFillPercentage = (value: number): number => {
    // Range is -12 to +12, so 24 total range
    // At -12: 0%, at 0: 50%, at +12: 100%
    return ((value + 12) / 24) * 100;
  };

  // Get slider color - plain blue for all values
  const getSliderColor = (): string => {
    return '#3b82f6'; // plain blue
  };

  // Get slider color for tone controls (bass/treble)
  const getToneSliderColor = (value: number): string => {
    if (value < 0) return '#ef4444'; // red
    if (value > 0) return '#10b981'; // green
    return '#94a3b8'; // neutral gray
  };

  const bands = [
    { key: 'band32' as const, label: EQUALIZER_BANDS[0].label, desc: EQUALIZER_BANDS[0].description, value: settings.band32 },
    { key: 'band64' as const, label: EQUALIZER_BANDS[1].label, desc: EQUALIZER_BANDS[1].description, value: settings.band64 },
    { key: 'band125' as const, label: EQUALIZER_BANDS[2].label, desc: EQUALIZER_BANDS[2].description, value: settings.band125 },
    { key: 'band250' as const, label: EQUALIZER_BANDS[3].label, desc: EQUALIZER_BANDS[3].description, value: settings.band250 },
    { key: 'band500' as const, label: EQUALIZER_BANDS[4].label, desc: EQUALIZER_BANDS[4].description, value: settings.band500 },
    { key: 'band1k' as const, label: EQUALIZER_BANDS[5].label, desc: EQUALIZER_BANDS[5].description, value: settings.band1k },
    { key: 'band2k' as const, label: EQUALIZER_BANDS[6].label, desc: EQUALIZER_BANDS[6].description, value: settings.band2k },
    { key: 'band4k' as const, label: EQUALIZER_BANDS[7].label, desc: EQUALIZER_BANDS[7].description, value: settings.band4k },
    { key: 'band8k' as const, label: EQUALIZER_BANDS[8].label, desc: EQUALIZER_BANDS[8].description, value: settings.band8k },
    { key: 'band16k' as const, label: EQUALIZER_BANDS[9].label, desc: EQUALIZER_BANDS[9].description, value: settings.band16k },
  ];

  // Get all preset keys
  const presetKeys = Object.keys(EQUALIZER_PRESETS);

  return (
    <ResizablePopup
      show={show}
      position={position}
      onClose={onClose}
      onMouseDown={onMouseDown}
      title="Equalizer"
      minWidth={isMobileDevice ? 320 : 900}
      minHeight={isMobileDevice ? 600 : 500}
      maxWidth={isMobileDevice ? 600 : 1400}
      maxHeight={isMobileDevice ? 900 : 800}
      showVisualization={showVisualization}
    >
      {(size) => {
        // Use device detection for layout choice
        const isMobile = isMobileDevice;

        // Calculate responsive sizes based on popup dimensions
        const baseHeight = 500;
        const baseWidth = isMobile ? 400 : 900;
        const heightScale = Math.max(1, size.height / baseHeight);
        const widthScale = Math.max(1, size.width / baseWidth);

        // Fader dimensions scale with popup size
        const faderHeight = isMobile
          ? Math.min(300, 180 * heightScale) // Mobile: shorter faders
          : Math.min(400, 200 * heightScale); // Desktop: taller faders
        const faderWidth = Math.min(12, 8 * widthScale);
        const thumbSize = Math.min(28, 20 + (widthScale - 1) * 4);

        // Mobile Layout: Vertical Stack (same components as desktop)
        if (isMobile) {
          return (
            <div className="flex flex-col h-full gap-4 overflow-y-auto custom-scrollbar">
              {/* Top Controls Bar - Same as desktop */}
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleToggleEnabled}
                    className={`px-4 py-2 rounded-xl transition-all duration-200 text-xs font-medium ${settings.enabled
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}
                  >
                    {settings.enabled ? '✓ EQ Enabled' : '✗ EQ Disabled'}
                  </button>
                  <button
                    onClick={handleResetAll}
                    className="px-3 py-2 rounded-xl transition-all duration-200 text-xs bg-white/10 text-white/70 hover:bg-white/15 border border-white/10 flex items-center gap-2"
                    title="Reset all bands to 0dB"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reset
                  </button>
                </div>
                <div className="text-xs text-white/60">
                  <span className="font-semibold text-blue-300">
                    {EQUALIZER_PRESETS[settings.preset as keyof typeof EQUALIZER_PRESETS]?.name || 'Custom'}
                  </span>
                </div>
              </div>

              {/* Presets - Same as desktop */}
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Presets</h3>
                <div className="grid grid-cols-2 gap-2">
                  {presetKeys.map((presetKey) => {
                    const preset = EQUALIZER_PRESETS[presetKey as keyof typeof EQUALIZER_PRESETS];
                    return (
                      <button
                        key={presetKey}
                        onClick={() => handlePresetChange(presetKey)}
                        disabled={!settings.enabled}
                        className={`p-3 rounded-lg transition-all duration-200 text-left ${!settings.enabled
                          ? 'bg-white/5 text-white/30 border border-white/5 cursor-not-allowed'
                          : settings.preset === presetKey
                            ? 'bg-blue-500/30 text-blue-300 border border-blue-400/50 shadow-lg'
                            : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
                          }`}
                      >
                        <div className="font-medium text-sm">{preset.name}</div>
                        <div className="text-[10px] text-white/40 mt-0.5">{preset.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 10-Band EQ - Same vertical faders as desktop */}
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                  10-Band Equalizer • ±12dB Range
                </h3>
                <div className="flex items-end gap-2.5 justify-between">
                  {bands.map(({ key, label, value }) => {
                    const fillPercentage = getSliderFillPercentage(value);
                    const sliderColor = getSliderColor();

                    return (
                      <div key={key} className="flex flex-col items-center gap-2 flex-1">
                        {/* Value Display */}
                        <div className={`text-[10px] font-mono font-semibold ${value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-white/50'
                          }`}>
                          {value > 0 ? '+' : ''}{value.toFixed(1)}
                        </div>

                        {/* Custom Vertical Slider Bar */}
                        <div
                          className="relative bg-white/10 rounded-lg overflow-visible"
                          style={{ height: `${faderHeight}px`, width: '8px' }}
                        >
                          {/* Filled portion from bottom */}
                          <div
                            className="absolute bottom-0 left-0 right-0 rounded-lg transition-all duration-100"
                            style={{
                              height: `${fillPercentage}%`,
                              background: sliderColor,
                              opacity: settings.enabled ? 1 : 0.3,
                            }}
                          />

                          {/* Center marker (0dB line) */}
                          <div
                            className="absolute left-1/2 transform -translate-x-1/2 h-0.5 bg-white/40 pointer-events-none"
                            style={{ bottom: '50%', width: '16px', marginLeft: '-8px' }}
                          />

                          {/* Draggable Thumb */}
                          <div
                            className="absolute left-1/2 transform -translate-x-1/2 w-6 h-6 bg-white rounded-full shadow-lg cursor-grab active:cursor-grabbing transition-transform active:scale-95"
                            style={{
                              bottom: `calc(${fillPercentage}% - 12px)`,
                              opacity: settings.enabled ? 1 : 0.3,
                              touchAction: 'none',
                            }}
                            onMouseDown={(e) => {
                              if (!settings.enabled) return;
                              e.preventDefault();
                              e.stopPropagation();

                              const bar = e.currentTarget.parentElement!;
                              const rect = bar.getBoundingClientRect();

                              const updateValue = (clientY: number) => {
                                const y = rect.bottom - clientY;
                                const percentage = Math.max(0, Math.min(1, y / rect.height));
                                const newValue = (percentage * 24) - 12;
                                handleSliderChange(key, Math.round(newValue * 2) / 2);
                              };

                              const handleMouseMove = (moveEvent: MouseEvent) => {
                                updateValue(moveEvent.clientY);
                              };

                              const handleMouseUp = () => {
                                document.removeEventListener('mousemove', handleMouseMove);
                                document.removeEventListener('mouseup', handleMouseUp);
                              };

                              document.addEventListener('mousemove', handleMouseMove);
                              document.addEventListener('mouseup', handleMouseUp);
                            }}
                            onTouchStart={(e) => {
                              if (!settings.enabled) return;
                              // Don't call preventDefault here - let native listener handle it
                              e.stopPropagation();
                            }}
                            ref={(el) => {
                              if (!el) return;

                              const handleTouchStart = (e: TouchEvent) => {
                                if (!settings.enabled) return;
                                e.preventDefault(); // Safe in native listener

                                const bar = (e.target as HTMLElement).parentElement!;
                                const rect = bar.getBoundingClientRect();

                                const updateValue = (clientY: number) => {
                                  const y = rect.bottom - clientY;
                                  const percentage = Math.max(0, Math.min(1, y / rect.height));
                                  const newValue = (percentage * 24) - 12;
                                  handleSliderChange(key, Math.round(newValue * 2) / 2);
                                };

                                const handleTouchMove = (moveEvent: TouchEvent) => {
                                  if (moveEvent.touches.length > 0) {
                                    updateValue(moveEvent.touches[0].clientY);
                                  }
                                };

                                const handleTouchEnd = () => {
                                  document.removeEventListener('touchmove', handleTouchMove);
                                  document.removeEventListener('touchend', handleTouchEnd);
                                };

                                document.addEventListener('touchmove', handleTouchMove, { passive: false });
                                document.addEventListener('touchend', handleTouchEnd);
                              };

                              el.addEventListener('touchstart', handleTouchStart, { passive: false });
                              return () => el.removeEventListener('touchstart', handleTouchStart);
                            }}
                          />
                        </div>

                        {/* Frequency Label */}
                        <div className="text-[9px] font-semibold text-white/60 text-center whitespace-nowrap">
                          {label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tone Controls - Same as desktop */}
              <div className="flex flex-col gap-4">
                <div className="space-y-4 p-5 rounded-xl bg-linear-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20">
                  <h3 className="text-xs font-semibold text-purple-300/80 uppercase tracking-wider flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                    Tone Control
                  </h3>

                  {/* Bass Tone */}
                  <div className="space-y-2">
                    <label className="text-white/80 text-xs font-medium flex justify-between items-center">
                      <span className="font-semibold">🎵 Bass</span>
                      <span className={`font-mono text-sm ${settings.bassTone > 0 ? 'text-green-400' : settings.bassTone < 0 ? 'text-red-400' : 'text-white/50'
                        }`}>
                        {settings.bassTone > 0 ? '+' : ''}{settings.bassTone.toFixed(1)}dB
                      </span>
                    </label>
                    <div className="text-[10px] text-white/40 mb-2">Deep bass enhancement (65Hz, natural response)</div>

                    {/* Custom Horizontal Slider */}
                    <div className="relative">
                      <div
                        className="relative h-3 bg-white/10 rounded-lg overflow-visible cursor-pointer"
                        onClick={(e) => {
                          if (!settings.enabled) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const percentage = Math.max(0, Math.min(1, x / rect.width));
                          const newValue = (percentage * 24) - 12;
                          handleSliderChange('bassTone' as keyof EqualizerSettings, Math.round(newValue * 2) / 2);
                        }}
                      >
                        {/* Filled portion */}
                        <div
                          className="absolute left-0 top-0 bottom-0 rounded-lg transition-all duration-100"
                          style={{
                            width: `${getSliderFillPercentage(settings.bassTone)}%`,
                            background: getToneSliderColor(settings.bassTone),
                            opacity: settings.enabled ? 1 : 0.3,
                          }}
                        />

                        {/* Center marker (0dB line) */}
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-0.5 h-5 bg-white/30 pointer-events-none" />

                        {/* Draggable Thumb */}
                        <div
                          className="absolute top-1/2 transform -translate-y-1/2 w-5 h-5 bg-white rounded-full shadow-lg cursor-grab active:cursor-grabbing transition-transform active:scale-95"
                          style={{
                            left: `calc(${getSliderFillPercentage(settings.bassTone)}% - 10px)`,
                            opacity: settings.enabled ? 1 : 0.3,
                            touchAction: 'none',
                          }}
                          onMouseDown={(e) => {
                            if (!settings.enabled) return;
                            e.preventDefault();
                            e.stopPropagation();

                            const bar = e.currentTarget.parentElement!;
                            const rect = bar.getBoundingClientRect();

                            const updateValue = (clientX: number) => {
                              const x = clientX - rect.left;
                              const percentage = Math.max(0, Math.min(1, x / rect.width));
                              const newValue = (percentage * 24) - 12;
                              handleSliderChange('bassTone' as keyof EqualizerSettings, Math.round(newValue * 2) / 2);
                            };

                            const handleMouseMove = (moveEvent: MouseEvent) => {
                              updateValue(moveEvent.clientX);
                            };

                            const handleMouseUp = () => {
                              document.removeEventListener('mousemove', handleMouseMove);
                              document.removeEventListener('mouseup', handleMouseUp);
                            };

                            document.addEventListener('mousemove', handleMouseMove);
                            document.addEventListener('mouseup', handleMouseUp);
                          }}
                          onTouchStart={(e) => {
                            if (!settings.enabled) return;
                            // Don't call preventDefault in React synthetic event
                            e.stopPropagation();
                          }}
                          ref={(el) => {
                            if (!el) return;

                            const handleTouchStart = (e: TouchEvent) => {
                              if (!settings.enabled) return;
                              e.preventDefault(); // Safe in native listener

                              const bar = (e.target as HTMLElement).parentElement!;
                              const rect = bar.getBoundingClientRect();

                              const updateValue = (clientX: number) => {
                                const x = clientX - rect.left;
                                const percentage = Math.max(0, Math.min(1, x / rect.width));
                                const newValue = (percentage * 24) - 12;
                                handleSliderChange('bassTone' as keyof EqualizerSettings, Math.round(newValue * 2) / 2);
                              };

                              const handleTouchMove = (moveEvent: TouchEvent) => {
                                if (moveEvent.touches.length > 0) {
                                  updateValue(moveEvent.touches[0].clientX);
                                }
                              };

                              const handleTouchEnd = () => {
                                document.removeEventListener('touchmove', handleTouchMove);
                                document.removeEventListener('touchend', handleTouchEnd);
                              };

                              document.addEventListener('touchmove', handleTouchMove, { passive: false });
                              document.addEventListener('touchend', handleTouchEnd);
                            };

                            el.addEventListener('touchstart', handleTouchStart, { passive: false });
                            return () => el.removeEventListener('touchstart', handleTouchStart);
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Treble Tone */}
                  <div className="space-y-2">
                    <label className="text-white/80 text-xs font-medium flex justify-between items-center">
                      <span className="font-semibold">🎶 Treble</span>
                      <span className={`font-mono text-sm ${settings.trebleTone > 0 ? 'text-green-400' : settings.trebleTone < 0 ? 'text-red-400' : 'text-white/50'
                        }`}>
                        {settings.trebleTone > 0 ? '+' : ''}{settings.trebleTone.toFixed(1)}dB
                      </span>
                    </label>
                    <div className="text-[10px] text-white/40 mb-2">Crystal clear treble (11kHz, natural air)</div>

                    {/* Custom Horizontal Slider */}
                    <div className="relative">
                      <div
                        className="relative h-3 bg-white/10 rounded-lg overflow-visible cursor-pointer"
                        onClick={(e) => {
                          if (!settings.enabled) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const percentage = Math.max(0, Math.min(1, x / rect.width));
                          const newValue = (percentage * 24) - 12;
                          handleSliderChange('trebleTone' as keyof EqualizerSettings, Math.round(newValue * 2) / 2);
                        }}
                      >
                        {/* Filled portion */}
                        <div
                          className="absolute left-0 top-0 bottom-0 rounded-lg transition-all duration-100"
                          style={{
                            width: `${getSliderFillPercentage(settings.trebleTone)}%`,
                            background: getToneSliderColor(settings.trebleTone),
                            opacity: settings.enabled ? 1 : 0.3,
                          }}
                        />

                        {/* Center marker (0dB line) */}
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-0.5 h-5 bg-white/30 pointer-events-none" />

                        {/* Draggable Thumb */}
                        <div
                          className="absolute top-1/2 transform -translate-y-1/2 w-5 h-5 bg-white rounded-full shadow-lg cursor-grab active:cursor-grabbing transition-transform active:scale-95"
                          style={{
                            left: `calc(${getSliderFillPercentage(settings.trebleTone)}% - 10px)`,
                            opacity: settings.enabled ? 1 : 0.3,
                            touchAction: 'none',
                          }}
                          onMouseDown={(e) => {
                            if (!settings.enabled) return;
                            e.preventDefault();
                            e.stopPropagation();

                            const bar = e.currentTarget.parentElement!;
                            const rect = bar.getBoundingClientRect();

                            const updateValue = (clientX: number) => {
                              const x = clientX - rect.left;
                              const percentage = Math.max(0, Math.min(1, x / rect.width));
                              const newValue = (percentage * 24) - 12;
                              handleSliderChange('trebleTone' as keyof EqualizerSettings, Math.round(newValue * 2) / 2);
                            };

                            const handleMouseMove = (moveEvent: MouseEvent) => {
                              updateValue(moveEvent.clientX);
                            };

                            const handleMouseUp = () => {
                              document.removeEventListener('mousemove', handleMouseMove);
                              document.removeEventListener('mouseup', handleMouseUp);
                            };

                            document.addEventListener('mousemove', handleMouseMove);
                            document.addEventListener('mouseup', handleMouseUp);
                          }}
                          onTouchStart={(e) => {
                            if (!settings.enabled) return;
                            // Don't call preventDefault in React synthetic event
                            e.stopPropagation();
                          }}
                          ref={(el) => {
                            if (!el) return;

                            const handleTouchStart = (e: TouchEvent) => {
                              if (!settings.enabled) return;
                              e.preventDefault(); // Safe in native listener

                              const bar = (e.target as HTMLElement).parentElement!;
                              const rect = bar.getBoundingClientRect();

                              const updateValue = (clientX: number) => {
                                const x = clientX - rect.left;
                                const percentage = Math.max(0, Math.min(1, x / rect.width));
                                const newValue = (percentage * 24) - 12;
                                handleSliderChange('trebleTone' as keyof EqualizerSettings, Math.round(newValue * 2) / 2);
                              };

                              const handleTouchMove = (moveEvent: TouchEvent) => {
                                if (moveEvent.touches.length > 0) {
                                  updateValue(moveEvent.touches[0].clientX);
                                }
                              };

                              const handleTouchEnd = () => {
                                document.removeEventListener('touchmove', handleTouchMove);
                                document.removeEventListener('touchend', handleTouchEnd);
                              };

                              document.addEventListener('touchmove', handleTouchMove, { passive: false });
                              document.addEventListener('touchend', handleTouchEnd);
                            };

                            el.addEventListener('touchstart', handleTouchStart, { passive: false });
                            return () => el.removeEventListener('touchstart', handleTouchStart);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Volume Control */}
                <div className="space-y-3 p-4 rounded-xl bg-linear-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
                  <h3 className="text-xs font-semibold text-emerald-300/80 uppercase tracking-wider flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 3.23v17.54c0 .42-.49.64-.8.36L7.83 16H4c-.55 0-1-.45-1-1V9c0-.55.45-1 1-1h3.83l5.37-5.13c.31-.28.8-.06.8.36zM16.5 8.5a1 1 0 011.41 0 5 5 0 010 7.07 1 1 0 01-1.41-1.41 3 3 0 000-4.24 1 1 0 010-1.42z" />
                    </svg>
                    Volume Control
                  </h3>
                  <button
                    onClick={handleToggleNormalizer}
                    disabled={!settings.enabled}
                    className={`w-full px-4 py-2 rounded-xl transition-all duration-200 text-sm font-medium border ${!settings.enabled
                      ? 'bg-white/5 text-white/30 border-white/10 cursor-not-allowed'
                      : settings.normalizerEnabled
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-red-500/20 text-red-300 border-red-500/40'
                      }`}
                  >
                    {settings.normalizerEnabled ? 'Normalizer Enabled' : 'Normalizer Disabled'}
                  </button>
                  <p className="text-[10px] text-white/50">
                    Keeps output level consistent between tracks. Turn off for pure manual volume.
                  </p>
                </div>
              </div>
            </div>
          );
        }

        // Desktop Layout: Horizontal Panel
        return (
          <div className="flex flex-col h-full gap-4">
            {/* Top Controls Bar */}
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/10">
              {/* Left: Enable/Disable & Reset */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleToggleEnabled}
                  className={`px-6 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium ${settings.enabled
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}
                >
                  {settings.enabled ? '✓ EQ Enabled' : '✗ EQ Disabled'}
                </button>
                <button
                  onClick={handleResetAll}
                  className="px-4 py-2.5 rounded-xl transition-all duration-200 text-sm bg-white/10 text-white/70 hover:bg-white/15 border border-white/10 flex items-center gap-2"
                  title="Reset all bands to 0dB"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reset
                </button>
              </div>

              {/* Right: Current Preset Display */}
              <div className="text-sm text-white/60">
                Current: <span className="font-semibold text-blue-300">
                  {EQUALIZER_PRESETS[settings.preset as keyof typeof EQUALIZER_PRESETS]?.name || 'Custom'}
                </span>
              </div>
            </div>

            {/* Main Content: 2 Column Layout */}
            <div className="flex gap-6 flex-1 overflow-hidden">
              {/* Left Column: Presets */}
              <div className="w-64 flex flex-col gap-3">
                <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Presets</h3>
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                  {presetKeys.map((presetKey) => {
                    const preset = EQUALIZER_PRESETS[presetKey as keyof typeof EQUALIZER_PRESETS];
                    return (
                      <button
                        key={presetKey}
                        onClick={() => handlePresetChange(presetKey)}
                        disabled={!settings.enabled}
                        className={`w-full p-3 rounded-lg transition-all duration-200 text-left ${!settings.enabled
                          ? 'bg-white/5 text-white/30 border border-white/5 cursor-not-allowed'
                          : settings.preset === presetKey
                            ? 'bg-blue-500/30 text-blue-300 border border-blue-400/50 shadow-lg'
                            : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
                          }`}
                      >
                        <div className="font-medium text-sm">{preset.name}</div>
                        <div className="text-[10px] text-white/40 mt-0.5">{preset.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Center Column: 10-Band EQ with Vertical Faders */}
              <div className="flex-1 flex flex-col gap-3">
                <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                  10-Band Equalizer • ±12dB Range
                </h3>
                <div className="flex-1 flex items-end gap-3 justify-between">
                  {bands.map(({ key, label, value }) => {
                    const fillPercentage = getSliderFillPercentage(value);
                    const sliderColor = getSliderColor();

                    return (
                      <div key={key} className="flex flex-col items-center gap-2 flex-1">
                        {/* Value Display */}
                        <div className={`text-xs font-mono font-semibold min-h-5 ${value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-white/50'
                          }`}>
                          {value > 0 ? '+' : ''}{value.toFixed(1)}
                        </div>

                        {/* Vertical Slider */}
                        <div className="relative flex items-center justify-center" style={{ height: `${faderHeight}px`, width: `${faderWidth * 4}px` }}>
                          <input
                            type="range"
                            min="-12"
                            max="12"
                            step="0.5"
                            value={value}
                            onChange={(e) => handleSliderChange(key, Number(e.target.value))}
                            disabled={!settings.enabled}
                            className="vertical-slider appearance-none cursor-pointer"
                            style={{
                              background: `linear-gradient(to top, ${sliderColor} 0%, ${sliderColor} ${fillPercentage}%, rgba(255,255,255,0.1) ${fillPercentage}%, rgba(255,255,255,0.1) 100%)`,
                              opacity: settings.enabled ? 1 : 0.3,
                              width: `${faderWidth}px`,
                              height: '100%',
                              '--thumb-size': `${thumbSize}px`,
                            } as React.CSSProperties & { '--thumb-size': string }}
                          />
                          {/* Center marker */}
                          <div
                            className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 h-0.5 bg-white/30 pointer-events-none"
                            style={{ width: `${faderWidth * 5}px` }}
                          />
                        </div>

                        {/* Frequency Label */}
                        <div className="text-[10px] font-semibold text-white/60 text-center whitespace-nowrap">
                          {label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Tone Controls */}
              <div className="w-72 flex flex-col gap-4">
                <div className="space-y-4 p-5 rounded-xl bg-linear-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20">
                  <h3 className="text-xs font-semibold text-purple-300/80 uppercase tracking-wider flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                    Tone Control
                  </h3>

                  {/* Bass Tone */}
                  <div className="space-y-2">
                    <label className="text-white/80 text-xs font-medium flex justify-between items-center">
                      <span className="font-semibold">🎵 Bass</span>
                      <span className={`font-mono text-sm ${settings.bassTone > 0 ? 'text-green-400' : settings.bassTone < 0 ? 'text-red-400' : 'text-white/50'
                        }`}>
                        {settings.bassTone > 0 ? '+' : ''}{settings.bassTone.toFixed(1)}dB
                      </span>
                    </label>
                    <div className="text-[10px] text-white/40 mb-2">Deep bass enhancement (100Hz lowshelf)</div>
                    <div className="relative">
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="0.5"
                        value={settings.bassTone}
                        onChange={(e) => handleSliderChange('bassTone' as keyof EqualizerSettings, Number(e.target.value))}
                        disabled={!settings.enabled}
                        className="w-full h-3 rounded-lg appearance-none cursor-pointer slider-custom"
                        style={{
                          background: `linear-gradient(to right, ${getToneSliderColor(settings.bassTone)} 0%, ${getToneSliderColor(settings.bassTone)} ${getSliderFillPercentage(settings.bassTone)}%, rgba(255,255,255,0.1) ${getSliderFillPercentage(settings.bassTone)}%, rgba(255,255,255,0.1) 100%)`,
                          opacity: settings.enabled ? 1 : 0.3,
                        }}
                      />
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-0.5 h-5 bg-white/20 pointer-events-none" />
                    </div>
                  </div>

                  {/* Treble Tone */}
                  <div className="space-y-2">
                    <label className="text-white/80 text-xs font-medium flex justify-between items-center">
                      <span className="font-semibold">🎶 Treble</span>
                      <span className={`font-mono text-sm ${settings.trebleTone > 0 ? 'text-green-400' : settings.trebleTone < 0 ? 'text-red-400' : 'text-white/50'
                        }`}>
                        {settings.trebleTone > 0 ? '+' : ''}{settings.trebleTone.toFixed(1)}dB
                      </span>
                    </label>
                    <div className="text-[10px] text-white/40 mb-2">Crisp treble enhancement (8kHz highshelf)</div>
                    <div className="relative">
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="0.5"
                        value={settings.trebleTone}
                        onChange={(e) => handleSliderChange('trebleTone' as keyof EqualizerSettings, Number(e.target.value))}
                        disabled={!settings.enabled}
                        className="w-full h-3 rounded-lg appearance-none cursor-pointer slider-custom"
                        style={{
                          background: `linear-gradient(to right, ${getToneSliderColor(settings.trebleTone)} 0%, ${getToneSliderColor(settings.trebleTone)} ${getSliderFillPercentage(settings.trebleTone)}%, rgba(255,255,255,0.1) ${getSliderFillPercentage(settings.trebleTone)}%, rgba(255,255,255,0.1) 100%)`,
                          opacity: settings.enabled ? 1 : 0.3,
                        }}
                      />
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-0.5 h-5 bg-white/20 pointer-events-none" />
                    </div>
                  </div>

                </div>

                <div className="space-y-3 p-4 rounded-xl bg-linear-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
                  <h3 className="text-xs font-semibold text-emerald-300/80 uppercase tracking-wider flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 3.23v17.54c0 .42-.49.64-.8.36L7.83 16H4c-.55 0-1-.45-1-1V9c0-.55.45-1 1-1h3.83l5.37-5.13c.31-.28.8-.06.8.36zM16.5 8.5a1 1 0 011.41 0 5 5 0 010 7.07 1 1 0 01-1.41-1.41 3 3 0 000-4.24 1 1 0 010-1.42z" />
                    </svg>
                    Volume Control
                  </h3>
                  <button
                    onClick={handleToggleNormalizer}
                    disabled={!settings.enabled}
                    className={`w-full px-4 py-2 rounded-xl transition-all duration-200 text-sm font-medium border ${!settings.enabled
                      ? 'bg-white/5 text-white/30 border-white/10 cursor-not-allowed'
                      : settings.normalizerEnabled
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-red-500/20 text-red-300 border-red-500/40'
                      }`}
                  >
                    {settings.normalizerEnabled ? 'Normalizer Enabled' : 'Normalizer Disabled'}
                  </button>
                  <p className="text-[10px] text-white/50">
                    Keeps output level consistent between tracks. Turn off for pure manual volume.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      }}
    </ResizablePopup>
  );
};
