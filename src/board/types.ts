export type Team = 'attack' | 'defence';

export type BoardView = 'pitchIn' | 'pitchMiddle' | 'pitchOut' | 'lineout';

export interface Point {
  x: number;
  y: number;
}

export interface PlayerPos {
  id: string;
  team: Team;
  number: number;
  x: number;
  y: number;
}

/** A full 15v15 layout in board coordinates (1100 x 700, attack always plays "up" toward y = 0). */
export interface Layout {
  boardView: BoardView;
  ball: Point;
  players: PlayerPos[];
}

/** Compact tuple format used by the Rugby Tactics Board presets: [team, number, x, y]. */
export type PlayerTuple = [Team, number, number, number];

export type Possession = 'attacking' | 'defending';

export type LaneId = 'left5' | 'left15' | 'centre' | 'right15' | 'right5';
export type RowId = 'top5' | 'top22' | 'top10' | 'halfway' | 'bottom10' | 'bottom22' | 'bottom5';
export type SideId = 'left' | 'right';

export type PodMode = 'pods' | 'tight' | 'hidden';
export type DefenceMode = 'static' | 'drift' | 'rush' | 'hold';
export type OpenSide = 'left' | 'right';
