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

function decodeImageDataUrl(dataUrl: string | null | undefined): Buffer | null {
  if (!dataUrl) return null;
  const match = /^data:image\/(?:jpeg|png|svg\+xml);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  return match ? Buffer.from(match[1], 'base64') : null;
}

function xmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!);
}

function pointMarkup(points: Array<{ x: number; y: number } | null | undefined>, width: number, height: number): string {
  return points.filter((point): point is { x: number; y: number } => Boolean(point))
    .map(point => `<circle cx="${point.x * width}" cy="${point.y * height}" r="7" fill="#22d3ee" stroke="#082f49" stroke-width="3"/>`)
    .join('');
}

function reviewOverlay(analysis: OpenAiBattingAnalysis, width: number, height: number, includeAngles: boolean): Buffer {
  const landmarks = analysis.contactLandmarksNorm;
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
  const points = pointMarkup(Object.values(landmarks), width, height);
  const bat = analysis.batHandleNorm && analysis.batToeNorm
    ? `<line x1="${analysis.batHandleNorm.x * width}" y1="${analysis.batHandleNorm.y * height}" x2="${analysis.batToeNorm.x * width}" y2="${analysis.batToeNorm.y * height}" stroke="#fb7185" stroke-width="4" stroke-dasharray="9 7"/>`
    : '';
  const contactPoint = analysis.contact.pointNorm
    ? `<circle cx="${analysis.contact.pointNorm.x * width}" cy="${analysis.contact.pointNorm.y * height}" r="12" fill="none" stroke="#fb7185" stroke-width="4"/>`
    : '';
  const angleLabels = includeAngles ? analysis.jointAngles.map((item, index) =>
    `<text x="14" y="${26 + index * 22}" fill="#fff" font-family="sans-serif" font-size="16" stroke="#0f172a" stroke-width="3" paint-order="stroke">${xmlEscape(`${item.side} ${item.joint}: ${item.angleDegrees === null ? 'unassessable' : `${item.angleDegrees}°`}`)}</text>`
  ).join('') : '';
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="none"/>${includeAngles ? segmentMarkup : ''}${bat}${points}${contactPoint}${angleLabels}</svg>`);
}

function markdownReport(analysis: OpenAiBattingAnalysis, artifactNames: Set<string>): string {
  const findings = [...analysis.errors, ...analysis.observations];
  const visuals = [
    ['contact_review.png', 'Contact frame with available point estimates.'],
    ['joint_analysis.png', 'Estimated joint segments with application-calculated projected angles.'],
    ['bat_path_sequence.png', 'Single-frame bat orientation; not a tracked trajectory.'],
    ['phase_sequence.png', 'Overview phase sequence montage.'],
    ['follow_through.png', 'Post-contact frame; timing caveats apply.']
  ] as const;
  return [
    '# Cricket batting analysis',
    '',
    `- **Assessment:** ${analysis.status}`,
    `- **Model:** ${analysis.executionLog.modelReturned}`,
    `- **Prompt/schema:** ${analysis.promptVersion} / ${analysis.schemaVersion}`,
    `- **Video:** ${analysis.video.durationSeconds.toFixed(3)} s, ${analysis.video.width}×${analysis.video.height}, ${analysis.video.fps.toFixed(3)} fps (encoded rate)`,
    `- **Contact:** ${analysis.contact.status}${analysis.contact.timestampSeconds === null ? '' : ` at ${analysis.contact.timestampSeconds.toFixed(6)} s`}`,
    `- **Camera view / blur:** ${analysis.footageQuality.cameraView} / ${analysis.footageQuality.blur}`,
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
    ...(findings.length ? findings.map(item => `### ${item.title}\n\n- Observation: ${item.observation}\n- Coaching implication: ${item.coachingImplication}\n- Alternative explanation: ${item.alternativeExplanation || 'Not assessed'}\n- Confidence: ${item.confidence}\n- Source frames: ${item.frameIndices.join(', ') || 'none recorded'}`) : ['No specific findings were supported by the supplied footage.']),
    '',
    '## Strengths',
    '',
    ...(analysis.strengths.length ? analysis.strengths.map(value => `- ${value}`) : ['No strengths could be assessed.']),
    '',
    '## Projected joint angles',
    '',
    '| Phase | Joint | Side | Angle | Confidence | Timestamp | Status |',
    '|---|---|---|---:|---:|---:|---|',
    ...analysis.jointAngles.map(item => `| ${item.phase} | ${item.joint} | ${item.side} | ${item.angleDegrees === null ? '—' : `${item.angleDegrees}°`} | ${Math.round(item.confidence * 100)}% | ${item.timestampSeconds.toFixed(3)} s | ${item.status} |`),
    '',
    'Angles are application-calculated image-plane estimates from visually estimated landmarks. They are not 3D or clinical angles; force, torque, ground reaction force, and physical speed are not measured.',
    '',
    '## Limitations',
    '',
    ...(analysis.limitations.length ? analysis.limitations.map(value => `- ${value}`) : ['No additional limitations were recorded.']),
    '',
    '## Additional evidence requested',
    '',
    ...(analysis.additionalEvidence.length ? analysis.additionalEvidence.map(value => `- ${value}`) : ['None.']),
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

  if (contactSource) {
    const { width, height } = await sharp(contactSource).metadata();
    if (width && height) {
      const contactOverlay = reviewOverlay(analysis, width, height, false);
      const jointOverlay = reviewOverlay(analysis, width, height, true);
      files.set('contact_review.png', { buffer: await sharp(contactSource).composite([{ input: contactOverlay }]).png().toBuffer(), mimeType: 'image/png' });
      files.set('joint_analysis.png', { buffer: await sharp(contactSource).composite([{ input: jointOverlay }]).png().toBuffer(), mimeType: 'image/png' });
      if (analysis.batHandleNorm && analysis.batToeNorm) {
        const batOrientationOverlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><line x1="${analysis.batHandleNorm.x * width}" y1="${analysis.batHandleNorm.y * height}" x2="${analysis.batToeNorm.x * width}" y2="${analysis.batToeNorm.y * height}" stroke="#fb7185" stroke-width="6" stroke-dasharray="10 8"/><text x="18" y="32" fill="#fff" font-family="sans-serif" font-size="18" stroke="#0f172a" stroke-width="3" paint-order="stroke">Single-frame bat orientation — not a tracked path</text></svg>`);
        files.set('bat_path_sequence.png', { buffer: await sharp(contactSource).composite([{ input: batOrientationOverlay }]).png().toBuffer(), mimeType: 'image/png' });
      }
    }
  }

  const phaseSvg = decodeImageDataUrl(analysis.visualOutputs.movementSequenceImageDataUrl);
  if (phaseSvg) {
    const phasePng = await sharp(phaseSvg).png().toBuffer();
    files.set('phase_sequence.png', { buffer: phasePng, mimeType: 'image/png' });
  }

  const followThroughSource = decodeImageDataUrl([...analysis.poseSequenceFrames].reverse().find(frame => frame.phase === 'POST_CONTACT')?.imageDataUrl);
  if (followThroughSource) {
    files.set('follow_through.png', { buffer: await sharp(followThroughSource).png().toBuffer(), mimeType: 'image/png' });
  }

  const analysisJson = toPersistableAnalysis(analysis, [...files.keys()]);
  files.set('analysis.json', { buffer: Buffer.from(JSON.stringify(analysisJson, null, 2)), mimeType: 'application/json' });
  files.set('joint_angles.json', { buffer: Buffer.from(JSON.stringify(analysis.jointAngles, null, 2)), mimeType: 'application/json' });
  files.set('report.md', { buffer: Buffer.from(markdownReport(analysis, new Set(files.keys()))), mimeType: 'text/markdown' });
  files.set('execution_log.json', { buffer: Buffer.from(JSON.stringify(analysis.executionLog, null, 2)), mimeType: 'application/json' });
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

export function toPersistableAnalysis(analysis: OpenAiBattingAnalysis, artifactNames: string[] = []): Record<string, unknown> {
  const { imageDataUrl: _contactImage, ...contact } = analysis.contact;
  const { croppedContactImageDataUrl: _crop, poseSequenceFrames, visualOutputs: _visuals, ...report } = analysis;
  return {
    ...report,
    contact,
    poseSequenceFrameCount: poseSequenceFrames.length,
    visualArtifacts: artifactNames
  };
}

function filesToBuffers(files: Map<string, { buffer: Buffer; mimeType: string }>): Map<string, Buffer> {
  return new Map([...files.entries()].map(([name, file]) => [name, file.buffer]));
}

export function isBattingReportArtifactName(name: string): boolean {
  return /^(analysis\.json|joint_angles\.json|contact_review\.png|joint_analysis\.png|bat_path_sequence\.png|follow_through\.png|phase_sequence\.png|report\.md|execution_log\.json|analysis_bundle\.zip)$/.test(name);
}