import { useCallback, useEffect, useRef, useState } from 'react';

export interface PlaybackOptions {
  /** Wrap back to the start when the clip ends instead of stopping. */
  loop?: boolean;
  /** Play again after every restart (the pendulum, which runs on its own). */
  autoplay?: boolean;
}

export function usePlayback(duration: number, { loop = false, autoplay = false }: PlaybackOptions = {}) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const last = useRef<number | null>(null);
  const raf = useRef<number>(0);
  const auto = useRef(autoplay);
  useEffect(() => {
    auto.current = autoplay;
  }, [autoplay]);

  useEffect(() => {
    if (!playing) {
      last.current = null;
      return;
    }
    const tick = (now: number) => {
      if (last.current != null) {
        const dt = Math.min((now - last.current) / 1000, 0.1) * speed;
        setTime((t) => {
          const next = t + dt;
          if (next < duration) return next;
          if (loop) return next % duration;
          setPlaying(false);
          return duration;
        });
      }
      last.current = now;
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, speed, duration, loop]);

  const toggle = useCallback(() => {
    setTime((t) => (t >= duration ? 0 : t));
    setPlaying((p) => !p);
  }, [duration]);

  /** Back to the start. Plays on if `autoplay` is set, or if `play` says so for the clip being switched to. */
  const restart = useCallback((play?: boolean) => {
    setPlaying(play ?? auto.current);
    setTime(0);
  }, []);

  const seek = useCallback((t: number) => {
    setPlaying(false);
    setTime(Math.max(0, Math.min(duration, t)));
  }, [duration]);

  return { time, playing, speed, setSpeed, toggle, restart, seek };
}
