import type { BoardView, Layout, PlayerPos } from '../board/types';

/**
 * Rugby Tactics Board export format (version 2). Files written here can be imported
 * on rugbytacticsboard.com and vice versa.
 */
export interface SiteExport {
  version: 2;
  exportedAt: string;
  metadata: { name: string; description: string; tags: string[] };
  stages: Array<{
    boardView: BoardView;
    players: PlayerPos[];
    ball: { x: number; y: number };
    actions: unknown[];
  }>;
  currentStageIndex: number;
}

export function toSiteExport(name: string, description: string, stages: Layout[]): SiteExport {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    metadata: { name, description, tags: ['steamrollers'] },
    stages: stages.map((s) => ({
      boardView: s.boardView,
      players: s.players.map((p) => ({ ...p })),
      ball: { ...s.ball },
      actions: [],
    })),
    currentStageIndex: 0,
  };
}

export function fromSiteExport(raw: unknown): Layout | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<SiteExport>;
  const stage = data.stages?.[0];
  if (!stage || !Array.isArray(stage.players)) return null;
  const players = stage.players
    .filter((p) => p && (p.team === 'attack' || p.team === 'defence') && Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p) => ({ id: `${p.team}-${p.number}`, team: p.team, number: Number(p.number), x: Number(p.x), y: Number(p.y) }));
  if (players.length === 0) return null;
  const view = (['pitchIn', 'pitchMiddle', 'pitchOut', 'lineout'] as BoardView[]).includes(stage.boardView as BoardView)
    ? (stage.boardView as BoardView)
    : 'pitchMiddle';
  return { boardView: view, ball: stage.ball ?? { x: 550, y: 350 }, players };
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
