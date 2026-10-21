export interface VisualFrame {
  frameIndex: number;
  timestampSeconds: number;
  width: number;
  height: number;
  imageDataUrl: string;
  playerBoxNorm: NormalizedBox | null;
}

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface NormalizedBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type LandmarkName =
  | 'head' | 'leftShoulder' | 'rightShoulder' | 'leftElbow' | 'rightElbow'
  | 'leftWrist' | 'rightWrist' | 'leftHip' | 'rightHip' | 'leftKnee'
  | 'rightKnee' | 'leftAnkle' | 'rightAnkle' | 'frontToe';

export type EstimatedLandmarks = Partial<Record<LandmarkName, NormalizedPoint | null>>;

export interface SequencePhase {
  label: string;
  frame: VisualFrame;
}

export interface JointReviewVisual {
  frame: VisualFrame;
  landmarks: EstimatedLandmarks;
  contactPoint: NormalizedPoint | null;
  observations: Array<{ title: string; observation: string; coachingImplication: string; confidence: string }>;
  errors: Array<{ title: string; observation: string; coachingImplication: string; confidence: string }>;
  priorityCue: string;
  limitations: string[];
}

const escapeXml = (value: string) => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
}[char]!));

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function cropBox(box: NormalizedBox | null): NormalizedBox {
  if (!box) return { left: 0, top: 0, right: 1, bottom: 1 };
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  const xPad = width * 0.38;
  const yPad = height * 0.18;
  return {
    left: clamp01(box.left - xPad),
    top: clamp01(box.top - yPad),
    right: clamp01(box.right + xPad),
    bottom: clamp01(box.bottom + yPad)
  };
}

function imagePlacement(frame: VisualFrame, crop: NormalizedBox, viewport: { x: number; y: number; width: number; height: number }) {
  const sourceLeft = crop.left * frame.width;
  const sourceTop = crop.top * frame.height;
  const sourceWidth = (crop.right - crop.left) * frame.width;
  const sourceHeight = (crop.bottom - crop.top) * frame.height;
  const scale = Math.min(viewport.width / sourceWidth, viewport.height / sourceHeight);
  const shownWidth = frame.width * scale;
  const shownHeight = frame.height * scale;
  const cropShownWidth = sourceWidth * scale;
  const cropShownHeight = sourceHeight * scale;
  const x = viewport.x + (viewport.width - cropShownWidth) / 2 - sourceLeft * scale;
  const y = viewport.y + (viewport.height - cropShownHeight) / 2 - sourceTop * scale;
  return { x, y, width: shownWidth, height: shownHeight, scale };
}

function imageElement(frame: VisualFrame, crop: NormalizedBox, viewport: { x: number; y: number; width: number; height: number }, clipId: string) {
  const place = imagePlacement(frame, crop, viewport);
  return `<defs><clipPath id="${clipId}"><rect x="${viewport.x}" y="${viewport.y}" width="${viewport.width}" height="${viewport.height}" rx="8"/></clipPath></defs><image href="${frame.imageDataUrl}" x="${place.x}" y="${place.y}" width="${place.width}" height="${place.height}" preserveAspectRatio="none" clip-path="url(#${clipId})"/>`;
}

export function makeMovementSequenceSvg(phases: SequencePhase[]): string {
  const width = 1440;
  const height = 590;
  const margin = 24;
  const gap = 18;
  const panelWidth = (width - margin * 2 - gap * 3) / 4;
  const imageY = 76;
  const imageHeight = 390;
  const cardHeight = 520;
  const panels = phases.slice(0, 4).map((phase, index) => {
    const x = margin + index * (panelWidth + gap);
    const viewport = { x: x + 10, y: imageY, width: panelWidth - 20, height: imageHeight };
    const crop = cropBox(phase.frame.playerBoxNorm);
    return `<g><rect x="${x}" y="56" width="${panelWidth}" height="${cardHeight}" rx="12" fill="#182436" stroke="#34445b"/>${imageElement(phase.frame, crop, viewport, `sequence-${index}`)}<text x="${x + 10}" y="${imageY + imageHeight + 48}" fill="#ffffff" font-family="Arial,sans-serif" font-size="24" font-weight="600">${escapeXml(phase.label)}</text></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#101c2c"/><text x="24" y="34" fill="#f8fafc" font-family="Arial,sans-serif" font-size="23" font-weight="700">Batting movement sequence</text>${panels}<text x="24" y="566" fill="#cbd5e1" font-family="Arial,sans-serif" font-size="17">Movement phases are visual estimates, not motion tracking.</text></svg>`;
}

function wrappedText(text: string, x: number, y: number, maxChars: number, color: string, fontSize = 18, lineHeight = 25): { svg: string; nextY: number } {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  const svg = lines.map((value, index) => `<text x="${x}" y="${y + index * lineHeight}" fill="${color}" font-family="Arial,sans-serif" font-size="${fontSize}">${escapeXml(value)}</text>`).join('');
  return { svg, nextY: y + lines.length * lineHeight };
}

export function makeJointAlignmentSvg(review: JointReviewVisual): string {
  const width = 1440;
  const height = 1020;
  const imageViewport = { x: 28, y: 100, width: 590, height: 760 };
  const crop = cropBox(review.frame.playerBoxNorm);
  const place = imagePlacement(review.frame, crop, imageViewport);
  const image = imageElement(review.frame, crop, imageViewport, 'joint-image');
  const mapPoint = (point: NormalizedPoint | null | undefined): { x: number; y: number } | null => {
    if (!point) return null;
    return { x: place.x + point.x * review.frame.width * place.scale, y: place.y + point.y * review.frame.height * place.scale };
  };
  const lm = review.landmarks;
  const edges: Array<[LandmarkName, LandmarkName]> = [
    ['leftShoulder', 'rightShoulder'], ['leftHip', 'rightHip'],
    ['leftShoulder', 'leftElbow'], ['leftElbow', 'leftWrist'],
    ['rightShoulder', 'rightElbow'], ['rightElbow', 'rightWrist'],
    ['leftShoulder', 'leftHip'], ['rightShoulder', 'rightHip'],
    ['leftHip', 'leftKnee'], ['leftKnee', 'leftAnkle'],
    ['rightHip', 'rightKnee'], ['rightKnee', 'rightAnkle']
  ];
  const skeleton = edges.map(([from, to]) => {
    const a = mapPoint(lm[from]);
    const b = mapPoint(lm[to]);
    return a && b ? `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#38e7f2" stroke-width="4" stroke-linecap="round"/>` : '';
  }).join('');
  const points = (Object.entries(lm) as Array<[LandmarkName, NormalizedPoint | null | undefined]>).flatMap(([name, value]) => {
    const point = mapPoint(value);
    return point ? [`<circle cx="${point.x}" cy="${point.y}" r="7" fill="#06121c" stroke="#42eff5" stroke-width="4"/><text x="${point.x + 10}" y="${point.y - 8}" fill="#d9feff" stroke="#0b1724" stroke-width="3" paint-order="stroke" font-family="Arial,sans-serif" font-size="15">${escapeXml(name)}</text>`] : [];
  }).join('');
  const head = mapPoint(lm.head);
  const frontAnkle = mapPoint(lm.frontToe || lm.leftAnkle || lm.rightAnkle);
  const alignment = head && frontAnkle
    ? `<line x1="${head.x}" y1="${head.y}" x2="${frontAnkle.x}" y2="${frontAnkle.y}" stroke="#ff77c8" stroke-width="3" stroke-dasharray="10 8"/><text x="${head.x + 10}" y="${(head.y + frontAnkle.y) / 2}" fill="#ff9bda" font-family="Arial,sans-serif" font-size="16">projected head / foot guide</text>`
    : '';
  const contact = mapPoint(review.contactPoint);
  const contactMarkup = contact
    ? `<circle cx="${contact.x}" cy="${contact.y}" r="18" fill="none" stroke="#ff4e55" stroke-width="5"/><circle cx="${contact.x}" cy="${contact.y}" r="5" fill="#ff4e55"/><text x="${contact.x + 22}" y="${contact.y - 10}" fill="#ff7b80" font-family="Arial,sans-serif" font-size="17" font-weight="700">CONTACT CANDIDATE</text>`
    : '';
  const arrowOrigin = frontAnkle || mapPoint(lm.leftHip || lm.rightHip);
  const schematicForces = arrowOrigin
    ? `<line x1="${arrowOrigin.x + 55}" y1="${arrowOrigin.y - 20}" x2="${arrowOrigin.x + 55}" y2="${Math.min(imageViewport.y + imageViewport.height - 10, arrowOrigin.y + 100)}" stroke="#a78bfa" stroke-width="5" marker-end="url(#arrow)"/><text x="${arrowOrigin.x + 65}" y="${arrowOrigin.y + 45}" fill="#c4b5fd" font-family="Arial,sans-serif" font-size="15">gravity (schematic)</text>`
    : '';

  let y = 126;
  const sections: string[] = [];
  const addSection = (heading: string, text: string, color: string) => {
    sections.push(`<text x="660" y="${y}" fill="${color}" font-family="Arial,sans-serif" font-size="21" font-weight="700">${escapeXml(heading)}</text>`);
    y += 30;
    const wrapped = wrappedText(text, 660, y, 74, '#e2e8f0');
    sections.push(wrapped.svg);
    y = wrapped.nextY + 12;
  };
  for (const [index, item] of review.observations.entries()) {
    addSection(`MOVEMENT · ${index + 1}. ${item.title}`, `${item.observation} ${item.coachingImplication}`, '#42e8f0');
  }
  for (const [index, item] of review.errors.entries()) {
    addSection(`COACHING POINT · ${index + 1}. ${item.title}`, `${item.observation} ${item.coachingImplication}`, '#ffc45c');
  }
  if (review.priorityCue) addSection('COACHING PRIORITY', review.priorityCue, '#ffc45c');
  if (review.limitations.length) addSection('LIMITATIONS', review.limitations.join(' '), '#cbd5e1');
  addSection('KINETICS · ILLUSTRATIVE ONLY', 'Gravity and possible ground-reaction direction are schematic. No force, torque, power, weight split, or centre of mass was measured.', '#b69cff');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><clipPath id="joint-crop"><rect x="${imageViewport.x}" y="${imageViewport.y}" width="${imageViewport.width}" height="${imageViewport.height}" rx="10"/></clipPath><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#a78bfa"/></marker></defs><rect width="100%" height="100%" fill="#101c2c"/><text x="28" y="46" fill="#f8fafc" font-family="Arial,sans-serif" font-size="27" font-weight="700">FRONT-FOOT DRIVE · JOINT &amp; ALIGNMENT REVIEW</text><text x="28" y="78" fill="#cbd5e1" font-family="Arial,sans-serif" font-size="18">Near-contact view · visual estimates</text>${image}${skeleton}${points}${alignment}${contactMarkup}${schematicForces}<line x1="640" y1="95" x2="640" y2="980" stroke="#34445b" stroke-width="2"/>${sections.join('')}<text x="28" y="990" fill="#cbd5e1" font-family="Arial,sans-serif" font-size="16">Original frame crop enlarged; estimated landmarks may be inaccurate. Review with a coach.</text></svg>`;
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}
