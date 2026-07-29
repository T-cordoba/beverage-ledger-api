import { rgb } from 'pdf-lib';

/**
 * Every measurement and colour the movement document uses.
 *
 * Gathered here because the original had the palette written out three times
 * across the frontend and drifting each time. Colours are the document's own, not
 * the organization's: per-tenant theming needs a colour on the organizations row,
 * which does not exist yet.
 */
export const PAGE = {
  width: 595, // A4 at 72dpi
  height: 842,
  margin: 40,
  headerHeight: 96,
  footerHeight: 56,
};

export const COLOR = {
  ink: rgb(0.1, 0.1, 0.1),
  muted: rgb(0.42, 0.42, 0.42),
  onDark: rgb(0.94, 0.9, 0.81),
  dark: rgb(0.07, 0.0, 0.02),
  accent: rgb(0.83, 0.69, 0.22),
  rule: rgb(0.8, 0.78, 0.74),
  zebra: rgb(0.96, 0.95, 0.93),
  paper: rgb(1, 1, 1),
};

export const TEXT = {
  title: 20,
  subtitle: 10,
  heading: 13,
  body: 9,
  small: 8,
  line: 12,
};

export const COLUMNS = [
  { header: 'Item', width: 215, align: 'left' as const },
  { header: 'Brand', width: 125, align: 'left' as const },
  { header: 'Qty', width: 45, align: 'right' as const },
  { header: 'Unit', width: 60, align: 'left' as const },
  { header: 'Singles', width: 70, align: 'right' as const },
];

export const TABLE_WIDTH = COLUMNS.reduce((total, column) => total + column.width, 0);
