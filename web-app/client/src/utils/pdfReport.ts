import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const BRAND: [number, number, number] = [5, 150, 105];
const INK: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const MARGIN = 40;

export type PdfBlock =
  | { type: 'heading'; text: string }
  | { type: 'facts'; items: [string, string][] }
  | { type: 'text'; label?: string; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'table'; head: string[]; rows: (string | number)[][] };

export interface PdfReport {
  title: string;
  subtitle?: string;
  filename: string;
  blocks: PdfBlock[];
}

/** Builds a branded, paginated A4 PDF from simple blocks and downloads it. */
export function downloadPdfReport(report: PdfReport) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  let y = 0;

  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageWidth, 56, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(report.title, MARGIN, 28);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(report.subtitle || 'eCricketCoach', MARGIN, 44);
  y = 80;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 50) {
      doc.addPage();
      y = MARGIN;
    }
  };

  for (const block of report.blocks) {
    if (block.type === 'heading') {
      ensureSpace(34);
      y += 8;
      doc.setTextColor(...BRAND);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(block.text.toUpperCase(), MARGIN, y);
      doc.setDrawColor(...BRAND);
      doc.setLineWidth(0.8);
      doc.line(MARGIN, y + 4, pageWidth - MARGIN, y + 4);
      y += 20;
    } else if (block.type === 'facts') {
      doc.setFontSize(9.5);
      for (const [label, value] of block.items) {
        const lines = doc.splitTextToSize(value || '-', contentWidth - 140) as string[];
        ensureSpace(lines.length * 12 + 4);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...MUTED);
        doc.text(label, MARGIN, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...INK);
        doc.text(lines, MARGIN + 140, y);
        y += lines.length * 12 + 4;
      }
      y += 4;
    } else if (block.type === 'text') {
      doc.setFontSize(9.5);
      if (block.label) {
        ensureSpace(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...MUTED);
        doc.text(block.label, MARGIN, y);
        y += 12;
      }
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...INK);
      const lines = doc.splitTextToSize(block.text?.trim() || '-', contentWidth) as string[];
      for (const line of lines) {
        ensureSpace(13);
        doc.text(line, MARGIN, y);
        y += 13;
      }
      y += 6;
    } else if (block.type === 'bullets') {
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...INK);
      const items = block.items.length ? block.items : ['None'];
      for (const item of items) {
        const lines = doc.splitTextToSize(item, contentWidth - 14) as string[];
        ensureSpace(lines.length * 13);
        doc.text('-', MARGIN + 2, y);
        doc.text(lines, MARGIN + 14, y);
        y += lines.length * 13;
      }
      y += 6;
    } else {
      autoTable(doc, {
        startY: y,
        head: [block.head],
        body: block.rows.length
          ? block.rows.map(row => row.map(String))
          : [[{ content: 'No records', colSpan: block.head.length, styles: { halign: 'center', textColor: MUTED } }]],
        margin: { left: MARGIN, right: MARGIN, bottom: 50 },
        styles: { fontSize: 8.5, cellPadding: 4, textColor: INK },
        headStyles: { fillColor: BRAND, textColor: 255 },
        alternateRowStyles: { fillColor: [241, 245, 249] }
      });
      y = ((doc as any).lastAutoTable?.finalY ?? y) + 14;
    }
  }

  const pages = doc.getNumberOfPages();
  const generated = new Date().toLocaleString();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Generated ${generated} - eCricketCoach`, MARGIN, pageHeight - 24);
    doc.text(`Page ${page} of ${pages}`, pageWidth - MARGIN, pageHeight - 24, { align: 'right' });
  }

  doc.save(report.filename);
}
