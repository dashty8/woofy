# woofy

A tiny 3D Shiba Inu that lives in the corner of your screen and keeps you company while you use Claude Code. Barks when Claude finishes a turn or needs input, does little idle animations while Claude is working, gets bored if ignored, and has stats you can feed/pet/play with.

240×240 transparent window, bottom-right, always-on-top. Designed to be a notification you can *see*, *hear*, and *care about*.

## Install

```bash
npm install -g claude-woofy   # installs the woofy CLI globally
woofy install                 # explicit, opt-in: merges 5 hooks into ~/.claude/settings.json
```

(Or clone the repo and run `npm install && node bin/cli.js install` if you'd rather run from source.)

The npm package is **`claude-woofy`** but the binary it installs is just `woofy`. Hook install is **opt-in** — installing the package will not modify your Claude Code settings on its own. When you run `woofy install`, it merges 5 hooks into `~/.claude/settings.json`, all tagged `__woofy__` so `woofy uninstall` can strip them cleanly later:

| Hook | Fires when | Puppy reacts with |
|---|---|---|
| `SessionStart` | Claude Code starts a session | auto-launches woofy if not running, greets you |
| `UserPromptSubmit` | you submit a prompt | a random idle animation |
| `PreToolUse` | Claude is about to call a tool | a head-tilt / sniff |
| `Stop` | Claude finishes a turn | bark sound + bark animation + "done!" bubble |
| `Notification` | Claude needs your input or permission | sharper double-yip bark + "heads up!" bubble |

> **Note on size:** the bundled Shiba model + PBR texture set is ~45 MB on disk, and Electron itself is ~120 MB once `npm install` has run. Expect ~165 MB after a full install.

The 3D Shiba model ships with the repo under the Fab Standard License — bundling is permitted, standalone redistribution isn't. See [`LICENSES/FAB_NOTICE.md`](LICENSES/FAB_NOTICE.md) for full attribution.

## First run

```bash
woofy
```

First time you run it in a terminal, you'll get a prompt to name your puppy:

```
     ╱|、
    (˙ ∆ ˙)   Welcome to woofy!
    /づ づ     A new puppy has arrived.

  What will you call them?  Biscuit
```

After that, the window appears in the bottom-right corner and starts idling.

## CLI

```bash
woofy                 # launch in foreground (logs to stdout)
woofy start           # launch detached in the background

woofy pet             # give scritches (+happiness, +bond)
woofy feed            # fill their bowl (-hunger, +happiness)
woofy play            # play fetch (+happiness, -energy, +bond)
woofy rest            # tell them to rest (+energy)

woofy stats           # print current stats from ~/.woofy/state.json
woofy name <name>     # rename
woofy wander          # force a bottom-strip wander

woofy bark            # send a test "done" bark
woofy alert "hey"     # send a test alert bark with an optional message

woofy anims           # list all 83 animation clip names
woofy anims sit       # filter by substring
woofy anim digging    # play a specific clip

woofy install         # re-install the Claude Code hooks
woofy uninstall       # remove the __woofy__-tagged hooks
woofy help
```

## Interaction

- **Left-click the dog** → pet
- **Press-and-drag the dog** → moves the window anywhere on the screen
- **Right-click the dog** → radial menu:
  - ❤️ pet
  - 🦴 feed
  - 🎾 play
  - 💤 rest
  - 🚶 walk-to — click anywhere on the screen and the dog walks there
  - 👋 bye — friendly bark + clean shutdown (state is persisted)
- **Hover the window** → HUD fades in showing mood, name, happiness, fullness, energy, bond

## Companion state

State lives at `~/.woofy/state.json` and persists across restarts. Hunger, energy, happiness, and bond drift over time (about 2 hours from fed to starving). The puppy gets **bored** after 3 minutes of no activity (curls up) and **dormant** after 10 (lies down to sleep). A sudden burst of tool calls from Claude triggers an "overwhelmed" double-bark reaction.

Mood is derived from the stats: `hungry`, `tired`, `wary`, `lonely`, `playful`, or `content` — and it actually changes how the puppy behaves:

- **Bubbles** are colored by mood (a hungry puppy says "kibble?" instead of "watching", a playful one says "let's goo!"; the mood emoji occasionally prepends the line)
- **Idle fidgets** are mood-biased (playful → in-place jumps; tired → slow idles; hungry → ground-sniffing / drinking; wary → defensive crouch)
- **Wandering** happens more when playful, rarely when tired/hungry, and is skipped entirely when wary
- **Bark pitch and pacing** scale with energy — low-energy woofs are slower and lower; high-energy yips snap and pitch up

## Uninstall

```bash
woofy uninstall              # strips the 5 __woofy__-tagged hooks, leaves everything else alone
npm uninstall -g claude-woofy   # (or remove the local clone)
```

`woofy uninstall` only touches hook entries it added itself (anything tagged `__woofy__`). The rest of your `~/.claude/settings.json` is left untouched.

## What woofy is / isn't

- **Is:** a persistent desktop companion — stateful, animated, interactive, and a notification channel for Claude Code
- **Isn't:** a productivity tool, a dashboard, or a mic-listener. It reacts only to hook events from Claude Code

## Credits

- 3D model: **Cartoon Dog – Shiba Inu** from Fab — bundled under the Fab Standard License. Bundling inside a project is permitted; standalone redistribution of the asset is not. See [`LICENSES/FAB_NOTICE.md`](LICENSES/FAB_NOTICE.md)
- Rendering: full PBR (Albedo + Normal + Roughness + Metalness + AO), PMREM-baked image-based lighting, ACES Filmic tone mapping
- Built on Electron + Three.js + Web Audio

## License

The woofy source code (everything in this repository **except** the bundled 3D model and textures) is released under the [MIT License](LICENSE). The Shiba Inu model and texture set under `electron/assets/AnimatedDog_FBX/` are under the Fab Standard License — see [`LICENSES/FAB_NOTICE.md`](LICENSES/FAB_NOTICE.md).
