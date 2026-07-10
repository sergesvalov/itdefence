# Sprite textures

Полный список файлов, размеры и арт-гайд — см.
[`public/assets/ART_BRIEF.md`](../ART_BRIEF.md).

Коротко: кладёте сюда `door.png`, `desk.png` (стол + Петя), `coworker.png`
и `tower-<variant>.png` для каждого типа башни (`script`, `router`, `docs`,
`coffee`, `chair`, `aircon`) — `MainScene.preload()` подхватывает их
автоматически по ключам из `TEXTURE_ASSETS` (`src/config.ts`). Прозрачный
фон обязателен. Пока файла нет — соответствующая сущность рисуется как
сейчас, программной графикой/эмодзи.
