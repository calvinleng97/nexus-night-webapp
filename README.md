# nexus-night-webapp

Web app for organizing Nexus Nights: Swiss-paired events for a friend group, with
results confirmed by both players and every game kept on disk for statistics later.

Next.js 16 · Google sign-in · plain JSON/JSONL files as the database.

---

## How it works

**Leagues** are standing groups of players. Any signed-in user can see and join any
league. League managers can create **events**. An event is one night: players join
while it's in `draft`, a manager starts it, and the app pairs **3 rounds** of Swiss
(configurable per event).

Each match is a best-of-three. One player submits the score, the opponent confirms
it, and once every match in the round is confirmed the next round is paired
automatically and everyone sees their new opponent. Managers can override any
result, drop a player, or force a round closed.

**Standings are records only.** Equal records share a rank and no champion is
crowned — but every game score is stored, so tiebreakers like opponent match-win %
stay computable from the data afterwards.

---

## Pairing: what it does and why

Pairing is a **minimum-cost perfect matching**, not the usual greedy walk down the
standings. This matters. The greedy approach — "pair each player with the first
opponent they haven't faced" — provably strands itself:

> 6 players, round 3, standings `[p0,p4,p2,p3,p1,p5]`, prior games
> `p0-p1, p0-p2, p1-p4, p2-p3, p3-p5, p4-p5`. Greedy reaches the last two players
> and finds they've already played — **even though a rematch-free pairing of that
> exact field exists**. The same failure occurs at n = 5, 7, 8 and 10.

That case is pinned as a regression test in `tests/pairing.test.ts`.

Constraints are **lexicographic, not weighted**. Rather than hand-tuned penalty
numbers that can silently trade one constraint for another, the scale of each
term is derived from the field so a higher-priority term can never be outbid by
any accumulation of lower-priority ones:

| Priority | Ordering |
|---|---|
| `record` (default) | second bye ≫ **record gap** ≫ rematches ≫ bye position |
| `avoid-rematch` | second bye ≫ **rematches** ≫ record gap ≫ bye position |

**The default is strict record-pairing.** Players on equal match points are
matched whenever group sizes allow, *accepting a rematch when that is what
keeping records together requires*. A second bye outranks everything in both
modes, and is always avoidable for n ≥ 3. Because costs are soft below that, a
pairing always exists and the engine can never deadlock.

Switch with `pairing.priority` in `nexus.config.json`.

### Verified behaviour

`npm run simulate` runs whole events through the real engine and reports anything
degenerate. Exhaustively checked across win/loss paths for n = 3–8 under both
policies, plus randomized trials to n = 64:

- **n = 1** — vacuous: three byes and an undefeated record. Blocked.
- **n = 2** — rounds 2 and 3 *must* be rematches under either policy; there is no
  other legal pairing. Allowed, with a warning at start time.
- **n ≥ 3** — no second byes, nobody ever left unpaired.
- **Rematches cost nothing from n = 7 up.** The two policies produce measurably
  different pairings only in small fields; from 7 players on, strict
  record-pairing needed zero rematches across every seed tested.

  | n | 2 | 3 | 4 | 5 | 6 | ≥ 7 |
  |---|---|---|---|---|---|---|
  | rematches, `record` | forced | 0 | ~1 per event | rare | rare | **0** |
  | rematches, `avoid-rematch` | forced | 0 | 0 | 0 | 0 | 0 |

  At n = 4 three rounds is a full round-robin, so round 3 generally has to
  replay the two players sharing the middle record. That is the price of strict
  record-pairing, and it is only ever charged in tiny fields.

- **Undefeated players after 3 rounds** ≈ ⌈n/8⌉:

  | n | 3–6 | 7–8 | 9 | 10 | 11–14 | 15–16 | 24 | 32 | 64 |
  |---|---|---|---|---|---|---|---|---|---|
  | finishing 3-0 | 0–2 | 1 | 2 | 1–2 | 1–2 | 2 | 3 | 4 | 8 |

  At n = 4 three rounds is a round-robin, so a rock-paper-scissors cycle can
  leave **nobody** undefeated. Past n = 8 co-leaders are normal — fine here,
  since no winner is crowned. Odd fields tend to produce more co-leaders than
  even ones: the odd player in the top record group pairs *down* against weaker
  opposition, exactly as at a real store.

## Local development

```bash
npm install
cp nexus.config.example.json nexus.config.json   # edit dataDir
cp .env.example .env.local                       # add Google credentials
npm run dev
```

For Google sign-in locally, add `http://localhost:3000/api/auth/callback/google`
as an authorized redirect URI on your OAuth client. `localhost` is the one host
Google accepts without a domain.

```bash
npm test          # 64 tests: pairing, event lifecycle, storage
npm run typecheck
npm run simulate  # pairing probe across field sizes
npm run simulate -- 2-64 --trials=200
npm run simulate -- 2-16 --priority=avoid-rematch   # compare policies
npx tsx scripts/stats.ts   # example stats read over the data directory
```

---

## Deploying to your own box

### 1. A hostname

Google OAuth rejects bare IP addresses as redirect URIs, so the box needs a name.
A free [DuckDNS](https://www.duckdns.org) subdomain pointing at your server's IP
works. Verify before continuing:

```bash
dig +short nexusnight.duckdns.org    # should print your server's IP
```

### 2. Google OAuth client

In [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials),
create an **OAuth client ID** of type **Web application** with these authorized
redirect URIs:

```
https://nexusnight.duckdns.org/api/auth/callback/google
http://localhost:3000/api/auth/callback/google
```

On the OAuth consent screen, keep the app in **Testing** mode and add your friends'
Google addresses as test users — up to 100, no verification review needed. Users
who aren't on that list cannot sign in.

### 3. App and data

```bash
sudo useradd -r -m -d /srv/nexus-night nexus
sudo mkdir -p /srv/nexus-night/{app,data} /etc/nexus-night
sudo chown -R nexus:nexus /srv/nexus-night

sudo -u nexus git clone https://github.com/calvinleng97/nexus-night-webapp /srv/nexus-night/app
cd /srv/nexus-night/app
sudo -u nexus npm ci
sudo -u nexus npm run build
```

Config at `/etc/nexus-night/config.json`:

```json
{
  "dataDir": "/srv/nexus-night/data",
  "site": { "name": "Nexus Night", "url": "https://nexusnight.duckdns.org" },
  "event": { "defaultRounds": 3 },
  "pairing": { "priority": "record" },
  "league": { "openJoin": true }
}
```

Secrets at `/etc/nexus-night/env` (`chmod 600`, owned by `nexus`):

```
AUTH_SECRET=...                      # openssl rand -base64 32
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
AUTH_URL=https://nexusnight.duckdns.org
AUTH_TRUST_HOST=true
```

`AUTH_TRUST_HOST=true` is required when running behind a reverse proxy.

### 4. Service and TLS

```bash
sudo cp deploy/nexus-night.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now nexus-night
journalctl -u nexus-night -f

sudo apt install caddy
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile   # edit the hostname first
sudo systemctl reload caddy
```

Caddy obtains a Let's Encrypt certificate on first start. Ports 80 and 443 must be
reachable.

---

## The data directory

Point `dataDir` at any directory; the app writes nowhere else. A test asserts that.

```
<dataDir>/
  meta.json                        schema version stamp
  users/<userId>.json              one file per player
  leagues/<leagueId>.json          members, managers
  events/<eventId>.json            players, rounds, pairings, results — current state
  events/<eventId>/matches.jsonl   append-only history of that event
  log/audit.jsonl                  append-only trail across everything
  .locks/                          transient advisory lock files
```

Writes go to a temp file then `rename(2)`, which is atomic, so a reader never sees
a half-written document. Mutations take an advisory lock first, because two players
may submit at the same moment — there's a test for exactly that race.

**User ids** are `u_` + a SHA-256 prefix of the Google `sub` claim, so a player's
id survives changing their name or email.

### Reading it for stats

`events/<id>.json` holds the final state of every round and match. For a career
view across events, `scripts/stats.ts` is a worked example. Or stay outside the
app entirely:

```bash
# every confirmed result ever recorded, as JSON lines
cat <dataDir>/events/*/matches.jsonl | jq -c 'select(.action=="result_confirmed")'
```

```python
import json, pathlib
events = [json.loads(p.read_text()) for p in pathlib.Path(data_dir, "events").glob("*.json")]
rows = [
    {"event": e["name"], "round": r["number"], "a": m["a"], "b": m["b"],
     "ga": (m["report"] or {}).get("score", {}).get("a"),
     "gb": (m["report"] or {}).get("score", {}).get("b")}
    for e in events for r in e["rounds"] for m in r["pairings"]
]
```

Back it up by copying the directory, or `git init` inside it — the JSON is
formatted and diffs cleanly.

---

## Configuration reference

| Key | Default | Meaning |
|---|---|---|
| `dataDir` | `./data` | Directory used as the database |
| `site.name` | `Nexus Night` | Shown in the header |
| `site.url` | `http://localhost:3000` | Public origin; must match the OAuth redirect origin |
| `event.defaultRounds` | `3` | Swiss rounds for new events |
| `pairing.priority` | `record` | `record` = pair strictly within records, replaying a pairing if needed. `avoid-rematch` = never repeat a pairing, mismatching records instead |
| `league.openJoin` | `true` | Any signed-in user may join any league |

Env overrides: `NEXUS_CONFIG` (config file path), `NEXUS_DATA_DIR`, `NEXUS_SITE_URL`.

---

## Layout

```
src/lib/domain/pairing.ts         matching solver — the interesting part
src/lib/domain/event-machine.ts   start, report, confirm, dispute, drop, advance
src/lib/domain/standings.ts       records from confirmed results
src/lib/store/                    JSON/JSONL persistence, locking, atomic writes
src/lib/config.ts                 config file + env loading
src/lib/auth.ts                   Auth.js with Google
src/app/                          pages and server actions
tests/                            pairing, event lifecycle, storage
scripts/simulate.ts               pairing probe
scripts/stats.ts                  example stats reader
deploy/                           Caddyfile, systemd unit
```
