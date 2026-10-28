import { Router, Request, Response } from 'express';
import { DbService } from '../services/dbService.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { approveDevelopmentPlayer, developmentSubscriptionsEnabled, PlayerSubscriptionError, renewDevelopmentPlayer } from '../services/playerDevelopmentSubscription.js';
import { sendPlayerSubscriptionError } from './playerSubscription.js';

export const adminRouter = Router();

// Admin: Get all notifications (Email Alerts inbox)
adminRouter.get('/notifications', async (_req: Request, res: Response) => {
  try {
    const notifs = await DbService.getNotifications();
    res.json(notifs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Get Support Tickets raised by tenants/customers
adminRouter.get('/support-tickets', async (req: Request, res: Response) => {
  try {
    const { status, category, search } = req.query;
    const tickets = await DbService.getSupportTickets({
      status: status as string | undefined,
      category: category as string | undefined,
      search: search as string | undefined
    });
    res.json(tickets);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Tenant / Public: Raise a new Support Ticket
adminRouter.post('/support-tickets', async (req: Request, res: Response) => {
  try {
    const { name, email, category, priority, subject, message, tenantRole, clubName } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Missing required fields: name, email, subject, message' });
    }
    const ticket = await DbService.createSupportTicket({
      name,
      email,
      category: category || 'TECHNICAL',
      priority: priority || 'NORMAL',
      subject,
      message,
      tenantRole,
      clubName
    });
    return res.status(201).json({ success: true, ticket });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin & Support Engineers: Resolve or Update Support Ticket
adminRouter.patch('/support-tickets/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { resolution, resolvedBy, status } = req.body;
    if (!resolution) {
      return res.status(400).json({ error: 'Resolution explanation is required to resolve ticket' });
    }
    const updated = await DbService.resolveSupportTicket(id, {
      resolution,
      resolvedBy: resolvedBy || 'System Support Engineer',
      status: status || 'RESOLVED'
    });
    return res.json({ success: true, ticket: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin: Get all customers with optional filters & tenancy MRR metrics
adminRouter.get('/customers', async (req: Request, res: Response) => {
  try {
    const { type, status, search } = req.query;
    const results = await DbService.getCustomers(
      search as string | undefined,
      type as string | undefined,
      status as string | undefined
    );

    const totalMrr = results.filter(c => c.status === 'ACTIVE').reduce((sum, c) => sum + c.mrr, 0);

    res.json({
      customers: results,
      metrics: {
        totalTenants: results.length,
        activeSubscriptions: results.filter(c => c.status === 'ACTIVE').length,
        pastDueCount: results.filter(c => c.status === 'PAST_DUE').length,
        totalMrr: parseFloat(totalMrr.toFixed(2))
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Update Customer Subscription / Status
adminRouter.patch('/customers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, subscriptionPlan } = req.body;

    let mrr: number | undefined;
    if (subscriptionPlan) {
      if (subscriptionPlan === 'INDIVIDUAL') mrr = 14.99;
      else if (subscriptionPlan === 'COACH_PRO') mrr = 49.99;
      else if (subscriptionPlan === 'CLUB_ACADEMY') mrr = 199.99;
      else mrr = 0;
    }

    const updated = await DbService.updateCustomer(id, { status, subscriptionPlan, mrr });
    if (!updated) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    return res.json({ success: true, customer: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin: Get Invoices & Billing logs
adminRouter.get('/invoices', async (_req: Request, res: Response) => {
  try {
    const invoices = await DbService.getInvoices();
    res.json(invoices);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Retry / Refund / Resolve Invoice
adminRouter.patch('/invoices/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updated = await DbService.updateInvoiceStatus(id, status || 'PAID');
    if (!updated) return res.status(404).json({ error: 'Invoice not found' });
    return res.json({ success: true, invoice: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin: List pending clubs
adminRouter.get('/club-approvals', async (_req: Request, res: Response) => {
  try {
    const approvals = await DbService.getClubApprovals();
    res.json(approvals);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Approve pending club registration
adminRouter.post('/club-approvals/:id/approve', authenticateToken, requireRole(['SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (developmentSubscriptionsEnabled()) {
      const application = await DbService.client.clubApproval.findUnique({ where: { id } });
      if (application?.type === 'INDIVIDUAL') {
        return res.json(await approveDevelopmentPlayer(id));
      }
    }
    const approvedItem = await DbService.approveClub(id);
    if (!approvedItem) return res.status(404).json({ error: 'Club application not found' });

    const mrr = approvedItem.type === 'CLUB' ? 199.99 : approvedItem.type === 'COACH' ? 49.99 : 14.99;
    const plan = approvedItem.type === 'CLUB' ? 'CLUB_ACADEMY' : approvedItem.type === 'COACH' ? 'COACH_PRO' : 'INDIVIDUAL';

    // Automatically register as active customer tenant in PostgreSQL
    const newCustomer = await DbService.createCustomer({
      id: 'ten-' + Date.now(),
      name: approvedItem.clubName,
      type: approvedItem.type || 'CLUB',
      email: approvedItem.adminEmail,
      subscriptionPlan: plan,
      status: 'ACTIVE',
      billingCycle: approvedItem.billingCycle || 'ANNUAL',
      mrr: mrr,
      activeMembers: 1,
      joinedAt: new Date().toISOString().split('T')[0]
    });

    const notif = await DbService.createNotification({
      id: 'notif-' + Date.now(),
      title: `Account Activated: ${approvedItem.clubName}`,
      message: `System Admin approved the registration for ${approvedItem.adminName} (${approvedItem.adminEmail}). Welcome email and credentials sent.`,
      type: 'TENANT_ACTIVATED',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      read: false
    });

    return res.json({
      success: true,
      message: `Account "${approvedItem.clubName}" approved. Admin invited!`,
      item: approvedItem,
      customer: newCustomer,
      notification: notif
    });
  } catch (err: any) {
    if (err instanceof PlayerSubscriptionError) return sendPlayerSubscriptionError(err, res);
    console.error('Registration approval failed:', err);
    return res.status(500).json({ error: 'Registration approval failed. Please try again.' });
  }
});

adminRouter.get('/player-subscriptions/config', authenticateToken, requireRole(['SUPER_ADMIN']), (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ developmentSubscriptionsEnabled: developmentSubscriptionsEnabled() });
});

adminRouter.post('/customers/:id/renew-player-subscription', authenticateToken, requireRole(['SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await renewDevelopmentPlayer(req.params.id));
  } catch (error) {
    sendPlayerSubscriptionError(error, res);
  }
});
