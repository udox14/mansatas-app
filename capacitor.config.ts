import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mansatas.app',
  appName: 'MANSATAS App',
  webDir: 'public',
  appendUserAgent: 'MANSATAS_APP_NATIVE',
  server: {
    url: 'https://app.mansatas.com/',
    cleartext: false,
    errorPath: 'offline.html',
  },
  plugins: {
    // MainActivity owns native insets for every Android/WebView version.
    SystemBars: {
      insetsHandling: 'disable',
      hidden: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
