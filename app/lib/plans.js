// Missing scope means the original shared plan; no data migration is required.
export const planScope = (p) => p?.scope === 'personal' ? 'personal' : 'together';
export const planOwner = (p) => p?.owner || p?.who;
export const canEditPlan = (p, who) => planScope(p) === 'together' || planOwner(p) === who;
