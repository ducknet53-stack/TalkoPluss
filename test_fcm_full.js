import express from "express";
import * as admin from "firebase-admin";

let adminApp = null;
let dbAdmin = null;
let messagingAdmin = null;

function getFirebaseAdmin() {
  if (!adminApp) {
    try {
      const adminModule = admin.default || admin;
      const adminApps = adminModule.apps || admin.apps;
      if (adminApps && adminApps.length > 0) {
        adminApp = adminApps[0];
      } else {
        const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
        const certFn = adminModule.cert || admin.cert;
        console.log("certFn exists?", !!certFn);
        if (saJson && certFn) {
          try {
            adminApp = adminModule.initializeApp({
              credential: certFn(JSON.parse(saJson))
            });
            console.log("Initialized with JSON");
          } catch (e) {
            console.error("Failed JSON init:", e.message);
            adminApp = adminModule.initializeApp();
          }
        } else {
          adminApp = adminModule.initializeApp();
          console.log("Initialized with default");
        }
      }
      dbAdmin = adminApp.firestore();
      messagingAdmin = adminApp.messaging();
    } catch (err) {
      console.error("Fatal error:", err.message);
    }
  }
  return { db: dbAdmin, messaging: messagingAdmin };
}

console.log(getFirebaseAdmin());
