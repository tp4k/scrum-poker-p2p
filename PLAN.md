# Scrum Poker — backend-free, P2P, GitHub Pages

This is a living ExecPlan: the `Progress`, `Surprises & Discoveries`, `Decision Log`,
and `Outcomes & Retrospective` sections must be kept current as work proceeds.

## Purpose / Big Picture

After this change, a team opens a single shared link (`…/#/room/<slug>?d=<deck>`) on a
GitHub Pages site and estimates tasks together with planning-poker cards — no backend,
no accounts, no ads. Anyone in the room can pick a card, reveal everyone's votes, and
start a new round; the link is permanent, so the same team reuses it forever, and a
"Recent rooms" list on the home screen keeps past links within reach. Under the hood,
sync between participants' browsers happens directly, peer-to-peer, via Trystero over
public Nostr relays — there is no server to run, pay for, or keep alive.

## Workstreams

### WS-A — Scaffold & Infra

Goal: stand up a buildable Svelte 5 + Vite + TypeScript skeleton with every dependency
the whole project will ever need already installed, so no downstream workstream has to
touch `package.json` (avoiding lockfile merge pain across parallel streams). This stream
also owns the hash router in full (it's small and self-contained) and the GitHub Pages
deploy workflow, plus placeholder stubs for everything WS-B/C/D will fill in, so the app
builds and type-checks from commit one.

Files owned: `poker/package.json`, `poker/tsconfig.json`, `poker/vite.config.ts`,
`poker/index.html`, `poker/.github/workflows/deploy.yml`, `poker/src/main.ts`,
`poker/src/App.svelte`, `poker/src/lib/router.ts`, `poker/src/lib/router.test.ts`,
placeholder stubs for `poker/src/lib/deck.ts`, `poker/src/lib/room.ts`,
`poker/src/Home.svelte`, `poker/src/Room.svelte`, `poker/src/Board.svelte`,
`poker/src/CardPicker.svelte`, `poker/src/Diag.svelte` (signatures agreed with WS-B/C/D,
bodies to be filled in by their owning streams).

Dependencies: none — this is the first stream, everything else depends on it.

Complexity: M.

Spec excerpt — "## Структура проекта" (verbatim from the approved plan):

````
## Структура проекта

```
poker/
  index.html  package.json  tsconfig.json  vite.config.ts   # base: './'
  .github/workflows/deploy.yml
  src/
    main.ts                # mount
    App.svelte             # switch по роуту: Home | Room
    lib/router.ts          # hashchange-store, parse/build '#/room/<slug>?d=…'
    lib/deck.ts            # пресеты, encode/decode `d`, isNumericCard(), average()
    lib/room.ts            # ВЕСЬ Trystero-код: createRoom(slug, deck) → stores + vote()/reveal()/newRound()/leave()
    Home.svelte            # выбор колоды, Create → location.hash = ссылка комнаты
    Room.svelte            # промпт имени (localStorage) → join; баннер соединения; lifecycle (onMount join / onDestroy leave)
    Board.svelte            # список участников (галочка/карта), среднее, кнопки Reveal / New Round
    CardPicker.svelte      # кнопки колоды, подсветка выбора
```

Stores в `lib/room.ts`: `peers`, `localVote`, `round`, `revealed`, `connection: 'connecting'|'ready'|'failed'`; derived `average` (только числовые карты), `everyoneVoted`. Слаг: 10 символов `a-z0-9` из `crypto.getRandomValues` (~51 бит).
````

Spec excerpt — "## Деплой" (verbatim from the approved plan):

```
## Деплой

`.github/workflows/deploy.yml`: push в main + workflow_dispatch; `permissions: {contents: read, pages: write, id-token: write}`; checkout@v4 → setup-node@v4 (node 22) → `npm ci` → `npm run build` → configure-pages@v5 → upload-pages-artifact@v3 (`dist`) → deploy-pages@v4. В настройках репо: Pages → Source = GitHub Actions.
```

Observable acceptance:
- `router.test.ts › buildRoomHash + route round-trip` passes:
  - `buildRoomHash('abc123','fib')` → `'#/room/abc123?d=fib'`
  - hash `'#/room/abc123?d=fib'` → route `{name:'room', slug:'abc123', deck:'fib'}`
  - `'#/diag'` → `{name:'diag'}`
  - empty hash → `{name:'home'}`
  - `newSlug()` matches `^[a-z0-9]{10}$`
- `npm run build`, `npm run check`, and `npm run test` all exit 0.

### WS-B — Deck logic

Goal: implement the real deck module — presets, URL encoding of the chosen deck, and
the numeric-card / average helpers other streams (UI, room protocol) build on. Pure,
framework-free logic, fully unit-tested; display formatting (1 decimal place, "–" for
no data) is explicitly out of scope here and belongs to WS-D.

Files owned: `poker/src/lib/deck.ts`, `poker/src/lib/deck.test.ts`.

Dependencies: WS-A (scaffold, TS/Vitest config, stub signatures).

Complexity: S–M.

Spec excerpt — "Колода" bullet from "## Решения" (verbatim):

```
- **Колода**: выбирается при создании (Fibonacci / T-shirt / свой список через запятую), фиксируется и кодируется в URL. Trystero roomId = `${slug}:${d}` — клиенты с разными колодами физически не соединятся.
```

Spec excerpt — average bullet from "## Edge cases v1" (verbatim):

```
- Среднее — только `Number.isFinite(parseFloat(card))`, иначе «–», 1 знак после запятой.
```

Observable acceptance (`deck.test.ts`):
- `decodeDeck(encodeDeck(cards))` deep-equals `cards` for fib, tshirt, and a custom deck (round-trip via the URL `d` param).
- `isNumericCard` is `true` for `'0'`, `'1'`, `'5'`, `'13'`; `false` for `'?'`, `'☕'`, `'XL'`.
- `average(['5','8','?','☕']) === 6.5`.
- `average(['XS','M']) === null`.

### WS-C — Room protocol

Goal: implement the entire Trystero P2P layer — join/leave, per-peer state broadcast,
the authority-free merge protocol, and the Svelte stores everything else reads from —
plus the diagnostics exports the in-app `#/diag` route needs. The merge function itself
is extracted as a pure, dependency-free function so the tricky ordering logic (rounds,
reveal OR-merge, stale votes) can be unit-tested without any WebRTC involved.

Files owned: `poker/src/lib/room.ts`, `poker/src/lib/room.test.ts`.

Dependencies: WS-A (scaffold, stub signatures). Runs in parallel with WS-B — both only
depend on WS-A, not on each other.

Complexity: L.

Spec excerpt — "## Проверенные факты Trystero v0.25.3 (не изобретать старый API!)" (verbatim, in full):

```
## Проверенные факты Trystero v0.25.3 (не изобретать старый API!)

- `makeAction` возвращает **объект**: `const state = room.makeAction<T>('state'); state.send(data, {target}); state.onMessage = (data, {peerId}) => …` (не кортеж).
- События — присваиваемые свойства: `room.onPeerJoin = cb`; уже подключённые пиры **реплеятся** новому обработчику (нет гонки при подписке).
- `joinRoom(config, roomId, {onJoinError})` — `onJoinError` ловит «SDP прошёл, WebRTC не соединился» → хук для баннера «connection failed».
- Стратегии в одной комнате **не комбинируются**; запасная — смена импорта на `@trystero-p2p/mqtt`. Надёжность внутри Nostr — `relayConfig.redundancy`.
- `getRelaySockets()` — карта URL→WebSocket, по `readyState` рисуем индикатор «connecting…».
- Если VPN↔дом не соединяется — добавить `turnConfig` с бесплатным Open Relay (metered.ca). Это главный риск проекта, спайк его измеряет.
```

Spec excerpt — "## Протокол синхронизации (без авторитета, без CRDT)" (verbatim, in full):

````
## Протокол синхронизации (без авторитета, без CRDT)

Одно действие `state`: каждый пир — единственный владелец своей записи, при любом изменении шлёт полный self-state:

```ts
type PeerState = { name: string; vote: string | null; round: number; revealed: boolean }
```

Мерж при получении (всё идемпотентно):
- `peers[P] = {name, vote}` (голос учитывается только при `msg.round === localRound`);
- `msg.round > localRound` → принять: новый раунд, `localVote = null`, `revealed = msg.revealed`;
- `msg.round === localRound` → `revealed ||= msg.revealed` (OR-мерж);
- `msg.round < localRound` → игнорировать голос, отправить своё состояние отстающему.

Действия пользователя = локальная мутация + broadcast: Vote (менять до reveal можно), Reveal (`revealed = true`), New Round (`round++`). **Поздний вход**: снапшот-протокол не нужен — на `onPeerJoin` каждый пир шлёт своё состояние новичку адресно (`{target}`), мерж восстанавливает `{round, revealed}`. **Дисконнект**: `onPeerLeave` → удалить из списка. Приватность голосов до reveal — только на уровне UI (devtools-подглядывание принимаем, commit-reveal не делаем).
````

Observable acceptance (`room.test.ts › applyRemoteState`):
- Same-round merge records the peer's vote and OR-merges `revealed` (`revealed ||= msg.revealed`).
- A higher incoming round is adopted: local round advances, `localVote` clears.
- A lower incoming round is ignored for voting purposes and flags that state should be re-sent to the stale peer.
- Applying the same message twice is idempotent (no duplicate/changed state on replay).
- Non-numeric votes (e.g. `'?'`, `'☕'`) don't break the merge.

### WS-D — UI

Goal: build the five Svelte components end users actually see — deck picker and Recent
rooms on Home, the join lifecycle and connection banner on Room, the participant board
with reveal/average/new-round, the card picker, and an in-app `#/diag` route. `Diag`
is the connectivity-spike page from the approved plan, adapted to live permanently in
the app rather than as a throwaway page, since the user still needs to run the real
home↔VPN network matrix after every deploy. All UI copy is in English.

Files owned: `poker/src/Home.svelte`, `poker/src/Room.svelte`, `poker/src/Board.svelte`,
`poker/src/CardPicker.svelte`, `poker/src/Diag.svelte`, plus their `*.test.ts` files
(`poker/src/Board.test.ts`, `poker/src/CardPicker.test.ts`).

Dependencies: WS-A (scaffold/stubs), WS-B (deck helpers), WS-C (room stores/actions).

Complexity: M–L.

Spec excerpt — component list from "## Структура проекта" (verbatim):

```
    Home.svelte            # выбор колоды, Create → location.hash = ссылка комнаты
    Room.svelte            # промпт имени (localStorage) → join; баннер соединения; lifecycle (onMount join / onDestroy leave)
    Board.svelte            # список участников (галочка/карта), среднее, кнопки Reveal / New Round
    CardPicker.svelte      # кнопки колоды, подсветка выбора
```

Spec excerpt — "Постоянные ссылки комнат" bullet from "## Решения" (verbatim):

```
- **Постоянные ссылки комнат**: команда сохраняет одну ссылку и переиспользует её всегда. Архитектура это даёт бесплатно — комната = слаг в URL, повторный заход по той же ссылке воссоздаёт комнату (состояние эфемерно, ссылка вечна). Дополнительно: на Home — список «Recent rooms» из localStorage (слаг + колода + дата захода), чтобы ссылку не терять.
```

Spec excerpt — "## Edge cases v1" (verbatim, in full):

```
## Edge cases v1

- Дубли имён — разрешены (peerId различает), своя строка помечена «(you)».
- Refresh вкладки — новый пир, «призрак» висит секунды до `onPeerLeave`; имя из localStorage, раунд/reveal восстанавливаются от пиров.
- Reveal при нуле голосов — кнопка disabled.
- Среднее — только `Number.isFinite(parseFloat(card))`, иначе «–», 1 знак после запятой.
```

Observable acceptance:
- `Board.test.ts › Reveal disabled at zero votes` passes.
- `Board.test.ts › average formatting` passes (1 decimal place when numeric, `"–"` otherwise).
- `CardPicker.test.ts › selection highlight + vote callback` passes.

## Progress

- [x] WS-A: git init + Svelte 5/Vite/TS scaffold, all deps pre-installed, router.ts implemented, stub signatures, deploy.yml (2026-07-20, commits 01f7aac/4bf8055/4efd1b1)
- [x] Plan validation (this PLAN.md reviewed against the approved spec before implementation starts) (2026-07-20, verdict PLAN_NEEDS_FIX, 3 MAJOR findings, briefs patched)
- [x] WS-B: deck.ts + deck.test.ts implemented and green (2026-07-20, 6 commits, 8 tests)
- [x] WS-C: room.ts + room.test.ts implemented and green (applyRemoteState + Trystero layer + stores) (2026-07-20, 2 commits, 8 tests; suite 18/18 green)
- [x] WS-D: Home/Room/Board/CardPicker/Diag.svelte implemented, Board.test.ts + CardPicker.test.ts green (2026-07-20, 11 commits, suite 23/23 at the time)
- [x] Code review round (via `/teamlead`, all review agents on by default) (2026-07-20, round 1: code-review NEEDS_REWORK 5 findings, perf APPROVED_WITH_NOTES 2 findings, security NEEDS_REWORK 3 findings)
- [x] Security review round (2026-07-20, round 1: NEEDS_REWORK, 3 findings — see above)
- [x] Performance review round (2026-07-20, round 1: APPROVED_WITH_NOTES, 2 findings — see above)
- [x] Rework rounds 1+2 (2026-07-20, commits 8826707..44d08e3, all 10 findings from round-1 reviews fixed, 30/30 tests)
- [x] Verification code review (2026-07-20, APPROVED_WITH_NOTES)
- [x] Browser testing via cmux (teamlead phase): multi-tab scenario — vote / change vote / reveal from another tab / new round from a third / tab close / refresh mid-round / late join after reveal (2026-07-20, WORKS_WITH_ISSUES — full E2E two-window P2P sync verified over public Nostr relays: vote/reveal/average/new-round propagated correctly)
- [x] Rework round 3: QA findings — stuck "Connection failed" banner, ghost-peer pruning, recent-rooms label (2026-07-20, commits a88b606, 89ae969; 39/39 tests; verification code-review APPROVED)
- [x] Focused browser re-test of connection fixes — ENV-BLOCKED (sandbox blocked WebRTC ICE this session; fixes verified via pure-function unit tests + code inspection) (2026-07-20)
- [x] User post-deploy step: create GitHub repo (public, personal) and push (2026-07-20, github.com/tp4k/scrum-poker-p2p, single squashed commit 8f4027d; full history preserved in local branch dev-history)
- [x] User post-deploy step: enable Pages → Source = GitHub Actions in repo settings (2026-07-20, deploy workflow succeeded after one re-run — first run raced the Pages enablement; live at https://tp4k.github.io/scrum-poker-p2p/, HTTP 200, built app verified)
- [ ] User post-deploy step: run `#/diag` network matrix (home↔home, home↔VPN, VPN↔VPN) from real networks, both directions
- [x] Redesign round (user request: more whitespace, AA accessibility): design tokens src/app.css + playing-card UI, commits 395a0ba/f46aa8c/f6e2119/508f6c9 — code+security+perf reviews all APPROVED; cmux visual QA LOOKS_GOOD (2026-07-20)
- [x] Redesign polish: font-size compounding fix + recent-rooms label truncation, commits 86c7e0b/1cecafe; suite 39/39 (2026-07-20)
- [x] Bugfix round (user reports): stale checkmarks after New Round (protocol leak, clearPeerVotes in applyRemoteState higher-round branch + newRound, commits 749f206/53100d0), row-height jump on vote (fixed indicator tokens + row min-height, bc90a11), "(you)" label → self-row accent highlight (58dd533, + 879f9fe border alignment); reviews code/security/perf APPROVED; cmux two-window P2P verification PASS (real Nostr peering, both New Round paths, 66px stable row, 0px name offset); suite 46/46 (2026-07-20)
- [x] Card-overflow fix round (user screenshot: labels '0.1'/'0.2' touching mini-card border): width-by-content + length-based font tiers on CardPicker and Board indicators, shared labelSizeClass in deck.ts (code-point length), commits 04e0559/f43f99c/fbdf6f7/83cacbf/61ae9d7; reviews code/security/perf clean; cmux QA PASS (gaps ≥8.5px, row 66px stable); suite 53/53 (2026-07-20)

## Surprises & Discoveries

- **2026-07-20** — Observation: typescript@7 (native-port rewrite) breaks svelte-check@4.7.3 at runtime (TypeError reading 'useCaseSensitiveFileNames' on ts.sys); pinned typescript ^6.0.3. Evidence: WS-A fresh-install run; npm run check crashes under TS7, passes 0/0 under 6.0.3.
- **2026-07-20** — Observation: Trystero's makeAction generic constrains payloads to JsonValue, so PeerState needs a `[key: string]: JsonValue` index signature (JsonValue re-exported from trystero). Evidence: svelte-check failure in WS-C, fixed in src/lib/room.ts.
- **2026-07-20** — Observation: @testing-library/svelte requires the svelteTesting() vite plugin for Svelte 5 component tests under jsdom; wired in vite.config.ts plus src/test-setup.ts. Evidence: plan-validator finding #3, applied in WS-A.
- **2026-07-20** — Observation: cmux browser panes in this sandbox share one localStorage/site-data store (contrary to skill doc's isolation claim); QA needed two separate windows + manual storage resets for multi-user testing. Evidence: QA session 2026-07-20, false "same identity" collisions.
- **2026-07-20** — Observation: real two-window P2P E2E succeeded in the sandbox over public Nostr relays (5 relays OPEN; votes/reveal/average synced), though WebRTC handshakes were slow/flaky (multi-minute churn, 'Trystero peer error: User-Initiated Abort' in console) — consistent with NAT/sandbox limits, watch for it in the user's real-network matrix.
- **2026-07-20** — Observation: one tab rendered a blank #app after heavy join/leave churn, 3× reproducible in that state, zero errors captured, not reproducible cleanly — deferred (see Decision Log).
- **2026-07-20** — Observation: second cmux QA session could not establish P2P at all — Nostr signaling healthy (5 relays OPEN, SDP exchanged) but ICE failed with "configure TURN servers with turnConfig or rtcConfig.iceServers". Sandbox NAT varies between sessions (first session peered successfully). Confirms the plan's main risk: restrictive NATs need the Open Relay turnConfig contingency. Evidence: bob_diag_turn_error.png in the session scratchpad.
- **2026-07-20** — Observation: `html, body { font-size: 1.0625rem }` compounds — body resolves rem against the already-scaled root → 18.06px instead of 17px. Fixed by setting font-size on html only. Evidence: getComputedStyle check in redesign QA.
- **2026-07-20** — Observation: cmux synthetic Tab/Enter key events don't drive native WKWebView focus traversal — keyboard a11y verified via source + computed styles instead of end-to-end. Evidence: redesign QA session, is-webview-focused true yet no traversal.
- **2026-07-20** — Observation: original protocol design carried only sender's own vote per message and nothing cleared other peers' stored votes on round advance — invisible to single-peer unit tests, caught only by real multi-user use. Evidence: repro scratchpad/repro.mjs, user report 2026-07-20.
- **2026-07-20** — Observation: cmux sandbox shares localStorage across separate WINDOWS (not just panes); QA worked around via per-window storage clears in a specific order.

## Decision Log

- **2026-07-20 · teamlead/planner** — Decision: Round-1 ships default Nostr strategy only; no `turnConfig`/mqtt fallback. Rationale: the approved plan makes TURN/mqtt contingent on the real-network spike, which only the user can run post-deploy via `#/diag`.
- **2026-07-20 · teamlead/planner** — Decision: the connectivity spike (Шаг 0 in the approved plan) is adapted into an in-app `#/diag` route instead of a separate throwaway page. Rationale: the real-network matrix requires the user to run it post-deploy anyway; a permanent diagnostics route serves the same purpose and stays useful afterward.
- **2026-07-20 · teamlead/planner** — Decision: the scaffold stream (WS-A) pre-installs every dependency the project will need; no later stream touches `package.json`. Rationale: enables WS-B/WS-C/WS-D to be implemented in parallel without lockfile merge corruption.
- **2026-07-20 · teamlead/planner** — Note: the Recent-rooms list cap defaults to a named constant of 8. This is a conventional default, not something the user explicitly confirmed — revisit if it turns out to matter.
- **2026-07-20 · teamlead** — Decision: createRoom signature is (slug, deckCode, deckCards) — three params; roomId = `${slug}:${deckCode}` with deckCode taken verbatim from the URL `d` param. Rationale: plan validator found the deck code unreachable from the original (slug, deckCards) signature; passing the URL value avoids re-encoding mismatches.
- **2026-07-20 · teamlead** — Decision: room.ts imports deck helpers aliased (`average as averageCards`) and exports its own derived store `average`. Rationale: validator caught a same-scope identifier collision.
- **2026-07-20 · WS-C implementer, accepted by teamlead** — Decision: participant name is set via setName(name) method on the room handle, not a createRoom argument.
- **2026-07-20 · teamlead** — Decision: Trystero appId fixed as constant 'scrumpoker-online-mighty-thimble'. Rationale: appId is mandatory; project-unique string namespaces the P2P rooms.
- **2026-07-20 · WS-B implementer, flagged for user visibility** — Decision: T-shirt preset is XS,S,M,L,XL,?.
- **2026-07-20 · teamlead** — Decision: connection-state semantics — onPeerJoin promotes to 'ready' from any state; onJoinError only applies while 'connecting'. Rationale: QA proved a live-peers room can show a stuck "Connection failed" banner; a live peer is definitive proof the room works.
- **2026-07-20 · teamlead** — Decision: ghost peers pruned via periodic reconciliation against Trystero's getPeers() connection map (10s interval), NOT a heartbeat protocol. Rationale: spec rejected heartbeats; getPeers() reuses Trystero's own liveness tracking.
- **2026-07-20 · teamlead** — Decision: blank-page-after-churn QA observation (one tab, unreproducible, no error captured) DEFERRED — documented, not chased in v1.
- **2026-07-20 · user+teamlead** — Decision: dark theme kept (no light theme); contrast fixed within it to WCAG AA, verified numerically (17 fg/bg pairs, worst text pair 6.87:1, non-text borders ≥3.24:1). Rationale: user chose minimal-intervention option in design interview.
- **2026-07-20 · user+teamlead** — Decision: accessibility scope = AA contrast + focus-visible rings + ≥16px type; ARIA/screen-reader pass explicitly deferred by user.
- **2026-07-20 · user+teamlead** — Decision: cards restyled as 2:3 playing cards with accent selected state; screen structure unchanged (user chose "cards + air" over full poker-table redesign).
- **2026-07-20 · teamlead** — Decision: protocol round-advance now clears ALL stored peer votes on both presser (newRound) and receivers (higher-round adoption), via shared pure clearPeerVotes; no rebroadcast added — laggard resend path remains the reconvergence mechanism. Rationale: diagnosed dual leak meant stale ✓ persisted until next vote; either fix alone doesn't converge.
- **2026-07-20 · teamlead** — Decision: own row marked visually (3px accent left border, transparent on other rows to keep alignment + elevated bg), "(you)" text removed per user preference.
- **2026-07-20 · user** — Decision: published as public repo scrum-poker-p2p with a SINGLE squashed commit; granular history kept only locally in dev-history. Rationale: user request ("пусть коммит будет 1"); tree verified byte-identical to the 46-commit history before push.
- **2026-07-20** — Decision: card label font tiers by code-point length (≤2 full, 3 medium, ≥4 small) with width growing to content; per-surface CSS size tokens, shared length→tier mapping. Rationale: user-reported overflow on decimal custom decks; single source prevents drift (2026-07-20).

## Outcomes & Retrospective

Delivered a fully client-only Scrum Poker (Svelte 5 + Vite + TS + Trystero/Nostr) in 27 commits with strict red/green TDD; 39 unit tests green, svelte-check clean, build clean. Three review rounds (code/security/perf) plus two browser QA sessions found and fixed 13 findings total: pre-reveal average leak, stale room handle on room→room nav, localStorage SecurityError crash, socket-driven ready state, poll/peerLog hygiene, malformed-`d` white-screen DoS, remote-payload validation (round/name/vote), stuck failed-banner, ghost-peer pruning, and recent-rooms label. Full two-window E2E over public Nostr relays succeeded in QA session 1, with votes, reveal, average, and new-round all syncing correctly between peers. The blank-#app-after-churn observation from QA session 1 remains deferred as unreproducible with no error captured. The turnConfig/mqtt contingencies called out as the project's main risk in the approved plan are not yet wired in — they await the user's real-network matrix via `#/diag` post-deploy, and QA session 2's TURN-required ICE failure (see Surprises & Discoveries) underscores that this risk is live, not theoretical. Remaining user steps: create the GitHub repo, push, enable Pages (Source = GitHub Actions), and run the network matrix home↔VPN from real networks.

Deployed and live at https://tp4k.github.io/scrum-poker-p2p/; remaining: user's real-network connectivity matrix via `#/diag` (home↔VPN), with turnConfig/Open Relay as the ready contingency.
</content>
