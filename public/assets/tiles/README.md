# Tile textures

Полный список файлов, размеры и арт-гайд — см.
[`public/assets/ART_BRIEF.md`](../ART_BRIEF.md).

Коротко: кладёте сюда `corridor-floor.png`, `office-floor.png`,
`wall.png` (все 40×40, бесшовные) — `MainScene.preload()` подхватывает их
автоматически по ключам из `TEXTURE_ASSETS` (`src/config.ts`). Пока файла
нет — этот кусок карты рисуется как сейчас, программной графикой.
