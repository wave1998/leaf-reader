import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.leafreader.app',
  appName: '叶读',
  webDir: 'dist',
  backgroundColor: '#f8f7f3',
  android: { backgroundColor: '#f8f7f3', allowMixedContent: false },
};

export default config;
