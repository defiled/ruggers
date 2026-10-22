import { useEffect, useMemo, useState } from 'react';
import type { DefenceMode, LaneId, OpenSide, PlayerPos, PodMode } from '../board/types';
import { LANES } from '../data/scrumSetups';
import { acrossScale, defaultOpenSide, phaseGeometry, phaseLayout } from '../data/phaseFormation';
import { PLAYS, PLAY_DURATION } from '../data/plays';
import { TRACK_LAG, ballAt, buildPlay, defenceAt, positionAt, seamFor } from '../engine/animate';
import { useFeedbackContext } from '../feedback/context';
import { MOBILE_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { usePlayback } from '../hooks/usePlayback';
import { Board, type Route } from './Board';
import { BoardOverlay } from './BoardOverlay';
import { Disclosure, Panel, Segmented, Toggle } from './controls';

export function PlaysTab() {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [playId, setPlayId] = useState(PLAYS[0].id);
  const [variantIdx, setVariantIdx] = useState(0);
  const [lane, setLane] = useState<LaneId>('left15');
  const [openSideOverride, setOpenSideOverride] = useState<OpenSide | null>(null);
  const [podMode, setPodMode] = useState<PodMode>('hidden');
  const [defenceMode, setDefenceMode] = useState<DefenceMode>('static');
  const [showRoutes, setShowRoutes] = useState(true);
  const [showSeam, setShowSeam] = useState(true);
  const playback = usePlayback(PLAY_DURATION);

  const play = PLAYS.find((p) => p.id === playId) ?? PLAYS[0];
  const variant = play.variants[Math.min(variantIdx, play.variants.length - 1)];
  const openSide: OpenSide = openSideOverride ?? defaultOpenSide(lane);
  const dir: 1 | -1 = openSide === 'right' ? 1 : -1;

  const layout = useMemo(
    () => phaseLayout({ lane, row: 'halfway', openSide, podMode, defenceMode }),
    [lane, openSide, podMode, defenceMode],
  );
  const built = useMemo(() => buildPlay(layout, variant, dir, acrossScale(phaseGeometry(lane, 'halfway', openSide))), [layout, variant, dir, lane, openSide]);

  const t = playback.time;
  const attackers: PlayerPos[] = useMemo(
    () =>
      layout.players
        .filter((p) => p.team === 'attack')
        .map((p) => ({ ...p, ...positionAt(built.routes[p.id], t) })),
    [layout, built, t],
  );
  const attackerPoints = useMemo(() => Object.fromEntries(attackers.map((p) => [p.id, { x: p.x, y: p.y }])), [attackers]);
  const ball = useMemo(() => ballAt(built, attackerPoints, t), [built, attackerPoints, t]);
  const lagged: PlayerPos[] = useMemo(
    () =>
      layout.players
        .filter((p) => p.team === 'attack')
        .map((p) => ({ ...p, ...positionAt(built.routes[p.id], Math.max(0, t - TRACK_LAG)) })),
    [layout, built, t],
  );
  const defence = useMemo(() => defenceAt(layout, defenceMode, dir, t, ball.pos, attackers, lagged), [layout, defenceMode, dir, t, ball.pos, attackers, lagged]);
  const seam = useMemo(() => (showSeam ? seamFor(built) : null), [built, showSeam]);

  const routes: Route[] = useMemo(() => {
    if (!showRoutes) return [];
    return Object.entries(built.routes)
      .filter(([id]) => Number(id.split('-')[1]) >= 9)
      .map(([id, frames]) => ({
        id,
        points: frames.map((f) => ({ x: f.x, y: f.y })),
        emphasis: id === `attack-${variant.strike}`,
        color: id === `attack-${variant.strike}` ? '#fde68a' : undefined,
      }));
  }, [built, showRoutes, variant.strike]);

  useFeedbackContext(`Plays · ${play.name} · ${variant.label} · ${lane} ${openSide} · ${podMode} · ${defenceMode} defence`);

  const carrierId = ball.carrier ? `attack-${ball.carrier}` : null;
  const activePass = variant.passes.find((p) => t >= p.t0 && t < p.t1);

  const selectPlay = (id: string) => {
    setPlayId(id);
    setVariantIdx(0);
    playback.restart();
  };

  // Keyboard transport: space play/pause, arrows nudge, Home restart (ignored while typing in a control).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
      if (e.key === ' ') {
        e.preventDefault();
        playback.toggle();
      } else if (e.key === 'ArrowRight') playback.seek(playback.time + 0.2);
      else if (e.key === 'ArrowLeft') playback.seek(playback.time - 0.2);
      else if (e.key === 'Home') playback.restart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playback]);

  const setup = (
    <div className="toolbar">
      {play.variants.length > 1 && (
        <Segmented
          label="Option"
          value={variantIdx}
          onChange={(v) => {
            setVariantIdx(v);
            playback.restart();
          }}
          options={play.variants.map((v, i) => ({ value: i, label: v.label }))}
        />
      )}
      <Segmented
        label="Ruck position"
        value={lane}
        onChange={(v) => {
          setLane(v);
          setOpenSideOverride(null);
          playback.restart();
        }}
        options={LANES.map((l) => ({ value: l.id, label: l.shortLabel, title: l.label }))}
      />
      <Segmented
        label={mobile ? 'Attack toward (left = top)' : 'Attack toward'}
        value={openSide}
        onChange={(v) => {
          setOpenSideOverride(v);
          playback.restart();
        }}
        options={[
          { value: 'left', label: mobile ? '↑ Left' : '← Left' },
          { value: 'right', label: mobile ? '↓ Right' : 'Right →' },
        ]}
      />
      <Segmented
        label="Forwards"
        value={podMode}
        onChange={setPodMode}
        options={[
          { value: 'pods', label: '1-3-3-1' },
          { value: 'tight', label: 'Tight' },
          { value: 'hidden', label: 'Backs only' },
        ]}
      />
      <Segmented
        label="Defence"
        value={defenceMode}
        onChange={(v) => {
          setDefenceMode(v);
          playback.restart();
        }}
        options={[
          { value: 'static', label: 'Straight up' },
          { value: 'drift', label: 'Drift' },
          { value: 'rush', label: 'Rush' },
          { value: 'hold', label: 'Hold' },
        ]}
      />
      <div className="toolbar__toggles">
        <Toggle label="Running lines" checked={showRoutes} onChange={setShowRoutes} />
        <Toggle label="Show seam" checked={showSeam} onChange={setShowSeam} />
      </div>
      <p className="hint hint--inline">Straight up is the Rugby Slate picture: each defender marks his man and comes forward. Drift and Hold slide out once the ball has passed; Rush comes up fast. Backs only takes both sets of forwards off.</p>
    </div>
  );

  return (
    <div className="layout">
      <div className="layout__main">
        <div className="playlist" role="tablist" aria-label="Plays">
          {PLAYS.map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={p.id === playId} className={`chip${p.id === playId ? ' is-active' : ''}`} onClick={() => selectPlay(p.id)}>
              <b>{p.name}</b>
              <small>{p.tag}</small>
            </button>
          ))}
        </div>

        <div className="board-wrap board-wrap--video">
          <Board
            view={layout.boardView}
            players={[...defence, ...attackers]}
            ball={ball.pos}
            ballInFlight={ball.inFlight}
            routes={routes}
            highlightIds={carrierId ? [carrierId] : []}
            ringIds={seam ? seam.ids : []}
            markers={seam ? [{ x: seam.point.x, y: seam.point.y, label: 'SEAM' }] : []}
            showReadouts={!mobile}
            portrait={mobile}
          />
          <BoardOverlay
            playing={playback.playing}
            time={t}
            duration={PLAY_DURATION}
            speed={playback.speed}
            passes={variant.passes}
            onToggle={playback.toggle}
            onSeek={playback.seek}
            onRestart={playback.restart}
            onSpeed={playback.setSpeed}
          />
        </div>

        <ol className="timeline">
          {variant.passes.map((p, i) => {
            const done = t >= p.t1;
            const live = activePass === p;
            return (
              <li key={i} className={`timeline__item${done ? ' is-done' : ''}${live ? ' is-live' : ''}`}>
                <button type="button" onClick={() => playback.seek(p.t0)}>
                  <span className="timeline__t">{p.t1.toFixed(1)}s</span>
                  <span>
                    {p.from} → {p.to}
                  </span>
                </button>
              </li>
            );
          })}
          <li className="timeline__item timeline__item--strike">
            <span className="timeline__t">strike</span>
            <span>{variant.strike}</span>
          </li>
        </ol>

        {mobile ? <Disclosure title="Setup: ruck, direction, forwards, defence" open={false}>{setup}</Disclosure> : setup}
      </div>

      <aside className="layout__side">
        <Panel eyebrow={play.tag} title={play.name}>
          <p className="lead">{play.summary}</p>
          <p className="muted">
            Rugby Slate calls this{' '}
            <a className="link" href={play.reference.url} target="_blank" rel="noreferrer">
              {play.reference.name}
            </a>
            .
          </p>
          <h3>What we are trying to do</h3>
          <p>{play.intent}</p>
          <h3>Sequence &amp; timing</h3>
          <p>{play.sequence}</p>
          <h3>When to call it</h3>
          <p>{play.read}</p>
          <h3>Who we are attacking</h3>
          <p>{play.target}</p>
          <h3>Watch-out</h3>
          <p>{play.risk}</p>
          <h3>If it is read</h3>
          <p>{play.fallback}</p>
          <h3>Theory</h3>
          <p>{play.theory}</p>
          <h3>Versus the Rugby Slate picture</h3>
          <p>{play.slateDiff}</p>
        </Panel>
      </aside>
    </div>
  );
}
