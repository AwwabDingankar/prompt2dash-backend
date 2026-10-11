const express = require('express');
const cors = require('cors');
require('dotenv').config();
const pool = require('./db');

const generateQueryFromPrompt = require('./llmService');
const validateSql = require('./sqlValidator');
const executeValidatedQuery = require('./queryExecutor');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'https://prompt2dash.vercel.app']
}));
app.use(express.json());

// Health check route — confirms server is running
app.get('/', (req, res) => {
  res.json({ status: 'Prompt2Dash backend is running' });
});

// Test route — confirms Postgres connection works
app.get('/api/test-orders', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT region, SUM(revenue) AS revenue FROM sales GROUP BY region ORDER BY revenue DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Query failed' });
  }
});

// Test route - NL2SQL generation
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

// Primary endpoint: NL2Dashboard Generation & Execution
app.post('/api/query', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    // Step 1: LLM generates dashboard spec
    const llmResult = await generateQueryFromPrompt(prompt);

    // Multi-chart dashboard response
    if (llmResult.charts || llmResult.kpis) {
      // Execute KPIs in parallel
      const kpis = await Promise.all((llmResult.kpis || []).map(async (kpi) => {
        try {
          const validation = validateSql(kpi.sql);
          if (!validation.valid) {
            return { ...kpi, error: validation.reason, value: null };
          }
          const rows = await executeValidatedQuery(kpi.sql);
          const rawVal = rows && rows[0] ? (rows[0].value ?? Object.values(rows[0])[0]) : 0;
          return {
            ...kpi,
            value: rawVal,
            data: rows,
          };
        } catch (err) {
          console.warn(`KPI "${kpi.title}" failed:`, err.message);
          return { ...kpi, error: err.message, value: null };
        }
      }));

      // Execute Charts in parallel
      const charts = await Promise.all((llmResult.charts || []).map(async (chart, index) => {
        try {
          const validation = validateSql(chart.sql);
          if (!validation.valid) {
            return { ...chart, error: validation.reason, data: [] };
          }
          const rows = await executeValidatedQuery(chart.sql);
          return {
            id: chart.id || `chart_${index + 1}`,
            ...chart,
            data: rows,
          };
        } catch (err) {
          console.warn(`Chart "${chart.title}" failed:`, err.message);
          return { ...chart, error: err.message, data: [] };
        }
      }));

      return res.json({
        isMultiChart: true,
        dashboard_title: llmResult.dashboard_title || 'Analytics Dashboard',
        summary: llmResult.summary || 'Generated multi-widget dashboard analytics.',
        kpis,
        charts,
      });
    }

    // Fallback: Legacy single-chart response
    if (llmResult.sql) {
      const validation = validateSql(llmResult.sql);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Generated query failed validation',
          reason: validation.reason,
        });
      }

      const data = await executeValidatedQuery(llmResult.sql);
      return res.json({
        isMultiChart: false,
        ...llmResult,
        data,
      });
    }

    res.status(500).json({ error: 'LLM returned unrecognized structure', details: llmResult });
  } catch (err) {
    console.error('API Error in /api/query:', err);
    res.status(500).json({ error: 'Something went wrong', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
