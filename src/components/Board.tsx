import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { BoardView, PlayerPos, Point } from '../board/types';
import { BALL_R, BOARD_H, BOARD_W, PLAYER_R, TEAM_STYLE, clampPlayer, distanceMetres, fmtM, metresFromHalfway, metresFromLeftTouch } from '../board/constants';
import { Pitch } from './Pitch';

export interface OffsideLine {
  y: number;
  label: string;
  team: 'attack' | 'defence' | 'neutral';
}

export interface Route {
  id: string;
  points: Point[];
  color?: string;
  emphasis?: boolean;
}

export interface SpacingLink {
  a: Point;
  b: Point;
  label: string;
}

export interface Marker {
  x: number;
  y: number;
  label: string;
}

interface Props {
  view: BoardView;
  players: PlayerPos[];
  ball: Point;
  ballInFlight?: boolean;
  routes?: Route[];
  offsideLines?: OffsideLine[];
  spacing?: SpacingLink[];
  /** Points of interest drawn as a dashed gold ring with a label (e.g. the seam a play attacks). */
  markers?: Marker[];
  highlightIds?: string[];
  ringIds?: string[];
  /** Small badge next to a token, keyed by player id (e.g. a role such as "SWEEP"). */
  badges?: Record<string, string>;
  editable?: boolean;
  onMove?: (id: string, p: Point) => void;
  onMoveBall?: (p: Point) => void;
  showReadouts?: boolean;
  /** Rotate the board 90° so the pitch width fills a portrait phone; attack then runs left → right. */
  portrait?: boolean;
}

/** Portrait: board (x, y) → screen (700 − y, x). */
const PORTRAIT_TRANSFORM = 'rotate(90) translate(0 -700)';

export function Board({
  view,
  players,
  ball,
  ballInFlight,
  routes = [],
  offsideLines = [],
  spacing = [],
  markers = [],
  highlightIds = [],
  ringIds = [],
  badges = {},
  editable = false,
  onMove,
  onMoveBall,
  showReadouts = false,
  portrait = false,
}: Props) {
  const innerRef = useRef<SVGGElement>(null);
  const [drag, setDrag] = useState<{ id: string; isBall: boolean } | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  // Convert with the inner group's CTM so dragging works identically in both orientations.
  const toBoard = useCallback((e: { clientX: number; clientY: number }): Point => {
    const g = innerRef.current;
    const svg = g?.ownerSVGElement;
    if (!g || !svg) return { x: 0, y: 0 };
    const ctm = g.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const r = pt.matrixTransform(ctm.inverse());
    return { x: r.x, y: r.y };
  }, []);

  const onPointerDown = (id: string, isBall: boolean) => (e: ReactPointerEvent<SVGGElement>) => {
    if (!editable) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ id, isBall });
  };
  const onPointerMove = (e: ReactPointerEvent<SVGGElement>) => {
    if (!drag) return;
    const p = clampPlayer(toBoard(e));
    if (drag.isBall) onMoveBall?.(p);
    else onMove?.(drag.id, { x: Math.round(p.x), y: Math.round(p.y) });
  };
  const onPointerUp = () => setDrag(null);

  const hovered = players.find((p) => p.id === hover);
  const upright = portrait ? 'rotate(-90)' : undefined;
  const tokenR = portrait ? PLAYER_R + 2 : PLAYER_R;
  const fontSize = portrait ? 13 : 12;

  return (
    <svg
      className={`board${editable ? ' board--editable' : ''}${portrait ? ' board--portrait' : ''}`}
      viewBox={portrait ? `0 0 ${BOARD_H} ${BOARD_W}` : `0 0 ${BOARD_W} ${BOARD_H}`}
      role="img"
      aria-label="Rugby tactics board"
    >
      <g ref={innerRef} transform={portrait ? PORTRAIT_TRANSFORM : undefined}>
        <Pitch view={view} portrait={portrait} />

        {offsideLines.map((l) => {
          const lx = portrait ? 1062 : 1062;
          const ly = l.y + (l.team === 'attack' ? 15 : -6);
          return (
            <g key={`${l.team}-${l.label}`} pointerEvents="none">
              <line
                x1={10}
                y1={l.y}
                x2={1090}
                y2={l.y}
                stroke={l.team === 'attack' ? TEAM_STYLE.attack.fill : l.team === 'defence' ? '#fda4af' : '#fde68a'}
                strokeWidth={2}
                strokeDasharray="8 6"
                opacity={0.85}
              />
              <text
                x={lx}
                y={ly}
                transform={portrait ? `rotate(-90 ${lx} ${ly})` : undefined}
                fill={l.team === 'attack' ? '#bbf7d0' : l.team === 'defence' ? '#fecdd3' : '#fde68a'}
                fontSize={11}
                fontWeight={600}
                textAnchor={portrait ? 'start' : 'end'}
              >
                {l.label}
              </text>
            </g>
          );
        })}

        {spacing.map((s, i) => {
          const mx = (s.a.x + s.b.x) / 2;
          const my = (s.a.y + s.b.y) / 2;
          return (
            <g key={i} pointerEvents="none">
              <line x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} stroke="#fde68a" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.9} />
              <g transform={`translate(${mx} ${my}) ${upright ?? ''}`}>
                <rect x={-17} y={-9} width={34} height={16} rx={4} fill="rgba(0,0,0,0.55)" />
                <text y={3} fill="#fde68a" fontSize={11} fontWeight={600} textAnchor="middle">
                  {s.label}
                </text>
              </g>
            </g>
          );
        })}

        {markers.map((mk, i) => (
          <g key={`mk${i}`} transform={`translate(${mk.x} ${mk.y})`} pointerEvents="none">
            <circle r={tokenR + 4} fill="rgba(253,230,138,0.18)" stroke="#fde68a" strokeWidth={2} strokeDasharray="4 4" />
            <g transform={upright}>
              <rect x={-(mk.label.length * 5.2 + 8) / 2} y={tokenR + 7} width={mk.label.length * 5.2 + 8} height={14} rx={7} fill="#fde68a" />
              <text y={tokenR + 17} textAnchor="middle" fontSize={8.5} fontWeight={600} fill="#1f2937" letterSpacing={0.4}>
                {mk.label}
              </text>
            </g>
          </g>
        ))}

        {routes.map((r) => (
          <polyline
            key={r.id}
            points={r.points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={r.color ?? 'rgba(255,255,255,0.75)'}
            strokeWidth={r.emphasis ? 3.5 : 2}
            strokeDasharray={r.emphasis ? '10 6' : '6 7'}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={r.emphasis ? 0.95 : 0.6}
            pointerEvents="none"
          />
        ))}

        {players.map((p) => {
          const style = TEAM_STYLE[p.team];
          const hi = highlightIds.includes(p.id);
          const ring = ringIds.includes(p.id);
          const badge = badges[p.id];
          return (
            <g
              key={p.id}
              transform={`translate(${p.x} ${p.y})`}
              className="token"
              onPointerDown={onPointerDown(p.id, false)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerEnter={() => setHover(p.id)}
              onPointerLeave={() => setHover((h) => (h === p.id ? null : h))}
              style={{ cursor: editable ? 'grab' : 'default' }}
            >
              {ring && <circle r={tokenR + 7} fill="none" stroke="#fde68a" strokeWidth={3} strokeDasharray="5 4" />}
              {hi && <circle r={tokenR + 5} fill="rgba(253,230,138,0.4)" />}
              <circle r={tokenR} fill={style.fill} stroke={style.stroke} strokeWidth={2} />
              <g transform={upright}>
                <text y={4} textAnchor="middle" fontSize={fontSize} fontWeight={700} fill={style.text}>
                  {p.number}
                </text>
                {badge && (
                  <g transform={`translate(0 ${tokenR + 11})`}>
                    <rect x={-(badge.length * 5.2 + 6) / 2} y={-8} width={badge.length * 5.2 + 6} height={14} rx={7} fill="#fde68a" stroke="#1f2937" strokeWidth={1} />
                    <text y={3} textAnchor="middle" fontSize={8.5} fontWeight={600} fill="#1f2937" letterSpacing={0.4}>
                      {badge}
                    </text>
                  </g>
                )}
              </g>
            </g>
          );
        })}

        <g
          transform={`translate(${ball.x} ${ball.y})`}
          onPointerDown={onPointerDown('ball', true)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{ cursor: editable ? 'grab' : 'default' }}
        >
          <ellipse rx={BALL_R + (ballInFlight ? 2 : 0)} ry={BALL_R - 1 + (ballInFlight ? 1 : 0)} fill="#fbbf24" stroke="#78350f" strokeWidth={1.5} transform="rotate(-25)" />
        </g>

        {showReadouts && hovered && (
          <g
            pointerEvents="none"
            transform={
              portrait
                ? `translate(${Math.min(Math.max(hovered.x, 40), BOARD_W - 44)} ${Math.min(hovered.y + 18, BOARD_H - 200)}) rotate(-90)`
                : `translate(${Math.min(hovered.x + 18, BOARD_W - 190)} ${Math.max(hovered.y - 44, 6)})`
            }
          >
            <rect width={184} height={38} rx={6} fill="rgba(2,6,23,0.88)" stroke="rgba(255,255,255,0.2)" />
            <text x={8} y={15} fill="#e2e8f0" fontSize={11} fontWeight={600}>
              {TEAM_STYLE[hovered.team].label} #{hovered.number}
            </text>
            <text x={8} y={30} fill="#cbd5e1" fontSize={11}>
              {fmtM(metresFromLeftTouch(hovered.x))} from left touch · {fmtM(Math.abs(metresFromHalfway(view, hovered.y) ?? 0))}{' '}
              {(metresFromHalfway(view, hovered.y) ?? 0) >= 0 ? 'own side' : 'opp side'} · {fmtM(distanceMetres(hovered, ball))} to ball
            </text>
          </g>
        )}
      </g>
    </svg>
  );
}
