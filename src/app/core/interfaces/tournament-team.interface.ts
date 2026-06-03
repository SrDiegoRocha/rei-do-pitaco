import { TeamType } from '@core/interfaces/enums';

export interface ITournamentTeamResponse {
  teamId: string;
  name: string;
  shortName: string | null;
  badgeUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  system: boolean;
  teamType: TeamType;
  countryCode: string | null;
  addedAt: string;
}
