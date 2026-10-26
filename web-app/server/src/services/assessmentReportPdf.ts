import fs from 'node:fs/promises';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { isBattingReportArtifactName } from './openAiBattingReportArtifacts.js';

const BRAND = '#059669';
const INK = '#0f172a';
const MUTED = '#64748b';
const STRIPE = '#f1f5f9';
const MARGIN = 40;
const FOOTER_SPACE = 50;

type Row = Record<string, unknown>;

export interface AssessmentReportInput {
  id: string;
  playerName: string;
  title: string;
  discipline: string;
  scheduledDate: string;
  coachName: string;
  status: string;
  metrics: unknown;
  strengths: string;
  focusAreas: string;
  coachFeedback: string;
  playerFeedback: string;
  aiInsights: unknown;
}

export interface BattingReportInput {
  id: string;
  analysis: unknown;
  artifacts: unknown;
}

type Block =
  | { type: 'heading'; text: string }
  | { type: 'facts'; items: [string, string][] }
  | { type: 'text'; label?: string; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'image'; buffer: Buffer; width: number; height: number; caption: string }
  | { type: 'table'; head: string[]; rows: string[][] };

const isRow = (value: unknown): value is Row => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const asRow = (value: unknown): Row => (isRow(value) ? value : {});
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asText = (value: unknown): string => (typeof value === 'string' ? value : '');
const asNumber = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

// The standard PDF fonts only cover WinAnsi, so map or drop characters outside it.
function pdfText(value: string): string {
  return value
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/[\u2010-\u2012]/g, '-')
    .replace(/[^\x09\x0a\x0d\x20-\xff\u2013\u2014\u2018\u2019\u201c\u201d\u2022\u2026\u20ac]/g, '');
}

function expectedRange(expected: unknown, unit: string): string {
  const suffix = unit === 'm' ? ' m' : unit;
  const [minimum, maximum] = asArray(expected).map(asNumber);
  if (minimum != null && maximum != null) return `${minimum}–${maximum}${suffix}`;
  if (minimum != null) return `>= ${minimum}${suffix}`;
  if (maximum != null) return `<= ${maximum}${suffix}`;
  return '—';
}

const humanize = (value: string) => value.replace(/_/g, ' ');

function assessmentBlocks(assessment: AssessmentReportInput): Block[] {
  const metrics = asArray(assessment.metrics).map(asRow);
  const rated = metrics.map(metric => asNumber(metric.score)).filter((score): score is number => score !== null);
  const average = rated.length ? rated.reduce((total, score) => total + score, 0) / rated.length : null;
  const blocks: Block[] = [
    { type: 'heading', text: `${assessment.playerName} - ${assessment.title}` },
    {
      type: 'facts',
      items: [
        ['Discipline', assessment.discipline],
        ['Date', assessment.scheduledDate],
        ['Coach', assessment.coachName],
        ['Status', humanize(assessment.status)],
        ['Average rating', average !== null ? `${average.toFixed(1)} / 5` : 'Not rated']
      ]
    },
    {
      type: 'table',
      head: ['Metric', 'Rating (1-5)', 'Note'],
      rows: metrics.map(metric => [asText(metric.name), asNumber(metric.score)?.toString() ?? 'Not rated', asText(metric.note)])
    },
    { type: 'text', label: 'Strengths', text: assessment.strengths },
    { type: 'text', label: 'Focus areas', text: assessment.focusAreas },
    { type: 'text', label: 'Coach feedback', text: assessment.coachFeedback },
    { type: 'text', label: "Player's own thoughts", text: assessment.playerFeedback }
  ];
  const insights = asRow(assessment.aiInsights);
  if (asText(insights.summary)) {
    blocks.push(
      { type: 'text', label: 'Development insights', text: asText(insights.summary) },
      { type: 'bullets', items: asArray(insights.recommendations).map(asText).filter(Boolean) }
    );
  }
  return blocks;
}

async function battingBlocks(report: BattingReportInput, heading = 'Batting video review - Movement and technique'): Promise<Block[]> {
  const analysis = asRow(report.analysis);
  const request = asRow(analysis.requestMetadata);
  const contact = asRow(analysis.contact);
  const pose = isRow(analysis.poseOverlay) ? analysis.poseOverlay : null;
  const rules = asRow(pose?.coaching_rules);
  const checks = asArray(rules.checks).map(asRow);
  const poseMetrics = asRow(pose?.metrics);
  const temporal = asRow(pose?.temporal_angle_estimates);

  const artifactNames = new Set(asArray(report.artifacts).flatMap(item => {
    const name = asRow(item).name;
    return typeof name === 'string' && isBattingReportArtifactName(name) ? [name] : [];
  }));
  const root = path.resolve(process.env.OPENAI_REPORTS_DIR || path.join(process.cwd(), 'var', 'openai-reports'));
  const directory = path.resolve(root, report.id);
  const readArtifact = async (name: unknown, caption: string): Promise<Block | null> => {
    if (typeof name !== 'string' || !artifactNames.has(name) || !name.endsWith('.png')) return null;
    if (!directory.startsWith(`${root}${path.sep}`)) return null;
    try {
      const buffer = await fs.readFile(path.join(directory, name));
      const { width, height } = await sharp(buffer).metadata();
      return width && height ? { type: 'image', buffer, width, height, caption } : null;
    } catch {
      return null;
    }
  };

  const handedness = asText(request.batterHandedness);
  const blocks: Block[] = [
    { type: 'heading', text: heading },
    {
      type: 'facts',
      items: [
        ['Batter hand', handedness === 'left' ? 'Left-handed' : handedness === 'right' ? 'Right-handed' : 'Unknown'],
        ['Shot type', humanize(asText(request.shotType) || 'unknown')],
        ['Contact status', humanize(asText(contact.status) || 'unknown').toLowerCase()]
      ]
    },
    { type: 'heading', text: 'Technique Summary' },
    { type: 'text', label: 'Summary', text: asText(rules.verdict) || asText(analysis.summary) || 'No technique summary available.' }
  ];

  const coachReview = asRow(analysis.coachReview);
  if (asText(coachReview.note).trim()) blocks.push({ type: 'text', label: 'Coach review', text: asText(coachReview.note) });

  const metricRows = (group: 'shot' | 'alignment', metrics: Array<[string, string, string]>) => metrics.map(([metric, label, unit]) => {
    const check = checks.find(item => item.group === group && item.metric === metric);
    const direct = asNumber(poseMetrics[metric]);
    const estimate = isRow(temporal[metric]) ? temporal[metric] as Row : null;
    const value = direct ?? asNumber(estimate?.value);
    const status = direct === null
      ? estimate ? 'Estimated from nearby frames' : 'Unavailable'
      : asText(check?.status) || 'Measured';
    const severity = asText(check?.severity);
    return [
      label,
      value === null ? 'Not measured' : `${value.toFixed(1)}${unit === 'm' ? ' m' : unit}`,
      expectedRange(check?.expected, unit),
      severity || (status === 'fault' ? 'Fault' : status === 'measured' ? 'Measured' : status)
    ];
  });

  const faults = asArray(rules.faults).map(asRow);
  const fixes = pose
    ? faults.map(fault => {
        const metric = asText(fault.metric);
        const unit = metric.endsWith('_m') ? 'm' : metric.endsWith('_degrees') || metric.endsWith('_deg') ? '°' : '%';
        const drill = asText(fault.drill);
        return `${asText(fault.verdict) || asText(fault.message)} (${asText(fault.severity)}): ${asText(fault.message)} ${humanize(metric)} ${asNumber(fault.value)?.toFixed(1) ?? ''}; expected ${expectedRange(fault.expected, unit)}. ${asText(fault.recommendation)}${drill ? ` Drill: ${drill}` : ''}`;
      })
    : asArray(analysis.errors).map(asRow).map(error => `${asText(error.title)}: ${asText(error.coachingImplication)}`);
  fixes.push(...asArray(rules.unavailable).map(asText).filter(Boolean).map(metric => `${humanize(metric)}: not assessed`));

  blocks.push(
    { type: 'heading', text: 'Kinematics' },
    {
      type: 'table',
      head: ['Measure', 'Measured', 'Expected', 'Status'],
      rows: metricRows('shot', [
        ['back_knee', 'Back knee', '°'],
        ['back_elbow', 'Back elbow', '°'],
        ['front_knee', 'Front knee', '°'],
        ['front_elbow', 'Front elbow', '°'],
        ['shoulder_tilt_degrees', 'Shoulder tilt', '°'],
        ['head_front_knee_offset_pct', 'Head front-knee offset', '%'],
        ['bat_angle_deg', 'Bat angle', '°'],
        ['stride_m', 'Stride', 'm']
      ])
    },
    { type: 'heading', text: 'Alignment checklist' },
    {
      type: 'table',
      head: ['Check', 'Measured', 'Expected', 'Status'],
      rows: metricRows('alignment', [
        ['chin_front_toe_offset_pct', 'Chin over front toe', '%'],
        ['front_shoulder_target_angle_deg', 'Front shoulder to target', '°'],
        ['back_foot_crease_angle_deg', 'Back foot to crease', '°'],
        ['front_elbow_height_pct', 'Front elbow height', '%']
      ])
    },
    { type: 'heading', text: 'What to Fix' },
    { type: 'bullets', items: fixes },
    { type: 'heading', text: 'Pose Overlay images' }
  );

  const contactCrop = await readArtifact('contact_crop.png', 'Selected contact view');
  if (contactCrop) blocks.push(contactCrop);
  const overlay = await readArtifact(pose?.overlayArtifactName, 'Batter movement and alignment');
  blocks.push(overlay ?? { type: 'text', text: 'Pose overlay image is not available for this saved analysis.' });

  blocks.push({ type: 'heading', text: 'Pose Through Contact' });
  let sequenceImages = 0;
  for (const frame of asArray(pose?.sequence).map(asRow)) {
    if (frame.status !== 'success') continue;
    const image = await readArtifact(frame.artifactName, `${humanize(asText(frame.phase))} · frame ${asNumber(frame.frame_index) ?? ''}`);
    if (!image) continue;
    sequenceImages += 1;
    blocks.push(image);
  }
  if (!sequenceImages) blocks.push({ type: 'text', text: 'Pose-through-contact images are not available for this saved analysis.' });

  const drill = asRow(analysis.drill);
  const drillText = [asText(drill.title), asText(drill.rationale), ...asArray(drill.instructions).map(asText)].filter(Boolean).join('\n');
  blocks.push(
    { type: 'heading', text: 'Coaching Guidance' },
    { type: 'text', label: 'Priority cue', text: asText(analysis.priorityCue) || 'No priority cue available.' },
    { type: 'text', label: 'Drill', text: drillText || 'No drill guidance available.' },
    { type: 'heading', text: 'Strengths' },
    {
      type: 'bullets',
      items: [
        ...asArray(analysis.strengths).map(asRow).map(strength => `${asText(strength.title)}: ${asText(strength.observation)}`),
        ...asArray(rules.strengths).map(asText).filter(Boolean)
      ]
    }
  );
  return blocks;
}

function renderPdf(title: string, subtitle: string, blocks: Block[]): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true, info: { Title: title, Author: 'eCricketCoach' } });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const contentWidth = pageWidth - MARGIN * 2;
  const bottom = pageHeight - FOOTER_SPACE;
  let y = 80;

  doc.rect(0, 0, pageWidth, 56).fill(BRAND);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16).text(pdfText(title), MARGIN, 18, { lineBreak: false });
  doc.font('Helvetica').fontSize(9).text(pdfText(subtitle), MARGIN, 38, { lineBreak: false });

  const ensureSpace = (needed: number) => {
    if (y + needed > bottom) {
      doc.addPage();
      y = MARGIN;
    }
  };
  const textHeight = (text: string, width: number) => doc.heightOfString(text, { width });

  for (const block of blocks) {
    if (block.type === 'heading') {
      ensureSpace(34);
      y += 8;
      doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND).text(pdfText(block.text).toUpperCase(), MARGIN, y, { width: contentWidth });
      y = doc.y + 2;
      doc.moveTo(MARGIN, y).lineTo(pageWidth - MARGIN, y).lineWidth(0.8).strokeColor(BRAND).stroke();
      y += 10;
    } else if (block.type === 'facts') {
      doc.fontSize(9.5);
      for (const [label, value] of block.items) {
        const text = pdfText(value || '-');
        doc.font('Helvetica');
        const height = Math.max(12, textHeight(text, contentWidth - 140));
        ensureSpace(height + 4);
        doc.font('Helvetica-Bold').fillColor(MUTED).text(pdfText(label), MARGIN, y, { width: 135 });
        doc.font('Helvetica').fillColor(INK).text(text, MARGIN + 140, y, { width: contentWidth - 140 });
        y += height + 4;
      }
      y += 4;
    } else if (block.type === 'text') {
      doc.fontSize(9.5);
      if (block.label) {
        ensureSpace(16);
        doc.font('Helvetica-Bold').fillColor(MUTED).text(pdfText(block.label), MARGIN, y, { width: contentWidth });
        y = doc.y + 1;
      }
      doc.font('Helvetica').fillColor(INK);
      for (const paragraph of pdfText(block.text?.trim() || '-').split('\n')) {
        const height = textHeight(paragraph || ' ', contentWidth);
        ensureSpace(Math.min(height, bottom - MARGIN));
        doc.text(paragraph || ' ', MARGIN, y, { width: contentWidth });
        y = doc.y;
      }
      y += 6;
    } else if (block.type === 'bullets') {
      doc.font('Helvetica').fontSize(9.5).fillColor(INK);
      for (const item of block.items.length ? block.items : ['None']) {
        const text = pdfText(item);
        ensureSpace(textHeight(text, contentWidth - 14) + 2);
        doc.text('-', MARGIN + 2, y);
        doc.text(text, MARGIN + 14, y, { width: contentWidth - 14 });
        y = doc.y + 2;
      }
      y += 6;
    } else if (block.type === 'image') {
      const scale = Math.min(contentWidth / block.width, 460 / block.width, (pageHeight - 2 * MARGIN - FOOTER_SPACE) / block.height);
      const width = block.width * scale;
      const height = block.height * scale;
      ensureSpace(height + 28);
      doc.image(block.buffer, MARGIN, y, { width, height });
      y += height + 4;
      doc.font('Helvetica-Oblique').fontSize(8).fillColor(MUTED).text(pdfText(block.caption), MARGIN, y, { width: contentWidth });
      y = doc.y + 10;
    } else {
      const columns = block.head.length;
      const widths = columns === 3 ? [0.38, 0.18, 0.44] : [0.34, 0.2, 0.2, 0.26];
      const columnWidths = widths.map(ratio => ratio * contentWidth);
      const padding = 4;
      const drawRow = (cells: string[], header: boolean, stripe: boolean) => {
        doc.font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5);
        const height = Math.max(...cells.map((cell, index) => textHeight(pdfText(cell || ''), columnWidths[index] - padding * 2))) + padding * 2;
        ensureSpace(height);
        if (header || stripe) doc.rect(MARGIN, y, contentWidth, height).fill(header ? BRAND : STRIPE);
        let x = MARGIN;
        cells.forEach((cell, index) => {
          doc.fillColor(header ? '#ffffff' : INK).text(pdfText(cell || ''), x + padding, y + padding, { width: columnWidths[index] - padding * 2 });
          x += columnWidths[index];
        });
        y += height;
      };
      drawRow(block.head, true, false);
      if (block.rows.length) block.rows.forEach((row, index) => drawRow(row, false, index % 2 === 1));
      else drawRow(['No records', ...Array(columns - 1).fill('')], false, false);
      y += 14;
    }
  }

  const range = doc.bufferedPageRange();
  const generated = new Date().toISOString().replace('T', ' ').slice(0, 16);
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    // Writing inside the bottom margin must not trigger an automatic page break.
    const pageMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(8).fillColor(MUTED);
    doc.text(`Generated ${generated} UTC - eCricketCoach`, MARGIN, pageHeight - 30, { lineBreak: false });
    doc.text(`Page ${index + 1} of ${range.count}`, MARGIN, pageHeight - 30, { width: contentWidth, align: 'right', lineBreak: false });
    doc.page.margins.bottom = pageMargin;
  }
  doc.end();
  return done;
}

/** Builds the assessment report PDF, including the linked batting video review (with its stored images) when present. */
export async function buildAssessmentReportPdf(assessment: AssessmentReportInput, batting: BattingReportInput | null): Promise<Buffer> {
  const blocks = assessmentBlocks(assessment);
  if (batting) blocks.push(...await battingBlocks(batting));
  return renderPdf('Player Assessment Report', `${assessment.playerName} - ${assessment.title}`, blocks);
}

/** Builds the standalone movement and technique PDF for a saved batting video review. */
export async function buildBattingReportPdf(report: BattingReportInput, playerName: string, createdAt: Date): Promise<Buffer> {
  const blocks = await battingBlocks(report, 'Movement and technique');
  return renderPdf('Movement and Technique', `${playerName || 'Player'} - ${createdAt.toISOString().slice(0, 10)}`, blocks);
}
