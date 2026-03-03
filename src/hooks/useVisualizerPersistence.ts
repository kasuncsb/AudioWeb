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

/**
 * Hook for persisting visualizer settings to localStorage.
 * @param shouldInit - When true, load/save from localStorage. Pass false to delay
 *                     initialization until the player is ready (prevents early writes).
 * @param options - Additional options for managing enabled state
 */
export function useVisualizerPersistence(
    shouldInit: boolean = false,
    options: UseVisualizerPersistenceOptions = {}
) {
    const { manageEnabled = true } = options;
    const [settings, setSettings] = useState<VisualizerSettings>(defaultSettings);
    const [isLoaded, setIsLoaded] = useState(false);

    // Initialize (load from storage) only when shouldInit becomes true
    useEffect(() => {
        if (!shouldInit || isLoaded) return;

        try {
            const saved = localStorage.getItem(STORAGE_KEYS.VISUALIZER_SETTINGS);
            if (saved) {
                // Merge with defaults to handle missing fields from old localStorage data
                const parsed = JSON.parse(saved);
                setSettings({ ...defaultSettings, ...parsed });
            }
            // Note: Don't save defaults to localStorage here — only save when user changes settings
        } catch (error) {
            console.error('Failed to load visualizer settings:', error);
        } finally {
            setIsLoaded(true);
        }
    }, [shouldInit, isLoaded]);

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
    // Only save after isLoaded is true AND settings have been modified by user
    const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const hasUserModified = useRef(false);
    
    useEffect(() => {
        // Only save if we've loaded AND user has modified settings
        if (!isLoaded || !hasUserModified.current) return;

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

        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, [settings, isLoaded, manageEnabled, getCurrentEnabledFromStorage]);

    const updateSettings = useCallback((newSettings: Partial<VisualizerSettings>) => {
        hasUserModified.current = true;
        setSettings((prev) => ({ ...prev, ...newSettings }));
    }, []);

    return {
        visualizerSettings: settings,
        updateVisualizerSettings: updateSettings,
        isLoaded,
        // Expose enabled state separately for convenience
        isVisualizerEnabled: settings.enabled,
        setVisualizerEnabled: (enabled: boolean) => updateSettings({ enabled }),
    };
}
