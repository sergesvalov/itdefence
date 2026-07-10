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

Экран портретный (480×800, под мобилки) — коллеги заходят через двери в
верхней четверти (ресепшен) и идут вниз через кабинет Пети (нижние 3/4
экрана) к его столу. Кабинет — это и есть игровое поле для построек.

## 💰 Экономика

Петя стартует с деньгами и получает зарплату каждые 10 волн. За деньги можно
ставить новые башни или улучшать существующие (клик по башне, до 3 уровней —
больше урон, дальше радиус, быстрее стрельба).

## 🕹️ Управление

| Действие | Управление |
|---|---|
| Поставить башню | Клик/тап по кабинету |
| Улучшить башню | Клик/тап по уже стоящей башне |
| Сменить тип башни | Клавиши 1-6, правый клик, или тап по строке типа в HUD |
| Посмотреть радиус башни | Навести курсор / тап |
| Рестарт (после Game Over) | **R** |

### Типы башен

Характеристики и стоимость заданы в `TOWER_VARIANTS_DATA` (`src/config.ts`).

| Башня | Особенность |
|---|---|
| 📜 **Script** | Сбалансированная — средний урон/радиус/скорость |
| 📡 **Router** | Быстрая стрельба, короткий радиус |
| 📖 **Docs** | Дальнобойная, бьёт сильнее, но медленно перезаряжается |
| ☕ **Coffee** | Замедляет цель при попадании |
| 🪑 **Chair** | Дешёвая стартовая башня (слабая, но доступна с самого начала) |
| 🌬️ **AC** | Урон по области вокруг попадания |

Все башни прокачиваются кликом/тапом по уже поставленной (до 3 уровней —
сильнее урон, больше радиус, быстрее стрельба; растёт и стоимость апгрейда).

## 📁 Структура проекта

```
itdefence/
├── Dockerfile.build          ← Docker-образ для CI
├── Jenkinsfile               ← Pipeline (checkout → build → deploy)
├── vite.config.ts
├── index.html
├── public/
│   └── assets/
│       ├── tiles/            ← сюда PNG для пола/стен (см. README внутри)
│       └── sprites/          ← сюда PNG для двери/стола (см. README внутри)
└── src/
    ├── main.ts               ← Точка входа Phaser
    ├── config.ts             ← Игровые константы (+ TEXTURE_ASSETS)
    ├── scenes/
    │   └── MainScene.ts      ← Основная логика игры (preload + drawMap)
    └── entities/
        ├── Coworker.ts       ← Враг (коллега с таском)
        └── ToolTower.ts      ← Башня-защитник
```

## 🖼️ Текстуры

Сейчас карта рисуется программно (`Graphics`), без картинок. Чтобы залить её
своими тайлами — положите PNG в `public/assets/tiles/` и `public/assets/sprites/`
под именами из README в этих папках (`wall.png`, `office-floor.png`,
`door.png`, `desk.png`). `MainScene.preload()` подхватывает их автоматически
по ключам из `TEXTURE_ASSETS` (`src/config.ts`) — код трогать не нужно. Пока
файла нет, соответствующий элемент карты рисуется как сейчас (заглушка), так
что игра работает в любом промежуточном состоянии.

Башни и коллеги пока рисуются фигурами + эмодзи — слотов под их текстуры нет;
скажите, если нужно завести и для них.

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

> **JDK берётся не из apt, а из тарбола Eclipse Temurin.** Capacitor 7
> генерирует Android-проект под Java 21, а Debian bookworm пакует только
> openjdk-17 (openjdk-21 появился лишь в Debian 13). `Dockerfile.android`
> ставит [Temurin 21 arm64](https://github.com/adoptium/temurin21-binaries)
> из checksum-пиненного тарбола вместо apt-пакета.

### Необходимые секреты Jenkins

| ID | Тип | Описание |
|---|---|---|
| `serge` | SSH Username with Private Key | Ключ пользователя `serge` на целевом сервере (deploy-пользователя `deploy` на хосте нет — используется тот же credential/юзер, что и в других проектах на этом Jenkins) |

### Параметры сборки

| Параметр | По умолчанию | Описание |
|---|---|---|
| `SKIP_TYPECHECK` | false | Пропустить tsc-проверку |
| `BUILD_WEB` | true | Собирать веб-версию и деплоить на сервер |
| `BUILD_ANDROID` | true | Собирать Android .apk |
| `FORCE_DEPLOY` | false | Деплоить не из ветки main |
| `FORCE_REBUILD_IMAGES` | false | Пересобрать Node/Android toolchain-образы, даже если их Dockerfile не менялся |