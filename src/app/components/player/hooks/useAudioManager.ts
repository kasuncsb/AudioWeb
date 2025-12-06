import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioTrack, EqualizerSettings } from '../types';
import { createLogger } from '@/utils/logger';
import { getAudioErrorMessage } from '@/utils/audioUtils';
import { EQUALIZER_BANDS } from '@/config/constants';

const logger = createLogger('AudioManager');

// Audio processing constants
const SUSTAINED_RELEASE_TIME = 0.8; // 800ms - for parallel compression sustain

// Professional Studio-Level Web Audio API Chain
// Complete signal flow for audiophile-grade sound processing
interface AudioChain {
  context: AudioContext;
  source: MediaElementAudioSourceNode;
  
  // Input Stage
  inputGain: GainNode;                 // Preamp - input level control with headroom
  highPassFilter: BiquadFilterNode;    // Rumble removal (subsonic frequencies)
  
  // Equalization Stage
  filters: BiquadFilterNode[];         // 10-band parametric EQ
  
  // Analysis Stage
  analyser: AnalyserNode;              // FFT analyzer for visualization
  
  // Dynamics Stage
  compressor: DynamicsCompressorNode;  // Dynamic range compression
  
  // Enhancement Stage
  exciter: BiquadFilterNode;           // Harmonic exciter/enhancer (high-freq boost)
  bassPunchFilter: BiquadFilterNode;  // Dedicated bass punch peaking filter (~60Hz)
  // Parallel low-band compressor for sustained punch
  lowBandFilter: BiquadFilterNode;
  parallelCompressor: DynamicsCompressorNode;
  parallelGain: GainNode;
  // Additional helpers for parallel low-band path
  lowBandLowpass?: BiquadFilterNode;  // ensures no mid/high leakage into the parallel path
  parallelMakeupGain?: GainNode;      // makeup gain after parallel compression
  parallelSaturator?: WaveShaperNode; // subtle saturation on parallel low band
  parallelLimiter?: DynamicsCompressorNode; // limiter for the parallel path
  // Very-low-frequency (sub-bass) parallel path for extra sustain/vibration
  subLowFilter?: BiquadFilterNode;      // bandpass for sub-bass (20-40Hz)
  subLowLowpass?: BiquadFilterNode;     // lowpass to isolate sub region
  subCompressor?: DynamicsCompressorNode; // compressor for sub-bass sustain
  subMakeupGain?: GainNode;             // makeup gain after sub compression
  subSaturator?: WaveShaperNode;        // saturation for sub-bass harmonics
  subLimiter?: DynamicsCompressorNode;  // limiter for sub-bass path
  subGain?: GainNode;                   // final blend gain for sub-bass
  
  // Spatial Stage
  stereoWidener: GainNode;             // Stereo width control (placeholder for future stereo processing)
  
  // Ambience Stage
  reverb: ConvolverNode | null;        // Convolution reverb (spatial depth) - optional
  reverbDryGain: GainNode;             // Dry signal path
  reverbWetGain: GainNode;             // Wet signal path (reverb)
  reverbMix: GainNode;                 // Mix node combining dry and wet
  
  // Protection Stage
  limiter: DynamicsCompressorNode;     // Brick-wall limiter (anti-clipping)
  
  // Output Stage
  loudnessGain: GainNode;              // Loudness auto-adjust (normalization)
  outputGain: GainNode;                // Post-amp - final output level control
  
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
  const [isChainReady, setIsChainReady] = useState(false);
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFadingRef = useRef<boolean>(false);

  // Fade in audio
  const fadeIn = useCallback((duration: number = 800) => {
    const audio = audioRef.current;
    const chain = audioChainRef.current;
    
    if (!audio) return;

    const targetVolume = volume / 100;

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
        }, duration);
        return;
      } catch (error) {
        logger.error('Fade in failed:', error);
      }
    }
    
    audio.volume = targetVolume;
  }, [volume]);

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
        logger.start('Initializing professional studio-level Web Audio API chain');

        // Create AudioContext
        const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        
        // Create MediaElementSource (can only be done once per element)
        const source = audioContext.createMediaElementSource(audio);
        
        // ===== INPUT STAGE =====
        // Input Gain (Preamp) - provides headroom for signal processing
        const inputGain = audioContext.createGain();
        inputGain.gain.value = 0.75; // 25% reduction for headroom
        
        // High-Pass Filter - removes rumble and subsonic frequencies (<20Hz)
        const highPassFilter = audioContext.createBiquadFilter();
        highPassFilter.type = 'highpass';
        highPassFilter.frequency.value = 20; // Subsonic rumble removal
        highPassFilter.Q.value = 0.707; // Butterworth response
        
        // ===== EQUALIZATION STAGE =====
        // 10-Band Parametric EQ - surgical frequency control
        const filters: BiquadFilterNode[] = [];
        EQUALIZER_BANDS.forEach((band, index) => {
          const filter = audioContext.createBiquadFilter();
          filter.type = index === 0 ? 'lowshelf' : index === EQUALIZER_BANDS.length - 1 ? 'highshelf' : 'peaking';
          filter.frequency.value = band.frequency;
          filter.Q.value = band.q; // Studio Q values from constants
          filter.gain.value = 0;
          filters.push(filter);
        });
        
        // ===== ANALYSIS STAGE =====
        // Analyser - FFT analysis for visualization (future use)
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;
        
        // ===== DYNAMICS STAGE =====
        // Studio-grade compressor - transparent mastering-style compression
        // Inspired by professional mastering compressors and PowerAmp/Viper4Android dynamics
  const compressor = audioContext.createDynamicsCompressor();
  compressor.threshold.value = -26;    // Lower threshold for more consistent dynamics
  compressor.knee.value = 12;          // Medium-soft knee for musical compression
  compressor.ratio.value = 3;          // Gentle ratio for transparency
  compressor.attack.value = 0.008;     // 8ms attack - fast enough to control peaks, slow enough for transients
  compressor.release.value = 0.18;     // 180ms release - responsive but musical
        
        // ===== ENHANCEMENT STAGE =====
        // Studio-grade exciter/enhancer - adds harmonic richness and air
        // Inspired by Viper4Android's ViPER Clarity and PowerAmp's tone controls
        const exciter = audioContext.createBiquadFilter();
        exciter.type = 'highshelf';
        exciter.frequency.value = 7000;      // Optimize for presence/brilliance sweet spot
        exciter.Q.value = 0.8;               // Slightly wider for smoother enhancement
        exciter.gain.value = 0;              // Disabled by default, controlled by trebleTone

  // Studio-grade bass punch filter - optimized for impact and clarity
  // Tuned to PowerAmp and Viper4Android bass enhancement characteristics
  const bassPunchFilter = audioContext.createBiquadFilter();
  bassPunchFilter.type = 'peaking';
  bassPunchFilter.frequency.value = 55;  // Sweet spot for bass punch (between sub and mid-bass)
  bassPunchFilter.Q.value = 1.3;         // Surgical Q for tight, focused impact
  bassPunchFilter.gain.value = 0;        // Controlled by bassTone
        
        // ===== SPATIAL STAGE =====
        // Stereo Widener - stereo field control (placeholder for future expansion)
        const stereoWidener = audioContext.createGain();
        stereoWidener.gain.value = 1.0;      // Unity gain (no widening by default)
        
        // ===== AMBIENCE STAGE =====
        // Reverb - convolution reverb for spatial depth (optional)
        const reverb: ConvolverNode | null = null; // Can be enabled later with impulse response
        const reverbDryGain = audioContext.createGain();
        const reverbWetGain = audioContext.createGain();
        const reverbMix = audioContext.createGain();
        
        reverbDryGain.gain.value = 1.0;      // 100% dry signal
        reverbWetGain.gain.value = 0.0;      // 0% wet signal (reverb disabled)
        reverbMix.gain.value = 1.0;
        
        // ===== PROTECTION STAGE =====
        // Studio-grade brick-wall limiter - transparent peak protection
        // Inspired by professional mastering limiters (L2, Ozone, etc.)
        const limiter = audioContext.createDynamicsCompressor();
        limiter.threshold.value = -0.5;      // Tighter ceiling for maximum loudness
        limiter.knee.value = 0;              // Hard knee (true brick-wall)
        limiter.ratio.value = 20;            // Hard limiting ratio
        limiter.attack.value = 0.0005;       // 0.5ms attack (near-instant)
        limiter.release.value = 0.08;        // 80ms release - fast but musical
        
        // ===== OUTPUT STAGE =====
        // Loudness Auto Adjust - intelligent loudness normalization
        const loudnessGain = audioContext.createGain();
        loudnessGain.gain.value = 1.0;       // Unity gain (no adjustment by default)
        
        // Output Gain (Post-amp) - final master volume control
        const outputGain = audioContext.createGain();
        outputGain.gain.value = volume / 100;

        // When a Web Audio graph is created the HTMLMediaElement's
        // built-in volume property would still be applied in addition
        // to our `outputGain`. If the user changed the slider before
        // playback, `audio.volume` may already be reduced which would
        // cause the final perceived volume to be multiplied twice
        // (audio.volume * outputGain.gain). Reset the element volume
        // to unity once the audio chain is ready so the chain alone
        // controls the final output level.
        try {
          audio.volume = 1;
        } catch {}

  // ===== PARALLEL LOW-BAND PUNCH PATH =====
  // Studio-grade parallel compression for sustained bass impact
  // Inspired by professional mastering techniques and Viper4Android's bass processing
  const lowBandFilter = audioContext.createBiquadFilter();
  lowBandFilter.type = 'bandpass';
  lowBandFilter.frequency.value = 45; // Optimized center for maximum bass impact
  lowBandFilter.Q.value = 1.5;        // Balanced Q for punch without mud

  // Studio-grade isolation filter for parallel path
  const lowBandLowpass = audioContext.createBiquadFilter();
  lowBandLowpass.type = 'lowpass';
  lowBandLowpass.frequency.value = 85; // Optimized cutoff for bass clarity
  lowBandLowpass.Q.value = 0.8;        // Slightly steeper for better isolation

  // Studio-grade parallel compressor - New York style compression
  // Inspired by professional mastering and PowerAmp dynamics processing
  const parallelCompressor = audioContext.createDynamicsCompressor();
  parallelCompressor.threshold.value = -20; // Optimized threshold for consistent punch
  parallelCompressor.knee.value = 8;        // Tighter knee for more punch character
  parallelCompressor.ratio.value = 5;       // Moderate ratio for transparency
  parallelCompressor.attack.value = 0.002;  // 2ms - fast transient response
  // Use sustained release time for low-band punch. While the Web Audio API spec
  // doesn't define a maximum, some browser implementations may log warnings for
  // values at the upper range. This value provides sustained punch without warnings.
  parallelCompressor.release.value = SUSTAINED_RELEASE_TIME;

  // Gain to mix compressed low band back into the chain
  const parallelGain = audioContext.createGain();
  parallelGain.gain.value = 0; // off by default; driven by bassTone

  // Studio-grade makeup gain - compensate for compression
  const parallelMakeupGain = audioContext.createGain();
  parallelMakeupGain.gain.value = 2.2; // ~6.8dB boost - optimized for parallel blend

  // Studio-grade saturation - adds warmth and harmonic richness
  // Inspired by analog mastering and Viper4Android's tube simulation
  const parallelSaturator = audioContext.createWaveShaper();
  // Create optimized tanh curve for musical saturation
  const makeTanhCurve = (amount = 400) => {
    const samples = 4096;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; ++i) {
      const x = (i * 2) / (samples - 1) - 1;
      curve[i] = Math.tanh(x * amount);
    }
    return curve;
  };
  parallelSaturator.curve = makeTanhCurve(52); // Optimized for warm, rich harmonics
  parallelSaturator.oversample = '4x';         // Maximum quality oversampling

  // Limiter on the parallel path to prevent extreme peaks from lifting master dynamics
  const parallelLimiter = audioContext.createDynamicsCompressor();
  parallelLimiter.threshold.value = -3; // gentle ceiling for parallel path
  parallelLimiter.knee.value = 0;
  parallelLimiter.ratio.value = 20;
  parallelLimiter.attack.value = 0.002;
  parallelLimiter.release.value = 0.1;

  // ===== SUB-BASS (VERY-LOW) PARALLEL PATH =====
  // Studio-grade sub-bass enhancement - deep, controlled impact
  // Inspired by professional subwoofer processing and Viper4Android's bass boost
  const subLowFilter = audioContext.createBiquadFilter();
  subLowFilter.type = 'bandpass';
  subLowFilter.frequency.value = 30; // Optimized for maximum sub-bass impact
  subLowFilter.Q.value = 1.7;        // Balanced Q for deep extension

  // Studio-grade sub isolation filter
  const subLowLowpass = audioContext.createBiquadFilter();
  subLowLowpass.type = 'lowpass';
  subLowLowpass.frequency.value = 65; // Optimized cutoff for sub clarity
  subLowLowpass.Q.value = 0.8;        // Steeper roll-off for better isolation

  // Studio-grade sub-bass compressor - tight, controlled impact
  const subCompressor = audioContext.createDynamicsCompressor();
  subCompressor.threshold.value = -22; // Optimized threshold for sub control
  subCompressor.knee.value = 5;        // Tighter knee for punch
  subCompressor.ratio.value = 7;       // Strong but musical ratio
  subCompressor.attack.value = 0.003;  // 3ms - fast sub transient response
  // Use sustained release time for sub-bass to avoid potential browser warnings
  subCompressor.release.value = SUSTAINED_RELEASE_TIME;

  // Studio-grade sub makeup gain
  const subMakeupGain = audioContext.createGain();
  subMakeupGain.gain.value = 2.3; // ~7.2dB boost - optimized for sub presence

  // Studio-grade sub saturation - creates perceivable harmonics
  const subSaturator = audioContext.createWaveShaper();
  subSaturator.curve = makeTanhCurve(60); // Optimized for deep, rich sub harmonics
  subSaturator.oversample = '4x';         // Maximum quality

  // Limiter for sub-bass path
  const subLimiter = audioContext.createDynamicsCompressor();
  subLimiter.threshold.value = -6;
  subLimiter.knee.value = 0;
  subLimiter.ratio.value = 20;
  subLimiter.attack.value = 0.002;
  subLimiter.release.value = 0.1;

  // Blend gain for sub-bass path
  const subGain = audioContext.createGain();
  subGain.gain.value = 0; // off by default
        
        // ===== CONNECT THE COMPLETE SIGNAL CHAIN =====
        // AudioSource → Input Gain → High-Pass Filter → 10-Band EQ → Analyser →
        // Compressor → Exciter → Stereo Widener → Reverb (Dry/Wet Mix) →
        // Limiter → Loudness Adjust → Output Gain → Destination
        
        source.connect(inputGain);
        inputGain.connect(highPassFilter);
        
        // Connect EQ chain
        let currentNode: AudioNode = highPassFilter;
        filters.forEach(filter => {
          currentNode.connect(filter);
          currentNode = filter;
        });
        
  // Continue signal flow
  currentNode.connect(analyser);
  analyser.connect(bassPunchFilter);
  bassPunchFilter.connect(compressor);
  compressor.connect(exciter);
        exciter.connect(stereoWidener);
        
  // Reverb routing (dry/wet mix)
  stereoWidener.connect(reverbDryGain);
  // Also feed parallel low-band punch path from stereoWidener
  stereoWidener.connect(lowBandFilter);
  // Ensure low-band path is tightly isolated (bandpass -> lowpass) before compression
  lowBandFilter.connect(lowBandLowpass);
  lowBandLowpass.connect(parallelCompressor);
  parallelCompressor.connect(parallelMakeupGain);
  // Saturate and limit the compressed low band to increase perceived loudness without affecting mids
  parallelMakeupGain.connect(parallelSaturator);
  parallelSaturator.connect(parallelLimiter);
  // Feed limiter output to the blend gain (no feedback loop)
  parallelLimiter.connect(parallelGain);
  parallelGain.connect(reverbMix); // add compressed low band before limiter

  // Also feed the dedicated sub-bass parallel path from stereoWidener
  stereoWidener.connect(subLowFilter);
  subLowFilter.connect(subLowLowpass);
  subLowLowpass.connect(subCompressor);
  subCompressor.connect(subMakeupGain);
  subMakeupGain.connect(subSaturator);
  subSaturator.connect(subLimiter);
  subLimiter.connect(subGain);
  subGain.connect(reverbMix); // mix sub-bass compressed/saturated content before limiter
        // Reverb is currently disabled (null) - can be enabled later with impulse response
        // if (reverb) {
        //   stereoWidener.connect(reverb);
        //   reverb.connect(reverbWetGain);
        // }
        reverbDryGain.connect(reverbMix);
        reverbWetGain.connect(reverbMix);
        
        // Final output chain
        reverbMix.connect(limiter);
        limiter.connect(loudnessGain);
        loudnessGain.connect(outputGain);
        outputGain.connect(audioContext.destination);

        // Store chain
        const chain: AudioChain = {
          context: audioContext,
          source,
          inputGain,
          highPassFilter,
          filters,
          analyser,
          compressor,
          exciter,
          bassPunchFilter,
          lowBandFilter,
          lowBandLowpass,
          parallelCompressor,
          parallelMakeupGain,
          parallelSaturator,
          parallelLimiter,
          parallelGain,
          subLowFilter,
          subLowLowpass,
          subCompressor,
          subMakeupGain,
          subSaturator,
          subLimiter,
          subGain,
          stereoWidener,
          reverb,
          reverbDryGain,
          reverbWetGain,
          reverbMix,
          limiter,
          loudnessGain,
          outputGain,
          connected: true,
        };

  audioChainRef.current = chain;
  audioChainStorage.set(audio, chain);
  setIsChainReady(true);

  logger.info('Web Audio API chain initialized successfully');
        logger.debug('Signal Flow: Source → Input Gain → High-Pass → 10-Band EQ → Analyser → Compressor → Exciter → Stereo Widener → Reverb → Limiter → Loudness → Output Gain → Destination');
        logger.debug(`EQ Bands: ${EQUALIZER_BANDS.map(b => b.label).join(', ')}`);
  logger.debug('Compressor: -24dB threshold, 4:1 ratio, 12ms attack, 250ms release');
        logger.debug('Limiter: -1dB threshold, 20:1 ratio, 1ms attack, 100ms release');
        logger.debug('All nodes created and connected successfully');
        logger.debug(`Input Gain: ${(inputGain.gain.value * 100).toFixed(0)}%, High-Pass: ${highPassFilter.frequency.value}Hz, Output: ${(outputGain.gain.value * 100).toFixed(0)}%`);
        
        // Initial EQ application removed here to avoid duplicate application.
        // The dedicated effect that listens to `equalizerSettings` (below)
        // will apply EQ once the audio chain exists and whenever settings
        // change. Keeping the initial application here caused the same
        // values to be set twice (once on init, once via the settings
        // effect) leading to duplicate logs and potential clamping warnings.
        
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
      
      // Cleanup audio chain on unmount to prevent memory leaks
      const chain = audioChainRef.current;
      if (chain && chain.connected) {
        try {
          // Close audio context to free resources
          if (chain.context.state !== 'closed') {
            chain.context.close().catch(() => {
              // Ignore errors during cleanup
            });
          }
          // Mark as disconnected to prevent further use
          chain.connected = false;
          // Remove from storage
          if (audio) {
            audioChainStorage.delete(audio);
          }
        } catch (error) {
          logger.warn('Error during audio chain cleanup:', error);
        }
      }
    };
  }, [volume]);

  // Update equalizer settings dynamically
  // Helper to apply equalizer settings to an initialized chain
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

      // Calculate total positive gain for dynamic processing
      const totalPositiveGain = settings.enabled
        ? gains.reduce((sum, gain) => sum + Math.max(0, gain), 0)
        : 0;

      // Dynamic input gain adjustment (headroom management)
      let inputGainValue = 0.75; // Base 25% reduction
      if (totalPositiveGain > 15) {
        const reduction = Math.min(0.2, ((totalPositiveGain - 15) / 30) * 0.2);
        inputGainValue -= reduction;
      }
      inputGainValue = Math.max(0.5, Math.min(0.85, inputGainValue));

      chain.inputGain.gain.cancelScheduledValues(now);
      chain.inputGain.gain.setValueAtTime(chain.inputGain.gain.value, now);
      chain.inputGain.gain.linearRampToValueAtTime(inputGainValue, now + 0.1);

      // Update 10-band EQ with smooth transitions
      gains.forEach((gain, index) => {
        if (chain.filters[index]) {
          const targetGain = settings.enabled ? gain : 0;
          chain.filters[index].gain.cancelScheduledValues(now);
          chain.filters[index].gain.setValueAtTime(chain.filters[index].gain.value, now);
          chain.filters[index].gain.linearRampToValueAtTime(targetGain, now + 0.05);
        }
      });

      // Update studio-grade exciter based on trebleTone
      // Optimized curve for PowerAmp/Viper4Android-style clarity enhancement
      const exciterGain = settings.enabled && settings.trebleTone > 0
        ? Math.min(3.5, settings.trebleTone * 0.28) // Max +3.5dB for more impact
        : settings.enabled && settings.trebleTone < 0
        ? Math.max(-2, settings.trebleTone * 0.15) // Subtle negative adjustment
        : 0;
      chain.exciter.gain.cancelScheduledValues(now);
      chain.exciter.gain.setValueAtTime(chain.exciter.gain.value, now);
      chain.exciter.gain.linearRampToValueAtTime(exciterGain, now + 0.04);

      // Update studio-grade bass punch filter based on bassTone
      // Optimized for PowerAmp/Viper4Android-style bass impact
      const targetBassTone = settings.enabled ? settings.bassTone : 0;
      const targetBassPunch = targetBassTone > 0
        ? Math.min(12, targetBassTone * 0.65) // Enhanced positive scaling
        : Math.max(-3, targetBassTone * 0.2);  // Subtle negative adjustment
      if (chain.bassPunchFilter) {
        chain.bassPunchFilter.gain.cancelScheduledValues(now);
        chain.bassPunchFilter.gain.setValueAtTime(chain.bassPunchFilter.gain.value, now);
        chain.bassPunchFilter.gain.linearRampToValueAtTime(targetBassPunch, now + 0.06);
      }

      // Update loudness normalization
      let loudnessValue = 1.0;
      if (settings.enabled) {
        const referenceGain = 15;
        if (totalPositiveGain > referenceGain) {
          const reduction = Math.min(0.25, ((totalPositiveGain - referenceGain) / referenceGain) * 0.25);
          loudnessValue = 1.0 - reduction;
        } else if (totalPositiveGain < referenceGain && totalPositiveGain > 0) {
          const boost = Math.min(0.15, ((referenceGain - totalPositiveGain) / referenceGain) * 0.15);
          loudnessValue = 1.0 + boost;
        }
        loudnessValue = Math.max(0.75, Math.min(1.15, loudnessValue));
      }
      chain.loudnessGain.gain.cancelScheduledValues(now);
      chain.loudnessGain.gain.setValueAtTime(chain.loudnessGain.gain.value, now);
      chain.loudnessGain.gain.linearRampToValueAtTime(loudnessValue, now + 0.15);

      logger.debug(`EQ updated: ${settings.preset}, enabled: ${settings.enabled}`);
      logger.debug(`Input: ${(inputGainValue * 100).toFixed(1)}%, Exciter: ${exciterGain.toFixed(1)}dB, Loudness: ${(loudnessValue * 100).toFixed(1)}%`);
      logger.debug(`Bass/Treble Tone: ${settings.bassTone}/${settings.trebleTone}dB, Total Positive Gain: ${totalPositiveGain.toFixed(1)}dB`);
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

  return {
    audioRef,
    handlePlayPause,
    handleProgressChange,
    handleSeek,
    getAnalyser,
  };
};
