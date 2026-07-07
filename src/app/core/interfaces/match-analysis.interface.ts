import { TournamentPhaseType } from '@core/interfaces/enums';
import { ITeamRef } from '@core/interfaces/match.interface';

/** Resultado de um jogo pela ótica de um time. */
export type FormOutcome = 'W' | 'D' | 'L';

/**
 * Tipo de contexto posicional exibido para cada time, conforme a fase da
 * partida:
 * - `ROUND_ROBIN`: posição atual na tabela de pontos corridos da fase.
 * - `GROUP`: posição atual dentro do grupo.
 * - `PREVIOUS_PHASE`: em mata-mata, a posição final na última fase de
 *   liga/grupos (quando a fase anterior era `ROUND_ROBIN` ou `GROUPS`).
 * - `NONE`: sem contexto posicional (ex.: mata-mata cuja fase anterior também
 *   era mata-mata, ou a primeira fase do torneio é mata-mata).
 */
export type StandingContextKind =
  | 'ROUND_ROBIN'
  | 'GROUP'
  | 'PREVIOUS_PHASE'
  | 'NONE';

export interface ITeamStandingContext {
  kind: StandingContextKind;
  /** Posição 1-indexed na tabela/grupo referenciado. */
  position: number;
  /** Total de times na tabela/grupo (para exibir "3º de 8"). */
  totalTeams: number;
  /** Pontos acumulados na tabela referenciada; null quando não se aplica. */
  points: number | null;
  /** Jogos disputados na tabela referenciada; null quando não se aplica. */
  played: number | null;
  /** Nome do grupo quando `kind === 'GROUP'`; null caso contrário. */
  groupName: string | null;
  /** Fase a que a posição se refere (a atual, ou a anterior em mata-mata). */
  phaseId: string;
  phaseName: string;
}

/** Um jogo do histórico recente, pela ótica de um time (o "dono" do card). */
export interface ITeamFormMatch {
  matchId: string;
  phaseId: string;
  phaseName: string;
  round: number;
  scheduledAt: string | null;
  /** Adversário naquele jogo. */
  opponent: ITeamRef;
  /** O time "dono" jogou como mandante nesse jogo? */
  playedHome: boolean;
  /** Gols marcados pelo time (placar decisivo: prorrogação se houve, senão 90'). */
  goalsFor: number;
  /** Gols sofridos (mesma base de `goalsFor`). */
  goalsAgainst: number;
  /** Resultado pela ótica do time (placar decisivo). Empate que foi a pênaltis = 'D'. */
  outcome: FormOutcome;
  /** Houve prorrogação nesse jogo. */
  hadExtraTime: boolean;
  /** Pênaltis marcados/sofridos quando o jogo foi decidido nos pênaltis; null caso contrário. */
  penaltyFor: number | null;
  penaltyAgainst: number | null;
  /** Quando foi a pênaltis, o time avançou? `null` quando não houve pênaltis. */
  advanced: boolean | null;
}

/** Recorte mandante/visitante do desempenho recente. */
export interface IVenueRecord {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

/** Sequência atual (ex.: 3 vitórias seguidas, ou 5 jogos invicto). */
export interface IFormStreak {
  type: 'WIN' | 'LOSS' | 'DRAW' | 'UNBEATEN' | 'WINLESS';
  count: number;
}

/** Agregados calculados pelo backend sobre os jogos de `recentMatches`. */
export interface ITeamFormStats {
  /** Quantos jogos entraram na janela (pode ser < `recentWindow`). */
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  /** Jogos sem sofrer gols. */
  cleanSheets: number;
  /** Jogos sem marcar. */
  failedToScore: number;
  /** Jogos da janela com 3+ gols no total (over 2.5). */
  overTwoFive: number;
  /** Jogos da janela em que os dois times marcaram (ambas marcam / BTTS). */
  bothTeamsScored: number;
  /** Pontos "virtuais" (3/1/0) na janela — base do aproveitamento. */
  points: number;
  /** Aproveitamento 0–100 (`points / (played * 3)`). `null` se `played === 0`. */
  performancePct: number | null;
  /** Sequência atual; `null` se não houver jogos. */
  streak: IFormStreak | null;
  /** Recorte por mando (calculado sobre a janela). */
  homeRecord: IVenueRecord | null;
  awayRecord: IVenueRecord | null;
}

/**
 * Desempenho dos palpiteiros nos jogos deste time no torneio — "como a galera
 * se sai com este time". Calculado pelo backend sobre TODOS os jogos
 * `COMPLETED` do time no torneio que tiveram ao menos um pitaco.
 */
export interface ITeamPredictorStats {
  /** Jogos do time (COMPLETED) com ao menos 1 pitaco. */
  ratedMatches: number;
  /** Total de pitacos considerados nesses jogos. */
  totalPredictions: number;
  /** % de pitacos que cravaram o placar exato (0–100); `null` se sem pitacos. */
  exactScoreRate: number | null;
  /** % de pitacos que acertaram o desfecho (vencedor/empate); `null` se sem pitacos. */
  correctOutcomeRate: number | null;
  /** Média de pontos por pitaco nesses jogos; `null` se sem pitacos. */
  averagePoints: number | null;
  /** % de jogos em que a maioria errou o desfecho ("fator surpresa"); `null` se sem jogos. */
  upsetRate: number | null;
}

export interface ITeamFormSummary {
  team: ITeamRef;
  /** Contexto posicional; `null` quando o `kind` seria `NONE`. */
  standing: ITeamStandingContext | null;
  /** Jogos recentes, do mais recente para o mais antigo, até `recentWindow`. */
  recentMatches: ITeamFormMatch[];
  stats: ITeamFormStats;
  /** Desempenho dos palpiteiros com este time no torneio. */
  predictors: ITeamPredictorStats;
  /**
   * Dias de descanso: do jogo mais recente do time até esta partida (ou até
   * "agora" se a partida não tem horário). `null` quando não dá pra calcular.
   */
  restDays: number | null;
}

/** Um confronto direto anterior entre os dois times (dentro do torneio). */
export interface IHeadToHeadMatch {
  matchId: string;
  phaseId: string;
  phaseName: string;
  round: number;
  scheduledAt: string | null;
  /** Times como jogaram naquele confronto (o mando pode estar invertido). */
  homeTeam: ITeamRef;
  awayTeam: ITeamRef;
  homeGoals: number;
  awayGoals: number;
  hadExtraTime: boolean;
  penaltyHomeGoals: number | null;
  penaltyAwayGoals: number | null;
}

export interface IHeadToHead {
  /** Nº de confrontos anteriores entre os dois no torneio. */
  totalMeetings: number;
  /** Contagens pela ótica dos times DESTA partida. */
  homeTeamWins: number;
  draws: number;
  awayTeamWins: number;
  /** Gols somados de cada time nos confrontos, pela ótica DESTA partida. */
  homeTeamGoals: number;
  awayTeamGoals: number;
  /** Média de gols por confronto (`(homeTeamGoals + awayTeamGoals) / totalMeetings`); `null` se nunca se enfrentaram. */
  averageGoals: number | null;
  /** Últimos confrontos, do mais recente ao mais antigo, até `headToHeadWindow`. */
  recentMeetings: IHeadToHeadMatch[];
}

/**
 * Gols esperados NESTA partida — projeção derivada da forma recente (ataque de
 * cada time cruzado com a defesa do adversário). **Não é xG de finalização**
 * (a base não tem dados de chute); é uma estimativa a partir de médias de gols.
 */
export interface IExpectedGoals {
  /** Gols esperados do mandante nesta partida. */
  home: number;
  /** Gols esperados do visitante nesta partida. */
  away: number;
}

export interface IMatchAnalysisResponse {
  matchId: string;
  /** Tipo da fase da partida — ajuda o front a rotular o contexto posicional. */
  phaseType: TournamentPhaseType;
  home: ITeamFormSummary;
  away: ITeamFormSummary;
  headToHead: IHeadToHead;
  /** Projeção de gols da partida; `null` quando algum time não tem jogos na janela. */
  expectedGoals: IExpectedGoals | null;
  /** Tamanho da janela de "últimos jogos" (padrão 10). */
  recentWindow: number;
  /** Tamanho da janela de confrontos diretos (padrão 2). */
  headToHeadWindow: number;
}
