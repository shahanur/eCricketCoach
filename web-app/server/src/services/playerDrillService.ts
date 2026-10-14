import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import type { CapeAiGuidance } from './capeClient.js';

type GuidanceItem = CapeAiGuidance['items'][number];
type Writer = Prisma.TransactionClient;
type AssignmentRecord = NonNullable<Awaited<ReturnType<typeof prisma.playerDrillAssignment.findFirst>>>;

export interface CapeJobForAssignment {
  id: string;
  tenantId: string;
  playerId: string | null;
  playerName: string | null;
  status: string;
  request: unknown;
  result: unknown;
}

export class DrillAssignmentError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function playerDrillAssignmentView(record: AssignmentRecord) {
  return {
    id: record.id,
    playerId: record.playerId,
    playerName: record.playerName,
    drillId: record.drillId,
    systemDrillId: record.systemDrillId,
    capeJobId: record.capeJobId,
    faultCode: record.faultCode,
    title: record.title,
    discipline: record.discipline,
    details: record.details,
    assignedByName: record.assignedByName,
    createdAt: record.createdAt.toISOString()
  };
}

function guidanceItem(result: unknown, faultCode: string): GuidanceItem | null {
  const items = (result as { coaching?: { ai_guidance?: { items?: unknown } } } | null)?.coaching?.ai_guidance?.items;
  if (!Array.isArray(items)) return null;
  return (items as GuidanceItem[]).find(item => item?.fault_code === faultCode) ?? null;
}

function disciplineFor(request: unknown): string {
  return (request as { target?: string } | null)?.target === 'bowler' ? 'BOWLING' : 'BATTING';
}

// Plain-text instructions for the catalogue, which only has a single free-text field.
export function drillInstructions(item: GuidanceItem): string {
  const lines = [
    ...item.drill.instructions.map((step, index) => `${index + 1}. ${step}`),
    item.coaching_cues.length ? `Coaching cues: ${item.coaching_cues.join('; ')}` : '',
    item.drill.equipment.length ? `Equipment: ${item.drill.equipment.join(', ')}` : '',
    `Focus: ${item.title}. ${item.why_it_matters}`
  ];
  return lines.filter(Boolean).join('\n');
}

// Reuses a catalogue drill with the same title and discipline in the same scope, otherwise creates one.
async function findOrCreateDrill(tx: Writer, scope: { source: 'SYSTEM_PREDEFINED' } | { source: 'CLUB_CUSTOM'; clubId: string; clubName: string | null }, item: GuidanceItem, discipline: string) {
  const title = item.drill.name.trim().slice(0, 200);
  const existing = await tx.drill.findFirst({
    where: { title, discipline, source: scope.source, clubId: scope.source === 'CLUB_CUSTOM' ? scope.clubId : null },
    select: { id: true }
  });
  if (existing) return existing.id;
  const prefix = scope.source === 'SYSTEM_PREDEFINED' ? 'drill-sys-cape' : 'drill-club-cape';
  const created = await tx.drill.create({
    data: {
      id: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      discipline,
      skillSet: item.title.trim().slice(0, 200) || 'Technique correction',
      contextType: 'INDIVIDUAL',
      duration: 15,
      source: scope.source,
      clubId: scope.source === 'CLUB_CUSTOM' ? scope.clubId : null,
      clubName: scope.source === 'CLUB_CUSTOM' ? scope.clubName : null,
      instructions: drillInstructions(item)
    },
    select: { id: true }
  });
  return created.id;
}

// Assigns the guidance drill for one fault of a finished CAPE job to the analysed player, adding it
// to both the club catalogue and the shared system catalogue. Repeat calls return the existing assignment.
export async function assignCapeGuidanceDrill(job: CapeJobForAssignment, faultCode: string, assignedById: string) {
  if (job.status !== 'SUCCEEDED') throw new DrillAssignmentError(409, 'The analysis has not finished yet.');
  if (!job.playerId) throw new DrillAssignmentError(400, 'This analysis is not linked to a player.');
  const item = guidanceItem(job.result, faultCode);
  if (!item) throw new DrillAssignmentError(404, 'No suggested drill was found for that finding.');

  const existing = await prisma.playerDrillAssignment.findUnique({ where: { capeJobId_faultCode: { capeJobId: job.id, faultCode } } });
  if (existing) return { assignment: playerDrillAssignmentView(existing), created: false };

  const [tenant, assigner] = await Promise.all([
    prisma.customerTenant.findUnique({ where: { id: job.tenantId }, select: { name: true } }),
    prisma.clubMember.findFirst({ where: { id: assignedById, clubId: job.tenantId }, select: { name: true } })
  ]);
  const discipline = disciplineFor(job.request);

  try {
    const record = await prisma.$transaction(async tx => {
      const systemDrillId = await findOrCreateDrill(tx, { source: 'SYSTEM_PREDEFINED' }, item, discipline);
      const drillId = await findOrCreateDrill(tx, { source: 'CLUB_CUSTOM', clubId: job.tenantId, clubName: tenant?.name ?? null }, item, discipline);
      return tx.playerDrillAssignment.create({
        data: {
          tenantId: job.tenantId,
          playerId: job.playerId!,
          playerName: job.playerName || 'Player',
          drillId,
          systemDrillId,
          capeJobId: job.id,
          faultCode,
          title: item.drill.name.trim().slice(0, 200),
          discipline,
          details: {
            correction: item.title,
            why_it_matters: item.why_it_matters,
            coaching_cues: item.coaching_cues,
            instructions: item.drill.instructions,
            equipment: item.drill.equipment
          },
          assignedById,
          assignedByName: assigner?.name ?? null
        }
      });
    });
    return { assignment: playerDrillAssignmentView(record), created: true };
  } catch (error) {
    // A concurrent click already created this assignment.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const winner = await prisma.playerDrillAssignment.findUnique({ where: { capeJobId_faultCode: { capeJobId: job.id, faultCode } } });
      if (winner) return { assignment: playerDrillAssignmentView(winner), created: false };
    }
    throw error;
  }
}
