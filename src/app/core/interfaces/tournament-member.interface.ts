import {
  TournamentMemberRole,
  TournamentMemberStatus,
} from '@core/interfaces/enums';

export interface ITournamentMemberResponse {
  userId: string;
  name: string;
  avatarUrl: string;
  role: TournamentMemberRole;
  status: TournamentMemberStatus;
  joinedAt: string;
  leftAt: string | null;
  bannedAt: string | null;
}
