import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mansatas.app',
  appName: 'MANSATAS App',
  webDir: 'public',
  server: {
    url: 'https://app.mansatas.com/',
    cleartext: false,
  },
};

export default config;
