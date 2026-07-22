const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { initializeApp, cert } = require('firebase-admin/app');
const fs = require('fs');

async function grant() {
  const serviceAccountPath = '/app/applet/firebase-applet-config.json';
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    initializeApp({
      credential: cert(serviceAccount)
    });
    
    try {
      const auth = getAuth();
      const user = await auth.getUserByEmail('goku1@gmail.com');
      console.log('Found Goku:', user.uid);
      const db = getFirestore();
      await db.collection('users').doc(user.uid).update({ isAdmin: true });
      console.log('Granted admin in Firestore!');
    } catch(e) {
      console.error(e);
    }
  }
}
grant();
