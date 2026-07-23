import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import * as dotenv from 'dotenv';

dotenv.config();

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT as string);
const app = initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore(app);
const auth = getAuth(app);

async function check() {
  const email = 'gogeta.blue053wow@gmail.com';
  try {
    const usersSnap = await db.collection('users').where('email', '==', email).get();
    usersSnap.forEach(doc => {
      console.log(`Firestore User: ${doc.id} - email: ${doc.data().email} - isAdmin: ${doc.data().isAdmin}`);
    });

    const authUser = await auth.getUserByEmail(email);
    console.log(`Auth User: ${authUser.uid} - providers: ${authUser.providerData.map(p => p.providerId).join(', ')}`);
  } catch (err: any) {
    console.error(err);
  }
}

check().then(() => process.exit(0));
