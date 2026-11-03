import { useEffect, useRef, useState } from 'react';
import { SEVERN, clipPoster, clipSrc, tapeLabel, tapeLink, type Clip, type Match } from '../data/severnClips';
import { useFeedbackContext } from '../feedback/context';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { ClipComments } from './ClipComments';

export function AnalysisTab() {
  const match = SEVERN;
  useFeedbackContext(`Analysis · ${match.opponent}`);

  return (
    <div className="analysis">
      <header className="analysis__head">
        <span className="eyebrow">Analysis</span>
        <h2 className="analysis__title">{match.opponent}</h2>
        <p className="analysis__meta">
          {match.date} · {match.clips.length} clips ·{' '}
          <a className="link" href={match.tapeUrl} target="_blank" rel="noreferrer">
            Watch the full tape
          </a>
        </p>
      </header>

      <ol className="cliplist">
        {match.clips.map((clip) => (
          <li key={clip.id}>
            <ClipCard match={match} clip={clip} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function ClipCard({ match, clip }: { match: Match; clip: Clip }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const stillness = useMediaQuery('(prefers-reduced-motion: reduce)');

  // 21 videos decoding at once would flatten a phone, so only what is on screen plays.
  // Under reduced motion nothing autoplays; the poster and the controls are enough.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setNear(entry.isIntersecting);
        if (!entry.isIntersecting) el.pause();
        else if (!stillness) void el.play().catch(() => {});
      },
      { rootMargin: '150px 0px', threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [stillness]);

  return (
    <article className="clip">
      <h3 className="clip__title">{clip.title}</h3>
      <div className="clip__frame">
        <video
          ref={ref}
          className="clip__video"
          src={clipSrc(match.id, clip.id)}
          poster={clipPoster(match.id, clip.id)}
          // preload stays "none" until the clip is near the viewport, so opening the
          // tab does not kick off 21 downloads at once.
          preload={near ? 'metadata' : 'none'}
          loop
          muted
          playsInline
          controls
        />
      </div>
      <div className="clip__foot">
        {clip.tapeOffset == null ? (
          <span className="clip__stamp clip__stamp--unknown">Timestamp unknown</span>
        ) : (
          <a className="clip__stamp" href={tapeLink(match, clip.tapeOffset)} target="_blank" rel="noreferrer">
            {tapeLabel(clip.tapeOffset)} in the full tape
          </a>
        )}
        <span className="clip__dur">{Math.round(clip.duration)}s</span>
      </div>
      <ClipComments clipId={clip.id} />
    </article>
  );
}
