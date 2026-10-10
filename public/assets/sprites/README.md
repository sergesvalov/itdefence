# Спрайты

SVG-файлы в этой папке **сгенерированы** скриптом
[`tools/generate-art.mjs`](../../../tools/generate-art.mjs) — руками их не
редактируют, следующий запуск всё перезапишет:

```bash
node tools/generate-art.mjs
```

Игра загружает их по ключам из `TEXTURE_ASSETS` (`src/config.ts`). Правила
стиля — в [`ART_BRIEF.md`](../ART_BRIEF.md).
