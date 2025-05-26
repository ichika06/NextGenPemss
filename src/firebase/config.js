/**
 * Initializes a Firebase app with the provided configuration and sets up Firestore and Storage services.
 * @param {Object} firebaseConfig - The configuration object containing API keys and other settings for Firebase.
 * @returns {Object} The initialized Firebase app.
 * @exports {Object} db - The Firestore database instance.
 * @exports {Object} storage - The Firebase Storage instance.
 */
// import { initializeApp } from "firebase/app"
// import { getFirestore } from "firebase/firestore"
// import { getStorage } from "firebase/storage"

// // const firebaseConfig = {
// //     apiKey: "AIzaSyC8tDVbDIrKuylsyF3rbDSSPlzsEHXqZIs",
// //     authDomain: "online-attendance-21f95.firebaseapp.com",
// //     databaseURL: "https://online-attendance-21f95-default-rtdb.firebaseio.com",
// //     projectId: "online-attendance-21f95",
// //     storageBucket: "online-attendance-21f95.appspot.com",
// //     messagingSenderId: "756223518392",
// //     appId: "1:756223518392:web:5e8d28c78f7eefb8be764d"
// //   };

// const firebaseConfig = {
//   apiKey: "AIzaSyB_wTtnR7BVhfx25VwfIv8mcIUcGg07e8c",
//   authDomain: "nextgen-pemss.firebaseapp.com",
//   databaseURL: "https://nextgen-pemss-default-rtdb.asia-southeast1.firebasedatabase.app",
//   projectId: "nextgen-pemss",
//   storageBucket: "nextgen-pemss.firebasestorage.app",
//   messagingSenderId: "671169830872",
//   appId: "1:671169830872:web:227ff20b3bb2d74872dcad",
//   measurementId: "G-7VYSTJJWRR"
// };

// // Initialize Firebase
// const app = initializeApp(firebaseConfig)
// export const db = getFirestore(app)
// export const storage = getStorage(app)

// export default app

import { initializeApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage"
import { getDatabase } from "firebase/database" // <-- Add this

const firebaseConfig = {
    apiKey: "AIzaSyB_wTtnR7BVhfx25VwfIv8mcIUcGg07e8c",
    authDomain: "nextgen-pemss.firebaseapp.com",
    databaseURL: "https://nextgen-pemss-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "nextgen-pemss",
    storageBucket: "nextgen-pemss.firebasestorage.app",
    messagingSenderId: "671169830872",
    appId: "1:671169830872:web:227ff20b3bb2d74872dcad",
    measurementId: "G-7VYSTJJWRR"
  };

// const firebaseConfig = {
//   apiKey: "AIzaSyB_wTtnR7BVhfx25VwfIv8mcIUcGg07e8c",
//   authDomain: "nextgen-pemss.firebaseapp.com",
//   databaseURL: "https://nextgen-pemss-default-rtdb.asia-southeast1.firebasedatabase.app",
//   projectId: "nextgen-pemss",
//   storageBucket: "nextgen-pemss.firebasestorage.app",
//   messagingSenderId: "671169830872",
//   appId: "1:671169830872:web:227ff20b3bb2d74872dcad",
//   measurementId: "G-7VYSTJJWRR"
// };

// Initialize Firebase
const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const database = getDatabase(app) // <-- Add this

export default app


