import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zipextractor.app',
  appName: 'Zip Extractor Online',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
