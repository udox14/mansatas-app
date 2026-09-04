import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mansatas.app',
  appName: 'MANSATAS App',
  webDir: 'public',
  server: {
    url: 'https://app.mansatas.com/',
    cleartext: false,
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
