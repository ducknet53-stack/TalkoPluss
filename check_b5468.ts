import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
dotenv.config();

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT as string);
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function run() {
  const snaps = await db.collection('users').get();
  console.log("Users in talko-b5468:");
  snaps.forEach(doc => console.log(doc.data().username));
}
run().then(() => process.exit(0));
