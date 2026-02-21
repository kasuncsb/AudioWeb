import { useState, useEffect } from 'react';
import { STORAGE_KEYS } from '@/config/constants';
import { VisualizerSettings } from '../app/components/player/types';

const defaultSettings: VisualizerSettings = {
    mode: 'Automatic',
    activePreset: '', // Blank initially means it will pick a random one if in Auto, or default to the first
};

export function useVisualizerPersistence() {
    const [settings, setSettings] = useState<VisualizerSettings>(defaultSettings);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load settings on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.VISUALIZER_SETTINGS);
            if (saved) {
                setSettings(JSON.parse(saved));
            }
        } catch (error) {
            console.error('Failed to load visualizer settings:', error);
        } finally {
            setIsLoaded(true);
        }
    }, []);

    // Save settings when changed
    useEffect(() => {
        if (isLoaded) {
            try {
                localStorage.setItem(STORAGE_KEYS.VISUALIZER_SETTINGS, JSON.stringify(settings));
            } catch (error) {
                console.error('Failed to save visualizer settings:', error);
            }
        }
    }, [settings, isLoaded]);

    const updateSettings = (newSettings: Partial<VisualizerSettings>) => {
        setSettings((prev) => ({ ...prev, ...newSettings }));
    };

    return {
        visualizerSettings: settings,
        updateVisualizerSettings: updateSettings,
        isLoaded,
    };
}
