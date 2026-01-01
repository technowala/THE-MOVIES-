// Firebase Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyBe-dPWzrtfcXJ3Wq9nF0GZyDoe2T5xnSs",
    authDomain: "the-movies-app-54a18.firebaseapp.com",
    databaseURL: "https://the-movies-app-54a18-default-rtdb.firebaseio.com",
    projectId: "the-movies-app-54a18",
    storageBucket: "the-movies-app-54a18.firebasestorage.app",
    messagingSenderId: "684636684598",
    appId: "1:684636684598:web:9112573f4aa16a94cbf397",
    measurementId: "G-FGV2382QM5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const storage = getStorage(app);
const moviesRef = ref(db, 'movies');
const usersRef = ref(db, 'users');

// Export functionality for script.js
window.db = db;
window.storage = storage;
window.moviesRef = moviesRef;
window.usersRef = usersRef;
window.push = push;
window.ref = ref;
window.onValue = onValue;
window.remove = remove;
window.update = update;
window.set = set; // useful for strict keys if needed
window.sRef = sRef;
window.uploadBytes = uploadBytes;
window.getDownloadURL = getDownloadURL;
