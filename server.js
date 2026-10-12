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

// Validation endpoint: checks Gemini API key authentication immediately
app.post('/api/validate-key', async (req, res) => {
  try {
    const { apiKey } = req.body;
    const clientKey = req.headers['x-gemini-api-key'] || apiKey;
    if (!clientKey || !clientKey.trim()) {
      return res.status(400).json({
        valid: false,
        error: 'Gemini API key is required.',
        isApiKeyError: true,
      });
    }

    const trimmedKey = clientKey.trim();
    if (trimmedKey.length < 20) {
      return res.status(400).json({
        valid: false,
        error: 'API key seems too short. Please verify your Google AI Studio key.',
        isApiKeyError: true,
      });
    }

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const client = new GoogleGenerativeAI(trimmedKey);
    const probeModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.7-flash', 'gemini-pro-latest'];
    let lastErr = null;

    for (const modelName of probeModels) {
      try {
        const model = client.getGenerativeModel({ model: modelName });
        await model.generateContent('ping');
        return res.json({ valid: true });
      } catch (err) {
        lastErr = err;
        const msg = err.message || '';
        // Immediate failure on authentication errors
        if (
          msg.includes('API_KEY_INVALID') ||
          msg.includes('API key not valid') ||
          msg.includes('403') ||
          msg.includes('unregistered') ||
          (msg.includes('400') && msg.includes('API key'))
        ) {
          return res.status(401).json({
            valid: false,
            error: 'Invalid Gemini API key. Please verify your key from Google AI Studio.',
            isApiKeyError: true,
          });
        }
        // If high demand (503) or quota exhausted (429), auth was successful
        if (msg.includes('503') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
          return res.json({ valid: true, note: 'Authenticated successfully (model busy/quota limit).' });
        }
      }
    }

    const lastMsg = lastErr ? lastErr.message : '';
    if (
      lastMsg.includes('API_KEY_INVALID') ||
      lastMsg.includes('API key not valid') ||
      lastMsg.includes('403') ||
      lastMsg.includes('unregistered')
    ) {
      return res.status(401).json({
        valid: false,
        error: 'Invalid Gemini API key. Please verify your key from Google AI Studio.',
        isApiKeyError: true,
      });
    }

    // Default to valid if authentication did not explicitly reject
    return res.json({ valid: true });
  } catch (err) {
    console.error('[Validate Key Error]:', err);
    return res.status(500).json({
      valid: false,
      error: 'Failed to validate API key: ' + err.message,
      isApiKeyError: false,
    });
  }
});


// Test route - NL2SQL generation
app.post('/api/generate-sql', async (req, res) => {
  try {
    const { prompt, apiKey } = req.body;
    const clientKey = req.headers['x-gemini-api-key'] || apiKey || process.env.GEMINI_API_KEY;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
    if (!clientKey) {
      return res.status(400).json({
        error: 'Gemini API key is required. Please configure your API key.',
        isApiKeyError: true,
      });
    }

    const result = await generateQueryFromPrompt(prompt, clientKey);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Primary endpoint: NL2Dashboard Generation & Execution
app.post('/api/query', async (req, res) => {
  try {
    const { prompt, apiKey } = req.body;
    const clientKey = req.headers['x-gemini-api-key'] || apiKey || process.env.GEMINI_API_KEY;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
    if (!clientKey) {
      return res.status(400).json({
        error: 'Gemini API key is required. Please configure your API key in the app.',
        isApiKeyError: true,
      });
    }

    // Step 1: LLM generates dashboard spec
    let llmResult;
    try {
      llmResult = await generateQueryFromPrompt(prompt, clientKey);
    } catch (llmErr) {
      console.warn('[LLM Generation Error]:', llmErr.message);
      const msg = llmErr.message || '';
      if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid') || msg.includes('403') || msg.includes('unregistered')) {
        return res.status(401).json({
          error: 'Your Gemini API key appears invalid. Please verify or update your key from Google AI Studio.',
          isApiKeyError: true,
        });
      }
      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota') || msg.includes('429')) {
        return res.status(429).json({
          error: 'Gemini API quota exceeded for your key. Please try again shortly or check your Google AI Studio limits.',
          isApiKeyError: true,
        });
      }
      return res.status(500).json({
        error: 'Failed to generate dashboard with AI. ' + (llmErr.message || ''),
      });
    }

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

    // Fallback: Legacy / Single-chart response
    if (llmResult.sql) {
      const validation = validateSql(llmResult.sql);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Generated query failed validation',
          reason: validation.reason,
        });
      }

      const data = await executeValidatedQuery(llmResult.sql);

      // Infer chart_type if not explicitly provided
      let chartType = llmResult.chart_type;
      if (!chartType || chartType === 'DataTable') {
        const xCol = (llmResult.x_axis || '').toLowerCase();
        const firstVal = data && data[0] && llmResult.x_axis ? String(data[0][llmResult.x_axis]) : '';
        const isDate = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4}-\d{2}|\d{2}\/\d{2})/i.test(firstVal) ||
                       /date|month|year|day|time|period/i.test(xCol);

        if (isDate && llmResult.y_axis) {
          chartType = 'LineChart';
        } else if (llmResult.x_axis && llmResult.y_axis) {
          if (data && data.length <= 6 && !chartType) {
            chartType = 'PieChart';
          } else {
            chartType = 'BarChart';
          }
        } else {
          chartType = chartType || 'DataTable';
        }
      }

      return res.json({
        isMultiChart: false,
        chart_type: chartType,
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
