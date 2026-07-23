import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import * as dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// We need to use talko-40a99! But we don't have its service account!
// Wait, can we just use the frontend API to update the user if we login?
