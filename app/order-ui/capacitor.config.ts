import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.trendcoffee.order',
  appName: 'TREND Coffee',
  webDir: 'dist',

  server: {

    /**
     * 🧑‍💻 DEV MODE – Live reload (chạy trực tiếp từ máy dev)
     * Bỏ comment dòng dưới khi DEV app mobile qua USB/Wi-Fi
     * ⚠️ Thay IP bằng IP LAN thật của máy (vd: 192.168.1.34)
     */
    
    // url: 'http://192.168.1.34:5173',
    // cleartext: true,
    androidScheme: 'https',
    iosScheme: 'https',
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1a1a1a',
    },
    Keyboard: {
      resize: 'body',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
}

export default config
