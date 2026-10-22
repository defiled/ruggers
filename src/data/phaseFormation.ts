import type { DefenceMode, LaneId, Layout, OpenSide, PlayerTuple, PodMode, RowId } from '../board/types';
import { BOARD_W, PX_PER_M_X, PX_PER_M_Y, clampPlayer, tuplesToPlayers } from '../board/constants';
import { LANES, ROWS } from './scrumSetups';

/**
 * Phase-play (ruck) formation builder.
 *
 * Attack: 1-3-3-1 pod structure as commonly used in the modern game.
 *   - "1": an edge forward (6) on the short side, wide enough to be a carrying option.
 *   - "3": pod A (1, 2, 4 - props + lock) one pass off 9, lead carrier in the middle.
 *   - "3": pod B (3, 5, 7) in the next 15 m channel with 12 playing behind it.
 *   - "1": the far-edge forward (8) linking into the open-side winger.
 *   10 plays behind pod A, 12 behind pod B, 13 outside, 15 as the second-wave / swing option.
 *   11 (blind winger) holds the short side unless the blind is narrower than ~12 m,
 *   in which case he tucks inside 10 as an extra option (matches the site's L5 behaviour).
 *
 * Defence: 13 in the front line (guards either side of the ruck, then evenly spaced to touch),
 *   15 deep, 9 sweeping behind the ruck, blind winger dropping back when the blind is narrow.
 *
 * All offsets are in metres relative to the ruck so the shape can be mirrored for either open side.
 */

export interface PhaseOptions {
  lane: LaneId;
  row: RowId;
  openSide: OpenSide;
  podMode: PodMode;
  defenceMode: DefenceMode;
}

export const defaultOpenSide = (lane: LaneId): OpenSide =>
  lane === 'right15' || lane === 'right5' ? 'left' : 'right';

export const PHASE_LABELS: Record<PodMode, string> = {
  pods: '1-3-3-1 pods',
  tight: 'Forwards tight to ruck',
  hidden: 'Backline only',
};

export const FORWARDS = [1, 2, 3, 4, 5, 6, 7, 8];
export const BACKS = [9, 10, 11, 12, 13, 14, 15];

const mx = (m: number) => m * PX_PER_M_X;
const my = (m: number) => m * PX_PER_M_Y;

export interface PhaseGeometry {
  bx: number;
  by: number;
  dir: 1 | -1;
  openWidth: number; // metres from ruck to open touchline
  blindWidth: number; // metres from ruck to blind touchline
  narrowBlind: boolean;
}

export function phaseGeometry(lane: LaneId, row: RowId, openSide: OpenSide): PhaseGeometry {
  const laneDef = LANES.find((l) => l.id === lane) ?? LANES[1];
  const rowDef = ROWS.find((r) => r.id === row) ?? ROWS[3];
  const dir: 1 | -1 = openSide === 'right' ? 1 : -1;
  const bx = laneDef.x;
  const by = rowDef.y;
  const openWidth = (dir === 1 ? BOARD_W - 10 - bx : bx - 10) / PX_PER_M_X;
  const blindWidth = 70 - openWidth;
  return { bx, by, dir, openWidth, blindWidth, narrowBlind: blindWidth < 12 };
}

/** Lateral compression applied to the open-side shape when the open side is narrower than 45 m. Routes use it too. */
export const acrossScale = (g: PhaseGeometry) => Math.min(1, (g.openWidth - 3) / 42);

/** Attack positions as [number, metres across (open side positive), metres deep (positive = own side)]. */
export function attackOffsets(g: PhaseGeometry, podMode: PodMode): Array<[number, number, number]> {
  const { openWidth, blindWidth, narrowBlind } = g;
  const k = acrossScale(g);
  const o = (m: number) => m * k;
  const out: Array<[number, number, number]> = [];

  // Backline strike alignment: 10 at 8 m depth, 12/13 staggered 6-7 m outside each other,
  // 15 deep behind 12/13 as the second wave, 14 wide and a touch flatter.
  out.push([9, 0.8, 1.2]);
  out.push([10, o(13), 9]);
  out.push([12, o(19), 10.5]);
  out.push([13, o(26), 11.5]);
  out.push([15, o(33), 17]);
  out.push([14, Math.min(o(42), openWidth - 3), 10]);
  if (narrowBlind) {
    out.push([11, o(10), 14]); // tucks inside 10 when the blind is too narrow to be a threat
  } else {
    out.push([11, -(blindWidth - 4), 8]);
  }

  if (podMode === 'pods') {
    const blindEdge = narrowBlind ? -2.5 : -7;
    out.push([6, blindEdge, 2.5]);
    // Pod A (1-2-4), one pass off 9. Lead carrier 4 in the middle, props latching either side.
    const ax = o(9);
    out.push([4, ax, 3.5]);
    out.push([1, ax - 2.5, 4.3]);
    out.push([2, ax + 2.5, 4.3]);
    // Pod B (3-5-7) in the next channel.
    const bxm = o(25);
    out.push([5, bxm, 4]);
    out.push([3, bxm - 2.5, 4.8]);
    out.push([7, bxm + 2.5, 4.8]);
    // Far edge forward.
    out.push([8, Math.min(o(44), openWidth - 8), 6]);
  } else if (podMode === 'tight') {
    // Two forwards over the ball, two guards, a four-man cluster one pass off 9.
    out.push([1, -0.8, -0.3]);
    out.push([2, 0.8, -0.5]);
    out.push([5, -2.5, 1.5]);
    out.push([4, 2.5, 1.5]);
    out.push([6, 4.5, 3]);
    out.push([3, 7, 3.5]);
    out.push([7, 9.5, 3]);
    out.push([8, 12, 3.5]);
  }
  return out;
}

/**
 * Defence positions in the same metre frame. Defence faces the attack, so "deep" is negative here.
 * Man-on-man across the backs: their 10, 12, 13 and 14 stand opposite ours, forwards fill the
 * channels either side of the ruck and the far edge. That is how the coached moves are drawn
 * (a crash ball finishes "between their 10 and 12"), so the seams the plays attack are real.
 */
export function defenceOffsets(g: PhaseGeometry, mode: DefenceMode, podMode: PodMode = 'pods'): Array<[number, number, number]> {
  const { openWidth, blindWidth, narrowBlind } = g;
  const k = acrossScale(g);
  const o = (m: number) => m * k;
  const lineDepth = mode === 'hold' ? -3.5 : mode === 'rush' ? -2 : -2.5;
  const out: Array<[number, number, number]> = [];
  // "Backs only" takes their forwards off too, so the picture is the one the move is drawn on.
  const fwd = (n: number, across: number, deep: number) => {
    if (podMode !== 'hidden') out.push([n, across, deep]);
  };
  // Guards either side of the ruck.
  fwd(1, 1.5, lineDepth);
  fwd(2, -1.5, lineDepth);
  // Blind side cover.
  if (!narrowBlind) {
    fwd(6, -5, lineDepth);
    out.push([11, -(blindWidth - 4), lineDepth - 0.5]);
  }
  // Open side: forwards inside, backs opposite their numbers, edge forwards outside 13.
  fwd(3, o(4.5), lineDepth);
  fwd(4, o(7.5), lineDepth - 0.3);
  fwd(5, o(10.5), lineDepth);
  out.push([10, o(13), lineDepth]);
  out.push([12, o(19), lineDepth]);
  out.push([13, o(26), lineDepth]);
  fwd(7, o(30.5), lineDepth - 0.3);
  fwd(8, o(35), lineDepth);
  if (narrowBlind) fwd(6, o(39), lineDepth - 0.3);
  out.push([14, Math.min(o(42), openWidth - 3), lineDepth]);
  // Backfield.
  out.push([9, 2, -8]);
  out.push([15, Math.min(12, openWidth / 2), -22]);
  if (narrowBlind) out.push([11, Math.min(30, openWidth - 12), -19]);
  return out;
}

export function phaseLayout(opts: PhaseOptions): Layout {
  const g = phaseGeometry(opts.lane, opts.row, opts.openSide);
  const rowDef = ROWS.find((r) => r.id === opts.row) ?? ROWS[3];
  const toTuple = (team: 'attack' | 'defence', [n, across, deep]: [number, number, number]): PlayerTuple => {
    const p = clampPlayer({ x: g.bx + g.dir * mx(across), y: g.by + my(deep) });
    return [team, n, Math.round(p.x), Math.round(p.y)];
  };
  const attack = attackOffsets(g, opts.podMode).map((o) => toTuple('attack', o));
  const defence = defenceOffsets(g, opts.defenceMode, opts.podMode).map((o) => toTuple('defence', o));
  const all = [...attack, ...defence].sort((a, b) => (a[0] !== b[0] ? (a[0] === 'attack' ? -1 : 1) : a[1] - b[1]));
  return {
    boardView: rowDef.boardView,
    ball: { x: g.bx, y: g.by },
    players: tuplesToPlayers(all),
  };
}
