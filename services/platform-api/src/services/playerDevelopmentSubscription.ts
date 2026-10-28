import { Prisma, PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { AuthenticatedUser } from '../middleware/auth.js';

export class PlayerSubscriptionError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

export function developmentSubscriptionsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.PLAYER_DEVELOPMENT_SUBSCRIPTIONS === 'true' &&
    (env.NODE_ENV === 'development' || env.NODE_ENV === 'test');
}

function requireDevelopmentMode() {
  if (!developmentSubscriptionsEnabled()) {
    throw new PlayerSubscriptionError(503, 'DEVELOPMENT_SUBSCRIPTIONS_DISABLED', 'Development player subscriptions are disabled.');
  }
}

export function oneMonthAfter(start: Date): Date {
  const end = new Date(start);
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(start.getUTCDate(), lastDay));
  return end;
}

const plan = {
  id: 'INDIVIDUAL',
  name: 'Individual Player',
  currency: 'GBP',
  priceMonthlyMinor: 1499,
  billingCycle: 'MONTHLY',
  profileLimit: 1,
  monthlyAnalysisLimit: 5,
};

function subscriptionResult(status: 'ACTIVE' | 'EXPIRED' | 'INACTIVE' | 'UNAVAILABLE', period: {
  startsAt: Date; endsAt: Date;
} | null) {
  return {
    status,
    source: period ? 'DEVELOPMENT_APPROVAL' : 'NONE',
    paymentVerified: false,
    plan,
    period: period ? { startsAt: period.startsAt.toISOString(), endsAt: period.endsAt.toISOString() } : null,
    autoRenews: false,
    // Neither approval nor a simulated invoice enables production payment or analysis.
    capabilities: { purchase: false, restorePurchases: false, analysis: false },
  };
}

async function lockOwner(tx: Prisma.TransactionClient, email: string) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${email}))`;
}

export async function registerDevelopmentPlayer(name: string, address: string, client: PrismaClient = prisma) {
  requireDevelopmentMode();
  const email = address.trim().toLowerCase();
  const displayName = name.trim();
  if (!displayName || displayName.length > 255 || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new PlayerSubscriptionError(400, 'INVALID_APPLICATION', 'A valid name and email are required.');
  }
  return client.$transaction(async tx => {
    await lockOwner(tx, email);
    const existing = await tx.clubApproval.findFirst({
      where: { type: 'INDIVIDUAL', adminEmail: { equals: email, mode: 'insensitive' } },
      orderBy: { createdAt: 'asc' },
    });
    if (existing && !['AWAITING_APPROVAL', 'APPROVED'].includes(existing.status)) {
      throw new PlayerSubscriptionError(409, 'APPLICATION_REVIEW_REQUIRED', 'Contact support to review your existing application.');
    }
    const id = `dev-player-${createHash('sha256').update(email).digest('hex').slice(0, 40)}`;
    const approval = existing ?? await tx.clubApproval.create({
      data: {
        id, clubName: displayName, adminName: displayName, adminEmail: email,
        plan: 'INDIVIDUAL (Monthly)', amountPaid: 0, type: 'INDIVIDUAL',
        billingCycle: 'MONTHLY', status: 'AWAITING_APPROVAL', createdAt: new Date().toISOString(),
      },
    });
    const notification = await tx.adminNotification.upsert({
      where: { id: `player-application-${approval.id}` },
      create: {
        id: `player-application-${approval.id}`, title: `Player registration: ${displayName}`.slice(0, 255),
        message: 'A player application is awaiting approval for development access. No payment has been taken.',
        type: 'APPROVAL_PENDING', timestamp: new Date().toISOString(), read: false,
      },
      update: {},
    });
    return {
      success: true,
      message: 'Application received. Sign in after your registration has been approved.',
      data: { approval: { ...approval, amountPaid: Number(approval.amountPaid) }, invoice: null, notification },
    };
  });
}

/** Development access is explicitly separate from provider-verified paid entitlement. */
export async function approveDevelopmentPlayer(approvalId: string, client: PrismaClient = prisma, now = new Date()) {
  requireDevelopmentMode();
  return client.$transaction(async tx => {
    const application = await tx.clubApproval.findUnique({ where: { id: approvalId } });
    if (!application || application.type !== 'INDIVIDUAL') {
      throw new PlayerSubscriptionError(404, 'APPLICATION_NOT_FOUND', 'Individual player application not found.');
    }
    if (!['AWAITING_APPROVAL', 'APPROVED'].includes(application.status)) {
      throw new PlayerSubscriptionError(409, 'APPLICATION_NOT_APPROVABLE', 'This application cannot be approved.');
    }
    const email = application.adminEmail.trim().toLowerCase();
    await lockOwner(tx, email);
    const existing = await tx.customerTenant.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (existing && (existing.type !== 'INDIVIDUAL' || existing.subscriptionPlan !== 'INDIVIDUAL' ||
      existing.status !== 'ACTIVE')) {
      throw new PlayerSubscriptionError(409, 'ACCOUNT_CONFLICT', 'An existing account must be reviewed before activation.');
    }
    const tenant = existing ?? await tx.customerTenant.create({
      data: {
        id: `player-${application.id}`, name: application.adminName, email,
        type: 'INDIVIDUAL', subscriptionPlan: 'INDIVIDUAL', status: 'ACTIVE',
        billingCycle: 'MONTHLY', mrr: 0, activeMembers: 1, joinedAt: now.toISOString().slice(0, 10),
      },
    });
    const subscription = await tx.playerDevelopmentSubscription.upsert({
      where: { tenantId: tenant.id },
      create: { tenantId: tenant.id, ownerEmail: email, approvalId, startsAt: now, endsAt: oneMonthAfter(now) },
      update: {},
    });
    const item = await tx.clubApproval.update({ where: { id: approvalId }, data: { status: 'APPROVED' } });
    const notification = await tx.adminNotification.upsert({
      where: { id: `player-activated-${subscription.approvalId}` },
      create: {
        id: `player-activated-${subscription.approvalId}`, title: `Player account activated: ${tenant.name}`.slice(0, 255),
        message: 'Individual player approved for one month of development access. No payment has been verified.',
        type: 'TENANT_ACTIVATED', timestamp: now.toISOString(), read: false,
      },
      update: {},
    });
    return {
      success: true,
      message: 'Player approved. They can now sign in to the player app.',
      item: { ...item, amountPaid: Number(item.amountPaid) },
      customer: { ...tenant, mrr: Number(tenant.mrr) },
      notification,
      subscription: subscriptionResult(now < subscription.endsAt ? 'ACTIVE' : 'EXPIRED', subscription),
    };
  });
}

export async function getPlayerSubscription(user: AuthenticatedUser, client: PrismaClient = prisma, now = new Date()) {
  if (user.role !== 'PLAYER' || !user.tenantId || !user.email) {
    throw new PlayerSubscriptionError(403, 'INDIVIDUAL_PLAYER_REQUIRED', 'An individual player account is required.');
  }
  const tenant = await client.customerTenant.findFirst({
    where: { id: user.tenantId, type: 'INDIVIDUAL', email: { equals: user.email, mode: 'insensitive' } },
  });
  if (!tenant) {
    throw new PlayerSubscriptionError(403, 'INDIVIDUAL_PLAYER_REQUIRED', 'An individual player account is required.');
  }
  if (!developmentSubscriptionsEnabled()) return subscriptionResult('UNAVAILABLE', null);
  if (tenant.status !== 'ACTIVE' || tenant.subscriptionPlan !== 'INDIVIDUAL') {
    return subscriptionResult('INACTIVE', null);
  }
  const subscription = await client.$transaction(async tx => {
    const email = tenant.email.trim().toLowerCase();
    await lockOwner(tx, email);
    const existing = await tx.playerDevelopmentSubscription.findUnique({ where: { tenantId: tenant.id } });
    if (existing) {
      if (existing.ownerEmail !== email) {
        throw new PlayerSubscriptionError(409, 'ACCOUNT_CONFLICT', 'The subscription owner must be reviewed.');
      }
      return existing;
    }
    // Existing approved website registrations receive their first test period once.
    const approval = await tx.clubApproval.findFirst({
      where: { type: 'INDIVIDUAL', status: 'APPROVED', adminEmail: { equals: email, mode: 'insensitive' } },
      orderBy: { createdAt: 'asc' },
    });
    if (!approval) return null;
    const alreadyLinked = await tx.playerDevelopmentSubscription.findUnique({ where: { ownerEmail: email } });
    if (alreadyLinked) {
      throw new PlayerSubscriptionError(409, 'ACCOUNT_CONFLICT', 'This player already has a subscription on another account.');
    }
    return tx.playerDevelopmentSubscription.create({
      data: { tenantId: tenant.id, ownerEmail: email, approvalId: approval.id, startsAt: now, endsAt: oneMonthAfter(now) },
    });
  });
  if (!subscription) return subscriptionResult('INACTIVE', null);
  return subscriptionResult(now >= subscription.startsAt && now < subscription.endsAt ? 'ACTIVE' : 'EXPIRED', subscription);
}

export async function renewDevelopmentPlayer(tenantId: string, client: PrismaClient = prisma, now = new Date()) {
  requireDevelopmentMode();
  return client.$transaction(async tx => {
    const tenant = await tx.customerTenant.findUnique({ where: { id: tenantId } });
    if (!tenant || tenant.type !== 'INDIVIDUAL' || tenant.status !== 'ACTIVE' ||
      tenant.subscriptionPlan !== 'INDIVIDUAL') {
      throw new PlayerSubscriptionError(404, 'PLAYER_NOT_FOUND', 'An active individual player account is required.');
    }
    await lockOwner(tx, tenant.email.trim().toLowerCase());
    const subscription = await tx.playerDevelopmentSubscription.findUnique({ where: { tenantId } });
    if (!subscription) {
      throw new PlayerSubscriptionError(409, 'SUBSCRIPTION_NOT_FOUND', 'The player must sign in once before renewal.');
    }
    // Duplicate clicks/retries cannot extend a still-active test subscription.
    if (now < subscription.endsAt) return subscriptionResult('ACTIVE', subscription);
    const renewed = await tx.playerDevelopmentSubscription.update({
      where: { tenantId }, data: { startsAt: now, endsAt: oneMonthAfter(now) },
    });
    return subscriptionResult('ACTIVE', renewed);
  });
}
