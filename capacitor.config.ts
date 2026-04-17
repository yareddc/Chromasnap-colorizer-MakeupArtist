import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chromasnap.app',
  appName: 'ChromaSnap',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    FirebaseAuthentication: {
      providers: ['google.com', 'phone'],
      skipNativeAuth: false,
    },
  }
};

export default config;
