import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  projectId: 'homejira',
  appId: '1:624292825344:web:4c3fc19cdd5ca675d0cbe5',
  storageBucket: 'homejira.firebasestorage.app',
  apiKey: 'AIzaSyBjkV8HISbjn2poVTWvn23A-aJD-fbxlu8',
  authDomain: 'homejira.firebaseapp.com',
  messagingSenderId: '624292825344',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
