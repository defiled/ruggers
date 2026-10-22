import { useMemo, useRef, useState } from 'react';
import type { DefenceMode, LaneId, Layout, OpenSide, PlayerPos, Point, PodMode, Possession, RowId, SideId } from '../board/types';
import { PX_PER_M_Y, distanceMetres, fmtM } from '../board/constants';
import { LANES, ROWS, scrumLayout, scrumSetupLabel } from '../data/scrumSetups';
import { DEFAULT_LINEOUT_SIZE, LINEOUT_SIZES, SIDES, lineoutLayout, type LineoutSize } from '../data/lineoutSetups';
import { PHASE_LABELS, defaultOpenSide, phaseGeometry, phaseLayout } from '../data/phaseFormation';
import { downloadJson, fromSiteExport, toSiteExport } from '../engine/exportFormat';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useFeedbackContext } from '../feedback/context';
import { MOBILE_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { Board, type OffsideLine, type SpacingLink } from './Board';
import { Disclosure, Panel, Segmented, Toggle } from './controls';

type SetPiece = 'scrum' | 'lineout' | 'phase';

type Edits = Record<string, { players?: Record<string, Point>; ball?: Point }>;

const SCRUM_NOTES: Record<LaneId, string> = {
  left5:
    'Site preset. With only 5 m of blind, 11 tucks inside 10 as an extra first-phase runner and 15 sits deeper off 13. All six backs are on the open side.',
  left15:
    'Site preset. 11 holds the 15 m blind beside 9 as a genuine blind-side threat; 10-12-13 stagger across the open side with 15 behind 12.',
  centre:
    'Site preset. The centres split: 12 plays left of the scrum and 13 right, with 10 straight behind No. 8 and 15 deep in the middle so the attack can go either way off 9.',
  right15: 'Site preset, mirror image of Left 15m: 11 holds the blind on the right, the backline stacks to the left.',
  right5: 'Site preset, mirror image of Left 5m: 11 tucks inside and the whole backline is set to the left.',
};

export function FormationsTab() {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [setPiece, setSetPiece] = useState<SetPiece>('scrum');
  const [row, setRow] = useState<RowId>('halfway');
  const [lane, setLane] = useState<LaneId>('left15');
  const [side, setSide] = useState<SideId>('left');
  const [possession, setPossession] = useState<Possession>('attacking');
  const [size, setSize] = useState<LineoutSize>(DEFAULT_LINEOUT_SIZE);
  const [podMode, setPodMode] = useState<PodMode>('pods');
  const [openSideOverride, setOpenSideOverride] = useState<OpenSide | null>(null);
  const [defenceMode, setDefenceMode] = useState<DefenceMode>('drift');
  const [showOffside, setShowOffside] = useState(true);
  const [showSpacing, setShowSpacing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [edits, setEdits] = useLocalStorage<Edits>('steamrollers.formation-edits.v1', {});
  const fileRef = useRef<HTMLInputElement>(null);

  const openSide: OpenSide = openSideOverride ?? defaultOpenSide(lane);

  const key = useMemo(() => {
    if (setPiece === 'scrum') return `scrum:${row}:${lane}:${possession}`;
    if (setPiece === 'lineout') return `lineout:${row}:${side}:${possession}:${size}`;
    return `phase:${row}:${lane}:${openSide}:${podMode}:${defenceMode}`;
  }, [setPiece, row, lane, side, possession, size, openSide, podMode, defenceMode]);

  const baseLayout: Layout = useMemo(() => {
    if (setPiece === 'scrum') return scrumLayout(row, lane, possession);
    if (setPiece === 'lineout') return lineoutLayout(row, side, possession, size);
    return phaseLayout({ lane, row, openSide, podMode, defenceMode });
  }, [setPiece, row, lane, side, possession, size, openSide, podMode, defenceMode]);

  const layout: Layout = useMemo(() => {
    const e = edits[key];
    if (!e) return baseLayout;
    return {
      ...baseLayout,
      ball: e.ball ?? baseLayout.ball,
      players: baseLayout.players.map((p) => (e.players?.[p.id] ? { ...p, ...e.players[p.id] } : p)),
    };
  }, [baseLayout, edits, key]);

  const hasEdits = Boolean(edits[key]);
  useFeedbackContext(`Formations · ${key}`);

  const movePlayer = (id: string, p: Point) =>
    setEdits((prev) => ({ ...prev, [key]: { ...prev[key], players: { ...(prev[key]?.players ?? {}), [id]: p } } }));
  const moveBall = (p: Point) => setEdits((prev) => ({ ...prev, [key]: { ...prev[key], ball: p } }));
  const resetEdits = () =>
    setEdits((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const offsideLines: OffsideLine[] = useMemo(() => {
    const find = (team: 'attack' | 'defence', n: number) => layout.players.find((p) => p.team === team && p.number === n);
    if (setPiece === 'scrum') {
      const a8 = find('attack', 8);
      const d8 = find('defence', 8);
      return [
        a8 ? { team: 'attack' as const, y: a8.y + 5 * PX_PER_M_Y, label: 'Backs offside (5 m behind hindmost foot)' } : null,
        d8 ? { team: 'defence' as const, y: d8.y - 5 * PX_PER_M_Y, label: 'Defence backs offside (5 m)' } : null,
      ].filter(Boolean) as OffsideLine[];
    }
    if (setPiece === 'lineout') {
      return [
        { team: 'attack', y: layout.ball.y + 10 * PX_PER_M_Y, label: 'Backs offside (10 m from line of touch)' },
        { team: 'defence', y: layout.ball.y - 10 * PX_PER_M_Y, label: 'Defence backs offside (10 m)' },
      ];
    }
    return [
      { team: 'attack', y: layout.ball.y + 1.5 * PX_PER_M_Y, label: 'Attack offside (hindmost foot)' },
      { team: 'defence', y: layout.ball.y - 1.5 * PX_PER_M_Y, label: 'Defence offside (hindmost foot)' },
    ];
  }, [layout, setPiece]);

  const spacing: SpacingLink[] = useMemo(() => {
    if (!showSpacing) return [];
    const backs = layout.players
      .filter((p) => p.team === 'attack' && [10, 12, 13, 14, 11].includes(p.number))
      .sort((a, b) => a.x - b.x);
    const links: SpacingLink[] = [];
    for (let i = 0; i < backs.length - 1; i++) {
      links.push({ a: backs[i], b: backs[i + 1], label: fmtM(distanceMetres(backs[i], backs[i + 1])) });
    }
    const ten = backs.find((p) => p.number === 10);
    const fifteen = layout.players.find((p) => p.team === 'attack' && p.number === 15);
    if (ten) links.push({ a: layout.ball, b: ten, label: fmtM(distanceMetres(layout.ball, ten)) });
    if (fifteen) links.push({ a: layout.ball, b: fifteen, label: fmtM(distanceMetres(layout.ball, fifteen)) });
    return links;
  }, [layout, showSpacing]);

  const exportJson = () => {
    const name =
      setPiece === 'scrum'
        ? `Scrum ${scrumSetupLabel(row, lane)} (${possession})`
        : setPiece === 'lineout'
          ? `Lineout ${row} ${side} ${size}-man (${possession})`
          : `Phase ${lane} ${PHASE_LABELS[podMode]}`;
    downloadJson(`${key.replace(/[:]/g, '-')}.json`, toSiteExport(name, 'Exported from Steamrollers Playbook', [layout]));
  };

  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = fromSiteExport(JSON.parse(String(reader.result)));
        if (!parsed) return alert('That file does not look like a Rugby Tactics Board export.');
        const players: Record<string, Point> = {};
        for (const p of parsed.players) players[p.id] = { x: p.x, y: p.y };
        setEdits((prev) => ({ ...prev, [key]: { players, ball: parsed.ball } }));
        setEditMode(true);
      } catch {
        alert('Could not read that file.');
      }
    };
    reader.readAsText(file);
  };

  const geometry = setPiece === 'phase' ? phaseGeometry(lane, row, openSide) : null;
  const attackCount = layout.players.filter((p) => p.team === 'attack').length;
  const defenceCount = layout.players.filter((p) => p.team === 'defence').length;
  const sortedForTable = [...layout.players].sort((a, b) => (a.team !== b.team ? (a.team === 'attack' ? -1 : 1) : a.number - b.number));

  const primaryControls = (
    <div className="toolbar">
      <Segmented
        label="Set piece"
        value={setPiece}
        onChange={(v) => {
          setSetPiece(v);
          setEditMode(false);
        }}
        options={[
          { value: 'scrum', label: 'Scrum' },
          { value: 'lineout', label: 'Lineout' },
          { value: 'phase', label: 'Phase · 1-3-3-1' },
        ]}
      />
      {setPiece !== 'lineout' ? (
        <Segmented
          label="Lane"
          value={lane}
          onChange={(v) => {
            setLane(v);
            setOpenSideOverride(null);
          }}
          options={LANES.map((l) => ({ value: l.id, label: l.shortLabel, title: l.label }))}
        />
      ) : (
        <Segmented label="Throw from" value={side} onChange={setSide} options={SIDES.map((s) => ({ value: s.id, label: s.shortLabel === 'L' ? 'Left' : 'Right', title: s.label }))} />
      )}
      {setPiece !== 'phase' && (
        <Segmented
          label="Possession"
          value={possession}
          onChange={setPossession}
          options={[
            { value: 'attacking', label: 'Our ball' },
            { value: 'defending', label: 'Their ball' },
          ]}
        />
      )}
      <Segmented label="Field position" value={row} onChange={setRow} compact options={ROWS.map((r) => ({ value: r.id, label: r.label }))} />
    </div>
  );

  const secondaryControls = (
    <div className="toolbar">
      {setPiece === 'lineout' && (
        <Segmented label="Lineout size" value={size} onChange={setSize} options={LINEOUT_SIZES.map((n) => ({ value: n, label: String(n) }))} />
      )}
      {setPiece === 'phase' && (
        <>
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
            label={mobile ? 'Open side (left = top)' : 'Open side'}
            value={openSide}
            onChange={setOpenSideOverride}
            options={[
              { value: 'left', label: mobile ? '↑ Left' : '← Left' },
              { value: 'right', label: mobile ? '↓ Right' : 'Right →' },
            ]}
          />
          <Segmented
            label="Defence"
            value={defenceMode}
            onChange={setDefenceMode}
            options={[
              { value: 'drift', label: 'Drift' },
              { value: 'rush', label: 'Rush' },
              { value: 'hold', label: 'Hold' },
            ]}
          />
        </>
      )}
      <div className="toolbar__toggles">
        <Toggle label="Offside lines" checked={showOffside} onChange={setShowOffside} />
        <Toggle label="Spacing" checked={showSpacing} onChange={setShowSpacing} />
        <Toggle label="Edit positions (drag)" checked={editMode} onChange={setEditMode} />
      </div>
      <div className="toolbar__actions">
        {hasEdits && (
          <button type="button" className="btn btn--ghost" onClick={resetEdits}>
            Reset to default
          </button>
        )}
        <button type="button" className="btn btn--ghost" onClick={() => fileRef.current?.click()}>
          Import JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importJson(f);
            e.target.value = '';
          }}
        />
        <button type="button" className="btn" onClick={exportJson}>
          Export JSON
        </button>
      </div>
    </div>
  );

  return (
    <div className="layout">
      <div className="layout__main">
        {primaryControls}

        <div className="board-wrap">
          <Board
            view={layout.boardView}
            players={layout.players}
            ball={layout.ball}
            offsideLines={showOffside ? offsideLines : []}
            spacing={spacing}
            editable={editMode}
            onMove={movePlayer}
            onMoveBall={moveBall}
            showReadouts={!mobile}
            portrait={mobile}
          />
        </div>

        {mobile ? <Disclosure title="More: overlays, edit, export" open={false}>{secondaryControls}</Disclosure> : secondaryControls}
        <p className="hint">
          {mobile ? 'Turn on edit mode to drag players.' : 'Hover a player for metre readouts.'} Exports use the Rugby Tactics Board file format, so they open on rugbytacticsboard.com.{' '}
          {hasEdits && 'This formation has team edits saved in this browser.'}
        </p>
      </div>

      <aside className="layout__side">
        <Panel eyebrow={setPiece === 'scrum' ? 'Scrum' : setPiece === 'lineout' ? 'Lineout' : 'Phase play'} title={titleFor(setPiece, row, lane, side, possession, size, podMode)}>
          <p className="muted">
            {attackCount} attackers · {defenceCount} defenders · {mobile ? 'attack plays left to right' : 'attack plays up the board'}
          </p>
          {setPiece === 'scrum' && <p>{SCRUM_NOTES[lane]}</p>}
          {setPiece === 'scrum' && possession === 'defending' && (
            <p>
              Their feed. Our 9 stands off the opposition 9, backs hold 5 m behind the hindmost foot and 10 lines up on their 10. Watch 11 and 15: they are the pendulum behind the line.
            </p>
          )}
          {setPiece === 'lineout' && (
            <p>
              Site generator: 2 throws, {size} in the line 35 px apart from 90 px in, spare forwards 10 m back, 9 at receiver. Backs 10 m back from the line of touch, 15 deepest. On their throw our line stands 10 m back and the backs mark up man-for-man.
            </p>
          )}
          {setPiece === 'phase' && geometry && (
            <>
              <p>
                <strong>{PHASE_LABELS[podMode]}.</strong> Ruck on the {LANES.find((l) => l.id === lane)?.label.toLowerCase()} line, playing {openSide}. Open side{' '}
                {fmtM(geometry.openWidth)}, blind {fmtM(geometry.blindWidth)}.
                {geometry.narrowBlind
                  ? ' Blind is too narrow to threaten, so 11 tucks inside 10 and the defence folds everyone bar one guard to the open side.'
                  : ' 11 holds the blind so the defence has to keep two there.'}
              </p>
              {podMode === 'pods' && (
                <ul className="list">
                  <li>
                    <strong>1 edge</strong> — 6 on the short side, a carry option off 9.
                  </li>
                  <li>
                    <strong>3 pod A</strong> — 1, 2, 4 one pass off 9. Lock 4 leads, props latch. 10 plays behind it.
                  </li>
                  <li>
                    <strong>3 pod B</strong> — 3, 5, 7 in the next 15 m channel. 12 plays behind it.
                  </li>
                  <li>
                    <strong>1 edge</strong> — 8 linking 13 and 14 on the far edge.
                  </li>
                  <li>
                    <strong>15</strong> swings as the second-wave playmaker behind 12/13.
                  </li>
                </ul>
              )}
              {podMode === 'tight' && (
                <p>Forwards stay compact: two over the ball, two guards, four as a cluster off 9. Use this for a reset carry or a pick-and-go sequence before launching the backs.</p>
              )}
              <p>
                <strong>Defence ({defenceMode}).</strong> Guards either side of the ruck, 13 in the front line spread to 3 m from touch, 15 deep, 9 sweeping.{' '}
                {defenceMode === 'rush'
                  ? 'Rush: starts on the offside line and comes hard, little drift. Beat it behind the first line or with the short ball.'
                  : defenceMode === 'hold'
                    ? 'Hold: starts a metre deeper and soaks. Carriers should expect to be met on the gain line; look for the kick or the late pass.'
                    : 'Drift: connected and sliding toward touch. Attack the inside shoulders or come back against the grain.'}
              </p>
            </>
          )}
        </Panel>

        <Disclosure title="Coordinates" open={!mobile}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Team</th>
                  <th>From left touch</th>
                  <th>To ball</th>
                </tr>
              </thead>
              <tbody>
                {sortedForTable.map((p: PlayerPos) => (
                  <tr key={p.id} className={p.team}>
                    <td>{p.number}</td>
                    <td>{p.team === 'attack' ? 'Us' : 'Them'}</td>
                    <td>{fmtM((p.x - 10) / (1080 / 70))}</td>
                    <td>{fmtM(distanceMetres(p, layout.ball))}</td>
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

function titleFor(setPiece: SetPiece, row: RowId, lane: LaneId, side: SideId, possession: Possession, size: number, podMode: PodMode) {
  const rowLabel = ROWS.find((r) => r.id === row)?.label ?? row;
  if (setPiece === 'scrum') return `${rowLabel}, ${LANES.find((l) => l.id === lane)?.label} · ${possession === 'attacking' ? 'our feed' : 'their feed'}`;
  if (setPiece === 'lineout') return `${rowLabel}, ${side} touch · ${size}-man · ${possession === 'attacking' ? 'our throw' : 'their throw'}`;
  return `${rowLabel}, ${LANES.find((l) => l.id === lane)?.label} · ${PHASE_LABELS[podMode]}`;
}
