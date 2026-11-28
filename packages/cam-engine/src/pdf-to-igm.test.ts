import { describe, expect, it } from 'vitest';
import { DEFAULT_PDF_OPS as OPS, operatorListToIgm, parsePdfToIgm } from './pdf-to-igm';

/** Builds a minimal valid single-page PDF containing a 72x72 pt (1x1 in = 25.4x25.4 mm) stroked box + text. */
function buildMinimalPdf(streamContent: string): Uint8Array {
  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

describe('pdf-to-igm', () => {
  it('converts PDF constructPath rectangles and colors directly to mm IGM layers', () => {
    // 72 pt x 36 pt = 25.4 mm x 12.7 mm
    const opList = {
      fnArray: [
        OPS.setStrokeRGBColor,
        OPS.constructPath,
        OPS.stroke,
        OPS.setStrokeRGBColor,
        OPS.constructPath,
        OPS.endPath, // Clipping path — must be discarded
      ],
      argsArray: [
        [255, 0, 0],
        [[OPS.rectangle], [0, 0, 72, 36]],
        [],
        [0, 0, 255],
        [[OPS.rectangle], [0, 0, 200, 200]],
        [],
      ],
    };

    const { doc } = operatorListToIgm({
      operatorList: opList,
      viewBox: [0, 0, 200, 200],
    });

    expect(doc.layers).toHaveLength(1);
    expect(doc.layers[0]!.id).toBe('pdf-stroke-#ff0000');
    expect(doc.layers[0]!.segments).toHaveLength(4);
    expect(doc.bounds.min.x).toBeCloseTo(0, 4);
    expect(doc.bounds.min.y).toBeCloseTo(0, 4);
    expect(doc.bounds.max.x).toBeCloseTo(25.4, 3);
    expect(doc.bounds.max.y).toBeCloseTo(12.7, 3);
  });

  it('flattens cubic Bezier curves and respects CTM save/restore transforms', () => {
    const opList = {
      fnArray: [
        OPS.save,
        OPS.transform,
        OPS.constructPath,
        OPS.stroke,
        OPS.restore,
      ],
      argsArray: [
        [],
        [1, 0, 0, 1, 72, 0], // translate +72pt (+25.4mm) in X
        [[OPS.moveTo, OPS.curveTo], [0, 0, 0, 72, 72, 72, 72, 0]],
        [],
        [],
      ],
    };

    const { doc } = operatorListToIgm({
      operatorList: opList,
      viewBox: [0, 0, 200, 200],
      options: { curveToleranceMm: 0.2 },
    });

    expect(doc.layers).toHaveLength(1);
    expect(doc.layers[0]!.segments.length).toBeGreaterThan(4);
    expect(doc.bounds.min.x).toBeCloseTo(25.4, 2);
    expect(doc.bounds.max.x).toBeCloseTo(50.8, 2);
    expect(doc.bounds.max.y).toBeGreaterThan(10);
  });

  it('places OPS.showText in a separate optional pdf-text layer', () => {
    const opList = {
      fnArray: [
        OPS.constructPath,
        OPS.stroke,
        OPS.beginText,
        OPS.setFont,
        OPS.setTextMatrix,
        OPS.showText,
        OPS.endText,
      ],
      argsArray: [
        [[OPS.rectangle], [0, 0, 72, 72]],
        [],
        [],
        ['Helvetica', 24],
        [1, 0, 0, 1, 10, 20],
        [[{ unicode: 'K', width: 667 }, { unicode: 'M', width: 833 }, { unicode: 'X', width: 667 }]],
        [],
      ],
    };

    const withText = operatorListToIgm({
      operatorList: opList,
      viewBox: [0, 0, 200, 200],
      options: { includeText: true, textLayerVisible: false },
    });

    expect(withText.textGlyphCount).toBe(3);
    const textLayer = withText.doc.layers.find((l) => l.id === 'pdf-text');
    expect(textLayer).toBeDefined();
    expect(textLayer!.visible).toBe(false);
    expect(textLayer!.segments.length).toBeGreaterThan(4);
    expect(withText.warnings.some((w) => w.includes('stroke font'))).toBe(true);

    const withoutText = operatorListToIgm({
      operatorList: opList,
      viewBox: [0, 0, 200, 200],
      options: { includeText: false },
    });

    expect(withoutText.textGlyphCount).toBe(3);
    expect(withoutText.doc.layers.find((l) => l.id === 'pdf-text')).toBeUndefined();
    expect(withoutText.warnings.some((w) => w.includes('Skipped 3 text glyph'))).toBe(true);
  });

  it('parses a real PDF binary end-to-end via pdfjs-dist opcodes', async () => {
    const stream = [
      '1 0 0 RG',
      '0 0 72 72 re S',
      'BT',
      '/F1 18 Tf',
      '1 0 0 1 10 100 Tm',
      '(CNC) Tj',
      'ET',
    ].join('\n');

    const pdfBytes = buildMinimalPdf(stream);
    const result = await parsePdfToIgm(pdfBytes, { includeText: true });

    expect(result.pageCount).toBe(1);
    expect(result.pageNumber).toBe(1);
    expect(result.textGlyphCount).toBe(3);

    const strokeLayer = result.doc.layers.find((l) => l.id === 'pdf-stroke-#ff0000');
    const textLayer = result.doc.layers.find((l) => l.id === 'pdf-text');
    expect(strokeLayer).toBeDefined();
    expect(strokeLayer!.segments).toHaveLength(4);
    expect(textLayer).toBeDefined();
    expect(textLayer!.segments.length).toBeGreaterThan(0);
  });
});
