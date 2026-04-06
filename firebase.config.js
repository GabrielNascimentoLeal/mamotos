const firebaseConfig = {
  apiKey: "AIzaSyAhRVTRem3lJUAvuU9JEzjAlk6hlSWm85E",
  authDomain: "ma-motos.firebaseapp.com",
  projectId: "ma-motos",
  storageBucket: "ma-motos.firebasestorage.app",
  messagingSenderId: "77729743454",
  appId: "1:77729743454:web:d728215c256973b4aa2acf"
};

window.FIREBASE_CONFIG = firebaseConfig;
window.FIREBASE_CONFIGURED = Object.values(firebaseConfig).every(v => v !== "");