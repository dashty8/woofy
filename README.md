# woofy

A tiny 3D puppy that lives in the corner of your screen and barks when Claude Code finishes a response or asks for input. That's it.

It's a notification you can see and hear — one that happens to be adorable.

## Install

```bash
cd woofy
npm install
```

That runs the postinstall which merges two hooks into `~/.claude/settings.json`:
- **Stop** — fires when Claude finishes its turn. Puppy barks "done!"
- **Notification** — fires when Claude needs input or tool permission. Puppy barks "heads up!"

Then drop a `dog.glb` in `electron/assets/` (see [asset README](./electron/assets/README.md) for free sources — Quaternius is recommended, CC0).

## Run

```bash
npx woofy           # foreground, logs to stdout
npx woofy start     # detached, runs in the background
```

The puppy appears in the bottom-right corner, asleep. When Claude barks it, it plays a bark animation + sound, shows a small bubble, then goes back to sleep after ~2s.

## Test without Claude

```bash
npx woofy bark           # send a test "done" bark
npx woofy alert "hey"    # send a test alert bark with a message
```

## Uninstall

```bash
npm uninstall
# or manually:
npx woofy uninstall
```

Removes only the `__woofy__`-tagged hooks from `~/.claude/settings.json`. Leaves anything else in that file alone.

## What it is / isn't

- **Is:** a visible, audible notification that Claude is waiting on you or has finished. Click-through, always-on-top, small corner window, no UI.
- **Isn't:** a companion with moods/hunger/trust. No state. No slash commands. No interactivity. If you want that, see the sibling project `clawed`.
