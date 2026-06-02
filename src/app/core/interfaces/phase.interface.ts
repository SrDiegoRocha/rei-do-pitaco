import {
  MatchGenerationMode,
  MatchLegMode,
  TournamentPhaseType,
} from '@core/interfaces/enums';

export interface IPhaseResponse {
  id: string;
  name: string;
  position: number;
  phaseType: TournamentPhaseType;
  matchLegMode: MatchLegMode;
  matchGenerationMode: MatchGenerationMode;
  playsInsideGroupOnly: boolean | null;
  hasThirdPlace: boolean;
  groupCount: number;
  teamCount: number;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ICreatePhaseRequest {
  name: string;
  phaseType: TournamentPhaseType;
  matchLegMode: MatchLegMode;
  matchGenerationMode: MatchGenerationMode;
  playsInsideGroupOnly?: boolean | null;
  hasThirdPlace?: boolean | null;
}

export interface IUpdatePhaseRequest extends ICreatePhaseRequest {}

export interface IMovePhaseRequest {
  position: number;
}
