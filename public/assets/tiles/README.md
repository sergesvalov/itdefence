# Tile textures

Drop PNGs here with these exact filenames — `MainScene.preload()` loads
them automatically (see `TEXTURE_ASSETS` in `src/config.ts`). Until a
file exists, that slot silently falls back to the current placeholder
`Graphics` drawing, so the game keeps working with none, some, or all
of these present — no code changes needed on your end.

Both are rendered as a `Phaser.GameObjects.TileSprite`, i.e. tiled /
repeated to fill their area, so they must tile seamlessly on all four
edges.

| File | Used for | Suggested size |
|---|---|---|
| `wall.png` | Reception strip (top) + bottom wall strip | 40×40, tileable |
| `office-floor.png` | Petya's office floor — the battlefield | 40×40, tileable |
