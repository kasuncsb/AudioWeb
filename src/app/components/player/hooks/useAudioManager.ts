import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioTrack, EqualizerSettings } from '../types';
import { createLogger } from '@/utils/logger';
import { getAudioErrorMessage } from '@/utils/audioUtils';
import { EQUALIZER_BANDS } from '@/config/constants';

const logger = createLogger('AudioManager');

// Clean, Simple Audio Chain
// Focus: Clarity, Punchy Bass, No Artifacts
interface AudioChain {
  context: AudioContext;
  source: MediaElementAudioSourceNode;

  // Simple Signal Flow:
  // Source → Preamp → HPF → EQ → Bass → Treble → Limiter → Output
  preamp: GainNode;                    // Input headroom control
  highPass: BiquadFilterNode;          // Rumble removal
  filters: BiquadFilterNode[];         // 10-band EQ
  analyser: AnalyserNode;              // Visualization
  bassBoost: BiquadFilterNode;         // Bass punch (peaking ~80Hz)
  subBoost: BiquadFilterNode;          // Sub bass (low shelf ~60Hz)
  trebleBoost: BiquadFilterNode;       // Treble control (high shelf)
  limiter: DynamicsCompressorNode;     // Clean brick-wall limiter
  outputGain: GainNode;                // Master volume

  connected: boolean;
}

const audioChainStorage = new WeakMap<HTMLAudioElement, AudioChain>();

export const useAudioManager = (
  playlist: AudioTrack[],
  currentTrackIndex: number,
  isPlaying: boolean,
  setIsPlaying: (playing: boolean) => void,
  setCurrentTime: (time: number) => void,
  setDuration: (duration: number) => void,
  volume: number,
  repeatMode: number,
  handleNext: () => void,
  equalizerSettings: EqualizerSettings,
  isEqualizerLoaded: boolean
) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioChainRef = useRef<AudioChain | null>(null);
  // Eagerly-created AudioContext so the visualizer can bind to it before first play.
  // The full audio chain reuses this same instance to avoid a cross-context mismatch.
  const eagerAudioContextRef = useRef<AudioContext | null>(null);
  const [isChainReady, setIsChainReady] = useState(false);
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFadingRef = useRef<boolean>(false);
  // Always-current volume ref so fadeIn/chain-init read the latest value
  // regardless of when their closures were created.
  const volumeRef = useRef(volume);
  useEffect(() => { volumeRef.current = volume; }, [volume]);

  // Fade in audio
  const fadeIn = useCallback((duration: number = 800) => {
    const audio = audioRef.current;
    const chain = audioChainRef.current;

    if (!audio) return;

    // Always read the latest volume from the ref so we fade to the correct
    // target even if localStorage restoration happened after this callback
    // was created.
    const targetVolume = volumeRef.current / 100;

    if (chain?.outputGain && chain.connected) {
      try {
        isFadingRef.current = true;
        const now = chain.context.currentTime;
        chain.outputGain.gain.cancelScheduledValues(now);
        chain.outputGain.gain.setValueAtTime(0, now);
        chain.outputGain.gain.linearRampToValueAtTime(targetVolume, now + duration / 1000);

        if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
        fadeTimeoutRef.current = setTimeout(() => {
          isFadingRef.current = false;
          // Re-sync volume after fade in case it was restored from
          // localStorage during the fade window.
          try {
            const correctVolume = volumeRef.current / 100;
            const ct = chain.context.currentTime;
            chain.outputGain.gain.cancelScheduledValues(ct);
            chain.outputGain.gain.setValueAtTime(correctVolume, ct);
          } catch { /* ignore */ }
        }, duration);
        return;
      } catch (error) {
        logger.error('Fade in failed:', error);
      }
    }

    audio.volume = targetVolume;
  }, []);

  // Fade out audio
  const fadeOut = useCallback((duration: number = 800): Promise<void> => {
    return new Promise((resolve) => {
      const audio = audioRef.current;
      const chain = audioChainRef.current;

      if (!audio) {
        resolve();
        return;
      }

      if (chain?.outputGain && chain.connected) {
        try {
          isFadingRef.current = true;
          const now = chain.context.currentTime;
          const currentVolume = chain.outputGain.gain.value;
          chain.outputGain.gain.cancelScheduledValues(now);
          chain.outputGain.gain.setValueAtTime(currentVolume, now);
          chain.outputGain.gain.linearRampToValueAtTime(0, now + duration / 1000);

          if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
          fadeTimeoutRef.current = setTimeout(() => {
            isFadingRef.current = false;
            resolve();
          }, duration);
          return;
        } catch (error) {
          logger.error('Fade out failed:', error);
        }
      }

      audio.volume = 0;
      resolve();
    });
  }, []);

  // Eagerly create AudioContext on mount so the visualizer can bind before first play.
  // This won't require user interaction – only .resume() needs it. We create it here
  // and reuse the same instance when the full chain is wired on the first play event.
  useEffect(() => {
    if (eagerAudioContextRef.current) return;
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      eagerAudioContextRef.current = new AudioContextClass();
      logger.debug('Eager AudioContext created');
    } catch (e) {
      logger.error('Failed to create eager AudioContext:', e);
    }
  }, []);

  // Initialize Web Audio API chain once
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Check if already initialized
    const existingChain = audioChainStorage.get(audio);
    if (existingChain && existingChain.connected) {
      logger.debug('Audio chain already initialized');
      audioChainRef.current = existingChain;
      return;
    }

    // Initialize on first user interaction
    const initAudioChain = () => {
      try {
        logger.start('Initializing audio chain');

        // Reuse the eagerly-created AudioContext instead of creating a new one.
        // This is critical: the visualizer is already bound to this context, so
        // creating a second one here would cause an InvalidAccessError when
        // butterchurn tries to connect an AnalyserNode from the wrong context.
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioContext = eagerAudioContextRef.current ?? new AudioContextClass();
        if (!eagerAudioContextRef.current) {
          eagerAudioContextRef.current = audioContext;
        }

        // The eager context was created on mount (no user gesture) so it starts in
        // 'suspended' state. The 'play' event fires inside a user-gesture call stack,
        // which is exactly the right moment the browser allows AudioContext.resume().
        if (audioContext.state === 'suspended') {
          audioContext.resume().catch((e) => logger.warn('AudioContext resume failed:', e));
        }

        // Create MediaElementSource (can only be done once per element)
        const source = audioContext.createMediaElementSource(audio);

        // ===== PREAMP - Input headroom =====
        const preamp = audioContext.createGain();
        preamp.gain.value = 0.8; // Start with headroom

        // ===== HIGH-PASS FILTER - Rumble removal =====
        const highPass = audioContext.createBiquadFilter();
        highPass.type = 'highpass';
        highPass.frequency.value = 25; // Remove sub-20Hz rumble
        highPass.Q.value = 0.7;

        // ===== 10-BAND EQ =====
        const filters: BiquadFilterNode[] = [];
        EQUALIZER_BANDS.forEach((band, index) => {
          const filter = audioContext.createBiquadFilter();
          // First band = low shelf, last = high shelf, rest = peaking
          filter.type = index === 0 ? 'lowshelf' : index === EQUALIZER_BANDS.length - 1 ? 'highshelf' : 'peaking';
          filter.frequency.value = band.frequency;
          filter.Q.value = band.q;
          filter.gain.value = 0;
          filters.push(filter);
        });

        // ===== ANALYSER - Visualization =====
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;

        // ===== BASS BOOST - Punchy bass =====
        // Peaking filter at 100Hz - separated from EQ band64 (64Hz) to avoid phase overlap
        const bassBoost = audioContext.createBiquadFilter();
        bassBoost.type = 'peaking';
        bassBoost.frequency.value = 100;  // 100Hz = punch frequency (clear of 64Hz EQ band)
        bassBoost.Q.value = 0.8;          // Moderate Q for musical response
        bassBoost.gain.value = 0;

        // ===== SUB BOOST - Deep bass body =====
        // Low shelf at 45Hz - separated from EQ band32 (32Hz shelf) to avoid overlap
        const subBoost = audioContext.createBiquadFilter();
        subBoost.type = 'lowshelf';
        subBoost.frequency.value = 45;    // Sub-bass shelf (clear of 32Hz EQ band)
        subBoost.Q.value = 0.7;
        subBoost.gain.value = 0;

        // ===== TREBLE BOOST =====
        // High shelf at 10kHz - separated from EQ band8k (8kHz) to avoid phase overlap
        const trebleBoost = audioContext.createBiquadFilter();
        trebleBoost.type = 'highshelf';
        trebleBoost.frequency.value = 10000; // 10kHz (clear of 8kHz EQ band)
        trebleBoost.Q.value = 0.7;
        trebleBoost.gain.value = 0;

        // ===== LIMITER - Relaxed to preserve micro-dynamics =====
        // Gentle limiting that only catches real peaks
        const limiter = audioContext.createDynamicsCompressor();
        limiter.threshold.value = -6;    // Only catch actual peaks, not everything
        limiter.knee.value = 6;          // Soft knee - gradual onset
        limiter.ratio.value = 4;         // Gentle ratio - compress, don't crush
        limiter.attack.value = 0.003;    // 3ms - lets transients breathe
        limiter.release.value = 0.1;     // 100ms release - smooth recovery

        // ===== OUTPUT GAIN - Master volume =====
        const outputGain = audioContext.createGain();
        outputGain.gain.value = volumeRef.current / 100;

        // Reset HTML element volume to unity (chain controls volume)
        try {
          audio.volume = 1;
        } catch { }

        // ===== CONNECT SIMPLE CHAIN =====
        // Source → Preamp → HPF → EQ (10 bands) → Analyser → Bass → Sub → Treble → Limiter → Output
        source.connect(preamp);
        preamp.connect(highPass);

        // Connect EQ chain
        let currentNode: AudioNode = highPass;
        filters.forEach(filter => {
          currentNode.connect(filter);
          currentNode = filter;
        });

        // Continue chain
        currentNode.connect(analyser);
        analyser.connect(bassBoost);
        bassBoost.connect(subBoost);
        subBoost.connect(trebleBoost);
        trebleBoost.connect(limiter);
        limiter.connect(outputGain);
        outputGain.connect(audioContext.destination);

        // Store chain
        const chain: AudioChain = {
          context: audioContext,
          source,
          preamp,
          highPass,
          filters,
          analyser,
          bassBoost,
          subBoost,
          trebleBoost,
          limiter,
          outputGain,
          connected: true,
        };

        audioChainRef.current = chain;
        audioChainStorage.set(audio, chain);
        setIsChainReady(true);

        logger.info('Audio chain initialized');
        logger.debug('Signal Flow: Source → Preamp → HPF → 10-Band EQ → Bass → Sub → Treble → Limiter → Output');

      } catch (error: unknown) {
        const err = error as Error;
        if (err.message && err.message.includes('already connected')) {
          logger.debug('Audio source already connected (expected)');
        } else {
          logger.error('Failed to initialize audio chain:', error);
          logger.warn('Falling back to basic HTML5 audio');
        }
      }
    };

    // Try immediate init
    audio.addEventListener('play', initAudioChain, { once: true });

    return () => {
      audio.removeEventListener('play', initAudioChain);
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply equalizer settings - clean and simple
  const applyEqualizerSettingsToChain = (chain: AudioChain, settings: EqualizerSettings) => {
    if (!chain || !chain.connected || chain.filters.length === 0) return;

    try {
      const gains = [
        settings.band32,
        settings.band64,
        settings.band125,
        settings.band250,
        settings.band500,
        settings.band1k,
        settings.band2k,
        settings.band4k,
        settings.band8k,
        settings.band16k,
      ];

      const now = chain.context.currentTime;
      const smoothTime = 0.05; // 50ms smooth transitions

      // Calculate preamp reduction based on ACTUAL applied gains (not raw slider values)
      const bassTone = settings.enabled ? settings.bassTone : 0;
      const trebleTone = settings.enabled ? settings.trebleTone : 0;

      // Actual applied gains: bass = val×1.0 + val×0.7 = val×1.7, treble = val×1.0
      const eqBoost = settings.enabled
        ? gains.reduce((sum, g) => sum + Math.max(0, g), 0)
        : 0;
      const actualBassBoost = Math.max(0, bassTone) * 1.7;
      const actualTrebleBoost = Math.max(0, trebleTone) * 1.0;
      const totalBoost = eqBoost + actualBassBoost + actualTrebleBoost;

      // Reduce by 0.5dB per dB of total boost above 6dB
      const preampDb = totalBoost > 6 ? -(totalBoost - 6) * 0.5 : 0;
      const preampValue = Math.max(0.3, Math.min(1.0, Math.pow(10, preampDb / 20)));

      chain.preamp.gain.cancelScheduledValues(now);
      chain.preamp.gain.setValueAtTime(chain.preamp.gain.value, now);
      chain.preamp.gain.linearRampToValueAtTime(preampValue, now + smoothTime);

      // Apply 10-band EQ
      gains.forEach((gain, index) => {
        if (chain.filters[index]) {
          const targetGain = settings.enabled ? Math.max(-12, Math.min(12, gain)) : 0;
          chain.filters[index].gain.cancelScheduledValues(now);
          chain.filters[index].gain.setValueAtTime(chain.filters[index].gain.value, now);
          chain.filters[index].gain.linearRampToValueAtTime(targetGain, now + smoothTime);
        }
      });

      // ===== BASS CONTROL =====
      // Bass punch at 80Hz (the "thump" you feel) — 1:1 with slider
      const punchGain = Math.max(-6, Math.min(12, bassTone * 1.0));
      chain.bassBoost.gain.cancelScheduledValues(now);
      chain.bassBoost.gain.setValueAtTime(chain.bassBoost.gain.value, now);
      chain.bassBoost.gain.linearRampToValueAtTime(punchGain, now + smoothTime);

      // Sub-bass body at 60Hz — subtler complement, symmetric cut
      const subGain = Math.max(-6, Math.min(8, bassTone * 0.7));
      chain.subBoost.gain.cancelScheduledValues(now);
      chain.subBoost.gain.setValueAtTime(chain.subBoost.gain.value, now);
      chain.subBoost.gain.linearRampToValueAtTime(subGain, now + smoothTime);

      // ===== TREBLE CONTROL =====
      // Treble at 8kHz — 1:1 with slider, balanced with bass
      const trebleGain = Math.max(-6, Math.min(12, trebleTone * 1.0));
      chain.trebleBoost.gain.cancelScheduledValues(now);
      chain.trebleBoost.gain.setValueAtTime(chain.trebleBoost.gain.value, now);
      chain.trebleBoost.gain.linearRampToValueAtTime(trebleGain, now + smoothTime);

      logger.debug(`EQ: ${settings.preset}, Bass: ${punchGain.toFixed(1)}dB @ 80Hz, Sub: ${subGain.toFixed(1)}dB @ 60Hz, Treble: ${trebleGain.toFixed(1)}dB`);
      logger.debug(`Preamp: ${(preampValue * 100).toFixed(0)}%, Total Boost: ${totalBoost.toFixed(1)}dB`);

    } catch (error) {
      logger.error('Failed to update EQ:', error);
    }
  };

  // This effect runs whenever equalizerSettings changes AND persistence has loaded
  useEffect(() => {
    if (!isEqualizerLoaded || !isChainReady) return;
    const chain = audioChainRef.current;
    if (!chain) return;
    applyEqualizerSettingsToChain(chain, equalizerSettings);
  }, [equalizerSettings, isEqualizerLoaded, isChainReady]);

  // Auto-load and play when track changes
  useEffect(() => {
    const audio = audioRef.current;
    const currentTrack = playlist[currentTrackIndex];
    if (!audio || !currentTrack) return;

    if (audio.src !== currentTrack.url) {
      logger.debug('Loading track:', currentTrack.title);
      audio.src = currentTrack.url;
      audio.load();

      if (isPlaying) {
        const playNewTrack = async () => {
          try {
            // Resume audio context if suspended
            const chain = audioChainRef.current;
            if (chain?.context && chain.context.state === 'suspended') {
              await chain.context.resume();
            }

            await audio.play();
            fadeIn(800);
            logger.info('Auto-play started');
          } catch (error) {
            logger.error('Auto-play failed:', error);
            setIsPlaying(false);
          }
        };
        playNewTrack();
      }
    }
  }, [playlist, currentTrackIndex, isPlaying, setIsPlaying, fadeIn]);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      logger.debug(`Audio loaded: ${audio.duration.toFixed(2)}s`);
    };

    const handleEnded = () => {
      logger.debug('Track ended');
      if (repeatMode === 2) {
        audio.currentTime = 0;
        audio.play().catch(err => logger.error('Repeat play failed:', err));
      } else {
        handleNext();
      }
    };

    const handleError = (e: Event) => {
      const target = e.target as HTMLAudioElement;
      const errorMessage = getAudioErrorMessage(target.error);
      logger.error('Playback error:', errorMessage);
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [repeatMode, handleNext, setCurrentTime, setDuration, setIsPlaying]);

  // Auto-pause when audio output device changes (e.g. headphones plugged/unplugged)
  // Protects ears (headphone switch) and privacy (speaker switch)
  useEffect(() => {
    if (!navigator.mediaDevices) return;

    const handleDeviceChange = () => {
      const audio = audioRef.current;
      if (audio && !audio.paused) {
        logger.info('Audio output device changed — pausing playback');
        audio.pause();
        setIsPlaying(false);
      }
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [setIsPlaying]);

  // Update volume
  useEffect(() => {
    const audio = audioRef.current;
    const chain = audioChainRef.current;

    if (!audio) return;

    const targetVolume = volume / 100;

    if (chain?.outputGain && chain.connected && !isFadingRef.current) {
      try {
        const now = chain.context.currentTime;
        chain.outputGain.gain.cancelScheduledValues(now);
        chain.outputGain.gain.setValueAtTime(chain.outputGain.gain.value, now);
        chain.outputGain.gain.linearRampToValueAtTime(targetVolume, now + 0.1);
      } catch {
        audio.volume = targetVolume;
      }
    } else if (!isFadingRef.current) {
      audio.volume = targetVolume;
    }
  }, [volume]);

  // Play/Pause handler
  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    const currentTrack = playlist[currentTrackIndex];
    if (!audio || !currentTrack) return;

    if (isPlaying) {
      fadeOut(800).then(() => {
        audio.pause();
        setIsPlaying(false);
        logger.debug('Paused');
      });
    } else {
      const startPlayback = async () => {
        try {
          // Resume audio context if needed
          const chain = audioChainRef.current;
          if (chain?.context && chain.context.state === 'suspended') {
            await chain.context.resume();
            logger.debug('Audio context resumed');
          }

          // Load if needed
          if (audio.src !== currentTrack.url) {
            logger.debug('Loading:', currentTrack.title);
            audio.src = currentTrack.url;
            audio.load();
          }

          await audio.play();
          setIsPlaying(true);
          fadeIn(800);
          logger.info('Playing');

        } catch (error: unknown) {
          const err = error as Error;
          logger.error('Play failed:', err.message);
          setIsPlaying(false);
        }
      };

      startPlayback();
    }
  }, [isPlaying, playlist, currentTrackIndex, setIsPlaying, fadeIn, fadeOut]);

  const handleProgressChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = Number(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, [setCurrentTime]);

  const handleSeek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = time;
    setCurrentTime(time);
  }, [setCurrentTime]);

  const getAnalyser = useCallback(() => {
    const chain = audioChainRef.current;
    if (chain?.analyser && chain.connected) {
      return chain.analyser;
    }
    return null;
  }, []);

  const getAudioContext = useCallback(() => {
    // Return the chain context if available, otherwise the eager context so the
    // visualizer can initialise before the first play event fires.
    const chain = audioChainRef.current;
    if (chain?.context && chain.connected) {
      return chain.context;
    }
    return eagerAudioContextRef.current;
  }, []);

  return {
    audioRef,
    handlePlayPause,
    handleProgressChange,
    handleSeek,
    getAnalyser,
    getAudioContext,
  };
};
