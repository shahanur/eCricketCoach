import { PlayerProfile as PlayerProfileRecord, Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { prisma } from '../config/prisma.js';
import { AuthenticatedUser } from '../middleware/auth.js';

export class PlayerProfileError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

export const playerProfileOptions = {
  battingHandedness: ['NOT_SET', 'RIGHT', 'LEFT'],
  bowlingStyle: [
    'NOT_SET',
    'RIGHT_ARM_FAST',
    'LEFT_ARM_FAST',
    'RIGHT_ARM_SPIN',
    'LEFT_ARM_SPIN',
  ],
  disciplines: ['BATTING', 'BOWLING', 'KEEPING', 'FIELDING'],
  experienceLevel: ['NOT_SET', 'BEGINNER', 'DEVELOPING', 'INTERMEDIATE', 'ADVANCED'],
} as const;

export type PlayerProfileInput = {
  version: number;
  displayName: string;
  battingHandedness: typeof playerProfileOptions.battingHandedness[number];
  bowlingStyle: typeof playerProfileOptions.bowlingStyle[number];
  primaryDisciplines: Array<typeof playerProfileOptions.disciplines[number]>;
  experienceLevel: typeof playerProfileOptions.experienceLevel[number];
  goals: string[];
};

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === 'string' && values.includes(value);
}

export function validatePlayerProfileInput(value: unknown): PlayerProfileInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PlayerProfileError(400, 'INVALID_PROFILE', 'The player profile is invalid.');
  }
  const input = value as Record<string, unknown>;
  const expectedKeys = [
    'version',
    'displayName',
    'battingHandedness',
    'bowlingStyle',
    'primaryDisciplines',
    'experienceLevel',
    'goals',
  ];
  if (Object.keys(input).some(key => !expectedKeys.includes(key)) ||
      expectedKeys.some(key => !Object.hasOwn(input, key))) {
    throw new PlayerProfileError(400, 'INVALID_PROFILE', 'The player profile is invalid.');
  }

  const displayName = typeof input.displayName === 'string' ? input.displayName.trim() : '';
  const hasControlCharacters = (value: string) => /[\u0000-\u001f\u007f]/.test(value);
  if (!Number.isSafeInteger(input.version) || (input.version as number) < 0 ||
      displayName.length < 1 || displayName.length > 80 || hasControlCharacters(displayName) ||
      !isOneOf(input.battingHandedness, playerProfileOptions.battingHandedness) ||
      !isOneOf(input.bowlingStyle, playerProfileOptions.bowlingStyle) ||
      !isOneOf(input.experienceLevel, playerProfileOptions.experienceLevel) ||
      !Array.isArray(input.primaryDisciplines) || input.primaryDisciplines.length > 4 ||
      !input.primaryDisciplines.every(item => isOneOf(item, playerProfileOptions.disciplines)) ||
      new Set(input.primaryDisciplines).size !== input.primaryDisciplines.length ||
      !Array.isArray(input.goals) || input.goals.length > 3 ||
      !input.goals.every(goal => typeof goal === 'string' && goal.trim().length > 0 &&
        goal.trim().length <= 120 && !hasControlCharacters(goal.trim()))) {
    throw new PlayerProfileError(400, 'INVALID_PROFILE', 'Check your profile details and try again.');
  }

  return {
    version: input.version as number,
    displayName,
    battingHandedness: input.battingHandedness,
    bowlingStyle: input.bowlingStyle,
    primaryDisciplines: input.primaryDisciplines as PlayerProfileInput['primaryDisciplines'],
    experienceLevel: input.experienceLevel,
    goals: [...new Set((input.goals as string[]).map(goal => goal.trim()))],
  };
}

async function findPlayerTenant(user: AuthenticatedUser, client: PrismaClient) {
  if (user.role !== 'PLAYER' || !user.tenantId || !user.email) {
    throw new PlayerProfileError(403, 'INDIVIDUAL_PLAYER_REQUIRED', 'An individual player account is required.');
  }
  const tenant = await client.customerTenant.findUnique({ where: { id: user.tenantId } });
  if (!tenant || tenant.type !== 'INDIVIDUAL' ||
      !['ACTIVE', 'TRIAL'].includes(tenant.status) ||
      tenant.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
    throw new PlayerProfileError(403, 'INDIVIDUAL_PLAYER_REQUIRED', 'An individual player account is required.');
  }
  return tenant;
}

function profileDto(profile: Prisma.PlayerProfileGetPayload<object>) {
  return {
    id: profile.id,
    displayName: profile.displayName,
    battingHandedness: profile.battingHandedness,
    bowlingStyle: profile.bowlingStyle,
    primaryDisciplines: profile.primaryDisciplines,
    experienceLevel: profile.experienceLevel,
    goals: profile.goals,
    isComplete: profile.primaryDisciplines.length > 0,
    version: profile.version,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

async function getOrCreatePlayerProfile(user: AuthenticatedUser, client: PrismaClient = prisma) {
  const tenant = await findPlayerTenant(user, client);
  const ownerEmail = tenant.email.trim().toLowerCase();
  let profile: PlayerProfileRecord;
  try {
    profile = await client.playerProfile.upsert({
      where: { tenantId: tenant.id },
      create: {
        id: randomUUID(),
        tenantId: tenant.id,
        ownerEmail,
        displayName: tenant.name.trim().slice(0, 80) || ownerEmail.split('@')[0],
        battingHandedness: 'NOT_SET',
        bowlingStyle: 'NOT_SET',
        primaryDisciplines: [],
        experienceLevel: 'NOT_SET',
        goals: [],
      },
      update: {},
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await client.playerProfile.findUnique({ where: { tenantId: tenant.id } });
      if (existing && existing.ownerEmail.trim().toLowerCase() === ownerEmail) {
        return existing;
      }
      throw new PlayerProfileError(409, 'PLAYER_PROFILE_EXISTS', 'A player profile already exists for this account.');
    }
    throw error;
  }
  if (profile.ownerEmail.trim().toLowerCase() !== ownerEmail) {
    throw new PlayerProfileError(403, 'PROFILE_OWNER_MISMATCH', 'This player profile is not available to this account.');
  }
  return profile;
}

export async function getPlayerProfile(user: AuthenticatedUser, client: PrismaClient = prisma) {
  return profileDto(await getOrCreatePlayerProfile(user, client));
}

export async function updatePlayerProfile(
  user: AuthenticatedUser,
  value: unknown,
  client: PrismaClient = prisma,
) {
  const input = validatePlayerProfileInput(value);
  const profile = await getOrCreatePlayerProfile(user, client);
  const updated = await client.playerProfile.updateMany({
    where: {
      id: profile.id,
      tenantId: profile.tenantId,
      ownerEmail: profile.ownerEmail,
      version: input.version,
    },
    data: {
      displayName: input.displayName,
      battingHandedness: input.battingHandedness,
      bowlingStyle: input.bowlingStyle,
      primaryDisciplines: input.primaryDisciplines,
      experienceLevel: input.experienceLevel,
      goals: input.goals,
      version: { increment: 1 },
    },
  });
  if (updated.count !== 1) {
    throw new PlayerProfileError(409, 'PROFILE_VERSION_CONFLICT', 'This profile changed elsewhere. Refresh it before saving again.');
  }
  return profileDto(await client.playerProfile.findUniqueOrThrow({ where: { id: profile.id } }));
}
