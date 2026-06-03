import { TeamType } from '@core/interfaces/enums';

export interface IPhaseTeamResponse {
  teamId: string;
  teamName: string;
  shortName: string | null;
  badgeUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  teamType: TeamType;
  countryCode: string | null;
  groupId: string | null;
  groupName: string | null;
  addedAt: string;
}

export interface IMovePhaseTeamRequest {
  groupId: string | null;
}
