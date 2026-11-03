# Analysis tab — Severn River match clips

**Date:** 2026-11-02
**Status:** approved design, pending implementation plan

A fourth tab holding match analysis. The first (and for now only) match is Severn
River: 21 clips from the full tape, each autoplaying on a loop, each with its own
comment thread. Commenters get a throwaway rugby nickname instead of an account.

## Source material

21 `.mov` screen recordings of the YouTube tape, 536 MB total, H.264, 7.6–51.7 s
each. The recordings are cropped browser windows, so dimensions vary (1034×500,
1294×596, 1298×…) and all are wider than 16:9 — the top and bottom of the tape
frame are cut off.

Full tape: `https://www.youtube.com/watch?v=xvro8lXdez8`
"Frederick Rugby @ Severn River Rugby Full Game Fall 2026", 5541 s (92:21), 1920×1080.

## Where files live

```
footage/severn/*.mov          21 originals, moved from ~/Desktop, gitignored
public/clips/severn/*.mp4     web encodes, committed
public/clips/severn/*.jpg     poster frames, committed
scripts/encode-clips.mjs      .mov -> mp4 + poster, idempotent
scripts/locate-clips.mjs      frame-match clips against the tape (one-off, see Ordering)
src/data/severnClips.ts       generated manifest, hand-edited titles
```

`/footage/` is added to `.gitignore` alongside the existing `/data/` entry.

### Encoding

H.264, `-crf 26`, `-preset slow`, capped at 960 px wide via `scale='min(960,iw)':-2`
(the `-2` keeps the height even, which the odd source dimensions require).
`-an` strips audio: autoplay requires muted playback anyway, and it roughly halves
the file. `-movflags +faststart` so playback can begin before the file finishes
arriving.

Measured on `severn pods hit gaps` (32.5 s, 36.7 MB source): **2.90 MB** at crf 26,
1.56 MB at crf 30. The 21 clips total 491 s, so expect **~44 MB** committed. crf 30
would halve that but visibly softens the grass, which is where the player detail is.

A poster frame is captured at 0.5 s as a 960 px JPEG, quality 6.

The script skips any clip whose `.mp4` is newer than its `.mov`, so re-runs are cheap.

## Ordering

The requirement is chronological order. Neither signal in the clips covers it:

| Signal | Clips covered |
|---|---|
| Burned-in camera wall clock (`14:05:44` etc.) | 4 |
| YouTube scrubber fill fraction | 13 |
| Neither | 4 |

The two groups do not overlap, so there is no clip carrying both signals and no way
to merge the two scales from the footage alone.

Resolution: locate each clip in the tape by frame matching. Download the tape at low
resolution, fingerprint it about once per second, fingerprint each clip's opening
frames, and find the best match. This yields an exact tape offset for all 21 clips,
which gives both the sort order and a per-clip deep link (`&t=<seconds>s`) into the
full tape.

Matching must tolerate the crop: clips are wider than 16:9 because the recordings cut
the tape frame vertically. The fingerprint is therefore computed on a horizontal band
of the frame rather than the whole frame, and the clip's band offset is searched over
a small range of vertical crops.

The resulting offsets are written into `src/data/severnClips.ts`. If a clip cannot be
matched confidently, its offset is recorded as `null` and it sorts to the end of the
list — the section still works, it is just that one clip's position that is unknown.

## Components

### `AnalysisTab`

A fourth entry in `TABS` in `src/App.tsx`, after Defence, using a new `IconFilm` in
`src/components/icons.tsx`.

The tab renders a match header — opponent, date, and a "Watch the full tape" link —
followed by the clip list. The data shape allows more than one
match; with only Severn present, the tab opens directly on it rather than showing a
one-item picker.

### `ClipCard`

Title, then video, then comments.

The video element is `autoPlay loop muted playsInline preload="metadata"` with a
poster. Twenty-one simultaneously decoding videos would overwhelm a phone, so an
`IntersectionObserver` plays only the clips intersecting the viewport and pauses the
rest. The observed behaviour is still "they all autoplay and loop", but at most one
or two decode at a time.

Each card shows its tape timestamp as a link into the full tape at that second.

Under `prefers-reduced-motion: reduce`, autoplay is suppressed and the clips show
their poster with a visible play control. The stylesheet already has a
reduced-motion block to extend.

### `ClipComments`

Per-clip thread, newest last. Each comment is nickname, relative time, body.

The composer is a textarea and a Post button. No name field — the nickname is
assigned automatically and shown above the box as "posting as Offside Barry" with a
small reroll control.

### `nickname.ts`

`adjective + rugby noun` drawn from two short word lists, e.g. *Offside Barry*,
*Scrum-Cap Gandalf*, *Ruck Goblin Terry*. Stored in `sessionStorage` under
`frederick.analysis-nickname`, so it survives navigation within the tab and resets
when the browser session ends. `rerollNickname()` replaces it.

The lists are sized so collisions within a squad-sized group are unlikely but
possible; collisions are harmless since the nickname is decorative, not an identity.

## Comments storage

Comments live in Turso (hosted libSQL), so they are genuinely shared: everyone who
opens the site sees the same thread. This is a change from the local-SQLite feedback
store, and it is what makes comments work on the Vercel deploy.

Database: `libsql://ruggers-rarest.aws-us-east-2.turso.io` (verified reachable,
SQLite 3.47.0).

### Schema

```sql
CREATE TABLE IF NOT EXISTS clip_comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  clip_id    TEXT    NOT NULL,
  nickname   TEXT    NOT NULL,
  body       TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  user_agent TEXT,
  hidden     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS clip_comments_clip ON clip_comments (clip_id, id);
```

Applied by `scripts/migrate-turso.mjs`, which is idempotent.

### Access

No new dependency. `@libsql/client` pulls in a native binding (`libsql`) that is
awkward on Vercel, and Turso's HTTP API is a single `POST /v2/pipeline` with a bearer
token — already verified working against this database. So `server/turso.mjs` is a
~40-line `fetch` wrapper exposing `query(sql, args)`, which runs unchanged on Node 22
and on Vercel.

On top of it, `server/comments.mjs` exposes `listComments(clipId)` and
`addComment(row)`. It is imported by both runtimes, so the query lives in exactly one
place:

- **Express** (`npm start`, local dev) — mounts the routes on the existing app.
- **Vercel serverless** — `api/comments.js`, which Vercel picks up automatically.
  This is new: the project currently deploys as pure static with no functions.

Routes, identical under both:

- `GET  /api/comments?clip=<clipId>` — oldest first, limit 200, excludes hidden
- `POST /api/comments` — `{ clip, nickname, body }`, returns the stored row

`POST` caps the body at 2000 characters and the nickname at 60, and validates `clip`
against `^[a-z0-9][a-z0-9-]{0,63}$` so the table cannot be used as open storage. The
existing per-IP throttle (10 per 10 minutes) moves into a small shared helper so both
runtimes enforce it; on Vercel it is per-instance and therefore best-effort, which is
acceptable for a club site.

### Credentials

`TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` come from the environment. They are added
to `.env.example` as empty placeholders, and the real values go in a local `.env`
(already gitignored) and in the Vercel project's environment variables. **The token is
never committed.**

The auth token is a full read-write credential. It was pasted into this chat, so it
should be rotated in the Turso dashboard once setup is done.

### Degradation

If the API is unreachable the component falls back to a localStorage store under
`frederick.analysis-comments.<clipId>` and shows a quiet line: "Saved on this device
only." Both paths go through one `commentStore` module exposing `list(clipId)` and
`add(clipId, comment)`, so the component does not branch on transport. This keeps the
site usable if Turso is down or the env vars are missing.

## Titles

Filenames become the titles, sentence-cased with light grammar and spelling fixes,
keeping the original voice. They are stored in the manifest and hand-editable.

| File | Title |
|---|---|
| `backline not drawing defenders` | Backline not drawing defenders |
| `backline not setup on correct side, 10 switches, gets sacked by their aggresive defense` | Backline set up on the wrong side — 10 switches and gets sacked by their aggressive defence |
| `fly half kicks` | Fly half kicks |
| `no backline, not using space, strong defensive pressure` | No backline, no use of space, under strong defensive pressure |
| `overload backline on set piece, attack inside gaps` | Overload the backline at the set piece and attack the inside gaps |
| `pods ex 1` | Pods, example 1 |
| `scrum half kicks` | Scrum half kicks |
| `scrum half pick and go` | Scrum half pick and go |
| `severn attacks with scrum half, then swing to other side quickly for a 2 phase try` | Severn attack with the scrum half, then swing wide for a two-phase try |
| `severn blitz on def` | Severn blitz on defence |
| `severn defense shuts down our attacks completely. turnover, kick over head, return it, and then they counter` | Severn's defence shuts our attack down completely — turnover, kick over the top, return, and they counter |
| `severn gets ball out wide for try quicky` | Severn get the ball wide quickly for a try |
| `severn kicks again, into touch` | Severn kick again, into touch |
| `severn kicks over defense again` | Severn kick over the defence again |
| `severn kicks over us` | Severn kick over us |
| `severn kicks` | Severn kick |
| `severn pods hit gaps` | Severn pods hit the gaps |
| `severn scores on empty space` | Severn score into empty space |
| `severn strong defensive attack, we pass too late` | Severn's strong defensive press — we pass too late |
| `very strong severn attacking play with wing/fullback` | Very strong Severn attacking play with the wing and fullback |
| `we lose posession at try line` | We lose possession at the try line |

## Styling

Follows the existing dark palette and mobile-first stylesheet: base rules are the
phone layout, with the single `min-width: 821px` block adding the wider view. Clip
cards use the existing `--card` / `--line` / `--r-lg` tokens and the established
`.panel`, `.eyebrow`, `.field`, `.btn` classes rather than new primitives.

On a phone the clip list is a single column with full-bleed video. On desktop it
stays a single readable column rather than a grid — these are for watching, not
browsing, and a grid would shrink them below useful size.

## Testing

`npm test` (vitest) gains:

- **Manifest** — every clip's `mp4` and `poster` exist in `public/`; ids are unique;
  entries are sorted by tape offset with `null` offsets last; every title is non-empty
  and starts with a capital.
- **Nickname** — generated names match `adjective noun` shape, are drawn from the
  lists, and `rerollNickname()` returns a different value; the session value is stable
  across repeated reads.
- **Comment store** — the localStorage fallback round-trips a comment, isolates by
  clip id, and survives a corrupt stored value without throwing.
- **Validation** — `clip` ids outside `^[a-z0-9][a-z0-9-]{0,63}$` are rejected, and
  over-long bodies and nicknames are truncated rather than stored whole. These run
  against the pure validation helpers, with no network involved, so `npm test` stays
  offline and does not touch Turso.

The existing play-validation tests are untouched.

## Out of scope

- Moderation UI. The `hidden` column exists; flipping it is a SQL or CLI job, matching
  how feedback resolution already works.
- Editing or deleting a posted comment.
- More matches. The data shape allows them; only Severn has clips.
- Per-clip tagging or filtering.
