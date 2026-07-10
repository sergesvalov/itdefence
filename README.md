# 🏢 Office TD — Enikey Defense

**Tower Defense** в офисном сеттинге. Петя сидит в своём кабинете, а по коридору к нему идут коллеги с тасками. Помоги Пете выжить!
////////
## 🎮 Стек

| Технология | Версия |
|---|---|
| Phaser 3 | ^3.88 |
| TypeScript | ~5.8 |
| Vite | ^6 |
| Node.js (CI) | 22 LTS |

## 🚀 Локальный запуск

```bash
npm install
npm run dev        # http://localhost:5173
```

## 🔧 Сборка

```bash
npm run build          # web-версия → dist/
npm run build:electron # Electron-версия → dist/ (base='./')
npm run build:cap      # Capacitor-версия → dist/ (base='./')
```

## 📦 Платформенные пакеты

```bash
# Windows: .exe инсталлятор (нужен Node + electron-builder)
npm run dist:win       # → release/*.exe

# Android: инициализация (первый раз)
npx cap add android
npm run cap:sync       # vite build + cap sync → android/
npm run cap:open       # открыть в Android Studio
```

## 🕹️ Управление

| Действие | Управление |
|---|---|
| Поставить башню | Левый клик по коридору |
| Сменить тип башни | Клавиши 1 / 2 / 3 или правый клик |
| Посмотреть радиус башни | Навести курсор |
| Рестарт (после Game Over) | **R** |

### Типы башен

- 📜 **Script** — синяя, базовая
- 📡 **Router** — фиолетовая, средняя
- 📖 **Docs** — зелёная, дальняя

## 📁 Структура проекта

```
itdefence/
├── Dockerfile.build          ← Docker-образ для CI
├── Jenkinsfile               ← Pipeline (checkout → build → deploy)
├── vite.config.ts
├── index.html
└── src/
    ├── main.ts               ← Точка входа Phaser
    ├── config.ts             ← Игровые константы
    ├── scenes/
    │   └── MainScene.ts      ← Основная логика игры
    └── entities/
        ├── Coworker.ts       ← Враг (коллега с таском)
        └── ToolTower.ts      ← Башня-защитник
```

## 🔄 CI/CD (Jenkins)

Пайплайн описан в [`Jenkinsfile`](./Jenkinsfile).

### Этапы

```
Source Checkout       (+ чистка dist/release/android от прошлой сборки)
    ↓
Build Node Image      (пересобирается и пушится, только если изменился Dockerfile.build)
    ↓
Build Android Image   (аналогично — только при изменении Dockerfile.android)
    ↓
Install Dependencies  (npm ci, с постоянным кэшем — том itdefence-npm-cache)
    ↓
TypeScript Check      (tsc --noEmit)
    ↓
┌───────────────────────────────────────┐  ← последовательно (ARM-хост не тянет parallel)
│ Build: Web           │ Build: Android          │
│ vite build:web       │ Capacitor + Gradle      │
│ → dist/ → Nginx-образ │ → android/...apk        │
│                       │ (кэш: itdefence-gradle-cache) │
└───────────────────────────────────────┘
    ↓
Archive (dist/**, **/*.apk)
    ↓
Deploy Web [только main] → docker compose (ssh) → /opt/itdefence на 192.168.10.222:7979
```

> **Windows .exe не собирается в этом пайплайне.** `electron-builder --win` создаёт
> NSIS-инсталлятор, а это требует Wine для запуска Windows-бинарников — на ARM64
> Linux-хосте Wine работал бы только через x86-эмуляцию (box64/qemu), что
> ненадёжно и очень медленно. Собирайте Windows-версию (`npm run dist:win`)
> либо локально на Windows, либо на отдельном Windows-агенте/раннере.

> **Android-сборка использует сторонний `aapt2` для arm64.** Google публикует
> `aapt2` только под x86_64/macOS/Windows, а Android Gradle Plugin тянет
> именно эту версию с Maven независимо от SDK build-tools — на ARM-хосте
> она не запускается. `Dockerfile.android` подкладывает вместо неё бинарник
> из [Commit451/android-arm-build-tools](https://github.com/Commit451/android-arm-build-tools)
> (MIT, пересобран из тегов релиза AOSP), запиненный на конкретный релиз и
> проверенный по SHA-256 при сборке образа. Если после апдейта AGP снова
> сломается (несовместимый флаг aapt2) — нужно поднять версию релиза в
> `Dockerfile.android` и обновить хэш.

### Необходимые секреты Jenkins

| ID | Тип | Описание |
|---|---|---|
| `deploy-ssh-key` | SSH Username with Private Key | Приватный ключ деплой-пользователя |

### Параметры сборки

| Параметр | По умолчанию | Описание |
|---|---|---|
| `SKIP_TYPECHECK` | false | Пропустить tsc-проверку |
| `BUILD_WEB` | true | Собирать веб-версию и деплоить на сервер |
| `BUILD_ANDROID` | true | Собирать Android .apk |
| `FORCE_DEPLOY` | false | Деплоить не из ветки main |
| `FORCE_REBUILD_IMAGES` | false | Пересобрать Node/Android toolchain-образы, даже если их Dockerfile не менялся |