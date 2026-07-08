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
Source Checkout
    ↓
Build Node Image     (Docker push → реестр: Dockerfile.build)
    ↓
Build Android Image  (Docker push → реестр: Dockerfile.android)
    ↓
TypeScript Check     (tsc --noEmit)
    ↓
┌──────────────────────────────────┐  ← параллельно
│ Build: Web         │ Build: Win  │ Build: Android       │
│ vite build:web     │ Electron    │ Capacitor + Gradle   │
│ → dist/            │ builder     │ → android/...apk     │
│                    │ → release/  │                      │
│                    │   *.exe     │                      │
└──────────────────────────────────┘
    ↓
Archive (dist/**, release/*.exe, **/*.apk)
    ↓
Deploy Web [только main] → rsync → /var/www/itdefence
```

### Необходимые секреты Jenkins

| ID | Тип | Описание |
|---|---|---|
| `deploy-ssh-key` | SSH Username with Private Key | Приватный ключ деплой-пользователя |

### Параметры сборки

| Параметр | По умолчанию | Описание |
|---|---|---|
| `SKIP_TYPECHECK` | false | Пропустить tsc-проверку |
| `FORCE_DEPLOY` | false | Деплоить не из ветки main |