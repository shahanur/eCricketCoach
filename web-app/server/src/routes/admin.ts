import { Router, Request, Response } from 'express';
import { mockCustomers, mockInvoices, mockClubApprovals } from '../data/mockStore.js';

export const adminRouter = Router();

// Admin: Get all customers with optional filters & tenancy MRR metrics
adminRouter.get('/customers', (req: Request, res: Response) => {
  const { type, status, search } = req.query;
  let results = [...mockCustomers];

  if (type) {
    results = results.filter(c => c.type === (type as string).toUpperCase());
  }
  if (status) {
    results = results.filter(c => c.status === (status as string).toUpperCase());
  }
  if (search) {
    const q = (search as string).toLowerCase();
    results = results.filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  }

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
});

// Admin: Update Customer Subscription / Status
adminRouter.patch('/customers/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, subscriptionPlan } = req.body;

  const customer = mockCustomers.find(c => c.id === id);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  if (status) customer.status = status;
  if (subscriptionPlan) {
    customer.subscriptionPlan = subscriptionPlan;
    if (subscriptionPlan === 'INDIVIDUAL') customer.mrr = 14.99;
    else if (subscriptionPlan === 'COACH_PRO') customer.mrr = 49.99;
    else if (subscriptionPlan === 'CLUB_ACADEMY') customer.mrr = 199.99;
    else customer.mrr = 0;
  }

  return res.json({ success: true, customer });
});

// Admin: Get Invoices & Billing logs
adminRouter.get('/invoices', (_req: Request, res: Response) => {
  res.json(mockInvoices);
});

// Admin: Retry / Refund / Resolve Invoice
adminRouter.patch('/invoices/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const inv = mockInvoices.find(i => i.id === id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  if (status) inv.status = status;
  return res.json({ success: true, invoice: inv });
});

// Admin: List pending clubs
adminRouter.get('/club-approvals', (_req: Request, res: Response) => {
  res.json(mockClubApprovals);
});

// Admin: Approve pending club registration
adminRouter.post('/club-approvals/:id/approve', (req: Request, res: Response) => {
  const { id } = req.params;
  const item = mockClubApprovals.find(a => a.id === id);
  if (!item) return res.status(404).json({ error: 'Club application not found' });

  item.approvalStatus = 'APPROVED';

  // Automatically register as active customer tenant
  mockCustomers.push({
    id: 'ten-' + Date.now(),
    name: item.clubName,
    type: 'CLUB',
    email: item.adminEmail,
    subscriptionPlan: 'CLUB_ACADEMY',
    status: 'ACTIVE',
    billingCycle: 'ANNUAL',
    mrr: 199.99,
    activeMembers: 1,
    joinedAt: new Date().toISOString().split('T')[0]
  });

  return res.json({ success: true, message: `Club "${item.clubName}" approved. Admin invited!`, item });
});
