# woofy

A tiny 3D Shiba Inu that lives in the corner of your screen and keeps you company while you use Claude Code. Barks when Claude finishes a turn or needs input, does little idle animations while Claude is working, gets bored if ignored, and has stats you can feed/pet/play with.

240×240 transparent window, bottom-right, always-on-top. Designed to be a notification you can *see*, *hear*, and *care about*.

## Install

```bash
git clone https://github.com/dashty8/woofy.git
cd woofy
npm install
```

`npm install` runs a postinstall that merges 5 hooks into `~/.claude/settings.json`, all tagged `__woofy__` so uninstall can clean up cleanly:

| Hook | Fires when | Puppy reacts with |
|---|---|---|
| `SessionStart` | Claude Code starts a session | auto-launches woofy if not running, greets you |
| `UserPromptSubmit` | you submit a prompt | a random idle animation |
| `PreToolUse` | Claude is about to call a tool | a head-tilt / sniff |
| `Stop` | Claude finishes a turn | bark sound + bark animation + "done!" bubble |
| `Notification` | Claude needs your input or permission | sharper double-yip bark + "heads up!" bubble |

The 3D Shiba model ships with the repo (Fab Standard License — bundling is permitted, standalone redistribution isn't).

## First run

```bash
npx woofy
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
npx woofy                 # launch in foreground (logs to stdout)
npx woofy start           # launch detached in the background

npx woofy pet             # give scritches (+happiness, +bond)
npx woofy feed            # fill their bowl (-hunger, +happiness)
npx woofy play            # play fetch (+happiness, -energy, +bond)
npx woofy rest            # tell them to rest (+energy)

npx woofy stats           # print current stats from ~/.woofy/state.json
npx woofy name <name>     # rename
npx woofy wander          # force a bottom-strip wander

npx woofy bark            # send a test "done" bark
npx woofy alert "hey"     # send a test alert bark with an optional message

npx woofy anims           # list all 83 animation clip names
npx woofy anims sit       # filter by substring
npx woofy anim digging    # play a specific clip

npx woofy install         # re-install the Claude Code hooks
npx woofy uninstall       # remove the __woofy__-tagged hooks
npx woofy help
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
npx woofy uninstall       # strips the 5 __woofy__-tagged hooks, leaves everything else alone
```

## What woofy is / isn't

- **Is:** a persistent desktop companion — stateful, animated, interactive, and a notification channel for Claude Code
- **Isn't:** a productivity tool, a dashboard, or a mic-listener. It reacts only to hook events from Claude Code

## Credits

- 3D model: **Cartoon Dog – Shiba Inu** from Fab — bundled under the Fab Standard License (commercial distribution of projects incorporating Fab assets is permitted)
- Rendering: full PBR (Albedo + Normal + Roughness + Metalness + AO), PMREM-baked image-based lighting, ACES Filmic tone mapping
- Built on Electron + Three.js + Web Audio
