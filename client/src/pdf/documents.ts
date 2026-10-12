// Builds the roster and record PDFs in the browser. Loaded lazily (see lib/pdf.ts) because pdfkit
// and its embedded fonts are large.
import PDFDocument from 'pdfkit/js/pdfkit.standalone.js';
import { formatDate, formatDateRange } from '../lib/dates';
import { judgeRoleLabel } from '../lib/judges';
import { membershipStatus, sortByName, type MembershipStatus } from '../lib/membership';
import { isSequentialType, recordMembers, recordPdfTitle } from '../lib/records';
import { formationIds, normalizeGrids } from '../lib/validation';
import { VIEWPOINT_DESCRIPTIONS, VIEWPOINT_LABELS } from '../lib/viewpoint';
import type { Contact, FormationGrid, Judge, RecordEntry, RecordEvent, Skydiver, Viewpoint } from '../types';

const MARGIN = 50;
const COLORS = {
  text: '#0f172a',
  muted: '#64748b',
  rule: '#cbd5e1',
  headerBg: '#f1f5f9',
  zebra: '#f8fafc',
  expired: '#b91c1c',
  expiring: '#b45309',
  current: '#047857',
};

const STATUS_LABEL: Record<MembershipStatus, string> = {
  current: 'Current',
  'expires-during-event': 'Expires during event',
  expired: 'EXPIRED',
};
const STATUS_COLOR: Record<MembershipStatus, string> = {
  current: COLORS.current,
  'expires-during-event': COLORS.expiring,
  expired: COLORS.expired,
};

type CellKey = 'num' | 'first' | 'last' | 'nick' | 'id' | 'license' | 'exp' | 'video' | 'status';
type Column = { key: CellKey; label: string; width: number };

// Each column set's widths sum to the 512pt content width of a portrait Letter page with 50pt margins.
const ROSTER_COLUMNS: readonly Column[] = [
  { key: 'num', label: '#', width: 26 },
  { key: 'first', label: 'First Name', width: 70 },
  { key: 'last', label: 'Last Name', width: 76 },
  { key: 'nick', label: 'Nick', width: 56 },
  { key: 'id', label: 'USPA ID', width: 52 },
  { key: 'license', label: 'License', width: 50 },
  { key: 'exp', label: 'Expiration', width: 64 },
  { key: 'video', label: 'Video', width: 38 },
  { key: 'status', label: 'Status', width: 80 },
];

/** Record PDF: participants and videographers are separate tables, so no Video or Nick column. */
const RECORD_COLUMNS: readonly Column[] = [
  { key: 'num', label: '#', width: 30 },
  { key: 'first', label: 'First Name', width: 100 },
  { key: 'last', label: 'Last Name', width: 100 },
  { key: 'id', label: 'USPA ID', width: 66 },
  { key: 'license', label: 'License', width: 60 },
  { key: 'exp', label: 'Expiration', width: 72 },
  { key: 'status', label: 'Status', width: 84 },
];
const CELL_PAD = 4;

function contactText(c: Contact | Judge): string {
  if (!c.name) return '—';
  const role = 'role' in c ? judgeRoleLabel(c.role) : '';
  return [role ? `${c.name} (${role})` : c.name, c.phone, c.email].filter(Boolean).join('  ·  ');
}

type Doc = PDFKit.PDFDocument;

const CONTENT_LEFT = MARGIN;
const contentWidth = (doc: Doc) => doc.page.width - MARGIN * 2;
const contentBottom = (doc: Doc) => doc.page.height - MARGIN - 20; // leave room for the footer

/** Runs `draw` against a portrait Letter document and resolves with the finished PDF bytes. */
function renderPdf(title: string, footerLabel: string, generatedAt: Date, draw: (doc: Doc) => void): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      layout: 'portrait',
      margin: MARGIN,
      bufferPages: true,
      info: { Title: title, Subject: 'Wingsuit record event' },
    });
    const chunks: Uint8Array[] = [];
    doc.on('data', (c: Uint8Array) => chunks.push(c));
    doc.on('end', () => resolve(concatBytes(chunks)));
    doc.on('error', reject);
    try {
      draw(doc);
      drawFooters(doc, footerLabel, generatedAt);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function drawFooters(doc: Doc, label: string, generatedAt: Date) {
  const range = doc.bufferedPageRange();
  const stamp = generatedAt.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0; // allow writing below the content area without auto-paging
    const footer = `${label}  ·  Generated ${stamp}  ·  Page ${i + 1} of ${range.count}`;
    // Shrink long footers (long record titles) so they stay on one line.
    let size = 8;
    doc.font('Helvetica');
    while (size > 5.5 && doc.fontSize(size).widthOfString(footer) > contentWidth(doc)) size -= 0.5;
    doc
      .fontSize(size)
      .fillColor(COLORS.muted)
      .text(footer, CONTENT_LEFT, doc.page.height - MARGIN + 10, {
        width: contentWidth(doc),
        align: 'center',
        lineBreak: false,
      });
    doc.page.margins.bottom = savedBottom;
  }
}

/** Section heading plus a one-line note (amber when there are membership warnings). */
function drawSectionHeading(doc: Doc, title: string, note: string, warn: boolean) {
  doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.text).text(title, CONTENT_LEFT, doc.y);
  if (note) doc.font('Helvetica').fontSize(9).fillColor(warn ? COLORS.expiring : COLORS.muted).text(note, { width: contentWidth(doc) });
  doc.moveDown(0.5);
}

function warningNote(count: number): string {
  return count
    ? `Sorted by first name. ${count} skydiver${count === 1 ? ' has' : 's have'} a membership that expires before or during the event.`
    : 'Sorted by first name.';
}

/** The skydiver table, sorted by first name, with the header repeated on each new page. */
function drawSkydiverTable(
  doc: Doc,
  skydivers: Skydiver[],
  event: RecordEvent,
  emptyText: string,
  columns: readonly Column[] = ROSTER_COLUMNS,
) {
  const left = CONTENT_LEFT;
  const width = contentWidth(doc);
  const rows = sortByName(skydivers).map((s) => ({
    s,
    status: membershipStatus(s.membershipExpiration, event),
  }));

  const drawHeader = () => {
    const y = doc.y;
    doc.rect(left, y, width, 18).fill(COLORS.headerBg);
    let x = left;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.muted);
    for (const col of columns) {
      doc.text(col.label.toUpperCase(), x + CELL_PAD, y + 5, { width: col.width - CELL_PAD * 2, lineBreak: false });
      x += col.width;
    }
    doc.y = y + 18;
  };

  if (rows.length === 0) {
    doc.font('Helvetica-Oblique').fontSize(10).fillColor(COLORS.muted).text(emptyText, left, doc.y + 6);
    return;
  }
  drawHeader();
  doc.fontSize(9);
  rows.forEach(({ s, status }, i) => {
    const cells: Record<CellKey, string> = {
      num: String(s.jumperNumber),
      first: s.firstName,
      last: s.lastName,
      nick: s.nickName || '',
      id: s.uspaMembershipId,
      license: s.uspaLicenseNumber || '—',
      exp: formatDate(s.membershipExpiration),
      video: s.isVideographer ? 'Yes' : '',
      status: STATUS_LABEL[status],
    };
    const fontFor = (key: string) =>
      key === 'num' || (key === 'status' && status !== 'current') ? 'Helvetica-Bold' : 'Helvetica';
    // Measure each cell in the font it is drawn with so bold text can't overflow the row.
    const rowH =
      Math.max(
        ...columns.map((c) => doc.font(fontFor(c.key)).heightOfString(cells[c.key], { width: c.width - CELL_PAD * 2 })),
      ) + CELL_PAD * 2;

    if (doc.y + rowH > contentBottom(doc)) {
      doc.addPage();
      doc.y = MARGIN;
      drawHeader();
      doc.fontSize(9);
    }
    const y = doc.y;
    if (i % 2 === 1) doc.rect(left, y, width, rowH).fill(COLORS.zebra);

    let x = left;
    for (const col of columns) {
      doc
        .font(fontFor(col.key))
        .fillColor(col.key === 'status' ? STATUS_COLOR[status] : COLORS.text)
        .text(cells[col.key], x + CELL_PAD, y + CELL_PAD, { width: col.width - CELL_PAD * 2 });
      x += col.width;
    }
    doc.moveTo(left, y + rowH).lineTo(left + width, y + rowH).lineWidth(0.5).strokeColor(COLORS.rule).stroke();
    doc.y = y + rowH;
  });
}

const ICON_COLOR: Record<MembershipStatus, string> = {
  current: '#0369a1',
  'expires-during-event': '#f59e0b',
  expired: '#dc2626',
};

/** Same top-down wingsuit shape as components/WingsuitIcon.tsx, in a 100×100 box. */
function drawWingsuitIcon(doc: Doc, x: number, y: number, size: number, number: number, color: string) {
  doc.save();
  doc.translate(x, y).scale(size / 100);
  doc.fillColor(color);
  doc.circle(50, 10, 8).fill();
  doc.path('M43 22 L2 50 L6 58 L43 66 Z').fill();
  doc.path('M57 22 L98 50 L94 58 L57 66 Z').fill();
  doc.roundedRect(36, 18, 28, 50, 9).fill();
  doc.path('M38 62 L28 98 L50 89 L72 98 L62 62 Z').fill();
  doc.fillColor('#ffffff').circle(50, 44, 20).fill();
  doc.restore();

  const label = String(number);
  const fontSize = size * (label.length >= 3 ? 0.19 : label.length === 2 ? 0.25 : 0.29);
  doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(COLORS.text);
  const textW = size * 0.4;
  doc.text(label, x + size * 0.5 - textW / 2, y + size * 0.45 - fontSize * 0.36, { width: textW, align: 'center', lineBreak: false });
}

/** Same pictogram as components/ViewpointIcon.tsx, in a 64×64 box. */
function drawViewpointIcon(doc: Doc, x: number, y: number, size: number, viewpoint: Viewpoint) {
  const sky = '#0369a1';
  const skyLight = '#e0f2fe';
  const slate = '#64748b';
  const dark = '#1e293b';
  doc.save();
  doc.translate(x, y).scale(size / 64);
  doc.lineCap('round').lineJoin('round');
  if (viewpoint === 'top-down') {
    doc.path('M6 54 L20 42 H58 L44 54 Z').lineWidth(2).fillAndStroke(skyLight, sky);
    for (const cx of [24, 32, 40]) doc.circle(cx, 48, 2.5).fill(sky);
    doc.path('M32 22 V36 M27 31 L32 36 L37 31').lineWidth(2.5).stroke(slate);
    doc.path('M18 12 Q32 0 46 12 Q32 24 18 12 Z').lineWidth(2.5).fillAndStroke('#ffffff', dark);
    doc.circle(32, 12, 4).fill(dark);
  } else {
    doc.path('M42 14 L58 6 V50 L42 58 Z').lineWidth(2).fillAndStroke(skyLight, sky);
    for (const cy of [22, 32, 42]) doc.circle(50, cy, 2.5).fill(sky);
    doc.path('M24 32 H37 M32 27 L37 32 L32 37').lineWidth(2.5).stroke(slate);
    doc.path('M2 32 Q12 20 22 32 Q12 44 2 32 Z').lineWidth(2.5).fillAndStroke('#ffffff', dark);
    doc.circle(12, 32, 4).fill(dark);
  }
  doc.restore();
}

/**
 * Draws a skydiver's full name centred in a grid cell, shrinking the font to fit and truncating
 * with an ellipsis when the cell is too small.
 */
function drawNameInCell(doc: Doc, x: number, y: number, size: number, name: string, color: string) {
  const pad = Math.max(1.5, size * 0.06);
  const w = size - pad * 2;
  const h = size - pad * 2;
  let fontSize = Math.min(9, Math.max(3.5, size * 0.2));
  doc.font('Helvetica-Bold');
  // Shrink until every word fits on a line (no mid-word breaks) and the wrapped name fits the cell.
  // Hyphenated names may also break at the hyphen.
  const words = name.split(/[\s-]+/).filter(Boolean);
  const fits = () =>
    words.every((word) => doc.widthOfString(word) <= w) && doc.heightOfString(name, { width: w, lineGap: 0 }) <= h;
  while (fontSize > 3.5 && !(doc.fontSize(fontSize), fits())) fontSize -= 0.5;
  const textH = Math.min(h, doc.fontSize(fontSize).heightOfString(name, { width: w, lineGap: 0 }));
  doc.fillColor(color).text(name, x + pad, y + pad + (h - textH) / 2, { width: w, height: h, align: 'center', lineGap: 0, ellipsis: true });
}

type GridMode = 'icons' | 'names';

/** Square formation grid with its viewpoint. Moves to a new page when less than half a page is left. */
function drawFormationGrid(
  doc: Doc,
  title: string,
  mode: GridMode,
  grid: FormationGrid,
  viewpoint: Viewpoint,
  placed: { s: Skydiver; row: number; col: number }[],
  event: RecordEvent,
) {
  const width = contentWidth(doc);
  if (contentBottom(doc) - doc.y < 300) {
    doc.addPage();
    doc.y = MARGIN;
  }

  // Viewpoint (icon + label + description), right-aligned on the heading row so it costs no height.
  const iconSize = 30;
  const label = `Viewpoint: ${VIEWPOINT_LABELS[viewpoint]}`;
  const desc = VIEWPOINT_DESCRIPTIONS[viewpoint];
  const textW = Math.max(
    doc.font('Helvetica-Bold').fontSize(10).widthOfString(label),
    doc.font('Helvetica').fontSize(9).widthOfString(desc),
  );
  const vx = CONTENT_LEFT + width - textW - iconSize - 8;
  const vy = doc.y;
  drawViewpointIcon(doc, vx, vy, iconSize, viewpoint);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text).text(label, vx + iconSize + 8, vy + 4, { width: textW + 1, lineBreak: false });
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text(desc, vx + iconSize + 8, vy + 18, { width: textW + 1, lineBreak: false });

  doc.y = vy;
  doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.text).text(title, CONTENT_LEFT, vy, { width: vx - CONTENT_LEFT - 8 });
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text(
    `${placed.length} skydiver${placed.length === 1 ? '' : 's'}. Videographers are not shown.`,
    { width: vx - CONTENT_LEFT - 8 },
  );
  doc.y = Math.max(doc.y, vy + iconSize) + 8;

  const side = Math.min(width, contentBottom(doc) - doc.y - 4);
  const cell = side / grid.size;
  const x0 = CONTENT_LEFT + (width - side) / 2;
  const y0 = doc.y;

  doc.lineWidth(0.5).strokeColor(COLORS.rule);
  for (let i = 0; i <= grid.size; i++) {
    doc.moveTo(x0 + i * cell, y0).lineTo(x0 + i * cell, y0 + side).stroke();
    doc.moveTo(x0, y0 + i * cell).lineTo(x0 + side, y0 + i * cell).stroke();
  }
  doc.lineWidth(1).strokeColor('#94a3b8').rect(x0, y0, side, side).stroke();

  const pad = cell * 0.06;
  for (const { s, row, col } of placed) {
    const status = membershipStatus(s.membershipExpiration, event);
    if (mode === 'icons') {
      drawWingsuitIcon(doc, x0 + col * cell + pad, y0 + row * cell + pad, cell - pad * 2, s.jumperNumber, ICON_COLOR[status]);
    } else {
      const color = status === 'current' ? COLORS.text : STATUS_COLOR[status];
      drawNameInCell(doc, x0 + col * cell, y0 + row * cell, cell, `${s.firstName} ${s.lastName}`.trim(), color);
    }
  }
  doc.y = y0 + side + 8;
}

/** Event detail rows for the roster PDF. */
function drawEventDetails(doc: Doc, event: RecordEvent) {
  const location = [event.city, event.state].filter(Boolean).join(', ');
  const details: [string, string][] = [
    ['Drop Zone', event.dropZone || '—'],
    ['Location', location || '—'],
    ['Dates', formatDateRange(event.startDate, event.endDate)],
    ['Aircraft', event.aircraft || '—'],
    ['Organizer', contactText(event.organizer)],
    ['Local Judge', contactText(event.localJudge)],
    ['Remote Judge(s)', event.remoteJudges.length ? event.remoteJudges.map(contactText).join('\n') : '—'],
  ];
  if (event.notes) details.push(['Notes', event.notes]);
  drawDetailRows(doc, details);
}

const countWarnings = (skydivers: Skydiver[], event: RecordEvent) =>
  skydivers.filter((s) => membershipStatus(s.membershipExpiration, event) !== 'current').length;

/** Renders the event's skydiver roster as a portrait Letter PDF. */
export function buildRosterPdf(event: RecordEvent, generatedAt = new Date()): Promise<Uint8Array> {
  return renderPdf(`${event.name} — Skydiver Roster`, event.name, generatedAt, (doc) => {
    const width = contentWidth(doc);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(18).text(event.name, CONTENT_LEFT, MARGIN, { width });
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted).text('Wingsuit Record Event — Skydiver Roster', { width });
    doc.moveDown(0.8);
    drawEventDetails(doc, event);

    doc.moveDown(1);
    if (doc.y + 80 > contentBottom(doc)) doc.addPage();
    const warnings = countWarnings(event.skydivers, event);
    drawSectionHeading(doc, `Skydiver Pool (${event.skydivers.length})`, warningNote(warnings), warnings > 0);
    drawSkydiverTable(doc, event.skydivers, event, 'No skydivers in the pool.');
  });
}

/** A detail value is plain text, or a function that draws at (x, y) within `width` and returns the bottom y. */
type DetailValue = string | ((x: number, y: number, width: number) => number);

/** Label/value rows (label column on the left). */
function drawDetailRows(doc: Doc, details: [string, DetailValue][]) {
  const left = CONTENT_LEFT;
  const width = contentWidth(doc);
  const labelW = 110;
  for (const [label, value] of details) {
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.muted).text(label, left, y, { width: labelW });
    const labelBottom = doc.y;
    let valueBottom: number;
    if (typeof value === 'string') {
      doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.text).text(value, left + labelW, y, { width: width - labelW });
      valueBottom = doc.y;
    } else {
      valueBottom = value(left + labelW, y, width - labelW);
    }
    doc.y = Math.max(labelBottom, valueBottom, y) + 3;
    if (doc.y > contentBottom(doc)) doc.addPage();
  }
}

/** Small rounded pill with a label, e.g. a judge's role. Returns its width. */
function drawBadge(doc: Doc, x: number, y: number, label: string): number {
  doc.font('Helvetica-Bold').fontSize(7.5);
  const w = doc.widthOfString(label) + 10;
  const h = 12;
  doc.roundedRect(x, y, w, h, 6).fillAndStroke('#e0f2fe', '#7dd3fc');
  // No width: pdfkit wraps when the box is exactly as wide as the measured text.
  doc.fillColor('#075985').text(label, x + 5, y + 2.6, { lineBreak: false });
  return w;
}

/** Judges one per line, each name followed by a role badge. Returns the bottom y. */
function drawJudgeLines(doc: Doc, judges: Judge[], x: number, y: number, width: number): number {
  const named = judges.filter((j) => j.name);
  if (named.length === 0) {
    doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.text).text('—', x, y, { width });
    return doc.y;
  }
  const lineH = 15;
  named.forEach((j, i) => {
    const ly = y + i * lineH;
    doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.text);
    const nameW = Math.min(doc.widthOfString(j.name), width - 90);
    doc.text(j.name, x, ly, { width: nameW + 1, lineBreak: false, ellipsis: true });
    const role = judgeRoleLabel(j.role);
    if (role) drawBadge(doc, x + nameW + 6, ly - 1.5, role);
  });
  return y + named.length * lineH - 3;
}

/**
 * One record: titled "Zone: Type - N way" (or "State name: Type - N way"; sequential records add
 * "- N-points"), with the organizer, attempt date and judges (with role badges), a Participants
 * table, a Videographers table, and the intended formation drawn with icons and with names —
 * once per point for sequential records.
 */
export function buildRecordPdf(event: RecordEvent, record: RecordEntry, generatedAt = new Date()): Promise<Uint8Array> {
  const title = recordPdfTitle(event, record);
  const grids = normalizeGrids(record.grids, record.type, formationIds(record.skydiverIds, event));
  return renderPdf(title, `${title}  ·  ${event.name}`, generatedAt, (doc) => {
    const width = contentWidth(doc);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(18).text(title, CONTENT_LEFT, MARGIN, { width });
    doc.moveDown(0.6);

    drawDetailRows(doc, [
      ['Event', event.name],
      ['Organizer', event.organizer.name || '—'],
      ['Drop Zone', event.dropZone || '—'],
      ['Location', [event.city, event.state].filter(Boolean).join(', ') || '—'],
      ['Record Attempt', record.attemptDate ? formatDate(record.attemptDate) : '—'],
      ['Local Judge', (x, y, w) => drawJudgeLines(doc, [event.localJudge], x, y, w)],
      ['Remote Judge(s)', (x, y, w) => drawJudgeLines(doc, event.remoteJudges, x, y, w)],
    ]);
    doc.moveDown(1);

    const { participants, videographers } = recordMembers(event, record);

    const warnings = countWarnings(participants, event);
    drawSectionHeading(doc, `Participants (${participants.length})`, warningNote(warnings), warnings > 0);
    drawSkydiverTable(doc, participants, event, 'No participants on this record.', RECORD_COLUMNS);
    doc.moveDown(1.5);

    if (doc.y + 80 > contentBottom(doc)) {
      doc.addPage();
      doc.y = MARGIN;
    }
    const videoWarnings = countWarnings(videographers, event);
    drawSectionHeading(doc, `Videographers (${videographers.length})`, videographers.length ? warningNote(videoWarnings) : '', videoWarnings > 0);
    drawSkydiverTable(doc, videographers, event, 'No videographers on this record.', RECORD_COLUMNS);
    doc.moveDown(1.5);

    const placedOn = (grid: FormationGrid) =>
      participants.flatMap((s) => {
        const p = grid.positions[s.id];
        return p && p.row < grid.size && p.col < grid.size ? [{ s, row: p.row, col: p.col }] : [];
      });

    if (!isSequentialType(record.type)) {
      const grid = grids[0];
      drawFormationGrid(doc, 'Intended Formation', 'icons', grid, record.viewpoint, placedOn(grid), event);
      doc.moveDown(1);
      drawFormationGrid(doc, 'Intended Formation', 'names', grid, record.viewpoint, placedOn(grid), event);
      return;
    }

    // Sequential: an "Intended Formation" heading, then each point as an icon grid and a names grid.
    if (contentBottom(doc) - doc.y < 330) {
      doc.addPage();
      doc.y = MARGIN;
    }
    doc.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.text).text('Intended Formation', CONTENT_LEFT, doc.y);
    doc.moveDown(0.4);
    grids.forEach((grid, i) => {
      const placed = placedOn(grid);
      if (i > 0) doc.moveDown(1);
      drawFormationGrid(doc, `Point #${i + 1}`, 'icons', grid, record.viewpoint, placed, event);
      doc.moveDown(1);
      drawFormationGrid(doc, `Point #${i + 1}`, 'names', grid, record.viewpoint, placed, event);
    });
  });
}
