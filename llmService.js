const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const buildSystemPrompt = require('./promptTemplate');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateQueryFromPrompt(userPrompt) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.6-flash',
    systemInstruction: buildSystemPrompt(),
    generationConfig: {
      responseMimeType: 'application/json', // forces valid JSON output
    },
  });

  const result = await model.generateContent(userPrompt);
  const rawText = result.response.text();

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new Error('LLM did not return valid JSON: ' + rawText);
  }

  return parsed;
}

module.exports = generateQueryFromPrompt;