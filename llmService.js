const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const buildSystemPrompt = require('./promptTemplate');


const FALLBACK_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.7-flash',
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-pro-latest',
];

async function generateQueryFromPrompt(userPrompt, apiKey = null) {
  const activeKey = apiKey || process.env.GEMINI_API_KEY;
  if (!activeKey) {
    throw new Error('Gemini API key is required. Please configure your Gemini API key.');
  }

  const client = new GoogleGenerativeAI(activeKey);
  let lastError = null;

  for (const modelName of FALLBACK_MODELS) {
    try {
      const model = client.getGenerativeModel({
        model: modelName,
        systemInstruction: buildSystemPrompt(),
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });

      const result = await model.generateContent(userPrompt);
      const rawText = result.response.text();

      // Clean any potential markdown wrapping
      const cleaned = rawText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      const parsed = JSON.parse(cleaned);
      return parsed;
    } catch (err) {
      console.warn(`[LLM Service] Model "${modelName}" failed:`, err.message);
      lastError = err;
    }
  }

  throw new Error(`All LLM models failed. Last error: ${lastError ? lastError.message : 'Unknown'}`);
}

module.exports = generateQueryFromPrompt;