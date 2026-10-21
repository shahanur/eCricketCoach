import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { ZipArchive } from 'archiver';
import { OpenAiBattingAnalysis } from './openAiBattingAnalysisService.js';

export interface StoredReportArtifact {
  name: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
}

export interface StoredBattingReport {
  id: string;
  directory: string;
  artifacts: StoredReportArtifact[];
  analysisRecord: Record<string, unknown>;
}

export interface CoachReviewRecord {
  reviewerId: string;
  reviewedAt: string;
  note: string;
  findings: Array<{ findingIndex: number; status: 'accepted' | 'revised' | 'not_applicable'; note: string }>;
}

function decodeImageDataUrl(dataUrl: string | null | undefined): Buffer | null {
  if (!dataUrl) return null;
  const match = /^data:image\/(?:jpeg|png|svg\+xml);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  return match ? Buffer.from(match[1], 'base64') : null;
}

function xmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!);
}

function reviewOverlay(
  analysis: OpenAiBattingAnalysis,
  width: number,
  height: number,
  frameIndex: number,
  landmarks: OpenAiBattingAnalysis['contactLandmarksNorm'],
  includeAngles: boolean
): Buffer {
  const segments = [
    ['leftShoulder', 'leftElbow'], ['leftElbow', 'leftWrist'], ['rightShoulder', 'rightElbow'], ['rightElbow', 'rightWrist'],
    ['leftShoulder', 'leftHip'], ['rightShoulder', 'rightHip'], ['leftHip', 'leftKnee'], ['leftKnee', 'leftAnkle'],
    ['rightHip', 'rightKnee'], ['rightKnee', 'rightAnkle']
  ] as const;
  const segmentMarkup = segments.map(([start, end]) => {
    const a = landmarks[start];
    const b = landmarks[end];
    if (!a || !b) return '';
    return `<line x1="${a.x * width}" y1="${a.y * height}" x2="${b.x * width}" y2="${b.y * height}" stroke="#facc15" stroke-width="4" stroke-linecap="round"/>`;
  }).join('');
  const points = Object.values(landmarks).filter((point): point is { x: number; y: number } => Boolean(point))
    .map(point => `<circle cx="${point.x * width}" cy="${point.y * height}" r="7" fill="#22d3ee" stroke="#082f49" stroke-width="3"/>`).join('');
  const batFrame = analysis.batLandmarksByFrame.find(item => item.frameIndex === frameIndex);
  const batRecord = (analysis.batAngles ?? []).find(item => item.frameIndex === frameIndex && item.angleDegrees !== null);
  const handle = batFrame?.handleNorm ?? batRecord?.handle ?? (frameIndex === analysis.contact.frameIndex ? analysis.batHandleNorm : null);
  const toe = batFrame?.toeNorm ?? (frameIndex === analysis.contact.frameIndex ? analysis.batToeNorm : null);
  const batAngle = batRecord?.angleDegrees
    ?? (analysis.contactBatAngle?.frameIndex === frameIndex && analysis.contactBatAngle.method !== 'wrists_to_contact' ? analysis.contactBatAngle.angleDegrees : null);
  const batLabel = batAngle === null || batAngle === undefined
    ? 'Estimated shaft orientation'
    : `Estimated shaft ≈${Math.round(batAngle)}° from vertical`;
  const bat = handle && toe
    ? `<line x1="${handle.x * width}" y1="${handle.y * height}" x2="${toe.x * width}" y2="${toe.y * height}" stroke="#fb7185" stroke-width="4" stroke-dasharray="9 7"/><text x="${Math.min(handle.x, toe.x) * width}" y="${Math.max(20, Math.min(handle.y, toe.y) * height - 8)}" fill="#fff" font-family="sans-serif" font-size="14" stroke="#0f172a" stroke-width="3" paint-order="stroke">${batLabel}</text>`
    : '';
  const angleTriplets: Record<string, [keyof typeof landmarks, keyof typeof landmarks, keyof typeof landmarks]> = {
    'elbow:left': ['leftShoulder', 'leftElbow', 'leftWrist'], 'elbow:right': ['rightShoulder', 'rightElbow', 'rightWrist'],
    'knee:left': ['leftHip', 'leftKnee', 'leftAnkle'], 'knee:right': ['rightHip', 'rightKnee', 'rightAnkle'],
    'hip:left': ['leftShoulder', 'leftHip', 'leftKnee'], 'hip:right': ['rightShoulder', 'rightHip', 'rightKnee'],
    'shoulder:left': ['leftElbow', 'leftShoulder', 'leftHip'], 'shoulder:right': ['rightElbow', 'rightShoulder', 'rightHip']
  };
  const angles = includeAngles ? analysis.jointAngles.filter(item => item.frameIndex === frameIndex).map((item, index) => {
    const keys = angleTriplets[`${item.joint}:${item.side}`];
    if (!keys) return '';
    const [a, vertex, c] = keys.map(key => landmarks[key]);
    if (!a || !vertex || !c || item.angleDegrees === null) return '';
    const bx = vertex.x * width; const by = vertex.y * height;
    const ux = a.x * width - bx; const uy = a.y * height - by;
    const vx = c.x * width - bx; const vy = c.y * height - by;
    const uLen = Math.hypot(ux, uy); const vLen = Math.hypot(vx, vy);
    if (!uLen || !vLen) return '';
    const radius = Math.max(8, Math.min(ux ? uLen : vLen, vLen) * 0.25);
    const start = { x: bx + ux / uLen * radius, y: by + uy / uLen * radius };
    const end = { x: bx + vx / vLen * radius, y: by + vy / vLen * radius };
    const cross = ux * vy - uy * vx;
    const arc = `<path d="M ${start.x} ${start.y} A ${radius} ${radius} 0 0 ${cross >= 0 ? 1 : 0} ${end.x} ${end.y}" fill="none" stroke="#38bdf8" stroke-width="3" stroke-dasharray="5 3"/>`;
    const middleX = bx + (ux / uLen + vx / vLen) * radius * 0.8;
    const middleY = by + (uy / uLen + vy / vLen) * radius * 0.8;
    const label = `<text x="${middleX}" y="${middleY - index * 2}" fill="#fff" font-family="sans-serif" font-size="14" stroke="#0f172a" stroke-width="3" paint-order="stroke">≈${Math.round(item.angleDegrees)}°</text>`;
    return `${arc}${label}`;
  }).join('') : '';
  const contactPoint = frameIndex === analysis.contact.frameIndex && analysis.contact.pointNorm
    ? `<circle cx="${analysis.contact.pointNorm.x * width}" cy="${analysis.contact.pointNorm.y * height}" r="12" fill="none" stroke="#fb7185" stroke-width="4"/>`
    : '';
  const frameAnnotations = analysis.annotations.filter(item => item.frameIndex === frameIndex).map(item => {
    const coords = item.points.map(point => ({ x: point.x * width, y: point.y * height }));
    const dashed = item.evidenceStatus === 'observed' ? '' : ' stroke-dasharray="8 6"';
    const stroke = item.evidenceStatus === 'schematic' ? '#a78bfa' : '#f97316';
    const label = xmlEscape(item.label.slice(0, 80));
    const anchor = coords[0];
    const labelMarkup = `<text x="${anchor.x + 8}" y="${anchor.y - 8}" fill="#fff" font-family="sans-serif" font-size="14" stroke="#0f172a" stroke-width="3" paint-order="stroke">${label}</text>`;
    if (item.type === 'point') return `<circle cx="${anchor.x}" cy="${anchor.y}" r="8" fill="${stroke}" stroke="#fff" stroke-width="2"/>${labelMarkup}`;
    if (item.type === 'line' || item.type === 'arrow') {
      const end = coords[1];
      return `<line x1="${anchor.x}" y1="${anchor.y}" x2="${end.x}" y2="${end.y}" stroke="${stroke}" stroke-width="4"${dashed}${item.type === 'arrow' ? ' marker-end="url(#arrowhead)"' : ''}/>${labelMarkup}`;
    }
    if (item.type === 'polyline') return `<polyline points="${coords.map(point => `${point.x},${point.y}`).join(' ')}" fill="none" stroke="${stroke}" stroke-width="4"${dashed}/>${labelMarkup}`;
    if (item.type === 'ellipse') {
      const radius = coords[1];
      return `<ellipse cx="${anchor.x}" cy="${anchor.y}" rx="${Math.abs(radius.x - anchor.x)}" ry="${Math.abs(radius.y - anchor.y)}" fill="none" stroke="${stroke}" stroke-width="3"${dashed}/>${labelMarkup}`;
    }
    return labelMarkup;
  }).join('');
  const legend = `<text x="14" y="${height - 16}" fill="#fff" font-family="sans-serif" font-size="13" stroke="#0f172a" stroke-width="3" paint-order="stroke">Dashed = estimate/schematic · 2D projected image · frame ${frameIndex}</text>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="8" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#a78bfa"/></marker></defs><rect width="100%" height="100%" fill="none"/>${includeAngles ? segmentMarkup : ''}${bat}${points}${contactPoint}${angles}${frameAnnotations}${legend}</svg>`);
}

async function renderAnnotatedFrame(
  analysis: OpenAiBattingAnalysis,
  source: Buffer,
  frameIndex: number,
  landmarks: OpenAiBattingAnalysis['contactLandmarksNorm'],
  includeAngles: boolean
): Promise<Buffer> {
  const { width, height } = await sharp(source).metadata();
  if (!width || !height) return sharp(source).png().toBuffer();
  const overlay = reviewOverlay(analysis, width, height, frameIndex, landmarks, includeAngles);
  return sharp(source).composite([{ input: overlay }]).png().toBuffer();
}

function markdownReport(analysis: OpenAiBattingAnalysis, artifactNames: Set<string>): string {
  const findings = [...analysis.errors, ...analysis.observations];
  const calculatedAngleCount = analysis.jointAngles.filter(item => item.angleDegrees !== null).length;
  const unassessableAngleCount = analysis.jointAngles.length - calculatedAngleCount;
  const batAngles = analysis.batAngles ?? [];
  const contactBatAngle = analysis.contactBatAngle ?? null;
  const renderEvidenceRequest = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.startsWith('{')) {
      try { return `\n\n\`\`\`json\n${JSON.stringify(JSON.parse(trimmed), null, 2)}\n\`\`\``; } catch { /* keep unparsed request as prose */ }
    }
    return `- ${value}`;
  };
  const visuals = [
    ['contact_review.png', 'Contact frame or bracketing frames when impact is uncertain.'],
    ['joint_analysis.png', 'Phase-matched joint segments with application-calculated projected angles.'],
    ['bat_path_sequence.png', 'Chronological individual shaft estimates; positions are not connected or tracked.'],
    ['phase_sequence.png', 'Overview phase sequence montage.'],
    ['follow_through.png', 'Post-contact frame; timing caveats apply.']
  ] as const;
  return [
    '# Cricket batting analysis',
    '',
    `- **Assessment:** ${analysis.status}`,
    `- **Model:** ${analysis.executionLog.modelReturned}`,
    `- **Prompt/schema:** ${analysis.promptVersion} / ${analysis.schemaVersion}`,
    `- **Requested shot / handedness:** ${analysis.requestMetadata.shotType} / ${analysis.requestMetadata.batterHandedness}`,
    `- **Identified shot / handedness:** ${analysis.shotIdentification.shotType ?? 'unknown'} / ${analysis.shotIdentification.batterHandedness} (${Math.round(analysis.shotIdentification.confidence * 100)}% model confidence)`,
    `- **Camera / timing:** ${analysis.requestMetadata.cameraView} / ${analysis.requestMetadata.playbackSpeed}${analysis.requestMetadata.captureFps === null ? '' : ` at ${analysis.requestMetadata.captureFps} capture fps`}`,
    `- **Video:** ${analysis.video.durationSeconds.toFixed(3)} s, ${analysis.video.width}×${analysis.video.height}, ${analysis.video.fps.toFixed(3)} fps (encoded rate)`,
    `- **Contact:** ${analysis.contact.status}${analysis.contact.timestampSeconds === null ? '' : ` at ${analysis.contact.timestampSeconds.toFixed(6)} s`}`,
    `- **Camera / framing / blur:** ${analysis.footageQuality.cameraView} / ${analysis.footageQuality.framing} / ${analysis.footageQuality.blur}`,
    '',
    '## Summary',
    '',
    analysis.summary,
    '',
    '## Shot assessments',
    '',
    ...(analysis.shotAssessments.length ? analysis.shotAssessments.map(shot => `- **${shot.shotId}** (${shot.shotType ?? 'unknown'}, ${shot.timestampSeconds.toFixed(3)} s): ${shot.summary}`) : ['No stroke candidate was assessable.']),
    '',
    '## Findings',
    '',
    ...(findings.length ? findings.map(item => `### ${item.title}\n\n- Observation: ${item.observation}\n- Coaching implication: ${item.coachingImplication}\n- Alternative explanation: ${item.alternativeExplanation || 'Not assessed'}\n- Coaching cue: ${item.coachingCue || 'Review only; no corrective cue established.'}\n- Drill: ${item.drill || 'No corrective drill is justified by the available evidence.'}\n- Confidence: ${item.confidence}\n- Source frames: ${item.frameIndices.join(', ') || 'none recorded'}`) : ['No specific findings were supported by the supplied footage.']),
    '',
    '## Strengths',
    '',
    ...(analysis.strengths.length ? analysis.strengths.map(value => `- **${value.title}:** ${value.observation} · confidence ${value.confidence} · frames ${value.frameIndices.join(', ') || 'not cited'}`) : ['No strengths could be assessed.']),
    '',
    '## Projected joint angles',
    '',
    '| Frame | Timestamp | Phase | Joint / side | Estimated 2D angle | Confidence | Limitation |',
    '|---|---:|---|---|---:|---:|---|',
    ...analysis.jointAngles.map(item => `| ${item.frameId} | ${item.timestampSeconds.toFixed(3)} s | ${item.phase} | ${item.joint} / ${item.side} | ${item.angleDegrees === null ? 'Unassessable' : `≈${Math.round(item.angleDegrees)}°`} | ${Math.round(item.confidence * 100)}% | ${item.limitations.join('; ').replace(/\|/g, '/')} |`),
    `Application angle summary: ${calculatedAngleCount} triplet(s) calculated from detailed phase frames; ${unassessableAngleCount} unassessable. Overview-only limitations below do not invalidate later detailed-frame calculations.`,
    '',
    'Angles are application-calculated image-plane estimates from visually estimated landmarks. They are not 3D or clinical angles; force, torque, ground reaction force, and physical speed are not measured.',
    `Kinetics status: ${analysis.kinetics.status}. ${analysis.kinetics.hypotheses.length ? analysis.kinetics.hypotheses.join(' ') : 'Force, torque, pressure distribution, joint loads and centre of mass are not measured.'}`,
    '',
    '## Projected bat angles',
    '',
    contactBatAngle
      ? `- **At contact (frame ${contactBatAngle.frameIndex}):** ≈${Math.round(contactBatAngle.angleDegrees)}° from vertical (${contactBatAngle.method === 'handle_to_toe' ? 'handle to toe' : contactBatAngle.method === 'hands_to_toe' ? 'grip to toe; handle hidden by the hands' : 'hands to estimated contact point; bat toe not visible'})`
      : '- **At contact:** unassessable; bat ends and hands-to-contact line were not both available.',
    '',
    ...(batAngles.length ? [
      '| Frame | Timestamp | Phase | Visibility | Estimated 2D bat angle | Confidence |',
      '|---|---:|---|---|---:|---:|',
      ...batAngles.map(item => `| ${item.frameId} | ${item.timestampSeconds.toFixed(3)} s | ${item.phase} | ${item.visibility} | ${item.angleDegrees === null ? 'Unassessable' : `≈${Math.round(item.angleDegrees)}°`} | ${Math.round(item.confidence * 100)}% |`),
      ''
    ] : []),
    'Bat angle is the handle-to-toe direction measured from straight down in the image (0° = bat hanging vertically below the hands, above 90° = toe above the hands), matching CAPE\'s convention. It is a 2D estimate, not a 3D bat face or lie angle.',
    '',
    '## Limitations',
    '',
    ...(analysis.limitations.length ? analysis.limitations.map(value => {
      if (calculatedAngleCount > 0 && /joint-triplet status:\s*unassessable/i.test(value)) {
        return `- Overview-only limitation: ${value} Detailed-frame calculations, where supported, are listed above.`;
      }
      return `- ${value}`;
    }) : ['No additional limitations were recorded.']),
    '',
    '## Additional evidence requested',
    '',
    ...(analysis.additionalEvidence.length ? analysis.additionalEvidence.map(renderEvidenceRequest) : ['None.']),
    '',
    '## Execution summary',
    '',
    `- **Input SHA-256:** ${analysis.executionLog.sourceSha256}`,
    `- **Model:** requested ${analysis.executionLog.modelRequested}; returned ${analysis.executionLog.modelReturned}`,
    `- **Responses:** ${analysis.executionLog.responseIds.join(', ') || 'none'}`,
    `- **Usage:** ${analysis.executionLog.usage ? `${analysis.executionLog.usage.inputTokens} input / ${analysis.executionLog.usage.outputTokens} output tokens` : 'not reported by API'}`,
    `- **Tools:** Node ${analysis.executionLog.toolVersions.node}; FFmpeg ${analysis.executionLog.toolVersions.ffmpeg}; FFprobe ${analysis.executionLog.toolVersions.ffprobe}; Sharp ${analysis.executionLog.toolVersions.sharp}`,
    `- **Stages:** ${analysis.executionLog.stages.join(' → ')}`,
    ...(analysis.executionLog.outputs.length ? analysis.executionLog.outputs.map(output => `- **Output checksum:** \`${output.path}\` · SHA-256 \`${output.sha256}\` · ${output.sizeBytes} bytes`) : ['- No separate output checksums were recorded.']),
    '',
    '## Review images',
    '',
    ...visuals.map(([name, description]) => artifactNames.has(name)
      ? `- [\`${name}\`](./${name}) ${description}`
      : `- **${name} omitted:** ${name.startsWith('bat_') ? 'both bat endpoints were not visible.' : 'the required source frame or phase evidence was unavailable.'}`),
    ''
  ].join('\n');
}

function archiveBuffers(files: Map<string, Buffer>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = new ZipArchive({ store: true });
    const chunks: Buffer[] = [];
    archive.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    archive.on('error', reject);
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    for (const [name, buffer] of files) archive.append(buffer, { name });
    void archive.finalize().catch(reject);
  });
}

async function createPngMontage(images: Array<{ buffer: Buffer; label: string }>, columns = 2): Promise<Buffer | null> {
  if (!images.length) return null;
  const cardWidth = 480;
  const cardHeight = 520;
  const cards = await Promise.all(images.map(async ({ buffer, label }) => {
    const resized = await sharp(buffer).resize(cardWidth - 20, cardHeight - 52, { fit: 'contain', background: '#020617' }).png().toBuffer();
    const labelSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cardWidth}" height="36"><rect width="100%" height="100%" fill="#0f172a"/><text x="12" y="24" fill="#fff" font-family="sans-serif" font-size="15">${xmlEscape(label.slice(0, 100))}</text></svg>`);
    return sharp({ create: { width: cardWidth, height: cardHeight, channels: 4, background: '#020617' } })
      .composite([{ input: labelSvg, top: 0, left: 0 }, { input: resized, top: 38, left: 10 }]).png().toBuffer();
  }));
  const actualColumns = Math.max(1, Math.min(columns, cards.length));
  const rows = Math.ceil(cards.length / actualColumns);
  return sharp({ create: { width: actualColumns * cardWidth, height: rows * cardHeight, channels: 4, background: '#020617' } })
    .composite(cards.map((input, index) => ({ input, left: (index % actualColumns) * cardWidth, top: Math.floor(index / actualColumns) * cardHeight })))
    .png().toBuffer();
}

export async function createAndPersistBattingReport(
  analysis: OpenAiBattingAnalysis,
  rootDirectory: string
): Promise<StoredBattingReport> {
  const id = randomUUID();
  const directory = path.join(rootDirectory, id);
  await fs.mkdir(directory, { recursive: true });
  try {
  const files = new Map<string, { buffer: Buffer; mimeType: string }>();
  const contactSource = decodeImageDataUrl(analysis.contact.imageDataUrl);

  if (contactSource && analysis.contact.status === 'DETECTED') {
    files.set('contact_review.png', { buffer: await renderAnnotatedFrame(analysis, contactSource, analysis.contact.frameIndex ?? -1, analysis.contactLandmarksNorm, false), mimeType: 'image/png' });
  } else {
    const ordered = [...analysis.poseSequenceFrames].sort((a, b) => a.timestampSeconds - b.timestampSeconds);
    const before = [...ordered].reverse().find(frame => frame.phase === 'PRE_CONTACT');
    const center = ordered.find(frame => frame.phase === 'CONTACT') ?? ordered.find(frame => frame.frameIndex === analysis.contact.frameIndex);
    const after = ordered.find(frame => frame.phase === 'POST_CONTACT');
    const brackets = [before, center, after].filter((frame): frame is OpenAiBattingAnalysis['poseSequenceFrames'][number] => Boolean(frame));
    const cards = await Promise.all(brackets.map(async frame => {
      const source = decodeImageDataUrl(analysis.sourceFrameImages.find(item => item.frameIndex === frame.frameIndex)?.imageDataUrl) ?? decodeImageDataUrl(frame.imageDataUrl);
      if (!source) return null;
      const phase = analysis.phaseReviewFrames.find(item => item.frameIndex === frame.frameIndex);
      const image = phase
        ? await renderAnnotatedFrame(analysis, source, frame.frameIndex, phase.landmarksNorm, false)
        : await sharp(source).png().toBuffer();
      return { buffer: image, label: `${frame.phase.replace(/_/g, ' ')} · frame ${frame.frameIndex} · ${frame.timestampSeconds.toFixed(3)} s` };
    }));
    if (!cards.length && contactSource) cards.push({ buffer: await sharp(contactSource).png().toBuffer(), label: `Candidate frame · ${analysis.contact.timestampSeconds?.toFixed(3) ?? 'time unknown'} s` });
    const montage = await createPngMontage(cards.filter((card): card is { buffer: Buffer; label: string } => card !== null), 3);
    if (montage) files.set('contact_review.png', { buffer: montage, mimeType: 'image/png' });
  }

  const jointCards = await Promise.all(analysis.phaseReviewFrames.map(async frame => {
    const source = decodeImageDataUrl(frame.imageDataUrl);
    const hasVisibleLandmark = Object.values(frame.landmarksNorm).some(point => point !== null);
    if (!source || !hasVisibleLandmark) return null;
    return {
      buffer: await renderAnnotatedFrame(analysis, source, frame.frameIndex, frame.landmarksNorm, true),
      label: `${frame.shotId} · ${frame.phase.replace(/_/g, ' ')} · frame ${frame.frameIndex} · ${frame.timestampSeconds.toFixed(3)} s · ${Math.round(frame.confidence * 100)}% landmark confidence`
    };
  }));
  const jointMontage = await createPngMontage(jointCards.filter((card): card is { buffer: Buffer; label: string } => card !== null));
  if (jointMontage) files.set('joint_analysis.png', { buffer: jointMontage, mimeType: 'image/png' });

  const batCards = await Promise.all(analysis.batLandmarksByFrame.map(async batFrame => {
    if (!batFrame.handleNorm || !batFrame.toeNorm || batFrame.visibility === 'hidden') return null;
    const frame = analysis.phaseReviewFrames.find(item => item.frameIndex === batFrame.frameIndex);
    const source = decodeImageDataUrl(analysis.sourceFrameImages.find(item => item.frameIndex === batFrame.frameIndex)?.imageDataUrl)
      ?? decodeImageDataUrl(frame?.imageDataUrl);
    if (!source) return null;
    return {
      buffer: await renderAnnotatedFrame(analysis, source, batFrame.frameIndex, frame?.landmarksNorm ?? {}, false),
      label: `${frame?.shotId ?? 'stroke'} · ${batFrame.phase.replace(/_/g, ' ')} · frame ${batFrame.frameIndex} · ${(frame?.timestampSeconds ?? analysis.sourceFrameImages.find(item => item.frameIndex === batFrame.frameIndex)?.timestampSeconds ?? 0).toFixed(3)} s · single-frame shaft estimate`
    };
  }));
  const batMontage = await createPngMontage(batCards.filter((card): card is { buffer: Buffer; label: string } => card !== null));
  if (batMontage) files.set('bat_path_sequence.png', { buffer: batMontage, mimeType: 'image/png' });

  const phaseCards = await Promise.all(analysis.phaseReviewFrames.map(async frame => {
    const source = decodeImageDataUrl(frame.imageDataUrl);
    if (!source) return null;
    return {
      buffer: await renderAnnotatedFrame(analysis, source, frame.frameIndex, frame.landmarksNorm, false),
      label: `${frame.shotId} · ${frame.phase.replace(/_/g, ' ')} · ${frame.timestampSeconds.toFixed(3)} s`
    };
  }));
  const phaseMontage = await createPngMontage(phaseCards.filter((card): card is { buffer: Buffer; label: string } => card !== null));
  if (phaseMontage) files.set('phase_sequence.png', { buffer: phaseMontage, mimeType: 'image/png' });
  else {
    const phaseSvg = decodeImageDataUrl(analysis.visualOutputs.movementSequenceImageDataUrl);
    if (phaseSvg) files.set('phase_sequence.png', { buffer: await sharp(phaseSvg).png().toBuffer(), mimeType: 'image/png' });
  }

  const finishFrame = analysis.phaseReviewFrames.find(frame => frame.phase === 'finish') ?? analysis.phaseReviewFrames.find(frame => frame.phase === 'extension');
  const followThroughSource = decodeImageDataUrl(finishFrame?.imageDataUrl) ?? decodeImageDataUrl([...analysis.poseSequenceFrames].reverse().find(frame => frame.phase === 'POST_CONTACT')?.imageDataUrl);
  if (followThroughSource) {
    const image = finishFrame
      ? await renderAnnotatedFrame(analysis, followThroughSource, finishFrame.frameIndex, finishFrame.landmarksNorm, true)
      : await sharp(followThroughSource).png().toBuffer();
    files.set('follow_through.png', { buffer: image, mimeType: 'image/png' });
  }

  files.set('joint_angles.json', { buffer: Buffer.from(JSON.stringify(analysis.jointAngles, null, 2)), mimeType: 'application/json' });
  analysis.executionLog.toolVersions.sharp = sharp.versions.sharp || 'unknown';
  analysis.executionLog.stages.push('render_available_png_artifacts', 'write_joint_angles_json', 'generate_markdown_report', 'persist_report_artifacts', 'create_analysis_bundle');
  analysis.executionLog.outputs = [...files.entries()].map(([name, file]) => ({
    path: name,
    sha256: createHash('sha256').update(file.buffer).digest('hex'),
    sizeBytes: file.buffer.length
  }));
  const reportBuffer = Buffer.from(markdownReport(analysis, new Set(files.keys())));
  files.set('report.md', { buffer: reportBuffer, mimeType: 'text/markdown' });
  analysis.executionLog.outputs.push({
    path: 'report.md',
    sha256: createHash('sha256').update(reportBuffer).digest('hex'),
    sizeBytes: reportBuffer.length
  });
  files.set('execution_log.json', { buffer: Buffer.from(JSON.stringify(analysis.executionLog, null, 2)), mimeType: 'application/json' });
  const analysisJson = toPersistableAnalysis(analysis, [...files.keys(), 'analysis.json', 'analysis_bundle.zip']);
  files.set('analysis.json', { buffer: Buffer.from(JSON.stringify(analysisJson, null, 2)), mimeType: 'application/json' });
  files.set('analysis_bundle.zip', { buffer: await archiveBuffers(filesToBuffers(files)), mimeType: 'application/zip' });

  const artifacts: StoredReportArtifact[] = [];
  for (const [name, file] of files) {
    await fs.writeFile(path.join(directory, name), file.buffer, { flag: 'wx' });
    artifacts.push({ name, mimeType: file.mimeType, sizeBytes: file.buffer.length, sha256: createHash('sha256').update(file.buffer).digest('hex') });
  }
  return { id, directory, artifacts, analysisRecord: analysisJson };
  } catch (error) {
    await fs.rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export async function persistBattingCoachReview(
  directory: string,
  analysisRecord: Record<string, unknown>,
  currentArtifacts: StoredReportArtifact[],
  review: CoachReviewRecord
): Promise<{ analysisRecord: Record<string, unknown>; artifacts: StoredReportArtifact[] }> {
  const files = new Map<string, Buffer>();
  for (const artifact of currentArtifacts) {
    if (!isBattingReportArtifactName(artifact.name) || artifact.name === 'analysis_bundle.zip') continue;
    files.set(artifact.name, await fs.readFile(path.join(directory, artifact.name)));
  }
  if (!files.has('analysis.json') || !files.has('report.md')) throw new Error('Persisted report is missing review artifacts.');
  const updatedAnalysis = { ...analysisRecord, coachReview: review };
  files.set('analysis.json', Buffer.from(JSON.stringify(updatedAnalysis, null, 2)));
  const escapeText = (value: string) => value.replace(/[<>]/g, character => character === '<' ? '&lt;' : '&gt;').trim();
  const reviewMarkdown = [
    '', '## Coach review', '', `Reviewed on ${review.reviewedAt}.`, '',
    escapeText(review.note) || 'No overall note added.', '',
    ...review.findings.map(item => `- Finding ${item.findingIndex + 1}: **${item.status}**${item.note ? ` — ${escapeText(item.note)}` : ''}`), ''
  ].join('\n');
  files.set('report.md', Buffer.concat([files.get('report.md')!, Buffer.from(reviewMarkdown)]));
  const allFiles = new Map(files);
  allFiles.set('analysis_bundle.zip', await archiveBuffers(files));

  const artifacts: StoredReportArtifact[] = [...allFiles.entries()].map(([name, buffer]) => ({
    name,
    mimeType: currentArtifacts.find(artifact => artifact.name === name)?.mimeType ?? (name === 'analysis_bundle.zip' ? 'application/zip' : 'application/json'),
    sizeBytes: buffer.length,
    sha256: createHash('sha256').update(buffer).digest('hex')
  }));
  const staged: Array<{ temporary: string; target: string }> = [];
  try {
    for (const [name, buffer] of allFiles) {
      const target = path.join(directory, name);
      const temporary = path.join(directory, `${randomUUID()}.tmp`);
      await fs.writeFile(temporary, buffer, { flag: 'wx' });
      staged.push({ temporary, target });
    }
    for (const file of staged) await fs.rename(file.temporary, file.target);
  } catch (error) {
    await Promise.all(staged.map(file => fs.rm(file.temporary, { force: true })));
    throw error;
  }
  return { analysisRecord: updatedAnalysis, artifacts };
}

export function toPersistableAnalysis(analysis: OpenAiBattingAnalysis, artifactNames: string[] = []): Record<string, unknown> {
  const { imageDataUrl: _contactImage, ...contact } = analysis.contact;
  const { croppedContactImageDataUrl: _crop, poseSequenceFrames, phaseReviewFrames, sourceFrameImages, shotAssessments, visualOutputs: _visuals, ...report } = analysis;
  return {
    ...report,
    contact,
    shotAssessments: (shotAssessments || []).map(({ phaseReviewFrames: shotFrames, ...shot }) => ({
      ...shot,
      phaseReviewFrameManifest: (shotFrames || []).map(({ imageDataUrl: _imageDataUrl, ...frame }) => frame)
    })),
    poseSequenceFrameCount: poseSequenceFrames.length,
    phaseReviewFrameManifest: (phaseReviewFrames || []).map(({ imageDataUrl: _imageDataUrl, ...frame }) => frame),
    sourceFrameManifest: (sourceFrameImages || []).map(({ imageDataUrl: _imageDataUrl, ...frame }) => frame),
    visualArtifacts: artifactNames
  };
}

function filesToBuffers(files: Map<string, { buffer: Buffer; mimeType: string }>): Map<string, Buffer> {
  return new Map([...files.entries()].map(([name, file]) => [name, file.buffer]));
}

export function isBattingReportArtifactName(name: string): boolean {
  return /^(analysis\.json|joint_angles\.json|contact_review\.png|joint_analysis\.png|bat_path_sequence\.png|follow_through\.png|phase_sequence\.png|report\.md|execution_log\.json|analysis_bundle\.zip)$/.test(name);
}