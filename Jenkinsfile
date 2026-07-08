pipeline {
    agent { label 'built-in' }

    parameters {
        booleanParam(name: 'SKIP_TYPECHECK', defaultValue: false, description: 'Пропустить TypeScript-проверку')
        booleanParam(name: 'BUILD_WEB',      defaultValue: true,  description: 'Собирать веб-версию и деплоить на сервер')
        booleanParam(name: 'BUILD_WINDOWS',  defaultValue: true,  description: 'Собирать Windows .exe (Electron)')
        booleanParam(name: 'BUILD_ANDROID',  defaultValue: true,  description: 'Собирать Android .apk (Capacitor)')
        booleanParam(name: 'FORCE_DEPLOY',   defaultValue: false, description: 'Деплоить веб не из ветки main')
    }

    environment {
        // ── Конфигурация локального реестра ──────────────────────────────
        REGISTRY_IP    = '192.168.10.222'
        REGISTRY_PORT  = '5050'
        NODE_IMAGE     = "${REGISTRY_IP}:${REGISTRY_PORT}/itdefence-builder"
        ANDROID_IMAGE  = "${REGISTRY_IP}:${REGISTRY_PORT}/itdefence-android"

        // ── Целевой сервер (Docker-деплой) ──────────────────────────────
        DEPLOY_HOST    = '192.168.10.222'
        DEPLOY_USER    = 'deploy'
        DEPLOY_DIR     = '/opt/itdefence'
        WEB_IMAGE      = "${REGISTRY_IP}:${REGISTRY_PORT}/itdefence-web"
        WEB_PORT       = '7979'

        BUILD_TAG      = "${env.BUILD_NUMBER}-${env.GIT_COMMIT?.take(7) ?: 'local'}"
    }

    stages {

        stage('Source Checkout') {
            steps {
                checkout scm
                echo "▶ Коммит: ${env.GIT_COMMIT} | Ветка: ${env.GIT_BRANCH}"
            }
        }

        stage('Build Node Image') {
            steps {
                script {
                    echo "🐳 Сборка Node-образа (Web + Electron builder)..."
                    sh "docker build -t ${NODE_IMAGE}:latest -f Dockerfile.build ."
                    sh "docker push ${NODE_IMAGE}:latest"
                }
            }
        }

        stage('Build Android Image') {
            when { expression { return params.BUILD_ANDROID } }
            steps {
                script {
                    echo "🐳 Сборка Android-образа..."
                    sh "docker build -t ${ANDROID_IMAGE}:latest -f Dockerfile.android ."
                    sh "docker push ${ANDROID_IMAGE}:latest"
                }
            }
        }

        stage('Install Dependencies') {
            steps {
                script {
                    echo "📦 npm ci в workspace..."
                    withNodeBuilder {
                        sh 'npm ci --ignore-scripts'
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

        // ═════════════════════════════════════════════════════════════════
        // ПОСЛЕДОВАТЕЛЬНЫЕ СБОРКИ (Изменено: убран parallel для стабильности на ARM)
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

        stage('Build: Windows (.exe)') {
            when { expression { return params.BUILD_WINDOWS } }
            steps {
                script {
                    echo "🪟 Electron-builder → Windows x64 NSIS..."
                    withNodeBuilder {
                        // Защита от падения, если нет иконки (как в spaceinvasion)
                        sh '''
                            mkdir -p public build
                            if [ ! -f "public/icon.ico" ] && [ ! -f "build/icon.ico" ]; then
                                echo "⚠️ Иконка не найдена! Скачиваем заглушку..."
                                curl -s -o public/icon.ico https://raw.githubusercontent.com/electron/electron/main/default_app/icon.ico || true
                            fi
                        '''
                        sh 'VITE_MODE=electron npm run build:electron'
                        sh './node_modules/.bin/electron-builder --win --x64 --publish never'
                    }
                    sh 'ls -lh release/'
                    archiveArtifacts artifacts: 'release/*.exe', fingerprint: true
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
                        
                        // 2. Инициализация платформы (красивый синтаксис из spaceinvasion)
                        sh "npx cap add android || npx cap sync android"
                        
                        // 3. Компиляция через Gradle
                        sh '''
                            cd android
                            chmod +x gradlew
                            ./gradlew assembleRelease --no-daemon --stacktrace --no-build-cache -Pandroid.useAndroidX=true
                        '''
                    }
                    sh 'find android/app/build/outputs/apk -name "*.apk" | head -5'
                    archiveArtifacts artifacts: 'android/app/build/outputs/apk/**/*.apk', fingerprint: true
                }
            }
        }

        // ── ДЕПЛОЙ ───────────────────────────────────────────────────────
        stage('Archive Web') {
            when { expression { return params.BUILD_WEB } }
            steps {
                archiveArtifacts artifacts: 'dist/**/*', fingerprint: true
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
                    sshagent(credentials: ['deploy-ssh-key']) {
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

// Функции-обертки для контейнеров (как в твоем рабочем файле)
def withNodeBuilder(Closure body) {
    docker.image("${env.NODE_IMAGE}:latest").inside('-u root') {
        body()
    }
}

def withAndroidBuilder(Closure body) {
    // ВНИМАНИЕ: Если на этапе Android все еще будет падать aapt2, 
    // добавь сюда флаг эмуляции: inside('-u root --platform linux/amd64')
    docker.image("${env.ANDROID_IMAGE}:latest").inside('-u root') {
        body()
    }
}