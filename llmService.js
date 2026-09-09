const { Mistral } = require('@mistralai/mistralai');
require('dotenv').config();
const buildSystemPrompt = require('./promptTemplate');

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

async function generateQueryFromPrompt(userPrompt) {
  try {
    const response = await client.chat.complete({
      model: 'ministral-3b-2512',
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: userPrompt },
      ],
      responseFormat: { type: 'json_object' },
    });

    const rawText = response.choices[0].message.content;

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (err) {
      throw new Error('LLM did not return valid JSON: ' + rawText);
    }

    return parsed;
  } catch (err) {
    if (err.statusCode === 429) {
      throw new Error('Rate limit reached. Please wait a few seconds and try again.');
    }
    throw err;
  }
}

module.exports = generateQueryFromPrompt;