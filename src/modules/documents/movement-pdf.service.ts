import { Injectable } from '@nestjs/common';
import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import { MovementType, MovementUnit } from '../../generated/prisma/enums';
import type { MovementDto, MovementItemDto } from '../inventory/dto/movement.dto';
import type { OrganizationDto } from '../organizations/dto/organization.dto';
import { COLOR, COLUMNS, PAGE, TABLE_WIDTH, TEXT } from './movement-pdf.theme';

const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * One row per product, also for a transfer.
 *
 * A transfer stores each product twice — the outgoing half and the incoming one —
 * so printing the lines raw would list every product twice and double the total.
 * The outgoing half is the one kept: it carries the same quantity, and the two
 * warehouses belong in the header rather than in a duplicated row.
 */
function printableLines(movement: MovementDto): MovementItemDto[] {
  if (movement.type !== MovementType.TRANSFER) {
    return movement.items;
  }

  return movement.items.filter((item) => item.quantityBase < 0);
}

/**
 * The fonts, plus the only safe way to put user text through them.
 *
 * A standard font carries no glyph table of its own: it is WinAnsi-encoded, 218
 * characters, and `drawText` **throws** on anything outside that set. Since
 * product names and notes are user input, one pasted character from outside
 * Windows-1252 would turn a download into a 500.
 */
interface Typeset {
  regular: PDFFont;
  bold: PDFFont;
  /** Rewrites a string so every character can be drawn. */
  printable(value: string): string;
}

/**
 * Asks the font what it supports instead of assuming a range.
 *
 * WinAnsi is wider than Latin-1 — it has the dash, the curly quotes, the ellipsis
 * — and Spanish accents are in it, so folding by default would print "Anejo" for
 * no reason. Only what genuinely does not fit is folded to its base letter, and
 * only what survives neither test becomes a question mark: a document with one
 * odd character beats a document that refuses to exist.
 *
 * Embedding a Unicode font is the real fix, at the cost of versioning a font file.
 */
function typesetWith(regular: PDFFont, bold: PDFFont): Typeset {
  const supported = new Set(regular.getCharacterSet());
  const canDraw = (text: string): boolean =>
    [...text].every((character) => supported.has(character.codePointAt(0) ?? -1));

  return {
    regular,
    bold,
    printable: (value) =>
      [...value]
        .map((character) => {
          if (canDraw(character)) {
            return character;
          }

          const folded = character.normalize('NFD').replace(COMBINING_MARKS, '');

          return folded !== '' && canDraw(folded) ? folded : '?';
        })
        .join(''),
  };
}

/**
 * The document's own copy stays here rather than in the i18n bundle: it is
 * rendered server-side, so the frontend's message catalogue never sees it.
 */
const counted = (value: number, singular: string, plural: string): string =>
  `${value} ${Math.abs(value) === 1 ? singular : plural}`;

interface Cell {
  text: string;
  align: 'left' | 'right';
}

@Injectable()
export class MovementPdfService {
  /**
   * Renders one movement as an A4 document.
   *
   * Line text comes from the snapshots on the movement, never from the product
   * rows: a document reprinted a year later has to read as it did the day it was
   * issued, even after the product was renamed.
   */
  async render(movement: MovementDto, organization: OrganizationDto): Promise<Uint8Array> {
    const document = await PDFDocument.create();
    const type = typesetWith(
      await document.embedFont(StandardFonts.Helvetica),
      await document.embedFont(StandardFonts.HelveticaBold),
    );

    document.setTitle(`${movement.code} - ${organization.name}`);
    document.setProducer('Beverage Ledger');

    const rows = printableLines(movement).map((item): Cell[] => [
      { text: type.printable(item.productNameSnapshot), align: 'left' },
      { text: type.printable(item.brandNameSnapshot ?? '-'), align: 'left' },
      { text: String(Math.abs(item.quantity)), align: 'right' },
      { text: this.unitLabel(item.unit, item.quantity), align: 'left' },
      { text: String(Math.abs(item.quantityBase)), align: 'right' },
    ]);

    const pages: PDFPage[] = [];
    let page = this.addPage(document, pages);
    let y = this.drawFirstPageHeader(page, movement, organization, type);

    y = this.drawTableHeader(page, y, type);

    for (const [index, row] of rows.entries()) {
      const height = this.rowHeight(row, type.regular);

      if (y - height < PAGE.footerHeight + 40) {
        page = this.addPage(document, pages);
        y = this.drawContinuationHeader(page, movement, organization, type);
        y = this.drawTableHeader(page, y, type);
      }

      this.drawRow(page, y, row, height, index % 2 === 1, type.regular);
      y -= height;
    }

    this.drawTotals(page, y, movement, type);

    // Page numbers are stamped last because the total is only known once every
    // row has found a page.
    pages.forEach((each, index) => {
      this.drawFooter(each, index + 1, pages.length, organization, type);
    });

    return document.save();
  }

  private addPage(document: PDFDocument, pages: PDFPage[]): PDFPage {
    const page = document.addPage([PAGE.width, PAGE.height]);
    pages.push(page);
    return page;
  }

  private drawBanner(page: PDFPage, organization: OrganizationDto, type: Typeset): void {
    page.drawRectangle({
      x: 0,
      y: PAGE.height - PAGE.headerHeight,
      width: PAGE.width,
      height: PAGE.headerHeight,
      color: COLOR.dark,
    });

    page.drawText(type.printable(organization.name.toUpperCase()), {
      x: PAGE.margin,
      y: PAGE.height - 42,
      size: TEXT.title,
      font: type.bold,
      color: COLOR.onDark,
    });
  }

  private drawFirstPageHeader(
    page: PDFPage,
    movement: MovementDto,
    organization: OrganizationDto,
    type: Typeset,
  ): number {
    this.drawBanner(page, organization, type);

    page.drawText('Movimiento de inventario', {
      x: PAGE.margin,
      y: PAGE.height - 62,
      size: TEXT.subtitle,
      font: type.regular,
      color: COLOR.onDark,
    });

    page.drawText(movement.code, {
      x: PAGE.width - PAGE.margin - type.bold.widthOfTextAtSize(movement.code, TEXT.heading),
      y: PAGE.height - 42,
      size: TEXT.heading,
      font: type.bold,
      color: COLOR.accent,
    });

    const facts: [string, string][] = [
      ['Tipo', movement.type],
      ['Estado', movement.status],
      ['Fecha', type.printable(this.formatDate(movement.occurredAt, organization.timezone))],
      ['Registrado por', type.printable(movement.createdBy.name)],
      ...(movement.reason
        ? ([['Motivo', type.printable(movement.reason)]] as [string, string][])
        : []),
      ...(movement.note ? ([['Nota', type.printable(movement.note)]] as [string, string][]) : []),
    ];

    let y = PAGE.height - PAGE.headerHeight - 28;

    for (const [label, value] of facts) {
      page.drawText(`${label}:`, {
        x: PAGE.margin,
        y,
        size: TEXT.body,
        font: type.bold,
        color: COLOR.muted,
      });
      page.drawText(value, {
        x: PAGE.margin + 90,
        y,
        size: TEXT.body,
        font: type.regular,
        color: COLOR.ink,
      });
      y -= TEXT.line;
    }

    if (organization.legalName) {
      y -= 4;
      page.drawText(type.printable(organization.legalName), {
        x: PAGE.margin,
        y,
        size: TEXT.small,
        font: type.regular,
        color: COLOR.muted,
      });
      y -= TEXT.line;
    }

    return y - 12;
  }

  private drawContinuationHeader(
    page: PDFPage,
    movement: MovementDto,
    organization: OrganizationDto,
    type: Typeset,
  ): number {
    this.drawBanner(page, organization, type);

    page.drawText(`${movement.code} (continuación)`, {
      x: PAGE.margin,
      y: PAGE.height - 62,
      size: TEXT.subtitle,
      font: type.regular,
      color: COLOR.onDark,
    });

    return PAGE.height - PAGE.headerHeight - 24;
  }

  private drawTableHeader(page: PDFPage, y: number, { bold }: Typeset): number {
    const height = 20;

    page.drawRectangle({
      x: PAGE.margin,
      y: y - height,
      width: TABLE_WIDTH,
      height,
      color: COLOR.dark,
    });

    let x = PAGE.margin;

    for (const column of COLUMNS) {
      const width = bold.widthOfTextAtSize(column.header, TEXT.body);

      page.drawText(column.header, {
        x: column.align === 'right' ? x + column.width - 6 - width : x + 6,
        y: y - height + 6,
        size: TEXT.body,
        font: bold,
        color: COLOR.onDark,
      });

      x += column.width;
    }

    return y - height;
  }

  private rowHeight(row: Cell[], font: PDFFont): number {
    const lines = row.reduce(
      (most, cell, index) =>
        Math.max(most, this.wrap(cell.text, COLUMNS[index]!.width - 12, font).length),
      1,
    );

    return 8 + lines * TEXT.line;
  }

  private drawRow(
    page: PDFPage,
    y: number,
    row: Cell[],
    height: number,
    shaded: boolean,
    font: PDFFont,
  ): void {
    page.drawRectangle({
      x: PAGE.margin,
      y: y - height,
      width: TABLE_WIDTH,
      height,
      color: shaded ? COLOR.zebra : COLOR.paper,
      borderColor: COLOR.rule,
      borderWidth: 0.5,
    });

    let x = PAGE.margin;

    for (const [index, cell] of row.entries()) {
      const column = COLUMNS[index]!;

      this.wrap(cell.text, column.width - 12, font).forEach((line, lineIndex) => {
        const width = font.widthOfTextAtSize(line, TEXT.body);

        page.drawText(line, {
          x: cell.align === 'right' ? x + column.width - 6 - width : x + 6,
          y: y - 14 - lineIndex * TEXT.line,
          size: TEXT.body,
          font,
          color: COLOR.ink,
        });
      });

      x += column.width;
    }
  }

  private drawTotals(page: PDFPage, y: number, movement: MovementDto, type: Typeset): void {
    const lines = printableLines(movement);
    const singles = lines.reduce((total, item) => total + Math.abs(item.quantityBase), 0);
    const box = { width: 200, height: 44 };
    const top = y - 16;

    page.drawRectangle({
      x: PAGE.width - PAGE.margin - box.width,
      y: top - box.height,
      width: box.width,
      height: box.height,
      color: COLOR.accent,
    });

    page.drawText(`TOTAL: ${counted(singles, 'unidad', 'unidades')}`, {
      x: PAGE.width - PAGE.margin - box.width + 12,
      y: top - 20,
      size: TEXT.heading,
      font: type.bold,
      color: COLOR.dark,
    });

    page.drawText(counted(lines.length, 'línea', 'líneas'), {
      x: PAGE.width - PAGE.margin - box.width + 12,
      y: top - 34,
      size: TEXT.small,
      font: type.regular,
      color: COLOR.dark,
    });
  }

  private drawFooter(
    page: PDFPage,
    pageNumber: number,
    totalPages: number,
    organization: OrganizationDto,
    type: Typeset,
  ): void {
    const font = type.regular;

    page.drawLine({
      start: { x: PAGE.margin, y: PAGE.footerHeight },
      end: { x: PAGE.width - PAGE.margin, y: PAGE.footerHeight },
      thickness: 0.5,
      color: COLOR.rule,
    });

    page.drawText(type.printable(organization.legalName ?? organization.name), {
      x: PAGE.margin,
      y: PAGE.footerHeight - 14,
      size: TEXT.small,
      font,
      color: COLOR.muted,
    });

    const pagination = `Página ${pageNumber} de ${totalPages}`;

    page.drawText(pagination, {
      x: PAGE.width - PAGE.margin - font.widthOfTextAtSize(pagination, TEXT.small),
      y: PAGE.footerHeight - 14,
      size: TEXT.small,
      font,
      color: COLOR.muted,
    });
  }

  /** Wraps on measured width, not on an assumed average character width. */
  private wrap(text: string, maxWidth: number, font: PDFFont): string[] {
    if (!text) {
      return [''];
    }

    const lines: string[] = [];
    let current = '';

    for (const word of text.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;

      if (font.widthOfTextAtSize(candidate, TEXT.body) <= maxWidth) {
        current = candidate;
        continue;
      }

      if (current) {
        lines.push(current);
      }

      current = this.breakLongWord(word, maxWidth, font, lines);
    }

    if (current) {
      lines.push(current);
    }

    return lines.length > 0 ? lines : [''];
  }

  /** A single word wider than the column is cut rather than allowed to overflow. */
  private breakLongWord(word: string, maxWidth: number, font: PDFFont, lines: string[]): string {
    let remainder = word;

    while (font.widthOfTextAtSize(remainder, TEXT.body) > maxWidth && remainder.length > 1) {
      let cut = remainder.length;

      while (
        cut > 1 &&
        font.widthOfTextAtSize(`${remainder.slice(0, cut)}-`, TEXT.body) > maxWidth
      ) {
        cut -= 1;
      }

      lines.push(`${remainder.slice(0, cut)}-`);
      remainder = remainder.slice(cut);
    }

    return remainder;
  }

  private unitLabel(unit: MovementUnit, quantity: number): string {
    const plural = Math.abs(quantity) !== 1;

    if (unit === MovementUnit.CASE) {
      return plural ? 'cajas' : 'caja';
    }

    return plural ? 'botellas' : 'botella';
  }

  private formatDate(value: Date, timezone: string): string {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: timezone,
    }).format(value);
  }
}
