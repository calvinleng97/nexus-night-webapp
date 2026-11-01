# nexus-night-webapp

Web app for organizing Nexus Nights: Swiss-paired events for a friend group, with
results confirmed by both players and every game kept on disk for statistics later.

Next.js 16 · Google sign-in · plain JSON/JSONL files as the database.

---

## How it works

**Leagues** are standing groups of players, joined with a **join code**. Every
league gets a random 6-character code on creation (upper case, with I/L/O/0/1
left out so it cannot be mistyped), shown at the top of the league page. A
manager can issue a new one at any time, which invalidates the old immediately.
Leagues you are not in are not listed anywhere — the code is the only way in,
and a league's link alone is not an invitation. League managers can create **events**. An event is one night: players join
while it's in `draft`, a manager starts it, and the app pairs **3 rounds** of Swiss
(configurable per event).

Each match is a best-of-three. One player submits the score, the opponent confirms
it, and **once the last match in a round is confirmed the next round is paired in
that same action** — nobody has to start a round. The confirming player's own
request is what generates the pairings, so every player sees their new opponent
on their next page load.

Managers never need to intervene in the normal flow. They can override a result,
resolve a dispute, drop a player, force a round closed when a match will not be
played, and remove someone from the league.

Removing a player from a league does not touch events: dropping them mid-event
forfeits their current match, which is too large a side effect to trigger
implicitly, so the manager is warned to do that separately if they want it.

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
npm test          # 88 tests: pairing, event lifecycle, storage, Elo, migrations
npm run typecheck
npm run simulate  # pairing probe across field sizes
npm run simulate -- 2-64 --trials=200
npm run simulate -- 2-16 --priority=avoid-rematch   # compare policies
npx tsx scripts/stats.ts          # example stats read over the data directory
npx tsx scripts/demo.ts 7         # play a full night and print every step
npx tsx scripts/seed-history.ts   # seed finished events so History/Elo have data
npx tsx scripts/seed-history.ts --events=5 --players=10 --skill=-1
npx tsx scripts/live-event.ts     # park an event mid-round to inspect player views
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

Publishing the consent screen (so friends do not need to be on a test-user
list) asks for a logo and three links. `public/logo-120.png` is the logo, and
the app serves the pages:

```
Application home page          https://YOUR-HOST/
Application privacy policy     https://YOUR-HOST/privacy
Application terms of service   https://YOUR-HOST/terms
Authorized domain              YOUR-HOST
```

Set `site.contactEmail` in the config first if you want your address on those
pages; left blank they tell readers to contact whoever invited them.


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

The service runs as `nexus`, so it must be able to traverse its own config
directory. Owning the directory by `root:nexus` is what makes that work —
`750 root:root` leaves the service unable to see the file at all, and the app
reports the config as missing rather than unreadable:

```bash
sudo chown root:nexus /etc/nexus-night
sudo chmod 750 /etc/nexus-night
```

Config at `/etc/nexus-night/config.json` (`chown root:nexus`, `chmod 640`):

```json
{
  "dataDir": "/srv/nexus-night/data",
  "site": { "name": "Nexus Night", "url": "https://nexusnight.duckdns.org" },
  "event": { "defaultRounds": 3 },
  "pairing": { "priority": "record" },
  "league": { "openJoin": true }
}
```

Secrets at `/etc/nexus-night/env` (`chown root:nexus`, `chmod 640`):

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

Caddy obtains a Let's Encrypt certificate on first start. Ports 80 and 443 must
be reachable — on a stock Ubuntu box `ufw` is active and allows only SSH, so
open them first or certificate issuance will silently never complete:

```bash
sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
```

---

## Deploying on push

Two options ship in `deploy/`. Both run the same `deploy/deploy.sh`, which is
idempotent, rebuilds, restarts, health-checks, and **rolls back to the previous
commit if the build or the health check fails** — so a bad push cannot leave
the site down.

### Pull-based (default, no credentials anywhere)

A timer on the box checks the branch every minute and deploys it if it moved.
Nothing inbound, no private key in GitHub.

```bash
sudo cp deploy/nexus-deploy.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nexus-deploy.timer
systemctl list-timers nexus-deploy.timer
```

The box needs read access to the repo: add
`/srv/nexus-night/.ssh/id_ed25519.pub` as a **read-only deploy key** under the
repository's Settings → Deploy keys.

### Push-based (GitHub Actions)

`deploy/github-actions-deploy.yml` runs typecheck, tests and a build, then
SSHes in. Copy it to `.github/workflows/deploy.yml` to enable it — adding a
workflow file needs a token with the `workflow` scope, so it does not ship in
place. It
and deploys. It is immediate and gives logs in GitHub, at the cost of holding a
private key as a repository secret. It needs:

- a key whose public half is in the box's `root` `authorized_keys`, ideally
  behind a forced command so the key can only deploy:
  `command="/srv/nexus-night/app/deploy/deploy.sh scaffold-swiss-webapp",no-pty,no-port-forwarding,...`
- repository secrets `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_KNOWN_HOSTS`

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

`meta.json` records the schema version. Migrations are forward-only and run
once at startup: v2 gave every pre-existing league a join code.
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
| `site.contactEmail` | `""` | Shown on /privacy and /terms; blank tells readers to ask whoever invited them |
| `event.defaultRounds` | `3` | Swiss rounds for new events |
| `pairing.priority` | `record` | `record` = pair strictly within records, replaying a pairing if needed. `avoid-rematch` = never repeat a pairing, mismatching records instead |
| `elo.base` | `1200` | Rating every player starts from |
| `elo.k` | `24` | K factor once a player is established |
| `elo.provisionalK` | `40` | K factor while a player is still settling |
| `elo.provisionalGames` | `10` | Rated matches before a player stops being provisional |

Env overrides: `NEXUS_CONFIG` (config file path), `NEXUS_DATA_DIR`, `NEXUS_SITE_URL`.

---

## Layout

```
src/lib/domain/pairing.ts         matching solver — the interesting part
src/lib/domain/event-machine.ts   start, report, confirm, dispute, drop, advance
src/lib/domain/standings.ts       records from confirmed results
src/lib/domain/elo.ts             per-league Elo, derived from results
src/lib/domain/history.ts         one player's match history across events
src/lib/store/                    JSON/JSONL persistence, locking, atomic writes
src/lib/config.ts                 config file + env loading
src/lib/auth.ts                   Auth.js with Google
src/app/                          pages and server actions
tests/                            pairing, event lifecycle, storage
scripts/simulate.ts               pairing probe
scripts/stats.ts                  example stats reader
scripts/demo.ts                   plays a full night end to end
scripts/seed-history.ts           seeds finished events for History and Elo
scripts/live-event.ts             parks an event mid-round for UI inspection
deploy/                           Caddyfile, systemd unit
```
