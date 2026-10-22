# Scrum backline shape — design

Date: 2026-10-22

## Problem

The 35 scrum presets were copied verbatim from rugbytacticsboard.com. The site's placement of our
backs is a drawing default, not a coached shape:

- Attacking: 10, 12 and 13 stand in a straight line (12 is level with 10 in 25 of 35 presets).
- Both 5 m rows (and halfway-left5): all our backs are 2.2 m behind the number 8, inside the 5 m
  offside line the board itself draws.
- Defending: same 2.2 m fault on the 5 m rows; 15 stands in the front line in most rows.
- Lineout: the throwing team's 10 stands 9.6 m from the line of touch (offside line is 10 m).

## Decision

Keep the site's scrum forwards and the opposition verbatim. Generate **our** backline (10–15)
procedurally from the scrum position, the same way `phaseFormation.ts` already does for ruck play.
Patching y values in the JSON was rejected because the site's lateral spacing is also inconsistent
row to row, and a generator gives one shape that mirrors cleanly for every lane.

## Attacking backline (metres from the scrum centre / behind the number 8)

Open side = the wider side of the scrum (right at a centre scrum, matching `defaultOpenSide`).
Across values scale by `k = min(1, (openWidth − 3) / 42)` as in the phase shape.

| Row group | 10 | 12 | 13 | 14 | 15 | 11 blind | 11 tucked |
|---|---|---|---|---|---|---|---|
| Normal (22, 10, halfway) | 10 across, 9 deep | 19 / 11 | 28 / 13 | see below / 12.5 | 34 / 18 | −(blind−5) / 8 | 7 / 13 |
| Opp. 5 m (`top5`) | 8 / 6 | 15 / 7.5 | 22 / 9 | see below / 8.5 | 27 / 12 | −(blind−5) / 6 | 6 / 9 |
| Own 5 m (`bottom5`) | 10 / 5.5 | 19 / 6 | 28 / 6.5 | see below / 6.5 | 34 / 7 | −(blind−5) / 5.5 | 7 / 6.5 |

- 14 across = clamp(openWidth − 12, across13 + 8, openWidth − 4). Deep as in the table.
- 11 tucks inside 10 when the blind side is narrower than 12 m (same rule as phase play).
- 15 sits behind the 13/14 channel as the second wave, never in the front line.
- Own 5 m: depths are flat because the backs are already on the try line; the board clamps at the
  bottom edge.
- 9 is left verbatim (he is at the base of the scrum).

## Defending backline

Keep x verbatim. Depth behind our number 8: 10, 12, 13, 11, 14 at least 5.5 m (keep deeper values);
15 at least 12 m.

## Lineout

Throwing team's 10 moves from 110 px to 118 px (10.3 m) so he is behind the 10 m line.

## Tests (`src/data/scrumSetups.test.ts`, extend lineout coverage)

For every row × lane:
- attacking: every back ≥ 5 m behind the 8; 12 deeper than 10; 13 deeper than 12; 15 deeper than
  13 and 14; 14 inside the touchline; 11 on the blind when blind ≥ 12 m, inside 10 otherwise.
- defending: every back ≥ 5 m behind the 8; 15 deepest.
- lineout: throwing 10 ≥ 10 m from the line of touch.

## Out of scope

Opposition shape in either variant; scrum forwards; phase formation (already a ladder);
rugbytacticsboard.com export format (positions still round-trip, they are just different numbers).

## Docs

README "Formations" bullet and provenance table updated to say forwards/opposition are verbatim and
our backline is generated.
