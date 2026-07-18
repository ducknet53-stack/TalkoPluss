import express from "express";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import cors from "cors";
import path from "path";
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(express.json());
app.use(cors());

// Initialize Gemini Client
const geminiClient = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

app.post("/api/ai/chat", async (req, res) => {
  try {
    const { message, history } = req.body;

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("GITHUB_TOKEN is not set in environment variables.");
    }

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
        {
          role: "system",
          content:
            "Sen Talko AI'sın. Talko'nun resmi, dahili yapay zeka asistanısın. Kullanıcıların sorularını samimi, sıcak, son derece profesyonelce ve tamamen Türkçe olarak yanıtlarsın. Talko platformunu ve özelliklerini mükemmel derecede bilirsin. Sorulara sanki Talko sisteminin bir parçası olduğunu bilerek cevap ver:\n\n" +
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
            "   - **Çevrimiçi Durumu**: Kullanıcıların online/offline durumlarını ve son görülme zamanlarını anlık takip etme.",
        },
        ...formattedHistory,
        { role: "user", content: message },
      ],
      stream: true,
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    for await (const chunk of response) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err: any) {
    console.error("AI error:", err);
    res.status(500).json({ error: err.message });
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
