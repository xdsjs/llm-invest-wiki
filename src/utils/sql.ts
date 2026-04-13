/**
 * Escape a string value for use in a SQL string literal.
 * Doubles single quotes and escapes backslashes.
 */
export function escapeSqlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "''");
}

/**
 * Wrap a value as a SQL string literal: 'value'
 */
export function escapeSqlLiteral(value: string): string {
  return `'${escapeSqlString(value)}'`;
}

/**
 * Escape an identifier (table/column name) with double quotes.
 */
export function escapeIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}
