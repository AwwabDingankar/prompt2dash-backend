const express = require('express');
const cors = require('cors');
require('dotenv').config();
const pool = require('./db');
const generateQueryFromPrompt = require('./llmService');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check route — confirms server is running
app.get('/', (req, res) => {
  res.json({ status: 'Prompt2Dash backend is running' });
});

// Test route — confirms Postgres connection works
app.get('/api/test-orders', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT region, SUM(total_amount) AS revenue FROM orders GROUP BY region ORDER BY revenue DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Query failed' });
  }
});

app.post('/api/generate-sql', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    const result = await generateQueryFromPrompt(prompt);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
