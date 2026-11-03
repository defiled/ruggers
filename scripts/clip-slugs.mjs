/**
 * Stable ids for the Severn clips.
 *
 * Derived slugs from these filenames would be unwieldy, and the id is what comment
 * rows are keyed on, so it must never drift. Keys are the source filenames; values
 * must match /^[a-z0-9][a-z0-9-]{0,63}$/.
 */
export const CLIP_SLUGS = {
  'backline not drawing defenders.mov': 'backline-not-drawing',
  'backline not setup on correct side, 10 switches, gets sacked by their aggresive defense.mov': 'backline-wrong-side',
  'fly half kicks.mov': 'fly-half-kicks',
  'no backline, not using space, strong defensive pressure.mov': 'no-backline-no-space',
  'overload backline on set piece, attack inside gaps.mov': 'overload-inside-gaps',
  'pods ex 1.mov': 'pods-example-1',
  'scrum half kicks.mov': 'scrum-half-kicks',
  'scrum half pick and go.mov': 'scrum-half-pick-and-go',
  'severn attacks with scrum half, then swing to other side quickly for a 2 phase try.mov': 'severn-two-phase-try',
  'severn blitz on def.mov': 'severn-blitz',
  'severn defense shuts down our attacks completely. turnover, kick over head, return it, and then they counter.mov': 'severn-shuts-us-down',
  'severn gets ball out wide for try quicky.mov': 'severn-wide-try',
  'severn kicks again, into touch.mov': 'severn-kick-into-touch',
  'severn kicks over defense again.mov': 'severn-kick-over-again',
  'severn kicks over us.mov': 'severn-kick-over-us',
  'severn kicks.mov': 'severn-kick',
  'severn pods hit gaps.mov': 'severn-pods-hit-gaps',
  'severn scores on empty space.mov': 'severn-empty-space-try',
  'severn strong defensive attack, we pass too late.mov': 'we-pass-too-late',
  'very strong severn attacking play with wing:fullback.mov': 'severn-wing-fullback',
  'we lose posession at try line.mov': 'lost-at-try-line',
};

export function slugFor(filename) {
  const slug = CLIP_SLUGS[filename];
  if (!slug) throw new Error(`No slug registered for "${filename}" — add it to scripts/clip-slugs.mjs`);
  return slug;
}
