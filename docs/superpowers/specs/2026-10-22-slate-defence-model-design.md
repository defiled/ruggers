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

## Addendum: Over/Under, Bread & Butter, 6 Go shapes (2026-10-23)

- **Over/Under is a fake 3 Go.** 13 runs the 3 Go unders line (shared `THIRTEEN_UNDERS`) as the
  decoy; 10 → 12 at 1.5 s; 12 holds and plays behind 13 at 2.7 s to 15, who comes in from 33 m to
  take it 7 m deep (pass 7.4 m); 15 straightens outside their 13 and gives 14, who has come in
  off his touchline, at 3.6 s (pass under 8 m). Reference: Rugby Slate Screen 2.
- **Bread & Butter pop 13.** 10 and 12 run the identical switch picture as Switch 12 to 2.0 s
  (`SWITCH_TEN`, `SWITCH_TWELVE`); 10 keeps, takes one more step and pops to 13 cutting under
  into the 12/13 seam at 2.6 s, 5 m deep. Replaces the double switch. Reference: Dummy Switch Pop.
- **6 Go** has two casts chosen by the board (`Play.autoVariant`): the blindside flanker runs the
  inside ball with 11 trailing on his inside hip when forwards are on and the blind is 12 m or
  wider; 11 runs it from the 5 m lanes or on Backs only. Both use the same `INSIDE_RUNNER` line
  (starts 9 m across, 12 m deep, finishes in their 10's channel). References: Rugby Slate's two
  inside-pop-to-11 moves; Rugby Coach Weekly on the blindside flanker taking the short pop off 10.
- **Chopper** unchanged; tag now says 12 and 13 are both options.

Acceptance re-run: strike runner never closer than 1.8 m to a front-line defender from catch to
gain line across every play, variant, lane, forwards and defence mode; the only closer contacts
are their 9 covering past the line and, in Drift only, their 13 sliding onto 15 after he has
already released 14.

Follow-up (same day): the shared 13 unders line now finishes a metre tighter, 20.5 m across
(their 12's outside shoulder), with the cut spread over 1.0-2.6 s so every segment stays steeper
than 1.5 : 1. Over/Under re-timed: 10 holds through the 3 Go pass window and *shows* the ball to
13 at 1.4-1.7 s (`PlayVariant.fakes`, drawn on the timeline as "fake 10 → 13"), then gives to 12
at 2.1 s; 12 → 15 at 3.1 s, 15 → 14 at 4.0 s, both still under 8 m.

## Addendum: Defence tab pictures (2026-10-23)

- **Drift** is 3 v 5 (9, 10, 12, 13, 14 against 10, 12, 13). On the 10 → 12 pass the whole line
  pushes one man out together, easing over 1.6 s to the inside shoulder of the new man as he stood
  when the pass went; the channel cap is now soft (eases in between 3 m and 1.5 m lateral) so
  nothing snaps. The touchline takes 14. Reference: Rugby Slate Drift-01.
- **Shooter**: their 12 shoots on the 10 → 12 pass. He comes up with the line, leaves it at 1.0 s
  as 10's hips turn, sprints at 7.5 m/s and meets 12 as he catches, ~5 m behind the gain line.
  10 and 13 fold in; 9 covers behind. Reference: Rugby Slate Shooter GIFs.
- **Pendulum**: 11, 15 and 14 only, joined by the pendulum line, a Defensive Line bar and the ball
  gliding across in front. The near winger stops 1.5 m behind the line, never on it. No 9.
  Reference: Rugby Slate Pendulum-01.
- **Dog-leg**: the late defender is flat-footed (no tracking); from 1.0 s two dashed options are
  drawn from the runner to the gaps either side of him (INSIDE / OUTSIDE); at 2.2 s he commits
  inside and goes through. Reference: Rugby Slate Dog-Leg-02 "Slow 10".
