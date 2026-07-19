import OpenAI from "openai";

async function main() {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      console.log("GITHUB_TOKEN is not set.");
      return;
    }
    console.log("Testing with GITHUB_TOKEN / OpenAI...");
    const ai = new OpenAI({
      baseURL: "https://models.inference.ai.azure.com",
      apiKey: token,
    });

    const response = await ai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Say hello!" }],
    });
    console.log("Success with OpenAI! Response:", response.choices[0]?.message?.content);
  } catch (err) {
    console.error("OpenAI test failed:", err);
  }
}

main();
