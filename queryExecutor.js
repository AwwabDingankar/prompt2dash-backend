const pool = require('./db');

function sanitizeRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const cleanRow = { ...row };
    for (const [key, val] of Object.entries(cleanRow)) {
      if (typeof val === 'string' && val.trim() !== '' && !isNaN(val)) {
        cleanRow[key] = Number(val);
      }
    }
    return cleanRow;
  });
}

async function executeValidatedQuery(sql) {
  // Enforce a hard row limit as a last line of defense,
  // in case the LLM forgot to add LIMIT
  const hasLimit = /LIMIT\s+\d+/i.test(sql);
  const finalSql = hasLimit ? sql : `${sql.replace(/;$/, '')} LIMIT 100;`;

  const result = await pool.query(finalSql);
  return sanitizeRows(result.rows);
}

module.exports = executeValidatedQuery;