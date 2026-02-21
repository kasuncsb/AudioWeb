import React, { useState, useMemo } from 'react';
import { VisualizerSettings } from './types';
import { ResizablePopup } from './ResizablePopup';

interface VisualizerPopupProps {
    show: boolean;
    position: { x: number; y: number };
    settings: VisualizerSettings;
    availablePresets: string[];
    showVisualization: boolean;
    onClose: () => void;
    onMouseDown: (e: React.MouseEvent) => void;
    onUpdateSettings: (settings: Partial<VisualizerSettings>) => void;
}

export const VisualizerPopup: React.FC<VisualizerPopupProps> = ({
    show,
    position,
    settings,
    availablePresets,
    showVisualization,
    onClose,
    onMouseDown,
    onUpdateSettings,
}) => {
    const [searchQuery, setSearchQuery] = useState('');

    // Filter presets based on search
    const filteredPresets = useMemo(() => {
        if (!searchQuery.trim()) return availablePresets;
        const query = searchQuery.toLowerCase();
        return availablePresets.filter(preset => preset.toLowerCase().includes(query));
    }, [availablePresets, searchQuery]);

    // Handle preset selection
    const handleSelectPreset = (presetKey: string) => {
        onUpdateSettings({ mode: 'Manual', activePreset: presetKey });
    };

    // Handle automatic mode selection
    const handleSelectAutomatic = () => {
        onUpdateSettings({ mode: 'Automatic' });
    };

    if (!show) return null;

    return (
        <ResizablePopup
            show={show}
            position={position}
            onClose={onClose}
            onMouseDown={onMouseDown}
            title="Visualizer Preset"
            minWidth={280}
            minHeight={350}
            maxWidth={500}
            maxHeight={800}
            style={{ width: 320, height: 480 }}
            className="z-50"
            showVisualization={showVisualization}
        >
            <div className="flex flex-col h-full overflow-hidden">
                {/* Search */}
                <div className="p-3 border-b border-white/5 shrink-0 bg-black/10">
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search presets..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 focus:bg-white/10 transition-all"
                        />
                        <svg className="w-4 h-4 text-white/40 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                {/* Presets List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {/* Automatic Option */}
                    <button
                        onClick={handleSelectAutomatic}
                        className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between group transition-all duration-200 ${settings.mode === 'Automatic'
                            ? 'bg-blue-500/20 text-blue-200 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                            : 'hover:bg-white/5 text-white border border-transparent'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${settings.mode === 'Automatic' ? 'bg-blue-500/30' : 'bg-white/10 group-hover:bg-white/20'} transition-colors`}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </div>
                            <div>
                                <div className="font-medium text-sm">Automatic</div>
                                <div className="text-xs opacity-70 mt-0.5">Changes at song end</div>
                            </div>
                        </div>
                        {settings.mode === 'Automatic' && (
                            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </button>

                    <div className="h-px bg-white/10 my-2 mx-2"></div>

                    {/* Manual Options list */}
                    {filteredPresets.map((preset) => {
                        const isSelected = settings.mode === 'Manual' && settings.activePreset === preset;

                        return (
                            <button
                                key={preset}
                                onClick={() => handleSelectPreset(preset)}
                                className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between group transition-all duration-200 ${isSelected
                                    ? 'bg-white/15 text-white font-medium border border-white/20'
                                    : 'hover:bg-white/5 text-white/70 hover:text-white border border-transparent'
                                    }`}
                            >
                                <span className="text-sm truncate pr-4 drop-shadow-sm">{preset}</span>
                                {isSelected && (
                                    <svg className="w-5 h-5 text-white shrink-0 drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </button>
                        );
                    })}

                    {filteredPresets.length === 0 && (
                        <div className="text-center py-8 text-white/40 text-sm">
                            No presets found matching "{searchQuery}"
                        </div>
                    )}
                </div>
            </div>
        </ResizablePopup>
    );
};
