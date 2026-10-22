import type { OpenAiBattingAnalysis, PoseOverlayAnalysis } from '../types';
import { downloadPdfReport, type PdfBlock } from './pdfReport';

function expectedRange(expected: [number | null, number | null], unit: string): string {
  const suffix = unit === 'm' ? ' m' : unit;
  const [minimum, maximum] = expected;
  if (minimum !== null && maximum !== null) return `${minimum}–${maximum}${suffix}`;
  if (minimum !== null) return `≥ ${minimum}${suffix}`;
  if (maximum !== null) return `≤ ${maximum}${suffix}`;
  return '—';
}

function metricStatus(status: string, severity: string | null | undefined): string {
  return severity || (status === 'fault' ? 'Fault' : status === 'measured' ? 'Measured' : status);
}

export function downloadBattingTechniquePdf(
  analysis: OpenAiBattingAnalysis,
  playerName: string,
  poseResult: PoseOverlayAnalysis | undefined = analysis.poseOverlayResult
): void {
  const shotType = analysis.requestMetadata.shotType.replace(/_/g, ' ');
  const blocks: PdfBlock[] = [
    { type: 'heading', text: 'Movement and technique' },
    { type: 'facts', items: [
      ['Batter hand', analysis.requestMetadata.batterHandedness === 'unknown' ? 'Unknown' : `${analysis.requestMetadata.batterHandedness === 'left' ? 'Left' : 'Right'}-handed`],
      ['Shot type', shotType],
      ['Contact status', analysis.contact.status.replace(/_/g, ' ').toLowerCase()]
    ] },
    { type: 'heading', text: 'Technique Summary' },
    { type: 'text', label: 'Summary', text: poseResult?.coaching_rules.verdict || analysis.summary || 'No technique summary available.' }
  ];

  const makeMetricRows = (group: 'shot' | 'alignment', metrics: Array<{ metric: string; label: string; unit: string }>) => metrics.map(({ metric, label, unit }) => {
    const check = poseResult?.coaching_rules.checks.find(item => item.group === group && item.metric === metric);
    const directValue = poseResult?.metrics[metric];
    const temporal = poseResult?.temporal_angle_estimates[metric];
    const value = directValue ?? temporal?.value ?? null;
    const status = directValue === null || directValue === undefined
      ? temporal ? 'Estimated from nearby frames' : 'Unavailable'
      : check?.status || 'Measured';
    return [
      label,
      value === null ? 'Not measured' : `${value.toFixed(1)}${unit === 'm' ? ' m' : unit}`,
      expectedRange(check?.expected ?? [null, null], unit),
      metricStatus(status, check?.severity)
    ];
  });

  blocks.push(
    { type: 'heading', text: 'Kinematics' },
    { type: 'table', head: ['Measure', 'Measured', 'Expected', 'Status'], rows: makeMetricRows('shot', [
      { metric: 'back_knee', label: 'Back knee', unit: '°' },
      { metric: 'back_elbow', label: 'Back elbow', unit: '°' },
      { metric: 'front_knee', label: 'Front knee', unit: '°' },
      { metric: 'front_elbow', label: 'Front elbow', unit: '°' },
      { metric: 'shoulder_tilt_degrees', label: 'Shoulder tilt', unit: '°' },
      { metric: 'head_front_knee_offset_pct', label: 'Head front-knee offset', unit: '%' },
      { metric: 'bat_angle_deg', label: 'Bat angle', unit: '°' },
      { metric: 'stride_m', label: 'Stride', unit: 'm' }
    ]) },
    { type: 'heading', text: 'Alignment checklist' },
    { type: 'table', head: ['Check', 'Measured', 'Expected', 'Status'], rows: makeMetricRows('alignment', [
      { metric: 'chin_front_toe_offset_pct', label: 'Chin over front toe', unit: '%' },
      { metric: 'front_shoulder_target_angle_deg', label: 'Front shoulder to target', unit: '°' },
      { metric: 'back_foot_crease_angle_deg', label: 'Back foot to crease', unit: '°' },
      { metric: 'front_elbow_height_pct', label: 'Front elbow height', unit: '%' }
    ]) },
    { type: 'heading', text: 'What to Fix' },
    { type: 'bullets', items: [
      ...(poseResult?.coaching_rules.faults.map(fault =>
        `${fault.verdict || fault.message} (${fault.severity}): ${fault.message} ${fault.metric.replace(/_/g, ' ')} ${fault.value.toFixed(1)}; expected ${expectedRange(fault.expected, fault.metric.endsWith('_m') ? 'm' : fault.metric.endsWith('_degrees') || fault.metric.endsWith('_deg') ? '°' : '%')}. ${fault.recommendation}${fault.drill ? ` Drill: ${fault.drill}` : ''}`
      ) ?? analysis.errors.map(error => `${error.title}: ${error.coachingImplication}`)),
      ...(poseResult?.coaching_rules.unavailable.map(metric => `${metric.replace(/_/g, ' ')}: not assessed`) ?? [])
    ] },
    { type: 'heading', text: 'Pose Overlay images' }
  );

  if (analysis.croppedContactImageDataUrl) {
    blocks.push({ type: 'image', dataUrl: analysis.croppedContactImageDataUrl, caption: 'Selected contact view' });
  }
  if (poseResult?.overlay_image_base64) {
    blocks.push({
      type: 'image',
      dataUrl: `data:${poseResult.overlay_mime_type};base64,${poseResult.overlay_image_base64}`,
      caption: 'Batter movement and alignment'
    });
  } else {
    blocks.push({ type: 'text', text: 'Pose overlay image is not available for this saved analysis.' });
  }

  blocks.push({ type: 'heading', text: 'Pose Through Contact' });
  const sequence = poseResult?.sequence.filter(frame => frame.status === 'success' && frame.overlay_image_base64) ?? [];
  if (sequence.length) {
    for (const frame of sequence) {
      blocks.push({
        type: 'image',
        dataUrl: `data:${frame.overlay_mime_type || 'image/png'};base64,${frame.overlay_image_base64}`,
        caption: `${frame.phase.replace(/_/g, ' ')} · frame ${frame.frame_index}`
      });
    }
  } else {
    blocks.push({ type: 'text', text: 'Pose-through-contact images are not available for this saved analysis.' });
  }

  blocks.push(
    { type: 'heading', text: 'Coaching Guidance' },
    { type: 'text', label: 'Priority cue', text: analysis.priorityCue || 'No priority cue available.' },
    { type: 'text', label: 'Drill', text: [
      analysis.drill.title,
      analysis.drill.rationale,
      ...analysis.drill.instructions
    ].filter(Boolean).join('\n') || 'No drill guidance available.' },
    { type: 'heading', text: 'Strengths' },
    { type: 'bullets', items: [
      ...analysis.strengths.map(strength => `${strength.title}: ${strength.observation}`),
      ...(poseResult?.coaching_rules.strengths ?? [])
    ] }
  );

  const safePlayerName = playerName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'player';
  downloadPdfReport({
    title: 'Movement and Technique',
    subtitle: `${playerName || 'Player'} · ${new Date().toLocaleDateString()}`,
    filename: `ecricketcoach-movement-technique-${safePlayerName}.pdf`,
    blocks
  });
}
