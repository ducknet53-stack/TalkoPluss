import express from "express";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import cors from "cors";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const app = express();
app.use(express.json());
app.use(cors());

// Lazy-initialize Firebase Admin SDK
let adminApp: any = null;
let dbAdmin: any = null;
let messagingAdmin: any = null;

function getFirebaseAdmin() {
  if (!adminApp) {
    try {
      const adminModule = (admin as any).default || admin;
      const adminApps = adminModule.apps || (admin as any).apps;
      if (adminApps && adminApps.length > 0) {
        adminApp = adminApps[0];
      } else {
        const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
        const certFn = adminModule.cert || (admin as any).cert;
        if (saJson && certFn) {
          try {
            adminApp = adminModule.initializeApp({
              credential: certFn(JSON.parse(saJson))
            });
          } catch (e: any) {
            console.error("[FIREBASE ADMIN] Failed to initialize with service account JSON, trying default:", e.message);
            adminApp = adminModule.initializeApp();
          }
        } else {
          adminApp = adminModule.initializeApp();
        }
      }
      dbAdmin = getFirestore(adminApp);
      messagingAdmin = getMessaging(adminApp);
      console.log("[FIREBASE ADMIN] SDK loaded successfully.");
    } catch (err: any) {
      console.warn("[FIREBASE ADMIN] Admin SDK initialization bypassed (No default credentials). Fallback local triggers are operational. Detail:", err.message);
    }
  }
  return { db: dbAdmin, messaging: messagingAdmin, adminApp };
}

// Helper to check admin auth
async function verifyAdminAuth(req: any, res: any) {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) throw new Error("Unauthorized");
  
  const { db, adminApp } = getFirebaseAdmin();
  if (!adminApp || !db) throw new Error("Firebase Admin not initialized");
  
  const decoded = await adminApp.auth().verifyIdToken(token);
  const userDoc = await db.collection('users').doc(decoded.uid).get();
  if (!userDoc.exists || !userDoc.data()?.isAdmin) {
    throw new Error("Forbidden: Not an admin");
  }
  return { uid: decoded.uid, db };
}

// Admin update user
app.post("/api/admin/update-user", async (req, res) => {
  try {
    const { db } = await verifyAdminAuth(req, res);
    const { targetUid, data } = req.body;
    if (!targetUid || !data) return res.status(400).json({ error: "Missing parameters" });
    
    await db.collection("users").doc(targetUid).update(data);
    res.json({ success: true });
  } catch (err: any) {
    res.status(err.message.includes("Forbidden") ? 403 : (err.message.includes("Unauthorized") ? 401 : 500)).json({ error: err.message });
  }
});

// Generic Admin Write API
app.post("/api/admin/batch", async (req, res) => {
  try {
    const { db } = await verifyAdminAuth(req, res);
    const { writes } = req.body;
    if (!writes || !Array.isArray(writes)) return res.status(400).json({ error: "Missing writes array" });
    
    const { FieldValue } = require('firebase-admin/firestore');
    
    // Helper to process special values
    const processData = (data: any) => {
      const processed = { ...data };
      for (const key in processed) {
        if (processed[key] === '__serverTimestamp') {
          processed[key] = FieldValue.serverTimestamp();
        } else if (typeof processed[key] === 'object' && processed[key] !== null && processed[key].__increment !== undefined) {
          processed[key] = FieldValue.increment(processed[key].__increment);
        }
      }
      return processed;
    };
    
    const batch = db.batch();
    for (const w of writes) {
      const ref = db.doc(w.path);
      const data = processData(w.data);
      if (w.type === 'set') batch.set(ref, data, { merge: w.merge });
      else if (w.type === 'update') batch.update(ref, data);
      else if (w.type === 'delete') batch.delete(ref);
    }
    await batch.commit();
    res.json({ success: true });
  } catch (err: any) {
    res.status(err.message.includes("Forbidden") ? 403 : (err.message.includes("Unauthorized") ? 401 : 500)).json({ error: err.message });
  }
});

// Push notification send endpoint
app.post("/api/notifications/send", async (req, res) => {
  const { chatId, senderId, senderName, text, participants, isGroup, groupName } = req.body;
  
  if (!chatId || !senderId || !text || !participants || !Array.isArray(participants)) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  try {
    const { db, messaging } = getFirebaseAdmin();
    
    if (!db || !messaging) {
      return res.json({ success: true, message: "Local notification fallback used" });
    }

    const targetUserIds = participants.filter(uid => uid !== senderId);
    if (targetUserIds.length === 0) {
      return res.json({ success: true, message: "No recipients to notify" });
    }

    const fcmTokens: string[] = [];

    for (const userId of targetUserIds) {
      // Check user preferences from Firestore before sending
      const userDoc = await db.collection("users").doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        const settings = userData?.notificationSettings;
        const messagesEnabled = settings?.messages !== false;
        const groupsEnabled = settings?.groups !== false;
        
        if (isGroup && !groupsEnabled) continue;
        if (!isGroup && !messagesEnabled) continue;
      }

      // Fetch active device tokens
      const tokensSnap = await db.collection("users").doc(userId).collection("tokens").get();
      tokensSnap.forEach(doc => {
        const data = doc.data();
        if (data && data.token) {
          fcmTokens.push(data.token);
        }
      });
    }

    if (fcmTokens.length === 0) {
      return res.json({ success: true, message: "No registered device tokens found" });
    }

    const title = isGroup ? `💬 ${groupName || "Grup Mesajı"}` : senderName || "Yeni Mesaj";
    const body = isGroup ? `${senderName}: ${text}` : text;

    const response = await messaging.sendEachForMulticast({
      tokens: fcmTokens,
      notification: {
        title,
        body,
      },
      data: {
        chatId,
        click_action: "/",
      },
    });

    // Automatically clean up failed/invalid registration tokens from Firestore
    if (response.failureCount > 0) {
      response.responses.forEach(async (resp, idx) => {
        if (!resp.success) {
          const staleToken = fcmTokens[idx];
          if (staleToken) {
            for (const userId of targetUserIds) {
              try {
                await db.collection("users").doc(userId).collection("tokens").doc(staleToken).delete();
              } catch (e) {}
            }
          }
        }
      });
    }

    return res.json({ success: true, sentCount: response.successCount });
  } catch (err: any) {
    console.error("[NOTIFICATIONS API ERROR]", err);
    return res.status(500).json({ error: err.message });
  }
});

// Initialize Gemini Client
const geminiClient = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

app.post("/api/ai/moderate", async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.json({ isAppropriate: true, category: "clean", reason: "" });
    }

    console.log(`[MODERATION REQUEST] Content to check: "${text}"`);

    let result = null;
    let openAiError = null;

    // 1. Try OpenAI/GitHub Models (gpt-4o) first
    const token = process.env.GITHUB_TOKEN;
    if (token) {
      console.log("[MODERATION] Attempting primary model: OpenAI (gpt-4o) via GITHUB_TOKEN...");
      try {
        const openai = new OpenAI({
          baseURL: "https://models.inference.ai.azure.com",
          apiKey: token,
        });

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are an expert content moderation AI. Respond only with a JSON object containing: isAppropriate (boolean), category (string: 'profanity' | 'harassment' | 'threat' | 'spam' | 'clean'), reason (string)."
            },
            {
              role: "user",
              content: `Aşağıdaki Türkçe mesajı bir sohbet uygulaması için moderasyon kontrolünden geçir.
Mesaj: "${text}"

Görev:
1. Küfür, hakaret, aşağılama, tehdit, taciz veya ağır argo içeriyor mu? (Özellikle a.mk, @mk, a m k, p!ç, o.ç, s*k gibi harf değiştirme, gizleme, sembol kullanma, aralara boşluk, nokta veya işaret yerleştirme yöntemlerine karşı duyarlı ol.)
2. Sadece kelime listesi eşleştirmesi yapma. Anlam ve bağlam analizi gerçekleştir. Mesajın asıl niyetini ve anlamını kavra.
3. Normal ve temiz bir sohbet mesajıysa (argo/alaycı kelimeler içerse bile hakaret veya küfür içermiyorsa, örneğin "Merhaba", "Bugün nasılsın?", "Talko çok güzel olmuş" gibi ifadeler) kesinlikle uygun kabul et (isAppropriate: true).
4. Çıktı formatı olarak kesinlikle şu JSON şemasını döndür:
{
  "isAppropriate": boolean,
  "category": string,
  "reason": string
}`
            }
          ],
          response_format: { type: "json_object" }
        });

        const responseText = response.choices[0]?.message?.content || "{}";
        console.log("[MODERATION] OpenAI (gpt-4o) Response received successfully:", responseText);
        result = JSON.parse(responseText);
      } catch (err: any) {
        openAiError = err;
        console.error("[MODERATION] Primary OpenAI moderation failed, falling back to Gemini. Detail:", err.message || err);
      }
    }

    // 2. Fall back to Gemini if OpenAI failed or GITHUB_TOKEN is not defined
    if (!result) {
      console.log("[MODERATION] Attempting Gemini API (gemini-2.0-flash)...");
      try {
        const response = await geminiClient.models.generateContent({
          model: "gemini-2.0-flash",
          contents: [{
            role: "user",
            parts: [{ 
              text: `Aşağıdaki Türkçe mesajı bir sohbet uygulaması için moderasyon kontrolünden geçir.
Mesaj: "${text}"

Görev:
1. Küfür, hakaret, aşağılama, tehdit, taciz veya ağır argo içeriyor mu? (Özellikle a.mk, @mk, a m k, p!ç, o.ç, s*k gibi harf değiştirme, gizleme, sembol kullanma, aralara boşluk, nokta veya işaret yerleştirme yöntemlerine karşı duyarlı ol.)
2. Sadece kelime listesi eşleştirmesi yapma. Anlam ve bağlam analizi gerçekleştir. Mesajın asıl niyetini ve anlamını kavra.
3. Normal ve temiz bir sohbet mesajıysa (argo/alaycı kelimeler içerse bile hakaret veya küfür içermiyorsa, örneğin "Merhaba", "Bugün nasılsın?", "Talko çok güzel olmuş" gibi ifadeler) kesinlikle uygun kabul et (isAppropriate: true).
4. Çıktı formatı olarak kesinlikle şu JSON şemasını döndür:
{
  "isAppropriate": boolean, // Uygunsa true, küfür/hakaret/uygunsuz ise false
  "category": string, // "profanity" (küfür/argo), "harassment" (taciz/aşağılama), "threat" (tehdit), "spam" (gereksiz tekrar), veya sorun yoksa "clean"
  "reason": string // Neden uygunsuz bulunduğuna dair kısa Türkçe açıklama
}`
            }]
          }],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                isAppropriate: {
                  type: Type.BOOLEAN,
                  description: "Mesaj uygunsa true, uygunsuzsa false (küfür/hakaret vb.)"
                },
                category: {
                  type: Type.STRING,
                  description: "İhlal varsa kategorisi: 'profanity', 'harassment', 'threat', 'spam'. Sorun yoksa 'clean'"
                },
                reason: {
                  type: Type.STRING,
                  description: "Neden uygunsuz olduğuna dair çok kısa bir açıklama (uygunsa boş bırak)"
                }
              },
              required: ["isAppropriate", "category", "reason"]
            }
          }
        });

        const responseText = response.text || "{}";
        console.log("[MODERATION] Gemini API Response received successfully:", responseText);
        result = JSON.parse(responseText);
      } catch (err: any) {
        console.warn("[MODERATION] Gemini API also failed. Falling back to automatic approval. Error detail:", err.message || err);
        result = {
          isAppropriate: true,
          category: "clean",
          reason: "Bypassed due to moderation service offline"
        };
      }
    }

    // Return the final result
    res.json(result);
  } catch (err: any) {
    console.warn("[MODERATION FATAL ERROR] Bypassing for safety. Detailed error logs:", err);
    res.json({ 
      isAppropriate: true, 
      category: "clean",
      reason: "Bypassed due to unexpected moderation error"
    });
  }
});

app.post("/api/ai/chat", async (req, res) => {
  try {
    const { message, history } = req.body;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const systemPrompt = "Sen Talko AI'sın. Talko'nun resmi, dahili yapay zeka asistanısın. Kullanıcıların sorularını samimi, sıcak, son derece profesyonelce ve tamamen Türkçe olarak yanıtlarsın. Talko platformunu ve özelliklerini mükemmel derecede bilirsin. Sorulara sanki Talko sisteminin bir parçası olduğunu bilerek cevap ver:\n\n" +
      "1. **Talko Nedir?**: Talko; gerçek zamanlı (real-time) anlık mesajlaşma, grup sohbetleri, canlı anketler (polls), profil özelleştirmeleri ve gelişmiş yapay zeka asistanı barındıran modern bir iletişim platformudur.\n" +
      "2. **Talko Verified (Mavi Tik / Doğrulanmış Profil) Nasıl Alınır?**:\n" +
      "   - Talko Verified, platformda önemli kişilere, markalara, kuruluşlara veya Talko Verified abonesi olan hesaplara verilen özel, mavi renkli resmi bir rozettir.\n" +
      "   - **NASIL BAŞVURULUR?**: Kullanıcılar kendi profillerini açıp, en alt kısımda bulunan **Talko Verified Başvurusu** alanına doğrulanma gerekçelerini (örneğin: içerik üreticisi olduklarını, kimliklerini kanıtlamak istediklerini vb.) yazarak kolayca başvurabilirler.\n" +
      "   - **ÖNEMLİ GİZLİLİK KURALI**: Kullanıcıya kesinlikle 'Admin Paneli'nden onaylanacak' veya 'Admin yetkisiyle buton tıklanacak' gibi dahili yönetim terimlerini söyleme! Bu detaylar arka planda gizli kalmalıdır. Bunun yerine, 'Başvurunuz sistem yöneticilerimiz ve ekibimiz tarafından incelenecek, profilinizin (fotoğraf, hakkımda alanı, genel aktivite) doğruluğu teyit edildikten sonra onaylanacaktır' şeklinde profesyonelce aktar.\n" +
      "   - Kullanıcılara başvurularının genellikle 24 saat içerisinde sonuçlanacağını belirtebilirsin. Ayrıca profil fotoğrafı ve dolu bir 'hakkımda' yazısının onay şansını artıracağını hatırlat.\n" +
      "3. **Sistem Özellikleri**:\n" +
      "   - **Gerçek Zamanlı Mesajlaşma**: Firebase Firestore tabanlı, anlık ve kesintisiz birebir sohbetler.\n" +
      "   - **Grup Sohbetleri**: Çoklu katılımcılı sohbetler oluşturma ve grup içinde '@Talko AI' yazarak doğrudan seninle (yapay zekayla) iletişime geçme özelliği.\n" +
      "   - **Canlı Anketler (Polls)**: Sohbetlerde anlık anketler oluşturup oylama yapma ve sonuçları canlı izleme.\n" +
      "   - **Çevrimiçi Durumu**: Kullanıcıların online/offline durumlarını ve son görülme zamanlarını anlık takip etme.";

    let streamSucceeded = false;
    const token = process.env.GITHUB_TOKEN;

    // Try OpenAI/Github first
    if (token) {
      try {
        const ai = new OpenAI({
          baseURL: "https://models.inference.ai.azure.com",
          apiKey: token,
        });

        const formattedHistory = history.map((msg: any) => ({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.text,
        }));

        const response = await ai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            ...formattedHistory,
            { role: "user", content: message },
          ],
          stream: true,
        });

        for await (const chunk of response) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
          }
        }
        streamSucceeded = true;
      } catch (err: any) {
        console.warn("[CHAT API] Primary OpenAI/Github chat failed, falling back to Gemini. Detail:", err.message);
      }
    }

    // Fallback to Gemini
    if (!streamSucceeded) {
      console.log("[CHAT API] Attempting Gemini API fallback (gemini-2.0-flash)...");
      try {
        const geminiHistory = history.map((msg: any) => ({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.text }]
        }));
        
        geminiHistory.push({ role: "user", parts: [{ text: message }] });

        const responseStream = await geminiClient.models.generateContentStream({
          model: "gemini-2.0-flash",
          contents: geminiHistory,
          config: {
            systemInstruction: systemPrompt
          }
        });

        for await (const chunk of responseStream) {
          if (chunk.text) {
            res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
          }
        }
        streamSucceeded = true;
      } catch (geminiErr: any) {
        console.error("[CHAT API] Both primary and fallback failed:", geminiErr);
        res.write(`data: ${JSON.stringify({ text: "\n\n⚠️ Üzgünüm, şu anda hizmet veremiyorum (Aşırı yoğunluk veya API hatası). Lütfen daha sonra tekrar deneyin." })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err: any) {
    console.error("AI error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ text: "\n\n⚠️ Beklenmeyen bir hata oluştu." })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    }
  }
});


async function startServer() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
