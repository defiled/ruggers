import type { BoardView } from '../board/types';
import { BOARD_H, BOARD_W, PITCH } from '../board/constants';

interface Props {
  view: BoardView;
  portrait?: boolean;
  showLabels?: boolean;
}

/** Pitch markings at the same coordinates as rugbytacticsboard.com so presets line up exactly. */
export function Pitch({ view, portrait = false, showLabels = true }: Props) {
  const lines = PITCH[view === 'lineout' ? 'pitchMiddle' : view];
  // In portrait the whole board is rotated 90°; counter-rotate each label about its anchor so it reads upright.
  const up = (x: number, y: number) => (portrait ? `rotate(-90 ${x} ${y})` : undefined);
  return (
    <g className="pitch" pointerEvents="none">
      <rect x={0} y={0} width={BOARD_W} height={BOARD_H} fill="var(--grass)" />
      {Array.from({ length: 7 }).map((_, i) => (
        <rect key={i} x={0} y={i * 100} width={BOARD_W} height={100} fill={i % 2 ? 'var(--grass-alt)' : 'transparent'} />
      ))}
      <rect x={10} y={-10} width={1080} height={BOARD_H + 20} fill="none" stroke="var(--line-pitch)" strokeWidth={3} />
      {lines.solid.map((y) => (
        <line key={`s${y}`} x1={10} y1={y} x2={1090} y2={y} stroke="var(--line-pitch)" strokeWidth={3} />
      ))}
      {lines.dashed.map((y) => (
        <line key={`d${y}`} x1={70} y1={y} x2={1030} y2={y} stroke="var(--line-pitch)" strokeWidth={3} strokeDasharray="60 120" />
      ))}
      {lines.vertical.slice(1, -1).map((x) => (
        <line
          key={`v${x}`}
          x1={x}
          y1={0}
          x2={x}
          y2={BOARD_H}
          stroke="var(--line-pitch)"
          strokeWidth={x === 550 ? 0 : 2}
          strokeDasharray="14 22"
          opacity={0.5}
        />
      ))}
      {showLabels &&
        lines.labels.map((l) => {
          // Portrait: label sits beside its line along the top edge, on the side that keeps it on the board.
          const nearTop = l.y <= 350;
          const text = portrait && l.text === 'HALFWAY' ? 'HALF' : l.text;
          const x = portrait ? 30 : 22;
          const y = portrait ? (nearTop ? l.y + 8 : l.y - 8) : l.y - 6;
          return (
            <text
              key={`t${l.y}`}
              x={x}
              y={y}
              transform={up(x, y)}
              fill="var(--line-pitch)"
              fontSize={portrait ? 15 : 13}
              fontWeight={500}
              opacity={0.75}
              textAnchor={portrait ? (nearTop ? 'end' : 'start') : 'start'}
            >
              {text}
            </text>
          );
        })}
      {showLabels &&
        [100, 280, 820, 1000].map((x) => {
          const text = x === 100 || x === 1000 ? '5m' : '15m';
          const y = portrait ? 40 : BOARD_H - 8;
          return (
            <text key={`m${x}`} x={x} y={y} transform={up(x, y)} fill="var(--line-pitch)" fontSize={11} opacity={0.6} textAnchor="middle">
              {text}
            </text>
          );
        })}
      {showLabels &&
        (portrait ? (
          <text x={60} y={BOARD_H - 14} transform={`rotate(-90 60 ${BOARD_H - 14})`} fill="var(--line-pitch)" fontSize={13} fontWeight={500} opacity={0.7} textAnchor="start">
            ATTACK →
          </text>
        ) : (
          <text x={BOARD_W - 22} y={BOARD_H / 2} fill="var(--line-pitch)" fontSize={12} opacity={0.6} textAnchor="middle" transform={`rotate(-90 ${BOARD_W - 22} ${BOARD_H / 2})`}>
            ATTACK ↑
          </text>
        ))}
    </g>
  );
}
