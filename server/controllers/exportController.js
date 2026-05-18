const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const TEMPLATE_PATH = path.join(__dirname, '../uploads/Letter-Header-2025.pdf');

const sanitizeText = (value = '') =>
  String(value)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const safeFilename = (value = 'report') => {
  const cleaned = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'report';
};

const splitTokenToFitWidth = (token, maxWidth, font, fontSize) => {
  const chunks = [];
  let current = '';

  for (const ch of token) {
    const candidate = current + ch;
    const candidateWidth = font.widthOfTextAtSize(candidate, fontSize);
    if (candidateWidth <= maxWidth || !current) {
      current = candidate;
      continue;
    }
    chunks.push(current);
    current = ch;
  }

  if (current) chunks.push(current);
  return chunks;
};

const wrapTextToWidth = (text = '', maxWidth, font, fontSize) => {
  const clean = sanitizeText(text);
  if (!clean) return ['-'];

  const words = clean.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const wordWidth = font.widthOfTextAtSize(word, fontSize);
    if (wordWidth > maxWidth) {
      if (current) {
        lines.push(current);
        current = '';
      }
      const chunks = splitTokenToFitWidth(word, maxWidth, font, fontSize);
      for (const chunk of chunks) {
        lines.push(chunk);
      }
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    const candidateWidth = font.widthOfTextAtSize(candidate, fontSize);
    if (candidateWidth <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines.length ? lines : ['-'];
};

const toTableRows = (rows = []) => rows.map((row) => {
  if (Array.isArray(row)) return row.map((cell) => sanitizeText(cell));
  if (row && typeof row === 'object') return Object.values(row).map((cell) => sanitizeText(cell));
  return [sanitizeText(row)];
});

const HEADER_OFFSET = 170; // px reserved for letterhead in portrait

const addTemplatePage = async (pdfDoc, templateDoc, landscape = false) => {
  const origPage = templateDoc.getPage(0);
  const { width: tW, height: tH } = origPage.getSize();

  if (landscape) {
    const lsWidth = tH;  // 792 for Letter
    const lsHeight = tW; // 612 for Letter
    const lsPage = pdfDoc.addPage([lsWidth, lsHeight]);

    // Embed the portrait template and draw it so its top (letterhead) is visible
    const embeddedTemplate = await pdfDoc.embedPage(origPage);
    const scale = lsWidth / tW;
    lsPage.drawPage(embeddedTemplate, {
      x: 0,
      y: lsHeight - tH * scale,
      width: tW * scale,
      height: tH * scale,
    });

    const headerOffset = Math.round(HEADER_OFFSET * scale);
    return { page: lsPage, width: lsWidth, height: lsHeight, cursorY: lsHeight - headerOffset };
  }

  const [templatePage] = await pdfDoc.copyPages(templateDoc, [0]);
  pdfDoc.addPage(templatePage);
  return { page: templatePage, width: tW, height: tH, cursorY: tH - HEADER_OFFSET };
};

const drawTableHeader = ({ page, y, columns, xStart, usableWidth, headerFont, headerFontSize }) => {
  const colCount = Math.max(1, columns.length);
  const colWidth = usableWidth / colCount;
  const headerPaddingX = 4;
  const headerPaddingTop = 10;
  const headerPaddingBottom = 4;
  const headerLineHeight = 9;
  const maxHeaderTextWidth = Math.max(8, colWidth - (headerPaddingX * 2));

  const wrappedHeaders = columns.map((col, idx) => {
    const label = sanitizeText(col || `Column ${idx + 1}`);
    return wrapTextToWidth(label, maxHeaderTextWidth, headerFont, headerFontSize);
  });

  const headerLineCount = wrappedHeaders.reduce((max, lines) => Math.max(max, lines.length), 1);
  const headerHeight = Math.max(16, (headerLineCount * headerLineHeight) + headerPaddingTop + headerPaddingBottom);

  page.drawRectangle({
    x: xStart,
    y: y - headerHeight,
    width: usableWidth,
    height: headerHeight,
    color: rgb(0.5, 0, 0),
  });

  wrappedHeaders.forEach((lines, idx) => {
    const cellX = xStart + (idx * colWidth);
    lines.forEach((line, lineIdx) => {
      page.drawText(line, {
        x: cellX + headerPaddingX,
        y: y - headerPaddingTop - (lineIdx * headerLineHeight),
        size: headerFontSize,
        font: headerFont,
        color: rgb(1, 1, 1),
      });
    });

    if (idx > 0) {
      page.drawLine({
        start: { x: cellX, y },
        end: { x: cellX, y: y - headerHeight },
        thickness: 0.4,
        color: rgb(0.75, 0.75, 0.75),
      });
    }
  });

  return { colWidth, nextY: y - (headerHeight + 2) };
};

const exportTabularPdf = async (req, res) => {
  try {
    if (!fs.existsSync(TEMPLATE_PATH)) {
      return res.status(500).json({ success: false, message: 'PDF template not found in server/uploads.' });
    }

    const reportTitle = sanitizeText(req.body?.reportTitle || 'PathToTech Report');
    const subtitle = sanitizeText(req.body?.subtitle || '');
    const columnsRaw = Array.isArray(req.body?.columns) ? req.body.columns : [];
    const rowsRaw = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const fileName = safeFilename(req.body?.fileName || reportTitle);

    if (!columnsRaw.length) {
      return res.status(400).json({ success: false, message: 'columns is required for PDF export.' });
    }

    const columns = columnsRaw.map((c, i) => sanitizeText(c || `Column ${i + 1}`));
    const rows = toTableRows(rowsRaw);

    // Auto-detect orientation: switch to landscape when columns are too wide for portrait
    const PORTRAIT_USABLE = 612 - 72;
    const landscape = columns.length * 80 > PORTRAIT_USABLE;

    const templateBytes = fs.readFileSync(TEMPLATE_PATH);
    const templateDoc = await PDFDocument.load(templateBytes);
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const marginX = 36;
    const bottomY = 40;
    let { page, width, height: pageHeight, cursorY } = await addTemplatePage(pdfDoc, templateDoc, landscape);
    const usableWidth = width - (marginX * 2);

    page.drawText(reportTitle, {
      x: marginX,
      y: cursorY,
      size: 15,
      font: bold,
      color: rgb(0.5, 0, 0),
    });
    cursorY -= 18;

    const generatedMeta = `Generated: ${new Date().toLocaleString()}${subtitle ? ` | ${subtitle}` : ''}`;
    page.drawText(generatedMeta, {
      x: marginX,
      y: cursorY,
      size: 9,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
    cursorY -= 16;

    const header = drawTableHeader({
      page,
      y: cursorY,
      columns,
      xStart: marginX,
      usableWidth,
      headerFont: bold,
      headerFontSize: 8,
    });

    const colWidth = header.colWidth;
    cursorY = header.nextY;
    const cellFontSize = 8;
    const lineHeight = 9;
    const cellPaddingX = 4;
    const cellPaddingTop = 10;
    const cellPaddingBottom = 4;
    const maxTextWidth = Math.max(8, colWidth - (cellPaddingX * 2));

    for (const row of rows) {
      const padded = columns.map((_, idx) => sanitizeText(row[idx] || '-'));
      const wrappedCells = padded.map((cell) => wrapTextToWidth(cell, maxTextWidth, font, cellFontSize));
      const lineCount = wrappedCells.reduce((max, lines) => Math.max(max, lines.length), 1);
      const rowHeight = Math.max(16, (lineCount * lineHeight) + cellPaddingTop + cellPaddingBottom);

      if ((cursorY - rowHeight) < bottomY) {
        const nextPage = await addTemplatePage(pdfDoc, templateDoc, landscape);
        page = nextPage.page;
        cursorY = nextPage.cursorY;

        const nextHeader = drawTableHeader({
          page,
          y: cursorY,
          columns,
          xStart: marginX,
          usableWidth,
          headerFont: bold,
          headerFontSize: 8,
        });
        cursorY = nextHeader.nextY;
      }

      page.drawRectangle({
        x: marginX,
        y: cursorY - rowHeight,
        width: usableWidth,
        height: rowHeight,
        borderWidth: 0.6,
        borderColor: rgb(0.85, 0.85, 0.85),
      });

      wrappedCells.forEach((lines, idx) => {
        const cellX = marginX + (idx * colWidth);
        page.drawLine({
          start: { x: cellX, y: cursorY },
          end: { x: cellX, y: cursorY - rowHeight },
          thickness: 0.4,
          color: rgb(0.86, 0.86, 0.86),
        });

        lines.forEach((line, lineIdx) => {
          page.drawText(line, {
            x: cellX + cellPaddingX,
            y: cursorY - cellPaddingTop - (lineIdx * lineHeight),
            size: cellFontSize,
            font,
            color: rgb(0.15, 0.15, 0.15),
          });
        });
      });

      page.drawLine({
        start: { x: marginX + usableWidth, y: cursorY },
        end: { x: marginX + usableWidth, y: cursorY - rowHeight },
        thickness: 0.4,
        color: rgb(0.86, 0.86, 0.86),
      });

      cursorY -= rowHeight;
    }

    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.pdf"`);
    return res.status(200).send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('PDF export failed:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate PDF.' });
  }
};

module.exports = { exportTabularPdf };