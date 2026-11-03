/**
 * Severn River match analysis.
 *
 * `tapeOffset` is the clip's start position in the full tape, in seconds. It drives
 * both the running order and the "jump to this moment" link. Clips whose position
 * could not be established are null and sort to the end.
 *
 * How the offsets were found: the footage carries the camera's burned-in wall clock,
 * and the tape carries the same clock, which calibrates tape t=0 to 13:02:26. See
 * docs/superpowers/specs/2026-11-02-severn-analysis-design.md.
 */
export interface Clip {
  id: string;
  title: string;
  /** Start position in the full tape, in seconds. Null when it could not be established. */
  tapeOffset: number | null;
  /**
   * How the position was established.
   *   'clock' — OCR of the camera's burned-in wall clock, many agreeing reads
   *   'match' — frame-matched against the tape, then confirmed by eye
   */
  source: 'clock' | 'match' | null;
  duration: number;
}

export interface Match {
  id: string;
  opponent: string;
  date: string;
  /** Wall clock of tape t=0, used to convert the camera clock to a tape offset. */
  tapeUrl: string;
  tapeDuration: number;
  clips: Clip[];
}

const CLIPS: Clip[] = [
  { id: 'severn-two-phase-try', title: 'Severn attack with the scrum half, then swing wide for a two-phase try', tapeOffset: 3798, source: 'clock', duration: 34.6 },
  { id: 'backline-wrong-side', title: 'Backline set up on the wrong side — 10 switches and gets sacked by their aggressive defence', tapeOffset: 4767, source: 'clock', duration: 28.6 },
  { id: 'severn-shuts-us-down', title: "Severn's defence shuts our attack down completely — turnover, kick over the top, return, and they counter", tapeOffset: 4975, source: 'clock', duration: 51.7 },
  { id: 'lost-at-try-line', title: 'We lose possession at the try line', tapeOffset: 5417, source: 'clock', duration: 7.6 },
  { id: 'pods-example-1', title: 'Pods, example 1', tapeOffset: 4855, source: 'clock', duration: 28.5 },
  { id: 'backline-not-drawing', title: 'Backline not drawing defenders', tapeOffset: null, source: null, duration: 25.5 },
  { id: 'severn-wing-fullback', title: 'Very strong Severn attacking play with the wing and fullback', tapeOffset: 154, source: 'match', duration: 30.5 },
  { id: 'scrum-half-pick-and-go', title: 'Scrum half pick and go', tapeOffset: 258, source: 'match', duration: 10.1 },
  { id: 'severn-kick-over-us', title: 'Severn kick over us', tapeOffset: 3680, source: 'match', duration: 35.1 },
  { id: 'severn-pods-hit-gaps', title: 'Severn pods hit the gaps', tapeOffset: null, source: null, duration: 32.5 },
  { id: 'severn-kick', title: 'Severn kick', tapeOffset: 1534, source: 'match', duration: 32.7 },
  { id: 'overload-inside-gaps', title: 'Overload the backline at the set piece and attack the inside gaps', tapeOffset: 2124, source: 'match', duration: 24.7 },
  { id: 'scrum-half-kicks', title: 'Scrum half kicks', tapeOffset: null, source: null, duration: 15.9 },
  { id: 'fly-half-kicks', title: 'Fly half kicks', tapeOffset: 1893, source: 'match', duration: 21.6 },
  { id: 'severn-empty-space-try', title: 'Severn score into empty space', tapeOffset: 350, source: 'match', duration: 8.3 },
  { id: 'we-pass-too-late', title: "Severn's strong defensive press — we pass too late", tapeOffset: null, source: null, duration: 15.2 },
  { id: 'severn-blitz', title: 'Severn blitz on defence', tapeOffset: 406, source: 'match', duration: 10.3 },
  { id: 'severn-kick-over-again', title: 'Severn kick over the defence again', tapeOffset: null, source: null, duration: 14.6 },
  { id: 'severn-wide-try', title: 'Severn get the ball wide quickly for a try', tapeOffset: 1567, source: 'match', duration: 18.7 },
  { id: 'severn-kick-into-touch', title: 'Severn kick again, into touch', tapeOffset: null, source: null, duration: 9.6 },
  { id: 'no-backline-no-space', title: 'No backline, no use of space, under strong defensive pressure', tapeOffset: null, source: null, duration: 35.1 },
];

export const SEVERN: Match = {
  id: 'severn',
  opponent: 'Severn River',
  date: 'Fall 2026',
  tapeUrl: 'https://www.youtube.com/watch?v=xvro8lXdez8',
  tapeDuration: 5541,
  clips: [...CLIPS].sort((a, b) => {
    if (a.tapeOffset == null && b.tapeOffset == null) return 0;
    if (a.tapeOffset == null) return 1;
    if (b.tapeOffset == null) return -1;
    return a.tapeOffset - b.tapeOffset;
  }),
};

export const MATCHES: Match[] = [SEVERN];

export const clipSrc = (matchId: string, clipId: string) => `/clips/${matchId}/${clipId}.mp4`;
export const clipPoster = (matchId: string, clipId: string) => `/clips/${matchId}/${clipId}.jpg`;

/** 3798 -> "63:18" */
export function tapeLabel(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function tapeLink(match: Match, seconds: number): string {
  return `${match.tapeUrl}&t=${Math.floor(seconds)}s`;
}
