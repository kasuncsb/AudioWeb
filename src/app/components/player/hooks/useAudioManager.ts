import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioTrack, EqualizerSettings } from '../types';
import { createLogger } from '@/utils/logger';
import { getAudioErrorMessage } from '@/utils/audioUtils';
import { EQUALIZER_BANDS, FREQUENCY_CACHE_MAX_SIZE } from '@/config/constants';

const logger = createLogger('AudioManager');

// ===== ADAPTIVE FREQUENCY DETECTION =====
// Full-track offline spectral analysis for precise bass/treble frequency targeting

interface DetectedFrequencies {
  bassPeak: number;      // Dominant bass "punch" frequency (60-150Hz)
  subPeak: number;       // Sub-bass "body" frequency (25-80Hz)
  treblePeak: number;    // Treble "air" frequency (6-16kHz)
  confidence: number;    // Analysis confidence (0-1)
}

// Default frequencies when analysis unavailable
const DEFAULT_FREQUENCIES: DetectedFrequencies = {
  bassPeak: 100,
  subPeak: 45,
  treblePeak: 10000,
  confidence: 0,
};

// Frequency detection bounds (industry-standard ranges)
const FREQ_BOUNDS = {
  bass: { min: 60, max: 150 },     // Kick drum, bass guitar punch
  sub: { min: 25, max: 80 },       // Sub-bass, 808s, synth bass
  treble: { min: 6000, max: 16000 }, // Air, presence, brilliance
};

// Analysis configuration
const ANALYSIS_CONFIG = {
  fftSize: 8192,           // Professional resolution for precise frequency detection (must be power of 2)
  samplePoints: 100,       // ~2-3 second intervals - matches mastering tools
  skipPercent: 0.05,       // Skip first/last 5% (often silence/fade)
  maxFileSizeMB: 50,       // Skip analysis for files larger than this (memory protection)
  timeoutMs: 30000,        // Analysis timeout (30 seconds)
};

/**
 * Check if a number is a power of 2
 */
function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

// Cache detected frequencies per track URL to avoid re-analysis
// LRU cache to prevent memory leaks
const frequencyCache = new Map<string, DetectedFrequencies>();
// Track ongoing analysis promises to prevent duplicate work
const analysisPromises = new Map<string, Promise<DetectedFrequencies>>();

function cacheFrequencies(trackUrl: string, freqs: DetectedFrequencies) {
  // Evict oldest entry if cache is full (Map maintains insertion order)
  if (frequencyCache.size >= FREQUENCY_CACHE_MAX_SIZE) {
    const oldestKey = frequencyCache.keys().next().value;
    if (oldestKey) frequencyCache.delete(oldestKey);
  }
  frequencyCache.set(trackUrl, freqs);
}

/**
 * Analyze a specific time position in the audio buffer using FFT
 */
function analyzeBufferAtPosition(
  audioBuffer: AudioBuffer,
  position: number,
  fftSize: number
): { bass: { freq: number; energy: number }; sub: { freq: number; energy: number }; treble: { freq: number; energy: number } } {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0); // Use first channel
  const startSample = Math.floor(position * sampleRate);
  
  // Extract samples for FFT
  const samples = new Float32Array(fftSize);
  for (let i = 0; i < fftSize && startSample + i < channelData.length; i++) {
    // Apply Hann window to reduce spectral leakage
    const windowMultiplier = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    samples[i] = channelData[startSample + i] * windowMultiplier;
  }

  // Compute FFT magnitude spectrum
  const spectrum = computeFFTMagnitude(samples, sampleRate);
  
  // Find spectral centroid in each frequency range
  const bass = findCentroidInRange(spectrum, sampleRate, fftSize, FREQ_BOUNDS.bass.min, FREQ_BOUNDS.bass.max);
  const sub = findCentroidInRange(spectrum, sampleRate, fftSize, FREQ_BOUNDS.sub.min, FREQ_BOUNDS.sub.max);
  const treble = findCentroidInRange(spectrum, sampleRate, fftSize, FREQ_BOUNDS.treble.min, FREQ_BOUNDS.treble.max);

  return { bass, sub, treble };
}

/**
 * Simple FFT magnitude computation (Cooley-Tukey radix-2)
 * Returns magnitude spectrum in dB
 */
function computeFFTMagnitude(samples: Float32Array, sampleRate: number): Float32Array {
  const n = samples.length;
  
  // Bit-reversal permutation
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  
  for (let i = 0; i < n; i++) {
    let j = 0;
    let nn = n;
    let ii = i;
    while (nn > 1) {
      j = (j << 1) | (ii & 1);
      ii >>= 1;
      nn >>= 1;
    }
    real[j] = samples[i];
  }

  // Cooley-Tukey FFT
  for (let size = 2; size <= n; size *= 2) {
    const halfSize = size / 2;
    const angle = -2 * Math.PI / size;
    
    for (let i = 0; i < n; i += size) {
      for (let j = 0; j < halfSize; j++) {
        const cos = Math.cos(angle * j);
        const sin = Math.sin(angle * j);
        const tr = real[i + j + halfSize] * cos - imag[i + j + halfSize] * sin;
        const ti = real[i + j + halfSize] * sin + imag[i + j + halfSize] * cos;
        
        real[i + j + halfSize] = real[i + j] - tr;
        imag[i + j + halfSize] = imag[i + j] - ti;
        real[i + j] += tr;
        imag[i + j] += ti;
      }
    }
  }

  // Convert to magnitude in dB (only need first half - Nyquist)
  const magnitude = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    const mag = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) / n;
    // Convert to dB with floor at -100dB
    magnitude[i] = mag > 0 ? Math.max(-100, 20 * Math.log10(mag)) : -100;
  }

  return magnitude;
}

/**
 * Find spectral centroid (center of mass) in a frequency range
 */
function findCentroidInRange(
  magnitude: Float32Array,
  sampleRate: number,
  fftSize: number,
  minFreq: number,
  maxFreq: number
): { freq: number; energy: number } {
  const binSize = sampleRate / fftSize;
  const minBin = Math.floor(minFreq / binSize);
  const maxBin = Math.min(Math.ceil(maxFreq / binSize), magnitude.length - 1);

  let weightedSum = 0;
  let totalEnergy = 0;
  let peakEnergy = -Infinity;

  for (let i = minBin; i <= maxBin; i++) {
    const freq = i * binSize;
    const dbValue = magnitude[i];
    // Convert from dB to linear power
    const linearPower = Math.pow(10, dbValue / 20);

    weightedSum += freq * linearPower;
    totalEnergy += linearPower;
    peakEnergy = Math.max(peakEnergy, dbValue);
  }

  const centroid = totalEnergy > 0 ? weightedSum / totalEnergy : (minFreq + maxFreq) / 2;

  return {
    freq: Math.max(minFreq, Math.min(maxFreq, centroid)),
    energy: peakEnergy,
  };
}

/**
 * Full-track offline frequency analysis
 * Decodes entire audio file and samples at multiple positions for accurate detection
 */
async function analyzeFullTrack(trackUrl: string, file?: File): Promise<DetectedFrequencies> {
  // Check cache first
  const cached = frequencyCache.get(trackUrl);
  if (cached) {
    logger.debug(`Using cached frequencies: bass=${cached.bassPeak}Hz, sub=${cached.subPeak}Hz, treble=${cached.treblePeak}Hz`);
    return cached;
  }

  // Check if analysis is already in progress
  const existingPromise = analysisPromises.get(trackUrl);
  if (existingPromise) {
    return existingPromise;
  }

  const analysisPromise = (async () => {
    try {
      logger.debug('Starting full-track frequency analysis...');
      const startTime = performance.now();

      // Validate FFT size is power of 2 (required for Cooley-Tukey)
      if (!isPowerOfTwo(ANALYSIS_CONFIG.fftSize)) {
        logger.error(`FFT size ${ANALYSIS_CONFIG.fftSize} is not a power of 2`);
        return DEFAULT_FREQUENCIES;
      }

      // File size check (memory protection)
      if (file && file.size > ANALYSIS_CONFIG.maxFileSizeMB * 1024 * 1024) {
        logger.warn(`File too large for analysis (${(file.size / 1024 / 1024).toFixed(1)}MB > ${ANALYSIS_CONFIG.maxFileSizeMB}MB limit)`);
        return DEFAULT_FREQUENCIES;
      }

      // Fetch audio data with timeout
      let arrayBuffer: ArrayBuffer;
      const fetchPromise = (async () => {
        if (file) {
          return await file.arrayBuffer();
        } else {
          const response = await fetch(trackUrl);
          return await response.arrayBuffer();
        }
      })();

      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Analysis timeout')), ANALYSIS_CONFIG.timeoutMs)
      );

      try {
        arrayBuffer = await Promise.race([fetchPromise, timeoutPromise]);
      } catch (e) {
        logger.warn('Analysis fetch timed out or failed:', e);
        return DEFAULT_FREQUENCIES;
      }

      // Decode audio
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      await audioContext.close();

      const duration = audioBuffer.duration;
      const { fftSize, samplePoints, skipPercent } = ANALYSIS_CONFIG;

      // Sample at multiple positions across the track (skip silence at start/end)
      const startPos = duration * skipPercent;
      const endPos = duration * (1 - skipPercent);
      const interval = (endPos - startPos) / samplePoints;

      const results: Array<{ bass: { freq: number; energy: number }; sub: { freq: number; energy: number }; treble: { freq: number; energy: number } }> = [];

      for (let i = 0; i < samplePoints; i++) {
        const position = startPos + (interval * i);
        const analysis = analyzeBufferAtPosition(audioBuffer, position, fftSize);
        results.push(analysis);
      }

      // Weight results by energy (louder sections are more representative)
      let bassWeightedSum = 0, bassWeightTotal = 0;
      let subWeightedSum = 0, subWeightTotal = 0;
      let trebleWeightedSum = 0, trebleWeightTotal = 0;
      let maxBassEnergy = -Infinity, maxSubEnergy = -Infinity, maxTrebleEnergy = -Infinity;

      for (const r of results) {
        // Use energy as weight (normalize from dB)
        const bassWeight = Math.pow(10, (r.bass.energy + 60) / 40);
        const subWeight = Math.pow(10, (r.sub.energy + 60) / 40);
        const trebleWeight = Math.pow(10, (r.treble.energy + 60) / 40);

        bassWeightedSum += r.bass.freq * bassWeight;
        bassWeightTotal += bassWeight;
        subWeightedSum += r.sub.freq * subWeight;
        subWeightTotal += subWeight;
        trebleWeightedSum += r.treble.freq * trebleWeight;
        trebleWeightTotal += trebleWeight;

        maxBassEnergy = Math.max(maxBassEnergy, r.bass.energy);
        maxSubEnergy = Math.max(maxSubEnergy, r.sub.energy);
        maxTrebleEnergy = Math.max(maxTrebleEnergy, r.treble.energy);
      }

      // Calculate weighted averages
      const bassPeak = bassWeightTotal > 0 ? Math.round(bassWeightedSum / bassWeightTotal) : DEFAULT_FREQUENCIES.bassPeak;
      const subPeak = subWeightTotal > 0 ? Math.round(subWeightedSum / subWeightTotal) : DEFAULT_FREQUENCIES.subPeak;
      const treblePeak = trebleWeightTotal > 0 ? Math.round(trebleWeightedSum / trebleWeightTotal) : DEFAULT_FREQUENCIES.treblePeak;

      // Calculate confidence based on peak energy levels
      const noiseFloor = -60;
      const signalRange = 40;
      const bassConf = Math.min(1, Math.max(0, (maxBassEnergy - noiseFloor) / signalRange));
      const subConf = Math.min(1, Math.max(0, (maxSubEnergy - noiseFloor) / signalRange));
      const trebleConf = Math.min(1, Math.max(0, (maxTrebleEnergy - noiseFloor) / signalRange));
      const confidence = (bassConf + subConf + trebleConf) / 3;

      const detected: DetectedFrequencies = { bassPeak, subPeak, treblePeak, confidence };

      const elapsed = performance.now() - startTime;
      const trebleDisplay = treblePeak >= 1000 ? `${(treblePeak / 1000).toFixed(1)}k` : `${treblePeak}`;
      logger.info(`EQ tuned: ${bassPeak}Hz / ${subPeak}Hz / ${trebleDisplay}Hz (${(elapsed / 1000).toFixed(1)}s)`);

      // Cache result
      cacheFrequencies(trackUrl, detected);
      
      return detected;
    } catch (error) {
      logger.error('Full-track analysis failed:', error);
      return DEFAULT_FREQUENCIES;
    } finally {
      analysisPromises.delete(trackUrl);
    }
  })();

  analysisPromises.set(trackUrl, analysisPromise);
  return analysisPromise;
}

// Clean, Simple Audio Chain
// Focus: Clarity, Punchy Bass, No Artifacts
interface AudioChain {
  context: AudioContext;
  source: MediaElementAudioSourceNode;

  // Simple Signal Flow:
  // Source → Analyser → Preamp → HPF → EQ → Bass → Treble → Limiter → Output
  preamp: GainNode;                    // Input headroom control
  highPass: BiquadFilterNode;          // Rumble removal
  filters: BiquadFilterNode[];         // 10-band EQ
  analyser: AnalyserNode;              // Raw frequency analysis (visualization + adaptive EQ)
  bassBoost: BiquadFilterNode;         // Bass punch (adaptive frequency)
  subBoost: BiquadFilterNode;          // Sub bass (adaptive frequency)
  trebleBoost: BiquadFilterNode;       // Treble control (adaptive frequency)
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

  // ===== ADAPTIVE FREQUENCY STATE =====
  const detectedFreqRef = useRef<DetectedFrequencies>(DEFAULT_FREQUENCIES);
  const analysisCompleteRef = useRef<boolean>(false);
  const currentTrackUrlRef = useRef<string>('');

  /**
   * Apply detected frequencies to boost filters with smooth transition
   */
  const applyDetectedFrequencies = useCallback((chain: AudioChain, freqs: DetectedFrequencies) => {
    if (!chain.connected) return;

    const now = chain.context.currentTime;
    const transitionTime = 0.3; // 300ms smooth transition

    // Apply bass punch frequency
    chain.bassBoost.frequency.cancelScheduledValues(now);
    chain.bassBoost.frequency.setValueAtTime(chain.bassBoost.frequency.value, now);
    chain.bassBoost.frequency.linearRampToValueAtTime(freqs.bassPeak, now + transitionTime);

    // Apply sub-bass frequency
    chain.subBoost.frequency.cancelScheduledValues(now);
    chain.subBoost.frequency.setValueAtTime(chain.subBoost.frequency.value, now);
    chain.subBoost.frequency.linearRampToValueAtTime(freqs.subPeak, now + transitionTime);

    // Apply treble frequency
    chain.trebleBoost.frequency.cancelScheduledValues(now);
    chain.trebleBoost.frequency.setValueAtTime(chain.trebleBoost.frequency.value, now);
    chain.trebleBoost.frequency.linearRampToValueAtTime(freqs.treblePeak, now + transitionTime);

    logger.debug(`Applied adaptive frequencies - Bass: ${freqs.bassPeak}Hz, Sub: ${freqs.subPeak}Hz, Treble: ${freqs.treblePeak}Hz`);
  }, []);

  /**
   * Run full-track frequency analysis (async, offline)
   * Analyzes entire audio file for accurate frequency detection
   */
  const runFrequencyAnalysis = useCallback(async (trackUrl: string, file?: File) => {
    // Run analysis (uses cache if available)
    const detected = await analyzeFullTrack(trackUrl, file);
    detectedFreqRef.current = detected;
    analysisCompleteRef.current = true;

    // Read chain ref AFTER await to get current value (not stale)
    const chain = audioChainRef.current;
    if (chain?.connected) {
      applyDetectedFrequencies(chain, detected);
    }
  }, [applyDetectedFrequencies]);

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
      eagerAudioContextRef.current = new AudioContextClass({ latencyHint: 'playback' });
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
        const audioContext = eagerAudioContextRef.current ?? new AudioContextClass({ latencyHint: 'playback' });
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

        // ===== ANALYSER - Raw frequency analysis =====
        // Placed early in chain for unprocessed signal analysis (visualization + adaptive detection)
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;          // Good frequency resolution for detection
        analyser.smoothingTimeConstant = 0.8;

        // ===== BASS BOOST - Adaptive punchy bass =====
        // Peaking filter - frequency auto-adjusted based on track analysis
        const bassBoost = audioContext.createBiquadFilter();
        bassBoost.type = 'peaking';
        bassBoost.frequency.value = DEFAULT_FREQUENCIES.bassPeak;  // Will be adapted per track
        bassBoost.Q.value = 0.8;          // Moderate Q for musical response
        bassBoost.gain.value = 0;

        // ===== SUB BOOST - Adaptive deep bass body =====
        // Low shelf filter - frequency auto-adjusted based on track analysis
        const subBoost = audioContext.createBiquadFilter();
        subBoost.type = 'lowshelf';
        subBoost.frequency.value = DEFAULT_FREQUENCIES.subPeak;  // Will be adapted per track
        subBoost.Q.value = 0.7;
        subBoost.gain.value = 0;

        // ===== TREBLE BOOST - Adaptive high frequency enhancement =====
        // High shelf filter - frequency auto-adjusted based on track analysis
        const trebleBoost = audioContext.createBiquadFilter();
        trebleBoost.type = 'highshelf';
        trebleBoost.frequency.value = DEFAULT_FREQUENCIES.treblePeak;  // Will be adapted per track
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
        // Source → Analyser → Preamp → HPF → EQ (10 bands) → Bass → Sub → Treble → Limiter → Output
        // Analyser placed early for raw frequency analysis (visualization + adaptive EQ detection)
        source.connect(analyser);
        analyser.connect(preamp);
        preamp.connect(highPass);

        // Connect EQ chain
        let currentNode: AudioNode = highPass;
        filters.forEach(filter => {
          currentNode.connect(filter);
          currentNode = filter;
        });

        // Continue chain
        currentNode.connect(bassBoost);
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
        logger.debug('Signal Flow: Source → Analyser → Preamp → HPF → 10-Band EQ → Bass → Sub → Treble → Limiter → Output');

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

  // ===== ADAPTIVE FREQUENCY ANALYSIS =====
  // Analyze track's frequency content when track changes (full offline scan)
  useEffect(() => {
    const currentTrack = playlist[currentTrackIndex];
    if (!currentTrack) return;

    const trackUrl = currentTrack.url;

    // Track URL changed - run analysis
    if (currentTrackUrlRef.current !== trackUrl) {
      currentTrackUrlRef.current = trackUrl;
      analysisCompleteRef.current = false;

      // Run full-track analysis (async, doesn't block playback)
      logger.debug('Starting full-track frequency analysis for:', currentTrack.title);
      runFrequencyAnalysis(trackUrl, currentTrack.file);
    }
  }, [playlist, currentTrackIndex, runFrequencyAnalysis]);

  // Apply detected frequencies when chain becomes ready (if analysis completed first)
  useEffect(() => {
    if (!isChainReady) return;
    const chain = audioChainRef.current;
    if (!chain?.connected || !analysisCompleteRef.current) return;

    applyDetectedFrequencies(chain, detectedFreqRef.current);
  }, [isChainReady, applyDetectedFrequencies]);

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
