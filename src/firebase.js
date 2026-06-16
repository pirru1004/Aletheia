import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: "mss26-satdat-pirru",
  appId: "1:54563636881:web:7ef24ff208a849abada130",
  storageBucket: "mss26-satdat-pirru.firebasestorage.app",
  apiKey: "AIzaSyAXDgfcBMskNfON97oGxtkINQurPCqJtr8",
  authDomain: "mss26-satdat-pirru.firebaseapp.com",
  messagingSenderId: "54563636881"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);

export { app, auth, googleProvider, db };
