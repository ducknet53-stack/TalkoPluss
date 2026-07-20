import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
const app = admin.initializeApp({
  credential: admin.cert(JSON.parse(saJson))
});
const db = getFirestore(app);
const messaging = getMessaging(app);
console.log("DB:", !!db, "Messaging:", !!messaging);
