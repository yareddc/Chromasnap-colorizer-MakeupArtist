import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chromasnap.app',
  appName: 'ChromaSnap',
  webDir: 'dist',
  server: {
    androidScheme: 'http'
  }
};

export default config;
