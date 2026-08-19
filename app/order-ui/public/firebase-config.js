// Firebase configuration for service worker
// This file is loaded by the service worker to initialize Firebase
// Config values should be injected at build time or set as environment variables
// NOTE: This is a fallback - main thread will send config via postMessage
// IMPORTANT: Service worker không hỗ trợ ES6 modules, KHÔNG dùng export/import
// IMPORTANT: Đổi tên biến để tránh conflict với firebaseConfig đã khai báo trong firebase-messaging-sw.js

var firebaseConfigFromFile = {
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  apiKey: "AIzaSyCDQnF9PEuqbTpkfA379tscDCRgjTY28nQ",
  authDomain: "order-notification-dev-v2.firebaseapp.com",
  projectId: "order-notification-dev-v2",
  storageBucket: "order-notification-dev-v2.firebasestorage.app",
  messagingSenderId: "526905752542",
  appId: "1:526905752542:web:6d05f6dec1947bdcc9fb4f",
  measurementId: "G-LSJT6YHQT9"
};

