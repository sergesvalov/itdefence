@Library('mylib@main') _

pipeline {
    agent { label 'built-in' }

    parameters {
        booleanParam(name: 'SKIP_TYPECHECK',       defaultValue: false, description: 'Пропустить TypeScript-проверку')
        booleanParam(name: 'BUILD_WEB',             defaultValue: true,  description: 'Собирать веб-версию и деплоить на сервер')
        booleanParam(name: 'BUILD_ANDROID',         defaultValue: true,  description: 'Собирать Android .apk (Capacitor)')
        booleanParam(name: 'FORCE_DEPLOY',          defaultValue: false, description: 'Деплоить веб не из ветки main')
        booleanParam(name: 'FORCE_REBUILD_IMAGES',  defaultValue: false, description: 'Пересобрать toolchain-образы (Node/Android), даже если их Dockerfile не менялся')
    }

    environment {
        // ── Конфигурация локального реестра ──────────────────────────────
        REGISTRY_IP    = '192.168.10.222'
        REGISTRY_PORT  = '5050'
        NODE_IMAGE     = "${REGISTRY_IP}:${REGISTRY_PORT}/itdefence-builder"
        ANDROID_IMAGE  = "${REGISTRY_IP}:${REGISTRY_PORT}/itdefence-android"

        // ── Целевой сервер (Docker-деплой) ──────────────────────────────
        DEPLOY_HOST    = '192.168.10.222'
        DEPLOY_USER    = 'serge'
        DEPLOY_CREDS   = 'serge'
        DEPLOY_DIR     = '/opt/itdefence'
        WEB_IMAGE      = "${REGISTRY_IP}:${REGISTRY_PORT}/itdefence-web"
        WEB_PORT       = '7979'

        BUILD_TAG      = "${env.BUILD_NUMBER}-${env.GIT_COMMIT?.take(7) ?: 'local'}"

        // Именованные Docker-тома с npm/gradle кэшем — переживают между
        // сборками (в отличие от слоёв образа) и сильно ускоряют повторные
        // npm ci / gradle assembleRelease на медленном ARM-хосте
        NPM_CACHE_VOLUME    = 'itdefence-npm-cache'
        GRADLE_CACHE_VOLUME = 'itdefence-gradle-cache'
    }

    stages {

        stage('Source Checkout') {
            steps {
                checkout scm
                echo "▶ Коммит: ${env.GIT_COMMIT} | Ветка: ${env.GIT_BRANCH}"

                // Предыдущие сборки могли оставить в workspace dist/,
                // release/ и android/ (cap add android — это полноценный
                // Gradle-проект). Без .dockerignore это раздувало context
                // каждого `docker build`; теперь на всякий случай чистим и
                // тут, чтобы workspace не пух от сборки к сборке.
                //
                // Эти файлы создавались контейнерами с -u root (см.
                // withNodeBuilder/withAndroidBuilder), поэтому на хосте они
                // root-owned — обычный `rm -rf` от jenkins-пользователя не
                // может их удалить (Permission denied). Чистим тоже от root,
                // через одноразовый контейнер на том же bind-mount workspace.
                sh 'docker run --rm -u root -v "$WORKSPACE:$WORKSPACE" -w "$WORKSPACE" node:22-bookworm-slim rm -rf dist release android'
            }
        }

        stage('Build Toolchain Images') {
            steps {
                script {
                    env.NODE_IMAGE_TAG = sh(script: 'sha1sum Dockerfile.build | cut -c1-12', returnStdout: true).trim()
                    buildAndPushIfChanged(env.NODE_IMAGE, env.NODE_IMAGE_TAG, 'Dockerfile.build', 'Node')

                    if (params.BUILD_ANDROID) {
                        env.ANDROID_IMAGE_TAG = sh(script: 'sha1sum Dockerfile.android | cut -c1-12', returnStdout: true).trim()
                        buildAndPushIfChanged(env.ANDROID_IMAGE, env.ANDROID_IMAGE_TAG, 'Dockerfile.android', 'Android')
                    }
                }
            }
        }

        stage('Install Dependencies') {
            steps {
                script {
                    echo "📦 npm ci в workspace..."
                    withNodeBuilder {
                        sh 'npm install --ignore-scripts'
                    }
                }
            }
        }

        stage('TypeScript Check') {
            when { expression { return !params.SKIP_TYPECHECK } }
            steps {
                script {
                    echo "🔍 Запуск tsc --noEmit..."
                    withNodeBuilder {
                        sh './node_modules/.bin/tsc --noEmit'
                    }
                }
            }
        }

        stage('Test') {
            steps {
                script {
                    echo "🧪 Запуск Unit-тестов (Vitest)..."
                    withNodeBuilder {
                        sh 'npm run test'
                    }

                    echo "🎭 Запуск E2E-тестов (Playwright)..."
                    // Используем официальный образ Playwright для запуска E2E тестов в Docker.
                    // Монтируем директорию и используем IPC/Net host, если нужно для локального dev-сервера.
                    docker.image('mcr.microsoft.com/playwright:v1.49.1-jammy').inside("-u root -v ${env.NPM_CACHE_VOLUME}:/tmp/.npm --shm-size=1gb") {
                        // Playwright требует установки системных зависимостей браузеров (даже в своем образе иногда).
                        // Но в mcr.microsoft.com/playwright они уже есть.
                        sh 'npm install --ignore-scripts' // На всякий случай убедимся, что пакеты стоят
                        sh 'npx playwright install chromium'
                        sh 'npm run test:e2e'
                    }
                }
            }
        }

        // ═════════════════════════════════════════════════════════════════
        // ПОСЛЕДОВАТЕЛЬНЫЕ СБОРКИ (без parallel — ARM-хост не тянет
        // одновременные тяжёлые контейнеры vite+gradle без деградации)
        // ═════════════════════════════════════════════════════════════════

        stage('Build: Web') {
            when { expression { return params.BUILD_WEB } }
            steps {
                script {
                    echo "🌐 Vite web-билд..."
                    withNodeBuilder {
                        sh 'VITE_MODE=web npm run build:web'
                    }
                    sh 'ls -lh dist/'

                    echo "🐳 Сборка Nginx-образа с dist/ внутри..."
                    sh "docker build -t ${WEB_IMAGE}:${BUILD_TAG} -t ${WEB_IMAGE}:latest -f Dockerfile.nginx ."
                    sh "docker push ${WEB_IMAGE}:${BUILD_TAG}"
                    sh "docker push ${WEB_IMAGE}:latest"

                    stash name: 'compose', includes: 'compose.yml'
                }
            }
        }

        stage('Build: Android (.apk)') {
            when { expression { return params.BUILD_ANDROID } }
            steps {
                script {
                    echo "🤖 Capacitor → Gradle → Android APK..."
                    withAndroidBuilder {
                        // 1. Vite-билд для мобилки
                        sh 'VITE_MODE=capacitor npm run build:cap'

                        // 2. Инициализация платформы
                        sh "npx cap add android || npx cap sync android"

                        // AGP тянет свой aapt2 с Maven (только x86_64) независимо
                        // от SDK build-tools — на arm64 падает с "Syntax error:
                        // '(' unexpected" (shell пытается исполнить x86_64 ELF).
                        // Официального arm64-билда от Google нет, поэтому
                        // подсовываем проверенный по чек-сумме arm64 aapt2 из
                        // Dockerfile.android (Commit451/android-arm-build-tools).
                        sh 'echo "android.aapt2FromMavenOverride=/usr/local/bin/aapt2" >> android/gradle.properties'

                        // 3. Компиляция через Gradle (с постоянным кэшем — см. GRADLE_CACHE_VOLUME)
                        sh '''
                            cd android
                            chmod +x gradlew
                            ./gradlew assembleRelease --no-daemon --stacktrace --build-cache -Pandroid.useAndroidX=true
                        '''

                        signAndroidApk(
                            unsignedApk: 'android/app/build/outputs/apk/release/app-release-unsigned.apk',
                            signedApk:   'android/app/build/outputs/apk/release/app-release.apk',
                            keystore:    'keystore/release.keystore',
                            storepass:   'password',
                            keyalias:    'release',
                            keypass:     'password'
                        )
                    }
                    sh 'find android/app/build/outputs/apk -name "*.apk" | head -5'
                    archiveArtifacts artifacts: 'android/app/build/outputs/apk/**/*.apk', fingerprint: true
                }
            }
        }



        stage('Deploy Web') {
            when {
                anyOf { branch 'main'; expression { return params.FORCE_DEPLOY } }
                expression { return params.BUILD_WEB }
            }
            steps {
                script {
                    echo "🚀 Docker-деплой на ${DEPLOY_HOST}:${WEB_PORT} ..."
                    unstash 'compose'
                    sshagent(credentials: [DEPLOY_CREDS]) {
                        sh "ssh -o StrictHostKeyChecking=no ${DEPLOY_USER}@${DEPLOY_HOST} 'mkdir -p ${DEPLOY_DIR}'"
                        sh "scp -o StrictHostKeyChecking=no compose.yml ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_DIR}/compose.yml"
                        sh "ssh -o StrictHostKeyChecking=no ${DEPLOY_USER}@${DEPLOY_HOST} 'cd ${DEPLOY_DIR} && docker compose pull && docker compose up -d --remove-orphans'"
                        echo "✅ Игра доступна: http://${DEPLOY_HOST}:${WEB_PORT}"
                    }
                }
            }
        }
    }

    post {
        success {
            echo "╔══════════════════════════════════════════╗\n║  ✅  Сборка #${BUILD_TAG} успешна        ║\n╚══════════════════════════════════════════╝"
        }
        failure {
            echo "❌ Сборка #${BUILD_TAG} упала."
        }
        always {
            sh 'docker image prune -f || true'
        }
    }
}
