import {
  BracketMode,
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
  /** Só KNOCKOUT: modo da RODADA FINAL (final + 3º lugar); null = herda matchLegMode. */
  finalLegMode: MatchLegMode | null;
  /** Só KNOCKOUT: chaveamento fixo x sorteio a cada rodada (resolvido, nunca null em KO). */
  bracketMode: BracketMode | null;
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
  /** Só usado em KNOCKOUT; null = a final herda o matchLegMode da fase. */
  finalLegMode?: MatchLegMode | null;
  /** Só usado em KNOCKOUT; null = default por matchGenerationMode. Front: envie sempre explícito. */
  bracketMode?: BracketMode | null;
}

export interface IUpdatePhaseRequest extends ICreatePhaseRequest {}

export interface IMovePhaseRequest {
  position: number;
}
