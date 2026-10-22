import { useCallback, useEffect, useRef, useState } from 'react';

export function usePlayback(duration: number) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const last = useRef<number | null>(null);
  const raf = useRef<number>(0);

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
          if (next >= duration) {
            setPlaying(false);
            return duration;
          }
          return next;
        });
      }
      last.current = now;
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, speed, duration]);

  const toggle = useCallback(() => {
    setTime((t) => (t >= duration ? 0 : t));
    setPlaying((p) => !p);
  }, [duration]);

  const restart = useCallback(() => {
    setPlaying(false);
    setTime(0);
  }, []);

  const seek = useCallback((t: number) => {
    setPlaying(false);
    setTime(Math.max(0, Math.min(duration, t)));
  }, [duration]);

  return { time, playing, speed, setSpeed, toggle, restart, seek };
}
