# Where to put your puppy model

Drop a rigged dog `.glb` here as `electron/assets/dog.glb` and restart woofy. Without a model it shows a brown placeholder box.

## Recommended source — Quaternius Animated Animals pack

- **URL:** <https://quaternius.com/packs/animatedanimals.html>
- **License:** CC0 (public domain). No attribution required.
- **What you get:** low-poly rigged animals including a **Dog**, with clips like `Idle`, `Idle_2`, `Idle_Headlow`, `Walk`, `Gallop`, `Jump_toIdle`, `Eating`, `Attack_Headbutt`, `Attack_Bite` (or similar), `Death`.

Steps:
1. Download and unzip the pack.
2. Find the dog `.glb` in the `GLB format/` folder.
3. Rename + copy it here: `electron/assets/dog.glb`.
4. Start woofy: `woofy` (foreground) or `woofy start` (background).

## Which clips woofy uses

| Event | First-match candidates |
|---|---|
| `sleep` (default, looping) | `Sleep` → `Idle_Sleep` → `Lay` → `Lying` → `Idle_Headlow` → `Idle_2` → `Idle` |
| `bark` (on notify) | `Bark` → `Attack_Bark` → `Attack_Bite` → `Attack_Headbutt` → `Idle_HitReact1` → `Idle_HitReact2` → `Jump_toIdle` → `Idle_2` → `Idle` |

The Quaternius Dog has no dedicated `Bark` clip, so woofy falls back to one of the `Attack_*` animations for the bark reaction. If you have a model with a real `Bark` clip, it'll be picked up automatically.

## Overriding the clip map

Drop a `dog.config.json` here to customize:

```json
{
  "fitSize": 1.0,
  "facingAxis": "+z",
  "clips": {
    "sleep": ["MyDog_Sleep"],
    "bark":  ["MyDog_Bark"]
  }
}
```

Missing keys fall back to defaults. Missing clip names fall through to the next candidate, then to the first clip in the file. Never crashes.

## Scale / facing knobs

| Field | Default | Purpose |
|---|---|---|
| `fitSize` | `1.0` | Max dimension of the fitted bounding box (world units) |
| `facingAxis` | `"+z"` | `"+z"` or `"+x"` — whichever way your puppy's nose points in source coords |
