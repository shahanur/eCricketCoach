import { createHash } from 'node:crypto';
import { prisma } from '../config/prisma.js';

const PROGRAM_START_DATE = process.env.EKOTA_PROGRAM_START_DATE || nextMondayUtc();
const CLUB_NAME = process.env.EKOTA_CLUB_NAME || 'Ekota Academy';

const WEEKLY_PLAN = [
  {
    focus: 'Fielding Fundamentals',
    activity: 'Build throwing arms safely and effectively with throwing mechanics, distance-building, and accuracy drills.',
    drill: 'Safe throwing mechanics, progressive distance throws, and target accuracy.'
  },
  {
    focus: 'Bowling Fundamentals I',
    activity: 'Line and length. Indoor or net bowling focused on consistent release points, targeting, and repeatable actions.',
    drill: 'Release-point repetition, target bowling, and line-and-length challenges.'
  },
  {
    focus: 'Bowling Fundamentals II',
    activity: 'Pace and variation. Work on grip, run-up rhythm, and basic cross-seam and slower-ball variations while maintaining core action.',
    drill: 'Grip checks, run-up rhythm, cross-seam deliveries, and introductory slower balls.'
  },
  {
    focus: 'Batting Fundamentals I',
    activity: 'The sweep technique. Develop head position, balance, and shot selection against spin.',
    drill: 'Sweep-shot progressions against spin with balance and head-position checkpoints.'
  },
  {
    focus: 'Batting Fundamentals II',
    activity: 'The off drive. Develop front-foot movement, weight transfer, and a straight bat through the off side.',
    drill: 'Front-foot movement, weight transfer, and straight-bat off-drive practice.'
  },
  {
    focus: 'Fielding Intensity',
    activity: 'Bullseye throwing and fielding accuracy. High-intensity circuits focused on hitting the stumps and quick releases.',
    drill: 'High-intensity ground-fielding circuit, quick pickup-and-release, and stump-target throws.'
  },
  {
    focus: 'Skill Integration I',
    activity: 'Combination grooving. Link multiple skills, such as batting followed by running or fielding followed by bowling.',
    drill: 'Linked batting-and-running and fielding-and-bowling combinations.'
  },
  {
    focus: 'Skill Integration II',
    activity: 'Match-scenario combinations: “Hit, Call & Sprint” batting and running, plus “Bowl, React & Attack” fielding transitions.',
    drill: 'Hit-call-sprint scenarios and bowl-react-attack fielding transitions.'
  },
  {
    focus: 'Advanced Batting',
    activity: 'Strike rotation and the cut shot. Practise singles to build an innings and the cut shot against short deliveries.',
    drill: 'Strike-rotation singles and cut-shot selection against short deliveries.'
  },
  {
    focus: 'Advanced Fielding & Batting',
    activity: 'Close catching and backfoot play. Improve close-range and slip-catching reflexes alongside the backfoot drive.',
    drill: 'Close-range and slip-catching reactions, plus backfoot-drive batting.'
  },
  {
    focus: 'Game Week',
    activity: 'Intra-squad match applying the skills from the first ten weeks. Coaches observe without intervening.',
    drill: 'Intra-squad match with coach observation and player-led skill application.'
  },
  {
    focus: 'Assessment Week',
    activity: 'Phase 1 review and feedback. Coaches conduct one-to-one player assessments, discuss strengths and development areas, and set Phase 2 goals.',
    drill: 'Individual Phase 1 assessment and feedback meetings.'
  },
  {
    focus: 'Scenario Batting',
    activity: 'Rebuild an innings after a batting collapse, using scenario-based nets focused on defence, patience, and rotating the strike.',
    drill: 'Batting-collapse scenarios focused on defence, patience, and strike rotation.'
  },
  {
    focus: 'Pressure Bowling',
    activity: 'Bowling at the death. Practise yorkers, slower balls, and setting fields for final-over situations.',
    drill: 'Final-over bowling scenarios with yorkers, slower balls, and field-setting decisions.'
  },
  {
    focus: 'Core Mechanics',
    activity: 'Align and balance. Revisit fundamentals to maintain body alignment and balance in batting and bowling actions.',
    drill: 'Batting and bowling alignment, balance, and controlled-action checkpoints.'
  },
  {
    focus: 'Spin Defense',
    activity: 'Defend against spin. Practise footwork, reading the bowler’s hand, and using the crease to defend.',
    drill: 'Read-the-hand cues, forward and back footwork, and crease-use against spin.'
  },
  {
    focus: 'Tactical Running',
    activity: 'Build a winning score with running between the wickets, calling, backing up, and turning ones into twos.',
    drill: 'Partner calling, backing-up, turning, and decision-making between the wickets.'
  },
  {
    focus: 'T20 Tactics',
    activity: 'Short-format dynamics. Practise aggressive batting, death bowling, and high-energy boundary fielding.',
    drill: 'T20 powerplay batting, death-over bowling, and boundary-fielding scenarios.'
  },
  {
    focus: 'Defensive Fielding',
    activity: 'Run saving. Perfect the long-barrier technique and boundary riding to prevent runs in match situations.',
    drill: 'Long-barrier technique, boundary riding, and run-saving scenarios.'
  },
  {
    focus: 'Solidifying Defense',
    activity: 'Forward defense. Master soft hands, playing late, and protecting the stumps against good-length bowling.',
    drill: 'Forward-defense technique with soft hands, late contact, and stump protection.'
  },
  {
    focus: 'Chases & Playing Spin',
    activity: 'Bat under pressure in simulated run chases, with additional focus on playing leg-spin effectively.',
    drill: 'Target-based run chases and leg-spin reading, footwork, and shot selection.'
  },
  {
    focus: 'Advanced Fielding Tactics',
    activity: 'Captaincy and field placement. Set fields for different bowlers and game situations, with intensive fielding and catching.',
    drill: 'Player-led field placements, bowler-specific tactics, and catching circuits.'
  },
  {
    focus: 'Game Week',
    activity: 'Final competitive intra-squad match. Players take ownership of field settings, batting orders, and match tactics.',
    drill: 'Final intra-squad match with player-led tactics, batting orders, and field settings.'
  },
  {
    focus: 'Assessment Week',
    activity: 'End-of-programme player evaluations, feedback, and celebration of progress and achievements.',
    drill: 'Final individual player assessment, feedback, goal setting, and programme celebration.'
  }
] as const;

const ASSESSMENT_METRICS: Record<string, string[]> = {
  BATTING: ['Stance & balance', 'Footwork', 'Shot selection', 'Timing & contact', 'Running between wickets'],
  BOWLING: ['Run-up & rhythm', 'Action & alignment', 'Release point', 'Accuracy', 'Follow-through'],
  KEEPING: ['Stance & readiness', 'Footwork', 'Glove technique', 'Catching & gathering', 'Communication'],
  FIELDING: ['Ready position', 'Movement & agility', 'Ground fielding', 'Throwing accuracy', 'Communication']
};

function nextMondayUtc(): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  const daysUntilMonday = (8 - date.getUTCDay()) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + daysUntilMonday);
  return date.toISOString().slice(0, 10);
}

function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('EKOTA_PROGRAM_START_DATE must use YYYY-MM-DD.');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('EKOTA_PROGRAM_START_DATE must be a real calendar date.');
  }
  if (date.getUTCDay() !== 1) {
    throw new Error('EKOTA_PROGRAM_START_DATE must be a Monday.');
  }
  return date;
}

function addWeeks(date: Date, weeks: number): string {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + weeks * 7);
  return result.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function stablePlayerKey(playerId: string): string {
  return createHash('md5').update(playerId).digest('hex').slice(0, 16);
}

async function seedEkotaProgram(): Promise<void> {
  const startDate = parseDate(PROGRAM_START_DATE);
  const club = await prisma.customerTenant.findFirst({
    where: { name: { equals: CLUB_NAME, mode: 'insensitive' }, type: 'CLUB' }
  });
  if (!club) throw new Error(`Club "${CLUB_NAME}" was not found. Create the club account before running this seed.`);

  const players = await prisma.clubMember.findMany({
    where: { clubId: club.id, role: 'PLAYER', invitationStatus: 'ACTIVE' },
    orderBy: { id: 'asc' }
  });
  if (players.length === 0) throw new Error('Ekota has no active players to assign to the programme.');

  const coach = await prisma.clubMember.findFirst({
    where: { clubId: club.id, role: 'COACH', invitationStatus: 'ACTIVE' },
    orderBy: { id: 'asc' }
  });
  if (!coach) throw new Error('Ekota has no active coach to own the programme assessments.');

  const programmeName = 'Ekota 24-Week Development Programme';
  const assignedPlayerIds = players.map(player => player.id);
  const sessions: Array<{ id: string; sessionDate: string }> = [];

  for (const [index, week] of WEEKLY_PLAN.entries()) {
    const weekNumber = index + 1;
    const weekId = weekNumber.toString().padStart(2, '0');
    const sessionId = `ekota-24wk-week-${weekId}`;
    const sessionDate = addWeeks(startDate, index);
    const drillId = `ekota-24wk-drill-${weekId}`;

    await prisma.drill.upsert({
      where: { id: drillId },
      create: {
        id: drillId,
        title: `Week ${weekNumber}: ${week.focus}`,
        discipline: weekNumber === 1 || weekNumber === 6 || weekNumber === 10 || weekNumber === 19 || weekNumber === 22
          ? 'FIELDING'
          : weekNumber === 2 || weekNumber === 3 || weekNumber === 14
            ? 'BOWLING'
            : 'BATTING',
        skillSet: week.focus,
        contextType: 'GROUP',
        duration: 30,
        source: 'CLUB_CUSTOM',
        clubId: club.id,
        clubName: club.name,
        instructions: week.drill
      },
      update: {
        title: `Week ${weekNumber}: ${week.focus}`,
        skillSet: week.focus,
        instructions: week.drill,
        clubName: club.name
      }
    });

    await prisma.trainingSession.upsert({
      where: { id: sessionId },
      create: {
        id: sessionId,
        clubId: club.id,
        squadName: programmeName,
        coachId: coach.id,
        coachName: coach.name,
        assignedPlayerIds,
        title: `Week ${weekNumber}: ${week.focus}`,
        sessionDate,
        durationMinutes: weekNumber === 12 || weekNumber === 24 ? 120 : 90,
        isPublished: false,
        drillCount: 1,
        drillIds: [drillId],
        postNotes: `Programme plan: ${week.activity}`
      },
      update: {
        clubId: club.id,
        squadName: programmeName,
        coachId: coach.id,
        coachName: coach.name,
        assignedPlayerIds,
        title: `Week ${weekNumber}: ${week.focus}`,
        sessionDate,
        durationMinutes: weekNumber === 12 || weekNumber === 24 ? 120 : 90,
        drillCount: 1,
        drillIds: [drillId]
      }
    });
    sessions.push({ id: sessionId, sessionDate });
  }

  for (const weekNumber of [12, 24]) {
    const session = sessions[weekNumber - 1];
    for (const [index, player] of players.entries()) {
      const discipline = player.discipline in ASSESSMENT_METRICS ? player.discipline : 'BATTING';
      const metrics = ASSESSMENT_METRICS[discipline].map(name => ({ name, score: null, note: '' }));
      const timeMinutes = 9 * 60 + (index % 16) * 30;
      const scheduledTime = `${Math.floor(timeMinutes / 60).toString().padStart(2, '0')}:${(timeMinutes % 60).toString().padStart(2, '0')}`;
      const scheduledDate = addDays(session.sessionDate, Math.floor(index / 16));
      const assessmentId = `ekota-24wk-w${weekNumber}-${stablePlayerKey(player.id)}`;

      await prisma.playerAssessment.upsert({
        where: { id: assessmentId },
        create: {
          id: assessmentId,
          clubId: club.id,
          playerId: player.id,
          playerName: player.name,
          coachId: coach.id,
          coachName: coach.name,
          title: weekNumber === 12 ? 'Week 12: Phase 1 Player Assessment' : 'Week 24: Final Programme Assessment',
          discipline,
          scheduledDate,
          scheduledTime,
          status: 'SCHEDULED',
          metrics,
          trainingSessionId: session.id
        },
        update: {
          playerName: player.name,
          coachId: coach.id,
          coachName: coach.name,
          scheduledDate,
          scheduledTime,
          trainingSessionId: session.id
        }
      });
    }
  }

  console.log(`Seeded Ekota programme from ${PROGRAM_START_DATE}: ${sessions.length} sessions and ${players.length * 2} assessments for ${players.length} active players.`);
}

seedEkotaProgram()
  .catch(error => {
    console.error('Failed to seed Ekota training programme:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
