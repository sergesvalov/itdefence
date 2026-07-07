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
    // Ориентация: только landscape (нужна для TD-игр)
    allowMixedContent: false,
  },
};

export default config;
