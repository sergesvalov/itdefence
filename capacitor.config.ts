import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:    'com.sergesvalov.itdefence',
  appName:  'Office TD',
  webDir:   'dist',           // Capacitor берёт билд из dist/

  // На устройстве загружаем из bundled assets (не с сервера)
  server: {
    androidScheme: 'https',
  },

  android: {
    // Игра портретная (480×800) — жёсткий лок ориентации на portrait
    // задаётся в android/app/.../AndroidManifest.xml (android:screenOrientation),
    // этот файл в репозитории не хранится — генерируется `cap add android`.
    allowMixedContent: false,
  },
};

export default config;
