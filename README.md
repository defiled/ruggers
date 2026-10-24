# Frederick RFC Attack Playbook

Interactive 15v15 rugby union board for the team: starting formations for every set piece and field position, plus the six backline calls animated against a scripted defence. Mobile-first: on a phone the pitch rotates so the full width fills the screen (attack runs left → right), playback controls sit on the board itself, and the tabs move to a bottom bar.

React + TypeScript + Vite, SVG board, no backend. Team edits are saved in the browser (localStorage). Club colours: navy and kelly green.

```bash
npm install
npm run dev      # web (http://localhost:5173) + feedback API (http://localhost:8787) together
npm run build    # static site in dist/
npm start        # build, then serve dist/ and the API from one Node process (production)
npm test         # validates every play (no forward passes, catches behind the line, steep strike lines)
npm run feedback # read messages people left on the site
```

Needs Node 22.13+ (the feedback store uses the built-in `node:sqlite`).

**03 · Defence**
- Drift, Blitz, Pendulum (back three), Shooter, and a Dog-leg demo of what goes wrong when the line is not together.
- Each picture is backs only, drawn the way Rugby Slate draws it: an attacking backline moving the ball from a ruck, and the defence answering. Switch the attack between deep, standard and flat to see why a deep attack invites the blitz and a flat one invites the drift; pick the ruck lane and direction. Pendulum shows just the back three and 9 against a ball moving across the field.
- Time-synced captions explain each moment (set, trigger, line, contact, reload), role badges mark the sweeper, backfield, shooter, pendulum movers and the late man, and a live readout shows how far behind the gain line the carrier is.
- Theory for each system: how it works, trigger, when we use it, why it works, strengths, weaknesses, how an attack beats it, common errors, coaching points, with a reference link to Rugby Slate. Plus "Read the attack" (what we see → what we call → why) and "Where on the pitch" (posture by zone).

## Entry gate

The password screen is **off**: the site opens straight on the playbook. To put it back, set `GATE_ENABLED` to `true` in `src/components/Gate.tsx`. It then works like this: any non-empty password is accepted, and what grants entry is the button sequence **OK → Cancel → OK** (Enter counts as OK), remembered per device in localStorage. Change the sequence in `ENTRY_SEQUENCE` in the same file; set it to `['ok']` for a plain "type anything and press OK" gate.

## Feedback ("Say something")

A floating button on every screen opens a short form (name optional, message required). Each message is stored in SQLite at `data/feedback.db` with the page context attached (which play / variant / lane, or which formation), the URL and the browser.

- `npm run feedback` lists open messages; `npm run feedback -- --all` includes resolved ones; `npm run feedback -- --resolve 12` marks one done.
- Set `FEEDBACK_WEBHOOK_URL` (Slack, Discord or Google Chat incoming webhook) and the server pings you on every message.
- Set `ADMIN_KEY` to read messages over HTTP: `GET /api/feedback?key=...`.
- Optional `VITE_FEEDBACK_EMAIL` (build-time) adds an "Email it instead" link if the API is unreachable, e.g. on static hosting without the server.
- Light abuse guard: 10 messages per IP per 10 minutes, 2000 characters max.

Copy `.env.example` to `.env` (the server reads plain environment variables; use `export` or your host's config).

## Brand and share card

The club has no official mascot (we are not the Steamrollers). For now the crest is the church-steeples logo, "Frederick RFC · Founded 1990".

- `brand/` holds the source logo and `og-card.html`, the share-card layout. See `brand/README.md` to regenerate the icons.
- `public/` holds what the site serves: `favicon.ico`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `logo.webp` (masthead and gate), `manifest.webmanifest` and `og.png` (1200×630 link preview).
- Link previews need absolute image URLs. `npm start` fills them in from each request's host (or `SITE_URL` if set). For static hosting without the server, set `VITE_SITE_URL=https://your.domain` before `npm run build`.

## Session replay (LogRocket)

Production builds load LogRocket (`src/analytics.ts`, app `antirithm/steamrollers`). There are no accounts, so sessions are identified by a random per-device id kept in localStorage, plus the name the visitor last typed into the feedback form; sending feedback fires a `feedback_sent` event carrying the page context. It is off under `npm run dev`; set `VITE_LOGROCKET=1` to turn it on locally.

## Tabs

**01 · Formations**
- **Scrum** — 7 field rows × 5 lanes (L5, L15, C, R15, R5), our feed or theirs. The scrum itself and the opposition are the Rugby Tactics Board presets, copied coordinate-for-coordinate (see provenance below). Our backline is generated from the scrum position so it is always onside and in a coached shape: 10 about 10 m wide and 9 m behind the hindmost foot, 12 and 13 each 2 m deeper, 14 on the edge, 15 deep behind the 13/14 channel as the second wave, 11 on the blind or tucked inside 10 when the blind is under 12 m. It flattens attacking the opposition 5 m line and sits on the try line at our own 5 m. Defending, our backs hold a flat line 5.5 m back with 15 at least 12 m deep. `npm test` checks every location.
- **Lineout** — left or right touch, 3 to 7 in the line, our throw or theirs. Generated with the same rules the site uses.
- **Phase · 1-3-3-1** — ruck at any lane/row, open side left or right. Forwards as 1-3-3-1 pods, tight to the ruck, or hidden. Defence shape: drift, rush, hold.
- Overlays: offside lines (5 m at scrum, 10 m at lineout, hindmost foot at a ruck), spacing in metres, hover readouts, coordinate table.
- Drag to edit any player or the ball; edits persist per formation. Export/import JSON in the Rugby Tactics Board format so files round-trip with rugbytacticsboard.com.

**02 · Plays**
- 2 Go (12 crash ball), 3 Go (miss-12, 13 unders), Bread & Butter (10/12 switch, option 13), Chopper (Rangy: 10 and 12 drift, 13 switch behind; option 12), Over/Under (13 under, 12 out the back to 15 and 14), 6 Go (blind winger inside ball).
- Each play is modelled on its common coached version and cross-checked against the Rugby Slate animation of the same move (linked from each play): deeper alignment, passes 6-8 m from the line, and a strike runner who finishes in a named seam between two defenders (ringed and marked SEAM on the board), never on a man. The defence stands man-on-man so those seams are real. `npm test` enforces all of this for every play in every lane and direction.
- Defence can be Static (the shape the move is drawn on, as on Rugby Slate), Drift, Rush or Hold.
- All 15 attackers and 15 defenders are on the board. Forwards toggle between 1-3-3-1 pods, tight, or backs only.
- Ruck position (lane) and attack direction mirror the play. Defence responds in drift / rush / hold mode and the defender the call targets is ringed.
- Tap the board to play / pause; scrub bar with pass markers, speed and restart live on the board. Space / ← / → / Home work on a keyboard. Notes cover intent, sequence, read, target, watch-out, fallback and theory.

## Data provenance

| Data | Source | File |
|---|---|---|
| Scrum formations (35 locations × attacking/defending) | rugbytacticsboard.com app bundle, "Standard Scrum Setups" table, copied verbatim. Forwards and opposition are used as-is; our six backs are regenerated by `src/data/scrumBackline.ts` | `src/data/scrumPresets.json` |
| Lineout formations | Port of the site's lineout generator (line order 1-4-5-6-3-7-8, 35 px spacing, back depths). One change: the throwing side's 10 stands 10.3 m back instead of the site's 9.6 m, which was inside the offside line | `src/data/lineoutSetups.ts` |
| Pitch markings | Site SVG line coordinates (1100 × 700 board) | `src/board/constants.ts` |
| 1-3-3-1 phase shape and defence | Written for this project from common modern practice | `src/data/phaseFormation.ts` |
| Plays | Team call names; each modelled on the common coached version of the move (crash ball, miss-12 unders, switch, Rangy, decoy out-the-back, blind winger strike) | `src/data/plays.ts` |
| Defence systems | Written for this project from the common coached versions; Rugby Slate's defending series (drift, blitz, pendulum, shooter, dog-legs, scrum-half role, defending by pitch section) used as the reference | `src/data/defenceSystems.ts`, `src/engine/defenceSim.ts` |

The site's board is not drawn to scale (about 15.4 px/m across, 11.5 px/m along), so metre readouts are approximate and interpolated from the drawn lines. The site's own lineout generator places defending backs a touch inside the 10 m line; it is reproduced as-is so the presets match.

## Project layout

```
src/board/        board size, pitch geometry, metre helpers, types
src/data/         scrum presets, lineout generator, phase builder, plays
src/engine/       route interpolation, ball ownership, scripted defence, JSON export
src/components/   Pitch, Board (SVG + drag, portrait rotation), BoardOverlay (video controls), Gate, FeedbackWidget, Formations / Plays / Defence tabs, controls
src/engine/validatePlays.test.ts   vitest checks on every play
src/engine/defenceSim.test.ts      vitest checks on every defence scenario
src/hooks/        playback (rAF), localStorage, media query
src/feedback/     page context attached to feedback messages
server/           Express API + SQLite store (serves dist/ in production)
scripts/          feedback CLI
```
