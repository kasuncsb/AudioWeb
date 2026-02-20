declare module 'butterchurn' {
  export interface ButterchurnVisualizerOptions {
    width: number;
    height: number;
    pixelRatio?: number;
    textureRatio?: number;
    meshWidth?: number;
    meshHeight?: number;
  }

  export interface ButterchurnVisualizer {
    setRendererSize(width: number, height: number, opts?: { pixelRatio?: number }): void;
    loadPreset(preset: object, blendTime?: number): void;
    launchSongTitleAnim(title: string): void;
    render(): void;
    connectAudio(audioNode: AnalyserNode): void;
    disconnectAudio(audioNode: AnalyserNode): void;
  }

  const butterchurn: {
    createVisualizer(
      audioContext: AudioContext,
      canvas: HTMLCanvasElement,
      options?: ButterchurnVisualizerOptions
    ): ButterchurnVisualizer;
  };

  export default butterchurn;
}

declare module 'butterchurn-presets' {
  interface PresetModule {
    getPresets(): { [key: string]: object };
  }
  const presets: PresetModule;
  export default presets;
}

declare module 'butterchurn-presets/lib/butterchurnPresets.min.js' {
  interface PresetModule {
    getPresets(): { [key: string]: object };
  }
  const presets: PresetModule;
  export default presets;
}

declare module 'butterchurn-presets/lib/butterchurnPresetsExtra.min.js' {
  interface PresetModule {
    getPresets(): { [key: string]: object };
  }
  const presets: PresetModule;
  export default presets;
}
