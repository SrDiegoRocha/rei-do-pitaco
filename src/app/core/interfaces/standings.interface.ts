import { TeamType } from '@core/interfaces/enums';

export type StandingZoneStyle = 'qualified' | 'eliminated' | 'none';

export interface IStandingRow {
  position: number;
  teamId: string;
  teamName: string;
  shortName: string | null;
  badgeUrl: string | null;
  teamType: TeamType;
  countryCode: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  zoneId: string | null;
  zoneName: string | null;
  nextPhaseId: string | null;
  nextPhaseName: string | null;
  qualifies: boolean;
}

export interface IGroupStandings {
  groupId: string | null;
  groupName: string | null;
  rows: IStandingRow[];
}

export interface IStandingsResponse {
  phaseId: string;
  groups: IGroupStandings[];
}
