import { ClubMember } from '../types';

// Players can belong to several squads; older payloads only carry the single `squad` label.
export function memberSquads(member: Pick<ClubMember, 'squad' | 'squads'>): string[] {
  if (Array.isArray(member.squads)) return member.squads;
  return member.squad && member.squad !== 'Unassigned' ? [member.squad] : [];
}

export function isInSquad(member: Pick<ClubMember, 'squad' | 'squads'>, squadName: string | undefined): boolean {
  return Boolean(squadName) && memberSquads(member).includes(squadName as string);
}

export function squadLabel(squads: string[]): string {
  return squads.length > 0 ? squads.join(', ') : 'Unassigned';
}
