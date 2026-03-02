import { useState, useEffect, useRef, useCallback } from 'react';
import { STORAGE_KEYS } from '@/config/constants';
import { VisualizerSettings } from '../app/components/player/types';

const defaultSettings: VisualizerSettings = {
    mode: 'Automatic',
    activePreset: '', // Blank initially means it will pick a random one if in Auto, or default to the first
    enabled: false,
};

interface UseVisualizerPersistenceOptions {
    /**
     * If true, this hook instance will manage the `enabled` state and save it.
     * Only ONE instance should have this set to true (page.tsx).
     * Other instances (Player.tsx) should set this to false to avoid race conditions.
     */
    manageEnabled?: boolean;
}

export function useVisualizerPersistence(options: UseVisualizerPersistenceOptions = {}) {
    const { manageEnabled = true } = options;
    const [settings, setSettings] = useState<VisualizerSettings>(defaultSettings);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load settings on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.VISUALIZER_SETTINGS);
            if (saved) {
                // Merge with defaults to handle missing fields from old localStorage data
                const parsed = JSON.parse(saved);
                setSettings({ ...defaultSettings, ...parsed });
            }
        } catch (error) {
            console.error('Failed to load visualizer settings:', error);
        } finally {
            setIsLoaded(true);
        }
    }, []);

    // Read current enabled value from localStorage to avoid stale writes
    const getCurrentEnabledFromStorage = useCallback((): boolean => {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.VISUALIZER_SETTINGS);
            if (saved) {
                const parsed = JSON.parse(saved);
                return parsed.enabled ?? false;
            }
        } catch { /* ignore */ }
        return false;
    }, []);

    // Save settings when changed (debounced to reduce main-thread blocking)
    const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
    useEffect(() => {
        if (isLoaded) {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            saveTimerRef.current = setTimeout(() => {
                try {
                    let toSave = settings;
                    // If this instance doesn't manage enabled, read current value from storage
                    // to avoid overwriting it with stale data
                    if (!manageEnabled) {
                        toSave = { ...settings, enabled: getCurrentEnabledFromStorage() };
                    }
                    localStorage.setItem(STORAGE_KEYS.VISUALIZER_SETTINGS, JSON.stringify(toSave));
                } catch (error) {
                    console.error('Failed to save visualizer settings:', error);
                }
            }, 500);
        }

        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, [settings, isLoaded, manageEnabled, getCurrentEnabledFromStorage]);

    const updateSettings = (newSettings: Partial<VisualizerSettings>) => {
        setSettings((prev) => ({ ...prev, ...newSettings }));
    };

    return {
        visualizerSettings: settings,
        updateVisualizerSettings: updateSettings,
        isLoaded,
        // Expose enabled state separately for convenience
        isVisualizerEnabled: settings.enabled,
        setVisualizerEnabled: (enabled: boolean) => updateSettings({ enabled }),
    };
}
