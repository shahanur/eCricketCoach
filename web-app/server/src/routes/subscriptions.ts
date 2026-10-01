import { Router, Request, Response } from 'express';
import { DbService } from '../services/dbService.js';
import { ClubApproval, Invoice, AdminNotification, CustomerTenant } from '../types/index.js';

export const subscriptionsRouter = Router();

subscriptionsRouter.get('/plans', (_req: Request, res: Response) => {
  res.json([
    {
      id: 'INDIVIDUAL',
      type: 'INDIVIDUAL',
      name: 'Individual Player',
      priceMonthly: 14.99,
      priceAnnual: 149.99,
      features: [
        'Tailored personalized batting, bowling, keeping & fielding roadmap',
        'AI Biomechanical Video Pose Estimation & Kinematic feedback',
        '5 AI Video Action Uploads / Month with Google Drive cloud sync',
        'Solo Practice Mode & self-guided technical drills',
        'Digital Certificate of Progression upon skill stage milestones'
      ]
    },
    {
      id: 'COACH_PRO',
      type: 'COACH',
      name: 'Coach Pro',
      priceMonthly: 49.99,
      priceAnnual: 499.99,
      features: [
        'Manage up to 25 active players with dedicated profiles',
        'Individual & Group drill planning and scheduling',
        'Create and save Proprietary Custom Coaching Drills to catalog',
        'Post-session coach observation logging with automated AI drill top-ups',
        'Player Stage Evaluations & 1-Click Progression Certificate Generator'
      ]
    },
    {
      id: 'CLUB_ACADEMY',
      type: 'CLUB',
      name: 'Club / Academy',
      priceMonthly: 199.99,
      priceAnnual: 1999.99,
      features: [
        'Unlimited coaches, managers, and registered youth/senior players',
        'Multi-squad & age-group management (U11, U13, U15, U19, Seniors)',
        'Club-wide Google Drive video integration & archive',
        'System Admin multi-tenant isolation with custom organizational branding',
        'Consolidated academy billing, invoice history & audit reports'
      ]
    }
  ]);
});

// Checkout & Subscription Payment Endpoint
subscriptionsRouter.post('/checkout', async (req: Request, res: Response) => {
  try {
    const { planId, billingCycle, name, email, organizationName, cardNumber } = req.body;
    if (!planId || !name || !email) {
      return res.status(400).json({ error: 'planId, name, and email are required.' });
    }

    const isAnnual = billingCycle === 'ANNUAL';
    const price = planId === 'CLUB_ACADEMY'
      ? (isAnnual ? 1999.99 : 199.99)
      : planId === 'COACH_PRO'
      ? (isAnnual ? 499.99 : 49.99)
      : (isAnnual ? 149.99 : 14.99);

    const planType: CustomerTenant['type'] =
      planId === 'CLUB_ACADEMY' ? 'CLUB' : planId === 'COACH_PRO' ? 'COACH' : 'INDIVIDUAL';

    const approvalId = 'appr-' + Date.now();
    const orgName = organizationName || (planType === 'CLUB' ? `${name} Cricket Club` : name);

    // 1. Queue into approvals in PostgreSQL
    const approvalItem: ClubApproval = {
      id: approvalId,
      clubName: orgName,
      adminName: name,
      adminEmail: email,
      plan: `${planId} (${isAnnual ? 'Annual' : 'Monthly'})`,
      amountPaid: price,
      paymentStatus: 'PAID',
      approvalStatus: 'AWAITING_APPROVAL',
      type: planType,
      billingCycle: isAnnual ? 'ANNUAL' : 'MONTHLY',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };
    const savedApproval = await DbService.createClubApproval({
      ...approvalItem,
      status: 'AWAITING_APPROVAL'
    });

    // 2. Generate Invoice in PostgreSQL
    const invoiceId = 'INV-' + Math.floor(1100 + Math.random() * 900);
    const invoiceItem: Invoice = {
      id: invoiceId,
      tenantId: 'pending-' + approvalId,
      customerName: orgName,
      amount: price,
      currency: 'USD',
      status: 'PAID',
      date: new Date().toISOString().split('T')[0],
      planName: `${planId} (${billingCycle})`
    };
    const savedInvoice = await DbService.createInvoice(invoiceItem);

    // 3. Dispatch Notification in PostgreSQL
    const notifItem: AdminNotification = {
      id: 'notif-' + Date.now(),
      title: `New Registration Paid: ${orgName} (${planId})`,
      message: `System Admin Notification: ${name} (${email}) completed checkout for $${price.toFixed(2)} on plan ${planId}. Queued for approval.`,
      type: 'PAYMENT_RECEIVED',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      read: false
    };
    const savedNotif = await DbService.createNotification(notifItem);

    return res.status(201).json({
      success: true,
      message: 'Subscription payment processed. Account application sent to System Admin for verification.',
      data: {
        approval: savedApproval,
        invoice: savedInvoice,
        notification: savedNotif
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
