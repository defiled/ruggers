import { useEffect, useState, type CSSProperties } from 'react';
import type { PassEvent } from '../data/plays';
import { IconPause, IconPlay, IconRestart } from './icons';

interface Props {
  playing: boolean;
  time: number;
  duration: number;
  speed: number;
  passes: PassEvent[];
  onToggle: () => void;
  onSeek: (t: number) => void;
  onRestart: () => void;
  onSpeed: (s: number) => void;
}

const SPEEDS = [0.5, 1, 1.5];

/** Video-style controls laid over the board: tap to play/pause, scrub bar with pass markers. */
export function BoardOverlay({ playing, time, duration, speed, passes, onToggle, onSeek, onRestart, onSpeed }: Props) {
  const [flash, setFlash] = useState(false);
  const ended = time >= duration;

  useEffect(() => {
    if (!playing) return;
    setFlash(true);
    const id = setTimeout(() => setFlash(false), 500);
    return () => clearTimeout(id);
  }, [playing]);

  const glyph = (size: number) => (playing ? <IconPause size={size} /> : ended ? <IconRestart size={size} /> : <IconPlay size={size} />);

  return (
    <div className={`overlay${playing ? ' is-playing' : ''}`}>
      <button type="button" className="overlay__tap" onClick={onToggle} aria-label={playing ? 'Pause' : 'Play'} />
      <div className={`overlay__big${(playing && !flash) || (!playing && time > 0 && !ended) ? ' is-hidden' : ''}`} aria-hidden="true">
        {glyph(28)}
      </div>
      <div className="overlay__bar" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="overlay__btn" onClick={onToggle} aria-label={playing ? 'Pause' : 'Play'}>
          {glyph(16)}
        </button>
        <div className="overlay__track">
          <input
            className="overlay__scrub"
            type="range"
            min={0}
            max={duration * 100}
            value={Math.round(time * 100)}
            onChange={(e) => onSeek(Number(e.target.value) / 100)}
            aria-label="Scrub"
            style={{ '--progress': `${(Math.min(time, duration) / duration) * 100}%` } as CSSProperties}
          />
          <div className="overlay__ticks" aria-hidden="true">
            {passes.map((p, i) => (
              <button
                key={i}
                type="button"
                className={`overlay__tick${time >= p.t1 ? ' is-done' : ''}`}
                style={{ left: `${(p.t1 / duration) * 100}%` }}
                onClick={() => onSeek(p.t0)}
                title={`${p.from} → ${p.to} at ${p.t1.toFixed(1)}s`}
                tabIndex={-1}
              />
            ))}
          </div>
        </div>
        <span className="overlay__time">
          {time.toFixed(1)}
          <span className="overlay__dim">/{duration.toFixed(0)}s</span>
        </span>
        <button
          type="button"
          className="overlay__btn overlay__btn--text"
          onClick={() => onSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
          aria-label="Playback speed"
        >
          {speed === 0.5 ? '½×' : `${speed}×`}
        </button>
        <button type="button" className="overlay__btn overlay__btn--text" onClick={onRestart} aria-label="Restart">
          <IconRestart size={15} />
        </button>
      </div>
    </div>
  );
}
