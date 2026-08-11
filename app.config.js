// Deliberately app.config.js, NOT app.json: static JSON never evaluates
// process.env.X, so react-native-maps' config plugin would write the literal
// string "process.env.GOOGLE_MAPS_API_KEY" into AndroidManifest.xml.
// See .planning/phases/01-foundation-auth/01-RESEARCH.md Pitfall 4.
require('dotenv').config();

module.exports = {
  expo: {
    name: 'GoRide',
    slug: 'go-ride-user-app',
    scheme: 'gorider',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    plugins: [
      'expo-router',
      'expo-secure-store',
      'expo-splash-screen',
      ['react-native-maps', { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY }],
    ],
    experiments: {
      typedRoutes: true,
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.goride.rider',
    },
    android: {
      package: 'com.goride.rider',
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      router: {},
    },
  },
};
