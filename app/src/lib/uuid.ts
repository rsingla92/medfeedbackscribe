/**
 * UUID validation utilities
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns true if the given string matches the standard UUID 8-4-4-4-12 hex
 * format (any version / variant).  Used to validate route / request params
 * before they reach the database.
 */
export function isValidUUID(id: string): boolean {
  return UUID_PATTERN.test(id);
}
