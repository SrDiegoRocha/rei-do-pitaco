import { IMatchResponse, ITeamRef } from '@core/interfaces/match.interface';

export interface IBracketResponse {
  phaseId: string;
  phaseName: string;
  rounds: IBracketRound[];
}

export interface IBracketRound {
  round: number;
  name: string;
  ties: IBracketTie[];
}

export interface IBracketTie {
  tieId: string;
  homeTeam: ITeamRef | null;
  awayTeam: ITeamRef | null;
  homeAggregate: number;
  awayAggregate: number;
  homePenalties: number | null;
  awayPenalties: number | null;
  winner: ITeamRef | null;
  complete: boolean;
  thirdPlace: boolean;
  legs: IMatchResponse[];
}
