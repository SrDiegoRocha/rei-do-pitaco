import { TeamType } from '@core/interfaces/enums';

export interface ITeamResponse {
  id: string;
  name: string;
  shortName: string | null;
  badgeUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  system: boolean;
  teamType: TeamType;
  countryCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ICreateTeamRequest {
  name: string;
  shortName?: string | null;
  badgeUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
}

export interface IUpdateTeamRequest extends ICreateTeamRequest {}
