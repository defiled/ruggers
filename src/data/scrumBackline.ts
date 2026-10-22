import type { PlayerTuple, Possession, RowId, Team } from '../board/types';
import { BOARD_W, PX_PER_M_X, PX_PER_M_Y, clamp, clampPlayer } from '../board/constants';

/**
 * Both backlines at a scrum. The site's presets place the forwards and the 9s; this file replaces
 * the twelve backs with coached shapes built from the scrum position and who has the ball:
 *
 *   - 10 roughly 10 m wide and 9 m behind the hindmost foot, 12 and 13 each 2 m deeper and
 *     ~9 m wider than the man inside them, 14 on the edge a touch flatter than 13, 15 deep
 *     behind the 13/14 channel as the second wave. 11 holds the blind, or tucks inside 10 when
 *     the blind is narrower than 12 m.
 *   - Attacking the opposition 5 m line everything flattens and tightens (but stays onside).
 *   - On our own 5 m line the backs are already on the try line, so the ladder is minimal.
 *   - The defending backs stand opposite their men in a flat line 5.5 m behind the hindmost foot,
 *     15 deep behind the 13/14 channel, 11 on the blind or tucked inside 10 when the blind is narrow
 *     (Rugby Slate's scrum moves draw the near winger on the 15 m line, ~10 m back, from a 5 m scrum).
 *
 * Across values are metres from the scrum centre toward the open side; deep values are metres
 * behind the number 8. The across values compress when the open side is narrower than 45 m,
 * using the same rule as the phase formation.
 */

export const BACKS = [10, 11, 12, 13, 14, 15] as const;

export interface ScrumGeometry {
  scrumX: number;
  eightY: number;
  /** +1 when the open side is to the right of the board, -1 to the left. */
  dir: 1 | -1;
  openWidth: number;
  blindWidth: number;
}

export function ourScrumGeometry(players: PlayerTuple[]): ScrumGeometry {
  const find = (n: number) => {
    const t = players.find((p) => p[0] === 'attack' && p[1] === n);
    if (!t) throw new Error(`attack ${n} missing from scrum preset`);
    return t;
  };
  const scrumX = (find(1)[2] + find(3)[2]) / 2;
  const eightY = find(8)[3];
  const right = (BOARD_W - 10 - scrumX) / PX_PER_M_X;
  const left = (scrumX - 10) / PX_PER_M_X;
  const dir: 1 | -1 = right >= left ? 1 : -1;
  return { scrumX, eightY, dir, openWidth: Math.max(right, left), blindWidth: Math.min(right, left) };
}

type RowGroup = 'normal' | 'oppFive' | 'ownFive';

const rowGroup = (row: RowId): RowGroup => (row === 'top5' ? 'oppFive' : row === 'bottom5' ? 'ownFive' : 'normal');

/** [across, deep] per back, except 14 whose across is derived from the open-side width. */
interface Shape {
  10: [number, number];
  12: [number, number];
  13: [number, number];
  14: number; // deep only
  15: [number, number];
  11: { blindDeep: number; tucked: [number, number] };
}

const SHAPES: Record<RowGroup, Shape> = {
  normal: { 10: [10, 9], 12: [19, 11], 13: [28, 13], 14: 12.5, 15: [34, 18], 11: { blindDeep: 8, tucked: [7, 13] } },
  oppFive: { 10: [8, 6], 12: [15, 7.5], 13: [22, 9], 14: 8.5, 15: [27, 12], 11: { blindDeep: 6, tucked: [6, 9] } },
  ownFive: { 10: [10, 5.5], 12: [19, 6], 13: [28, 6.5], 14: 6.5, 15: [34, 7], 11: { blindDeep: 5.5, tucked: [7, 6.5] } },
};

/** Metres across (open side positive) and deep (behind the 8) for each of our backs when attacking. */
export function attackingBackOffsets(g: ScrumGeometry, row: RowId): Array<[number, number, number]> {
  const s = SHAPES[rowGroup(row)];
  const k = Math.min(1, (g.openWidth - 3) / 42);
  const o = (m: number) => m * k;
  const across13 = o(s[13][0]);
  const across14 = clamp(g.openWidth - 12, across13 + 8, g.openWidth - 4);
  const eleven: [number, number] =
    g.blindWidth < 12 ? [o(s[11].tucked[0]), s[11].tucked[1]] : [-(g.blindWidth - 5), s[11].blindDeep];
  return [
    [10, o(s[10][0]), s[10][1]],
    [12, o(s[12][0]), s[12][1]],
    [13, across13, s[13][1]],
    [14, across14, s[14]],
    [15, o(s[15][0]), s[15][1]],
    [11, eleven[0], eleven[1]],
  ];
}

const toTuple = (g: ScrumGeometry, team: Team, n: number, across: number, deep: number): PlayerTuple => {
  // Our backs stand behind our 8 (down the board); theirs behind their 8 (up the board).
  const sign = team === 'attack' ? 1 : -1;
  const p = clampPlayer({ x: g.scrumX + g.dir * across * PX_PER_M_X, y: g.eightY + sign * deep * PX_PER_M_Y });
  return [team, n, p.x, p.y];
};

/** Depth (behind the hindmost foot) of a defending backline: onside with a little margin. */
const DEFEND_LINE_DEPTH = 5.5;
const DEFEND_FULLBACK_DEPTH = 13;

/**
 * The defending backs, drawn against the attacking shape: 10, 12, 13 and 14 stand opposite their
 * men in a flat line just behind the offside line; 15 deep behind the 13/14 channel; 11 holds the
 * blind when there is one, otherwise tucks inside 10 (a 5 m blind needs nobody out there).
 */
export function defendingBackOffsets(g: ScrumGeometry, attacking: Array<[number, number, number]>): Array<[number, number, number]> {
  const acrossOf = (n: number) => attacking.find((o) => o[0] === n)![1];
  const eleven: [number, number] = g.blindWidth < 12 ? [4, DEFEND_LINE_DEPTH + 2.5] : [-(g.blindWidth - 5), DEFEND_LINE_DEPTH];
  return [
    [10, acrossOf(10), DEFEND_LINE_DEPTH],
    [12, acrossOf(12), DEFEND_LINE_DEPTH],
    [13, acrossOf(13), DEFEND_LINE_DEPTH],
    [14, acrossOf(14) - 1, DEFEND_LINE_DEPTH],
    [15, (acrossOf(13) + acrossOf(14)) / 2, DEFEND_FULLBACK_DEPTH],
    [11, eleven[0], eleven[1]],
  ];
}

/** The attacking team's row group is seen from their end: our "opposition 5 m" is their own 5 m. */
const flipRow = (row: RowId): RowId => (row === 'top5' ? 'bottom5' : row === 'bottom5' ? 'top5' : row);

/**
 * Replace both backlines in a preset according to who has the ball. The site's forwards and 9s
 * are kept; the attacking backs get the coached ladder, the defending backs line up opposite them.
 */
export function withBacklines(players: PlayerTuple[], row: RowId, possession: Possession): PlayerTuple[] {
  const g = ourScrumGeometry(players);
  const theirs: ScrumGeometry = { ...g, eightY: theirEightY(players) };
  const attackTeam: Team = possession === 'attacking' ? 'attack' : 'defence';
  const defendTeam: Team = attackTeam === 'attack' ? 'defence' : 'attack';
  const attackG = attackTeam === 'attack' ? g : theirs;
  const defendG = attackTeam === 'attack' ? theirs : g;
  const attacking = attackingBackOffsets(attackG, attackTeam === 'attack' ? row : flipRow(row));
  const defending = defendingBackOffsets(defendG, attacking);
  const generated = new Map<string, PlayerTuple>();
  for (const [n, a, d] of attacking) generated.set(`${attackTeam}-${n}`, toTuple(attackG, attackTeam, n, a, d));
  for (const [n, a, d] of defending) generated.set(`${defendTeam}-${n}`, toTuple(defendG, defendTeam, n, a, d));
  return players.map((t) => generated.get(`${t[0]}-${t[1]}`) ?? t);
}

function theirEightY(players: PlayerTuple[]): number {
  const t = players.find((p) => p[0] === 'defence' && p[1] === 8);
  if (!t) throw new Error('defence 8 missing from scrum preset');
  return t[3];
}
