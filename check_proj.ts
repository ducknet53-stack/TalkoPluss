import * as dotenv from 'dotenv';
dotenv.config();

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT as string);
console.log('Service Account Project ID:', serviceAccount.project_id);
