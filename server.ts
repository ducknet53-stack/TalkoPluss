import express from 'express';
import { createServer as createViteServer } from 'vite';
import OpenAI from 'openai';
import cors from 'cors';
import path from 'path';

const app = express();
app.use(express.json());
app.use(cors());

app.post('/api/ai/chat', async (req, res) => {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("GITHUB_TOKEN is not set in environment variables.");
    }
    
    const ai = new OpenAI({
      baseURL: 'https://models.inference.ai.azure.com',
      apiKey: token,
    });
    
    const { message, history } = req.body;
    
    const formattedHistory = history.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.text
    }));

    const response = await ai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Sen Talko AI'sın. Talko'nun resmi yapay zeka asistanısın. Kullanıcıların sorularını yanıtlarsın. Kullanıcılara yardım et ve nazik ol."
        },
        ...formattedHistory,
        { role: "user", content: message }
      ],
      stream: true,
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of response) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    console.error('AI error:', err);
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
