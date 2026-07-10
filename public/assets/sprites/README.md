# Sprite textures

Drop PNGs here with these exact filenames — `MainScene.preload()` loads
them automatically (see `TEXTURE_ASSETS` in `src/config.ts`). Until a
file exists, that slot silently falls back to the current placeholder
`Graphics` drawing, so the game keeps working with none, some, or all
of these present — no code changes needed on your end.

Each is rendered as a single `Phaser.GameObjects.Image`, scaled to the
size below (`setDisplaySize`) regardless of the source file's actual
pixel dimensions — use a transparent background and roughly that
aspect ratio.

| File | Used for | Displayed at |
|---|---|---|
| `door.png` | Each of the 4 spawn doors (reception strip) | 40×44 |
| `desk.png` | Petya's desk, monitor included in the same image | 100×90 |
