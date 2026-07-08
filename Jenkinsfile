pipeline {
    agent { label 'built-in' }

    parameters {
        booleanParam(name: 'SKIP_TYPECHECK', defaultValue: false,
                     description: 'Пропустить TypeScript-проверку')
        booleanParam(name: 'BUILD_WEB',      defaultValue: true,
                     description: 'Собирать веб-версию и деплоить на сервер')
        booleanParam(name: 'BUILD_WINDOWS',  defaultValue: true,
                     description: 'Собирать Windows .exe (Electron)')
        booleanParam(name: 'BUILD_ANDROID',  defaultValue: true,
                     description: 'Собирать Android .apk (Capacitor)')
        booleanParam(name: 'FORCE_DEPLOY',   defaultValue: false,
                     description: 'Деплоить веб не из ветки main')
    }

    environment {
        // ── Локальный Docker-реестр ──────────────────────────────────────
        REGISTRY_IP    = '192.168.10.222'
        REGISTRY_PORT  = '5050'
        NODE_IMAGE     = "${REGISTRY_IP}:${REGISTRY_PORT}/itdefence-builder"
        ANDROID_IMAGE  = "${REGISTRY_IP}:${REGISTRY_PORT}/itdefence-android"

        // ── Целевой сервер (Docker-деплой) ──────────────────────────────
        DEPLOY_HOST    = '192.168.10.222'
        DEPLOY_USER    = 'deploy'
        DEPLOY_DIR     = '/opt/itdefence'           // папка с compose.yml на сервере
        WEB_IMAGE      = "${REGISTRY_IP}:${REGISTRY_PORT}/itdefence-web"
        WEB_PORT       = '7979'

        // ── Метка сборки ─────────────────────────────────────────────────
        BUILD_TAG      = "${env.BUILD_NUMBER}-${env.GIT_COMMIT?.take(7) ?: 'local'}"
    }

    stages {

        // ─────────────────────────────────────────────────────────────────
        stage('Source Checkout') {
            steps {
                checkout scm
                echo "▶ Коммит: ${env.GIT_COMMIT} | Ветка: ${env.GIT_BRANCH}"
            }
        }

        // ─────────────────────────────────────────────────────────────────
        stage('Build Node Image') {
            steps {
                script {
                    echo "🐳 Сборка Node-образа (Web + Electron builder)..."
                    sh "docker build -t ${NODE_IMAGE}:latest -f Dockerfile.build ."
                    sh "docker push ${NODE_IMAGE}:latest"
                }
            }
        }

        // ─────────────────────────────────────────────────────────────────
        stage('Build Android Image') {
            when { expression { return params.BUILD_ANDROID } }
            steps {
                script {
                    echo "🐳 Сборка Android-образа (Node + JDK17 + Android SDK)..."
                    sh "docker build -t ${ANDROID_IMAGE}:latest -f Dockerfile.android ."
                    sh "docker push ${ANDROID_IMAGE}:latest"
                }
            }
        }

        // ─────────────────────────────────────────────────────────────────
        // Устанавливаем зависимости ОДИН РАЗ в Jenkins workspace.
        // Без этого docker.inside() монтирует workspace поверх /app в образе,
        // скрывая node_modules из образа — и npx скачивает не те пакеты.
        stage('Install Dependencies') {
            steps {
                script {
                    echo "📦 npm ci → node_modules в workspace..."
                    docker.image("${NODE_IMAGE}:latest").inside {
                        sh 'npm ci --ignore-scripts'
                    }
                }
            }
        }

        // ─────────────────────────────────────────────────────────────────
        stage('TypeScript Check') {
            when { expression { return !params.SKIP_TYPECHECK } }
            steps {
                script {
                    echo "🔍 Запуск tsc --noEmit..."
                    docker.image("${NODE_IMAGE}:latest").inside {
                        // Используем локальный tsc из workspace/node_modules
                        sh './node_modules/.bin/tsc --noEmit'
                    }
                }
            }
        }

        // ═════════════════════════════════════════════════════════════════
        // ПЛАТФОРМЕННЫЕ СБОРКИ (параллельно)
        // ═════════════════════════════════════════════════════════════════
        stage('Platform Builds') {
            parallel {

                // ── WEB ──────────────────────────────────────────────────
                stage('Build: Web') {
                    when { expression { return params.BUILD_WEB } }
                    steps {
                        script {
                            echo "🌐 Vite web-билд..."
                            docker.image("${NODE_IMAGE}:latest").inside {
                                sh 'VITE_MODE=web npm run build:web'
                            }
                            sh 'ls -lh dist/'

                            echo "🐳 Сборка Nginx-образа с dist/ внутри..."
                            sh "docker build -t ${WEB_IMAGE}:${BUILD_TAG} -t ${WEB_IMAGE}:latest -f Dockerfile.nginx ."
                            sh "docker push ${WEB_IMAGE}:${BUILD_TAG}"
                            sh "docker push ${WEB_IMAGE}:latest"

                            // Стэш compose.yml нужен для Deploy
                            stash name: 'compose', includes: 'compose.yml'
                        }
                    }
                }

                // ── WINDOWS ──────────────────────────────────────────────
                stage('Build: Windows (.exe)') {
                    when { expression { return params.BUILD_WINDOWS } }
                    steps {
                        script {
                            echo "🪟 Electron-builder → Windows x64 NSIS..."
                            docker.image("${NODE_IMAGE}:latest").inside {
                                // 1. Собираем бандл с относительными путями
                                sh 'VITE_MODE=electron npm run build:electron'
                                // 2. Упаковываем в .exe (electron-builder)
                                sh './node_modules/.bin/electron-builder --win --x64 --publish never'
                            }
                            sh 'ls -lh release/'
                            archiveArtifacts artifacts: 'release/*.exe', fingerprint: true
                        }
                    }
                }

                // ── ANDROID ──────────────────────────────────────────────
                stage('Build: Android (.apk)') {
                    when { expression { return params.BUILD_ANDROID } }
                    steps {
                        script {
                            echo "🤖 Capacitor → Gradle → Android APK..."
                            docker.image("${ANDROID_IMAGE}:latest").inside('-u root') {
                                // 1. Vite-билд для Capacitor
                                sh 'VITE_MODE=capacitor npm run build:cap'
                                // 2. Синхронизация в android/ проект
                                sh './node_modules/.bin/cap sync android'
                                // 3. Gradle assembleRelease
                                sh '''
                                    cd android
                                    chmod +x gradlew
                                    ./gradlew assembleRelease \
                                        --no-daemon \
                                        --stacktrace \
                                        -Pandroid.useAndroidX=true
                                '''
                            }
                            sh 'find android/app/build/outputs/apk -name "*.apk" | head -5'
                            archiveArtifacts artifacts: 'android/app/build/outputs/apk/**/*.apk',
                                             fingerprint: true
                        }
                    }
                }

            } // end parallel
        } // end Platform Builds

        // ─────────────────────────────────────────────────────────────────
        stage('Archive Web') {
            when { expression { return params.BUILD_WEB } }
            steps {
                archiveArtifacts artifacts: 'dist/**/*', fingerprint: true
                echo "📦 dist/ сохранён в Jenkins. Основной артефакт — Docker-образ ${WEB_IMAGE}:${BUILD_TAG}"
            }
        }

        // ─────────────────────────────────────────────────────────────────
        stage('Deploy Web') {
            when {
                anyOf {
                    branch 'main'
                    expression { return params.FORCE_DEPLOY }
                }
                expression { return params.BUILD_WEB }
            }
            steps {
                script {
                    echo "🚀 Docker-деплой на ${DEPLOY_HOST}:${WEB_PORT} ..."
                    unstash 'compose'
                    sshagent(credentials: ['deploy-ssh-key']) {
                        // 1. Создаём папку на сервере (если нет)
                        sh """
                            ssh -o StrictHostKeyChecking=no \
                                ${DEPLOY_USER}@${DEPLOY_HOST} \
                                'mkdir -p ${DEPLOY_DIR}'
                        """

                        // 2. Копируем compose.yml на сервер
                        sh """
                            scp -o StrictHostKeyChecking=no \
                                compose.yml \
                                ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_DIR}/compose.yml
                        """

                        // 3. Пуллим новый образ и перезапускаем контейнер
                        sh """
                            ssh -o StrictHostKeyChecking=no \
                                ${DEPLOY_USER}@${DEPLOY_HOST} \
                                'cd ${DEPLOY_DIR} && \
                                 docker compose pull && \
                                 docker compose up -d --remove-orphans'
                        """

                        // 4. Проверяем что контейнер поднялся
                        sh """
                            ssh -o StrictHostKeyChecking=no \
                                ${DEPLOY_USER}@${DEPLOY_HOST} \
                                'docker compose -f ${DEPLOY_DIR}/compose.yml ps'
                        """

                        echo "✅ Игра доступна: http://${DEPLOY_HOST}:${WEB_PORT}"
                    }
                }
            }
        }

    } // end stages

    post {
        success {
            echo """
╔══════════════════════════════════════════╗
║  ✅  Сборка #${BUILD_TAG} успешна        ║
║  Web:     ${params.BUILD_WEB}            ║
║  Windows: ${params.BUILD_WINDOWS}        ║
║  Android: ${params.BUILD_ANDROID}        ║
╚══════════════════════════════════════════╝
"""
        }
        failure {
            echo "❌ Сборка #${BUILD_TAG} упала — смотри логи выше."
        }
        always {
            sh 'docker image prune -f || true'
        }
    }
}
