/**
 * Builds the url-safe key a name is unique by.
 *
 * Accents are stripped first, so "Ron Añejo" and "Ron Anejo" collide instead of
 * becoming two catalogue entries for the same thing.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
