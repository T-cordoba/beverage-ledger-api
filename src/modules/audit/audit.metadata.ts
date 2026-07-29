/**
 * What an audit entry may carry beyond the action itself: ids, names, quantities,
 * before-and-after values.
 *
 * Deliberately flat and scalar. An audit entry is read by a person answering
 * "who changed this and to what", and nesting arbitrary objects turns that into
 * a JSON archaeology exercise.
 */
export type AuditMetadata = Record<string, string | number | boolean | null | undefined>;
