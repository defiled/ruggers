# Plays: Rugby Slate defence model — design

Date: 2026-10-22

## Problem

With the default settings (1-3-3-1 forwards, Drift defence) 2 Go's 12 ran into their 10 and
3 Go's 13 ran into their 12 and their 9. Measured at the left-15 ruck attacking right: in Static
mode 12 finished at 16.2 m across, between their 10 (13 m) and 12 (19 m), exactly as Rugby
Slate's Crash 12 draws it. In Drift mode the whole line slid out at 1.6 m/s regardless of who was
running at whom, so their 10 stood at 17.8 m when 12 arrived. The sweeper came up 3 m and tracked
the ball into the same seam from behind. Their eight forwards were always on the board.

## What Rugby Slate's GIFs show (Crash 12, Crash 13, Rangy, Switch 10 & 12, Screen 1)

- Cast is backs only: 9, 10, 12, 13 attacking; 10, 12, 13 (sometimes 11, 14, 15) defending.
- The defence comes straight up. Each defender shadows his opposite man laterally, late and
  partially (about 40% of the man's movement; the carrier's marker a little more).
- A straight runner therefore holds his defender; a drifting 10 drags his 10 across (Rangy,
  Switch), and that is the hole the strike runner takes.
- The strike runner bends once at 20-25° then straightens into the seam and takes a flat pass
  close to the line. He clears the two defenders by roughly 1.5 m and 2 m.

## Decision

- `defenceAt`: every front-line back marks his opposite number and copies 70% of his lateral
  movement as it was 0.6 s ago, so a 10 who drifts for two seconds drags his marker but a late
  cut at pace is barely followed (Slate's Rangy vs Crash 12); forwards hold their channel. Drift / Hold / Rush add a slide only once the ball is
  past the defender, proportional to how far past it is (50% / 20% / 10%). Line speed: Straight
  up 1.0 m/s, Drift 1.0, Rush 2.0, Hold 0.6. Their 9 tracks the ball from behind the line and
  comes up at most 1 m.
- `defenceOffsets` takes the forwards mode; Backs only removes the defending forwards too.
- Plays tab defaults: Backs only, Straight up (id `static`, relabelled).
- Acceptance: for every play, lane, forwards mode and defence mode, the strike runner is never
  closer than 1.5 m to a front-line defender from the catch to the gain line. Checked for all
  combinations; the only closer contact is their 9 covering 6 m past the line.

## Out of scope here

Defence tab forwards toggle and pendulum rebuild; copy rewrite; branding (in progress in a
separate session).

## Addendum: scrum and lineout possession (same day)

The site's "defensive" scrum presets only move the 9s, so Their ball never changed either
backline, and our backs kept the attacking spacing pushed to 5.5 m deep (11 out at 45-58 m on
several rows). Both backlines are now generated from possession in `scrumBackline.withBacklines`:
the attacking side gets the ladder, the defending side stands opposite their men 5.5 m behind
the hindmost foot, 15 at 13 m deep behind the 13/14 channel, 11 on the blind when it is 12 m or
wider and otherwise 4 m inside 10 and 2.5 m deeper. Rugby Slate's scrum moves draw the near
winger on the 15 m line about 10 m back from a 5 m scrum, which is where our attacking 11
already stood. Lineout 11 moves from 28 m to 12 m from touch, behind the tail, inside 10.
