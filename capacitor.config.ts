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
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
