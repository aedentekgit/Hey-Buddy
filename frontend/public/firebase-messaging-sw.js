importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// This is required for background notifications
// The actual config is handled by the browser when it registers the worker
// But for some setups, we need to initialize it here with a placeholder
// or wait for the web app to pass it.
// For simplicity, we'll keep it as a basic handler.

firebase.initializeApp({
    apiKey: "AIzaSyBH-qj2DmMqZh2t9tKMLScPP3VYtPlv3pU",
    authDomain: "heybuddy-8abaf.firebaseapp.com",
    projectId: "heybuddy-8abaf",
    storageBucket: "heybuddy-8abaf.firebasestorage.app",
    messagingSenderId: "358398871801",
    appId: "1:358398871801:web:f947ffc39e178371a2fa28",
    measurementId: "G-7ZVH2483SP"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/vite.svg'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
