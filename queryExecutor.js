const pool = require('./db');

async function executeValidatedQuery(sql) {
  // Enforce a hard row limit as a last line of defense,
  // in case the LLM forgot to add LIMIT
  const hasLimit = /LIMIT\s+\d+/i.test(sql);
  const finalSql = hasLimit ? sql : `${sql.replace(/;$/, '')} LIMIT 100;`;

  const result = await pool.query(finalSql);
  return result.rows;
}

module.exports = executeValidatedQuery;