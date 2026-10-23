import { useMemo, useState } from 'react';
import type { LaneId, OpenSide, PlayerPos } from '../board/types';
import { fmtM } from '../board/constants';
import { ALIGNMENT_LABEL, DEFENCE_SYSTEMS, PITCH_SECTIONS, READ_THE_ATTACK, type Alignment, type DefenceSystemId } from '../data/defenceSystems';
import { defaultOpenSide } from '../data/phaseFormation';
import { LANES } from '../data/scrumSetups';
import { ballAt, positionAt, type BallState } from '../engine/animate';
import { DEF_DURATION, buildScenario, defendersAt, gainLineMetres } from '../engine/defenceSim';
import { useFeedbackContext } from '../feedback/context';
import { useBoardOrientation } from '../hooks/useBoardOrientation';
import { usePlayback } from '../hooks/usePlayback';
import { Board, type OffsideLine } from './Board';
import { BoardOverlay } from './BoardOverlay';
import { Disclosure, OrientationToggle, Panel, Segmented } from './controls';

export function DefenceTab() {
  const { mobile, portrait, orientation, setOrientation } = useBoardOrientation();
  const [systemId, setSystemId] = useState<DefenceSystemId>(DEFENCE_SYSTEMS[0].id);
  const [alignment, setAlignment] = useState<Alignment>('deep');
  const [lane, setLane] = useState<LaneId>('left15');
  const [openSideOverride, setOpenSideOverride] = useState<OpenSide | null>(null);
  const playback = usePlayback(DEF_DURATION);

  const system = DEFENCE_SYSTEMS.find((s) => s.id === systemId) ?? DEFENCE_SYSTEMS[0];
  // On a 5 m lane there is only one side with room for a backline, so the direction is fixed.
  const edgeLane = lane === 'left5' || lane === 'right5';
  const openSide: OpenSide = (edgeLane ? null : openSideOverride) ?? defaultOpenSide(lane);

  const scenario = useMemo(() => buildScenario(systemId, lane, openSide, alignment), [systemId, lane, openSide, alignment]);
  const t = playback.time;

  const attackers: PlayerPos[] = useMemo(
    () =>
      scenario.layout.players
        .filter((p) => p.team === 'attack')
        .map((p) => ({ ...p, ...positionAt(scenario.built.routes[p.id], t) })),
    [scenario, t],
  );
  const attackerPoints = useMemo(() => Object.fromEntries(attackers.map((p) => [p.id, { x: p.x, y: p.y }])), [attackers]);
  const ball: BallState = useMemo(
    () => (scenario.ballPath ? { pos: positionAt(scenario.ballPath, t), carrier: null, inFlight: false } : ballAt(scenario.built, attackerPoints, t)),
    [scenario, attackerPoints, t],
  );
  const frame = useMemo(() => defendersAt(scenario, t, ball.pos, attackers, ball.carrier), [scenario, t, ball, attackers]);

  const ballOnly = !!scenario.ballPath; // pendulum: no carriers, so no carrier or gain-line readout
  const carrier = ball.carrier ? attackers.find((a) => a.number === ball.carrier) : null;
  const gain = carrier ? gainLineMetres(scenario, carrier) : null;
  const caption = [...system.captions].reverse().find((c) => t >= c.t) ?? system.captions[0];
  const carrierId = ball.carrier ? `attack-${ball.carrier}` : null;

  const guides: OffsideLine[] = ballOnly
    ? [{ team: 'defence', y: scenario.defensiveLineY, label: 'DEFENSIVE LINE' }]
    : [{ team: 'neutral', y: scenario.layout.ball.y, label: 'GAIN LINE' }];

  useFeedbackContext(`Defence · ${system.name} · ${ALIGNMENT_LABEL[alignment]} · ${lane} ${openSide}`);

  const select = (id: DefenceSystemId) => {
    setSystemId(id);
    playback.restart();
  };

  const setup = (
    <div className="toolbar">
      {!ballOnly && (
        <Segmented
          label="Attack alignment"
          value={alignment}
          onChange={(v) => {
            setAlignment(v);
            playback.restart();
          }}
          options={[
            { value: 'deep', label: 'Deep' },
            { value: 'standard', label: 'Standard' },
            { value: 'flat', label: 'Flat' },
          ]}
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
      {!edgeLane && (
        <Segmented
          label={portrait ? 'They attack toward (left = top)' : 'They attack toward'}
          value={openSide}
          onChange={(v) => {
            setOpenSideOverride(v);
            playback.restart();
          }}
          options={[
            { value: 'left', label: portrait ? '↑ Left' : '← Left' },
            { value: 'right', label: portrait ? '↓ Right' : 'Right →' },
          ]}
        />
      )}
    </div>
  );

  return (
    <div className="layout">
      <div className="layout__main">
        <div className="playlist playlist--5" role="tablist" aria-label="Defensive systems">
          {DEFENCE_SYSTEMS.map((s) => (
            <button key={s.id} type="button" role="tab" aria-selected={s.id === systemId} className={`chip${s.id === systemId ? ' is-active' : ''}`} onClick={() => select(s.id)}>
              <span className="chip__name">{s.name}</span>
              <span className="chip__tag">{s.tag}</span>
            </button>
          ))}
        </div>

        {mobile && <OrientationToggle value={orientation} onChange={setOrientation} />}
        <div className="board-wrap board-wrap--video">
          <Board
            view={scenario.layout.boardView}
            players={[...frame.players, ...attackers]}
            ball={ball.pos}
            ballInFlight={ball.inFlight}
            offsideLines={guides}
            highlightIds={carrierId ? [carrierId] : []}
            ringIds={frame.rings}
            badges={frame.badges}
            showReadouts={!mobile}
            portrait={portrait}
          />
          <BoardOverlay
            playing={playback.playing}
            time={t}
            duration={DEF_DURATION}
            speed={playback.speed}
            passes={scenario.built.variant.passes}
            onToggle={playback.toggle}
            onSeek={playback.seek}
            onRestart={playback.restart}
            onSpeed={playback.setSpeed}
          />
        </div>

        <div className="caption">
          <p className="caption__text">{caption.text}</p>
          {!ballOnly && (
            <div className="caption__stats">
              <span className="stat">
                <span className="stat__label">Carrier</span>
                <span className="stat__value">{carrier ? `#${carrier.number}` : ball.inFlight ? 'ball in air' : '—'}</span>
              </span>
              <span className="stat">
                <span className="stat__label">Gain line</span>
                <span className={`stat__value${gain != null && gain < 0 ? ' is-bad' : ''}`}>
                  {gain == null ? '—' : gain >= 0 ? `${fmtM(gain)} behind` : `${fmtM(-gain)} over`}
                </span>
              </span>
              <span className="stat">
                <span className="stat__label">Attack</span>
                <span className="stat__value">{ALIGNMENT_LABEL[alignment]}</span>
              </span>
            </div>
          )}
        </div>

        {mobile ? <Disclosure title={ballOnly ? 'Setup: ruck, direction' : 'Setup: attack depth, ruck, direction'} open={false}>{setup}</Disclosure> : setup}
      </div>

      <aside className="layout__side">
        <Panel eyebrow={system.tag} title={system.name}>
          <p className="lead">{system.summary}</p>
          <h3>How it works</h3>
          <ol className="list">
            {system.how.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <h3>Trigger</h3>
          <p>{system.trigger}</p>
          <h3>When we use it</h3>
          <ul className="list">
            {system.when.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <h3>Why it works</h3>
          <p>{system.why}</p>
          {system.strengths.length > 0 && (
            <>
              <h3>Strengths</h3>
              <ul className="list">
                {system.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </>
          )}
          <h3>Weaknesses</h3>
          <ul className="list">
            {system.weaknesses.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <h3>How an attack beats it</h3>
          <ul className="list">
            {system.beats.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <h3>Common errors</h3>
          <ul className="list">
            {system.errors.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <h3>Coaching points</h3>
          <ul className="list">
            {system.coaching.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <p className="muted">
            Reference:{' '}
            <a className="link" href={system.source} target="_blank" rel="noreferrer">
              Rugby Slate
            </a>
          </p>
        </Panel>

        <Disclosure title="Read the attack: which call, and why" open={!mobile}>
          <p className="muted">The call comes from the outside in: the wingers and 13 can see the numbers. Make it before 9 picks the ball up.</p>
          <div className="table-wrap">
            <table className="table table--wrap">
              <thead>
                <tr>
                  <th>We see</th>
                  <th>Call</th>
                  <th>Because</th>
                </tr>
              </thead>
              <tbody>
                {READ_THE_ATTACK.map((r, i) => (
                  <tr key={i}>
                    <td>{r.see}</td>
                    <td>
                      <strong>{r.call}</strong>
                    </td>
                    <td>{r.because}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Disclosure>

        <Disclosure title="Where on the pitch" open={false}>
          <div className="table-wrap">
            <table className="table table--wrap">
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Posture</th>
                  <th>Why</th>
                </tr>
              </thead>
              <tbody>
                {PITCH_SECTIONS.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <strong>{r.where}</strong>
                    </td>
                    <td>{r.posture}</td>
                    <td>{r.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Disclosure>
      </aside>
    </div>
  );
}
