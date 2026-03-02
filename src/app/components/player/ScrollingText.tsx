import { useEffect, useRef, useState, useCallback } from 'react';

interface ScrollingTextProps {
  text: string;
  className?: string;
  speed?: number; // Pixels per second
  pauseOnHover?: boolean;
  pauseDuration?: number; // Pause at each end in ms
}

export const ScrollingText: React.FC<ScrollingTextProps> = ({
  text,
  className = '',
  speed = 50,
  pauseOnHover = false,
  pauseDuration = 1000,
}) => {
  const safeSpeed = Math.max(1, Math.min(speed, 1000));
  const safePauseDuration = Math.max(0, Math.min(pauseDuration, 10000));
  const safeText = text || '';

  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);

  // Measure overflow and set CSS custom properties for animation
  const measure = useCallback(() => {
    const container = containerRef.current;
    const el = textRef.current;
    if (!container || !el) return;

    const containerWidth = container.offsetWidth;
    const textWidth = el.scrollWidth;

    if (containerWidth <= 0 || textWidth <= 0) {
      setShouldScroll(false);
      return;
    }

    const overflow = textWidth - containerWidth;
    const needsScroll = overflow > 5;
    setShouldScroll(needsScroll);

    if (needsScroll) {
      // Scroll distance (negative translateX value)
      el.style.setProperty('--scroll-distance', `-${overflow}px`);
      // Total cycle: scroll-right + pause + scroll-left + pause
      const scrollTime = (overflow / safeSpeed) * 2; // seconds for both directions
      const pauseTime = (safePauseDuration / 1000) * 2; // seconds for both pauses
      const totalDuration = Math.max(scrollTime + pauseTime, 1); // minimum 1s
      el.style.setProperty('--scroll-duration', `${totalDuration.toFixed(2)}s`);
    }
  }, [safeSpeed, safePauseDuration]);

  useEffect(() => {
    measure();

    if (!safeText || safeText.trim().length === 0) {
      setShouldScroll(false);
      return;
    }

    const resizeObserver = new ResizeObserver(measure);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [safeText, measure]);

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden ${className}`}
      style={pauseOnHover && shouldScroll ? { cursor: 'default' } : undefined}
      onMouseEnter={pauseOnHover ? () => textRef.current?.style.setProperty('animation-play-state', 'paused') : undefined}
      onMouseLeave={pauseOnHover ? () => textRef.current?.style.setProperty('animation-play-state', 'running') : undefined}
    >
      <span
        ref={textRef}
        className={`inline-block whitespace-nowrap${shouldScroll ? ' scrolling-text-animated' : ''}`}
      >
        {safeText}
      </span>
    </div>
  );
};
