import { Router, Request, Response } from 'express';

export const subscriptionsRouter = Router();

subscriptionsRouter.get('/plans', (_req: Request, res: Response) => {
  res.json([
    {
      id: 'plan_individual',
      name: 'Individual Player',
      priceMonthly: 14.99,
      features: ['Personal skill roadmap', '5 AI video analyses/month', 'Tailored training plans', 'Solo practice mode']
    },
    {
      id: 'plan_coach',
      name: 'Coach Pro',
      priceMonthly: 49.99,
      features: ['Manage up to 25 players', 'Group and Individual drill planning', 'Skill assessment & promotions', 'AI drill library ingestion']
    },
    {
      id: 'plan_club',
      name: 'Club / Academy',
      priceMonthly: 199.99,
      features: ['Unlimited coaches & players', 'Squad management', 'Multi-tenant organization admin', 'Full analytics & video storage']
    }
  ]);
});
