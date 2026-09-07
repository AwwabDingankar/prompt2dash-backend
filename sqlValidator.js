const ALLOWED_TABLES = ['customers', 'products', 'orders'];

// Keywords that should never appear in a generated query
const FORBIDDEN_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE',
  'CREATE', 'GRANT', 'REVOKE', 'EXECUTE', ';--', 'xp_cmdshell'
];

function validateSql(sql) {
  const upperSql = sql.toUpperCase();

  // 1. Must start with SELECT
  const trimmed = sql.trim();
  if (!trimmed.toUpperCase().startsWith('SELECT')) {
    return { valid: false, reason: 'Only SELECT queries are allowed.' };
  }

  // 2. Block forbidden keywords
  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (upperSql.includes(keyword)) {
      return { valid: false, reason: `Forbidden keyword detected: ${keyword}` };
    }
  }

  // 3. Block multiple statements (stacked queries via semicolon)
  const semicolonCount = (sql.match(/;/g) || []).length;
  if (semicolonCount > 1) {
    return { valid: false, reason: 'Multiple statements are not allowed.' };
  }

  // 4. Must reference at least one allowed table
  const referencesAllowedTable = ALLOWED_TABLES.some(table =>
    new RegExp(`\\b${table}\\b`, 'i').test(sql)
  );
  if (!referencesAllowedTable) {
    return { valid: false, reason: 'Query does not reference any known table.' };
  }

  return { valid: true };
}

module.exports = validateSql;