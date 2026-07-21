import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {
  BracketMode,
  MatchLegMode,
  MatchType,
  TournamentPhaseType,
  TournamentStatus,
} from '@core/interfaces/enums';
import { IBracketResponse } from '@core/interfaces/bracket.interface';
import {
  ICreateMatchRequest,
  IMatchResponse,
  IUpdateMatchRequest,
} from '@core/interfaces/match.interface';
import { IPhaseGroupResponse } from '@core/interfaces/phase-group.interface';
import { IPhaseTeamResponse } from '@core/interfaces/phase-team.interface';
import {
  IKnockoutStageInfo,
  IKnockoutStageOption,
  knockoutMatchBucketLabel,
  knockoutRoundLabel,
  knockoutStageForRound,
  knockoutStageOptions,
} from '@core/utils/round-label';
import { ButtonComponent } from '@shared/components/button/button.component';
import { InputComponent } from '@shared/components/input/input.component';

export type MatchFormMode = 'create' | 'edit';
export type MatchFormPayload = ICreateMatchRequest | IUpdateMatchRequest;

function differentTeamsValidator(
  group: AbstractControl,
): ValidationErrors | null {
  const home = group.get('homeTeamId')?.value;
  const away = group.get('awayTeamId')?.value;
  if (!home || !away) return null;
  return home !== away ? null : { sameTeams: true };
}

function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      `T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
  } catch {
    return '';
  }
}

function localInputToIso(value: string): string | null {
  if (!value) return null;
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

@Component({
  selector: 'app-match-form',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './match-form.component.html',
  styleUrl: './match-form.component.scss',
})
export class MatchFormComponent implements OnInit {
  public readonly initial = input<IMatchResponse | null>(null);
  public readonly mode = input<MatchFormMode>('create');
  public readonly phaseType = input.required<TournamentPhaseType>();
  /** Total de times da fase (potência de 2 em KO). Base dos nomes de etapa. */
  public readonly teamCount = input<number>(0);
  /** Modo de pernas da fase (KO). Decide se há Ida/Volta por etapa. */
  public readonly matchLegMode = input<MatchLegMode>('SINGLE');
  /** Modo da rodada final (KO); null = herda matchLegMode. */
  public readonly finalLegMode = input<MatchLegMode | null>(null);
  /** Chaveamento (KO). FIXED_BRACKET guia o par pela árvore; REDRAW é livre. */
  public readonly bracketMode = input<BracketMode | null>(null);
  public readonly phaseTeams = input<IPhaseTeamResponse[]>([]);
  public readonly groups = input<IPhaseGroupResponse[]>([]);
  /** Se true, o confronto só pode ser entre times do mesmo grupo. */
  public readonly playsInsideGroupOnly = input<boolean>(false);
  public readonly existingMatches = input<IMatchResponse[]>([]);
  public readonly bracket = input<IBracketResponse | null>(null);
  public readonly hasThirdPlace = input<boolean>(false);
  public readonly tournamentStatus = input<TournamentStatus | null>(null);
  public readonly matchStatus = input<IMatchResponse['status'] | null>(null);
  public readonly submitting = input<boolean>(false);
  public readonly serverError = input<string | null>(null);

  /** "Criar e sair" / "Salvar alterações" — encerra o fluxo. */
  public readonly saveForm = output<MatchFormPayload>();
  /** "Salvar e criar outra" — só em modo create; mantém o usuário na tela. */
  public readonly saveAndNew = output<MatchFormPayload>();
  public readonly cancelForm = output<void>();

  /** Indica qual ação está em voo, para o spinner ir no botão certo. */
  protected readonly pendingNew = signal(false);

  private readonly _fb = inject(FormBuilder);

  protected readonly form = this._fb.group(
    {
      homeTeamId: this._fb.nonNullable.control('', {
        validators: [Validators.required],
      }),
      awayTeamId: this._fb.nonNullable.control('', {
        validators: [Validators.required],
      }),
      round: this._fb.nonNullable.control(1, {
        validators: [Validators.required, Validators.min(1)],
      }),
      matchType: this._fb.nonNullable.control<MatchType>('REGULAR'),
      // Só usado na criação da perna de VOLTA em ida-e-volta: vincula a volta
      // ao confronto (tie) do jogo de ida. Ida/jogo único deixam null (o
      // backend gera o tieId).
      tieId: this._fb.control<string | null>(null),
      groupId: this._fb.control<string | null>(null),
      scheduledAt: this._fb.nonNullable.control(''),
    },
    { validators: [differentTeamsValidator] },
  );

  /** Total de times: usa o input; cai para o nº de times cadastrados. */
  private readonly _teamCount = computed(
    () => this.teamCount() || this.phaseTeams().length,
  );

  private readonly _formStatus = toSignal(this.form.statusChanges, {
    initialValue: this.form.status,
  });

  private readonly _homeValue = toSignal(
    this.form.controls.homeTeamId.valueChanges,
    { initialValue: this.form.controls.homeTeamId.value },
  );
  private readonly _awayValue = toSignal(
    this.form.controls.awayTeamId.valueChanges,
    { initialValue: this.form.controls.awayTeamId.value },
  );
  private readonly _roundValue = toSignal(
    this.form.controls.round.valueChanges,
    { initialValue: this.form.controls.round.value },
  );
  private readonly _matchTypeValue = toSignal(
    this.form.controls.matchType.valueChanges,
    { initialValue: this.form.controls.matchType.value },
  );
  private readonly _groupValue = toSignal(
    this.form.controls.groupId.valueChanges,
    { initialValue: this.form.controls.groupId.value },
  );

  protected readonly isGroupsPhase = computed(
    () => this.phaseType() === 'GROUPS',
  );

  protected readonly isKnockoutPhase = computed(
    () => this.phaseType() === 'KNOCKOUT',
  );

  /** Chaveamento fixo: o par é ditado pela árvore (CHAVEAMENTO.md §4). */
  private readonly _isFixedBracket = computed(
    () => this.isKnockoutPhase() && this.bracketMode() === 'FIXED_BRACKET',
  );

  /** Os selects de time devem ficar restritos ao grupo selecionado? */
  protected readonly restrictToGroup = computed(
    () => this.isGroupsPhase() && this.playsInsideGroupOnly(),
  );

  /**
   * Times que já jogam na mesma rodada (em outra partida). Em modo edit,
   * a partida atual não conta (o usuário pode trocar mandante/visitante dela).
   */
  private readonly _teamsInSameRound = computed<Set<string>>(() => {
    const round = this._roundValue();
    if (typeof round !== 'number') return new Set();
    const currentMatchId = this.initial()?.id ?? null;
    const taken = new Set<string>();
    for (const m of this.existingMatches()) {
      if (m.id === currentMatchId) continue;
      if (m.round !== round) continue;
      taken.add(m.homeTeam.id);
      taken.add(m.awayTeam.id);
    }
    return taken;
  });

  /** Etapa/perna do round CRU atualmente selecionado (KO). */
  private readonly _selectedStage = computed<IKnockoutStageInfo | null>(() => {
    if (!this.isKnockoutPhase()) return null;
    const round = this._roundValue();
    if (typeof round !== 'number') return null;
    return knockoutStageForRound(
      round,
      this._teamCount(),
      this.matchLegMode(),
      this.finalLegMode(),
    );
  });

  /** Vencedores de uma etapa (ordinal do bracket), para alimentar a próxima. */
  private _winnersOfStage(stageOrdinal: number): Set<string> {
    const bracket = this.bracket();
    if (!bracket || stageOrdinal < 1) return new Set();
    const round = bracket.rounds.find((r) => r.round === stageOrdinal);
    if (!round) return new Set();
    const winners = new Set<string>();
    for (const tie of round.ties) {
      if (tie.thirdPlace) continue;
      if (tie.winner) winners.add(tie.winner.id);
    }
    return winners;
  }

  /** Perdedores de uma etapa (para a disputa de 3º lugar). */
  private _losersOfStage(stageOrdinal: number): Set<string> {
    const bracket = this.bracket();
    if (!bracket || stageOrdinal < 1) return new Set();
    const round = bracket.rounds.find((r) => r.round === stageOrdinal);
    if (!round) return new Set();
    const losers = new Set<string>();
    for (const tie of round.ties) {
      if (tie.thirdPlace || !tie.winner || !tie.homeTeam || !tie.awayTeam) {
        continue;
      }
      losers.add(
        tie.winner.id === tie.homeTeam.id ? tie.awayTeam.id : tie.homeTeam.id,
      );
    }
    return losers;
  }

  /**
   * Chaveamento fixo: dado o vencedor de um confronto da etapa anterior, qual é
   * o vencedor do confronto ADJACENTE (o par canônico `2j` × `2j+1`). Os ties da
   * rodada vêm na ordem canônica no `/bracket`; o índice do par é `i ^ 1`.
   * Retorna `null` se o time não venceu a etapa anterior ou o adjacente ainda
   * não tem vencedor definido.
   */
  private _adjacentWinnerId(
    teamId: string,
    stageOrdinal: number,
  ): string | null {
    const bracket = this.bracket();
    if (!bracket || stageOrdinal <= 1) return null;
    const prev = bracket.rounds.find((r) => r.round === stageOrdinal - 1);
    if (!prev) return null;
    const ties = prev.ties.filter((t) => !t.thirdPlace);
    const i = ties.findIndex((t) => t.winner?.id === teamId);
    if (i < 0) return null;
    return ties[i ^ 1]?.winner?.id ?? null;
  }

  /**
   * Fase em chaveamento fixo cujo confronto atual tem par DETERMINADO pela
   * árvore: rodadas > 1 (par adjacente) ou disputa de 3º lugar (os 2 perdedores
   * das semis). A ida de ida-e-volta e a 1ª rodada seguem livres.
   */
  private readonly _isGuidedFixedPairing = computed(() => {
    if (!this._isFixedBracket()) return false;
    const stage = this._selectedStage();
    if (!stage) return false;
    if (stage.legTotal > 1 && stage.legIndex > 0) return false; // volta
    if (this._matchTypeValue() === 'THIRD_PLACE') return true;
    return stage.stageOrdinal > 1;
  });

  /**
   * Time que o backend exige como adversário de `teamId` no chaveamento fixo:
   * vencedor do confronto adjacente (rodadas > 1) ou o outro perdedor de semi
   * (3º lugar). `null` quando indeterminado (adjacente pendente etc.).
   */
  private _requiredOpponentFor(teamId: string): string | null {
    if (!this._isGuidedFixedPairing() || !teamId) return null;
    const stage = this._selectedStage();
    if (!stage) return null;
    if (this._matchTypeValue() === 'THIRD_PLACE') {
      const others = [...this._losersOfStage(stage.stageOrdinal - 1)].filter(
        (id) => id !== teamId,
      );
      return others.length === 1 ? others[0]! : null;
    }
    return this._adjacentWinnerId(teamId, stage.stageOrdinal);
  }

  /**
   * Times elegíveis para a etapa/perna selecionada.
   * - THIRD_PLACE: perdedores das semifinais.
   * - Perna de VOLTA: os dois times do jogo de ida deste confronto.
   * - IDA/jogo único, 1ª etapa: sem filtro (todos).
   * - IDA/jogo único, demais etapas: vencedores da etapa anterior.
   * Retorna `null` = sem filtro (não-KO, ou 1ª etapa).
   */
  private readonly _eligibleKnockoutTeamIds = computed<Set<string> | null>(
    () => {
      if (!this.isKnockoutPhase()) return null;
      const stage = this._selectedStage();
      if (!stage) return null;

      if (this._matchTypeValue() === 'THIRD_PLACE') {
        return this._losersOfStage(stage.stageOrdinal - 1);
      }

      // Perna de volta: mesmos times do jogo de ida (mando invertido).
      if (stage.legTotal > 1 && stage.legIndex > 0) {
        const round = this._roundValue() as number;
        const idaRound = round - stage.legIndex;
        const init = this.initial();
        if (init) {
          const ida = this.existingMatches().find(
            (m) => m.tieId === init.tieId && m.round === idaRound,
          );
          if (ida) return new Set([ida.homeTeam.id, ida.awayTeam.id]);
        }
        const ids = new Set<string>();
        for (const m of this.existingMatches()) {
          if (m.matchType === 'REGULAR' && m.round === idaRound) {
            ids.add(m.homeTeam.id);
            ids.add(m.awayTeam.id);
          }
        }
        return ids;
      }

      if (stage.stageOrdinal <= 1) return null;
      return this._winnersOfStage(stage.stageOrdinal - 1);
    },
  );

  /** Mostra o seletor de "jogo de ida" (criação da volta em ida-e-volta). */
  protected readonly showIdaPicker = computed(() => {
    if (this.mode() !== 'create') return false;
    const stage = this._selectedStage();
    return !!stage && stage.legTotal > 1 && stage.legIndex > 0;
  });

  /** Jogos de ida desta etapa ainda sem a volta criada. */
  protected readonly idaTieOptions = computed<
    { tieId: string; label: string; homeId: string; awayId: string }[]
  >(() => {
    const stage = this._selectedStage();
    const round = this._roundValue();
    if (
      !stage ||
      typeof round !== 'number' ||
      stage.legTotal <= 1 ||
      stage.legIndex === 0
    ) {
      return [];
    }
    const idaRound = round - stage.legIndex;
    const voltaTieIds = new Set(
      this.existingMatches()
        .filter((m) => m.matchType === 'REGULAR' && m.round === round)
        .map((m) => m.tieId),
    );
    return this.existingMatches()
      .filter((m) => m.matchType === 'REGULAR' && m.round === idaRound)
      .filter((m) => !voltaTieIds.has(m.tieId))
      .map((m) => ({
        tieId: m.tieId,
        // Volta: mando invertido em relação à ida.
        label: `${m.homeTeam.name} × ${m.awayTeam.name}`,
        homeId: m.awayTeam.id,
        awayId: m.homeTeam.id,
      }));
  });

  /** Mensagem amigável sobre quem pode ser selecionado em KO. */
  protected readonly knockoutEligibilityMessage = computed<string | null>(() => {
    if (!this.isKnockoutPhase()) return null;
    const stage = this._selectedStage();
    if (!stage) return null;
    const eligible = this._eligibleKnockoutTeamIds();
    if (eligible === null) return null;

    const tc = this._teamCount();

    if (this._matchTypeValue() === 'THIRD_PLACE') {
      const semiLabel = knockoutRoundLabel(stage.stageOrdinal - 1, tc);
      if (eligible.size === 0) {
        return `Lance os resultados das ${semiLabel} antes de criar a disputa de 3º lugar.`;
      }
      return `Apenas os ${eligible.size} times que perderam as ${semiLabel} aparecem nos selects.`;
    }

    // Perna de volta.
    if (stage.legTotal > 1 && stage.legIndex > 0) {
      if (eligible.size === 0) {
        return 'Crie o jogo de ida deste confronto antes da volta.';
      }
      return 'A volta usa os mesmos times do jogo de ida, com o mando invertido.';
    }

    if (stage.stageOrdinal <= 1) return null;
    const prevLabel = knockoutRoundLabel(stage.stageOrdinal - 1, tc);
    if (eligible.size === 0) {
      return `Lance os resultados de ${prevLabel} antes de criar partidas desta etapa.`;
    }
    const base = `Apenas os ${eligible.size} times que venceram ${prevLabel} aparecem nos selects.`;
    if (this._isFixedBracket()) {
      return `${base} Chaveamento fixo: ao escolher um time, o adversário (vencedor do confronto adjacente) é preenchido automaticamente.`;
    }
    return base;
  });

  protected readonly homeOptions = computed<IPhaseTeamResponse[]>(() => {
    const away = this._awayValue();
    const taken = this._teamsInSameRound();
    const currentHome = this.initial()?.homeTeam.id ?? null;
    const eligible = this._eligibleKnockoutTeamIds();
    const groupId = this._groupValue();
    // Confronto restrito ao grupo: sem grupo escolhido, sem times.
    if (this.restrictToGroup() && !groupId) return [];
    return this.phaseTeams().filter((t) => {
      if (
        this.restrictToGroup() &&
        t.groupId !== groupId &&
        t.teamId !== currentHome
      ) {
        return false;
      }
      if (t.teamId === away) return false;
      if (taken.has(t.teamId) && t.teamId !== currentHome) return false;
      if (eligible !== null && !eligible.has(t.teamId) && t.teamId !== currentHome) {
        return false;
      }
      return true;
    });
  });

  protected readonly awayOptions = computed<IPhaseTeamResponse[]>(() => {
    const home = this._homeValue();
    const taken = this._teamsInSameRound();
    const currentAway = this.initial()?.awayTeam.id ?? null;
    const eligible = this._eligibleKnockoutTeamIds();
    const groupId = this._groupValue();
    if (this.restrictToGroup() && !groupId) return [];
    return this.phaseTeams().filter((t) => {
      if (
        this.restrictToGroup() &&
        t.groupId !== groupId &&
        t.teamId !== currentAway
      ) {
        return false;
      }
      if (t.teamId === home) return false;
      if (taken.has(t.teamId) && t.teamId !== currentAway) return false;
      if (eligible !== null && !eligible.has(t.teamId) && t.teamId !== currentAway) {
        return false;
      }
      return true;
    });
  });

  /** Placeholder dos selects de time conforme o contexto. */
  protected readonly teamPlaceholder = computed(() =>
    this.restrictToGroup() && !this._groupValue()
      ? 'Selecione o grupo primeiro'
      : 'Selecione um time',
  );

  /** Orientação para os selects de time em fase de grupos restrita. */
  protected readonly groupSelectionHint = computed<string | null>(() => {
    if (!this.restrictToGroup()) return null;
    const groupId = this._groupValue();
    if (!groupId) {
      return 'Times deste confronto devem ser do mesmo grupo. Selecione o grupo para listar os disponíveis.';
    }
    const group = this.groups().find((g) => g.id === groupId);
    const groupLabel = group?.name ?? 'o grupo selecionado';
    const inGroup = this.phaseTeams().filter((t) => t.groupId === groupId);
    if (inGroup.length < 2) {
      return `${groupLabel} precisa de pelo menos 2 times para ter uma partida.`;
    }
    const taken = this._teamsInSameRound();
    const init = this.initial();
    const available = inGroup.filter(
      (t) =>
        !taken.has(t.teamId) ||
        t.teamId === init?.homeTeam.id ||
        t.teamId === init?.awayTeam.id,
    );
    if (available.length < 2) {
      return `Todos os times de ${groupLabel} já têm partida na rodada ${this._roundValue()}. Escolha outra rodada.`;
    }
    return null;
  });

  protected readonly koStageOptions = computed<IKnockoutStageOption[]>(() => {
    if (!this.isKnockoutPhase()) return [];
    const teamCount = this._teamCount();
    const all = knockoutStageOptions(
      teamCount,
      this.matchLegMode(),
      this.finalLegMode(),
      this.hasThirdPlace(),
    );
    const currentMatchId = this.initial()?.id ?? null;
    // Filtra etapas/pernas já lotadas (sem vagas para mais partidas), exceto a
    // da partida sendo editada. A capacidade é o nº de confrontos da etapa
    // (teamCount / 2^etapa) — cada confronto tem uma partida por perna.
    return all.filter((opt) => {
      const expected =
        opt.matchType === 'THIRD_PLACE'
          ? 1
          : teamCount / Math.pow(2, opt.stageOrdinal);
      let countInBucket = 0;
      for (const m of this.existingMatches()) {
        if (m.id === currentMatchId) continue;
        if (m.round !== opt.round) continue;
        if (m.matchType !== opt.matchType) continue;
        countInBucket++;
      }
      // Mostra a etapa atual da partida sendo editada mesmo se cheia (preserva
      // a seleção atual no select).
      const init = this.initial();
      if (
        init &&
        init.round === opt.round &&
        init.matchType === opt.matchType
      ) {
        return true;
      }
      return countInBucket < expected;
    });
  });

  /** Valor string composto pro select de etapa (round + matchType). */
  protected readonly koEtapaSelectValue = computed<string>(() => {
    if (!this.isKnockoutPhase()) return '';
    const mt = this._matchTypeValue();
    const r = this._roundValue();
    if (mt === 'THIRD_PLACE') return `third:${r}`;
    return `regular:${r}`;
  });

  protected readonly currentRoundLabel = computed<string | null>(() => {
    if (!this.isKnockoutPhase()) return null;
    const round = this._roundValue();
    if (typeof round !== 'number') return null;
    return knockoutMatchBucketLabel(
      round,
      this._matchTypeValue() === 'THIRD_PLACE',
      this._teamCount(),
      this.matchLegMode(),
      this.finalLegMode(),
    );
  });

  protected readonly statusBanner = computed<string | null>(() => {
    if (this.tournamentStatus() === 'FINISHED') {
      return 'Torneio finalizado — partidas não podem ser modificadas.';
    }
    if (this.mode() === 'edit' && this.matchStatus() === 'COMPLETED') {
      return 'Partida já concluída. Para editar o agendamento, primeiro limpe o resultado (cancele a partida).';
    }
    return null;
  });

  protected readonly isLocked = computed(() => {
    if (this.tournamentStatus() === 'FINISHED') return true;
    if (this.mode() === 'edit' && this.matchStatus() === 'COMPLETED') {
      return true;
    }
    return false;
  });

  protected readonly submitLabel = computed(() =>
    this.mode() === 'create' ? 'Criar partida' : 'Salvar alterações',
  );

  protected readonly teamsError = computed<string | null>(() => {
    void this._formStatus();
    if (!this.form.touched) return null;
    if (this.form.hasError('sameTeams')) {
      return 'Os times mandante e visitante devem ser diferentes.';
    }
    return null;
  });

  protected readonly groupRequiredError = computed<string | null>(() => {
    void this._formStatus();
    if (!this.isGroupsPhase()) return null;
    const c = this.form.controls.groupId;
    if (!c.touched) return null;
    return c.value ? null : 'Selecione um grupo';
  });

  constructor() {
    // Usabilidade: desabilita os campos durante o envio; ao terminar
    // (sucesso ou erro), reabilita — exceto se o form está travado por
    // regra de negócio (isLocked).
    effect(() => {
      if (this.submitting()) {
        this.form.disable();
      } else if (!this.isLocked()) {
        this.form.enable();
      }
    });
  }

  public ngOnInit(): void {
    const init = this.initial();
    if (init) {
      this.form.setValue({
        homeTeamId: init.homeTeam.id,
        awayTeamId: init.awayTeam.id,
        round: init.round,
        matchType: init.matchType ?? 'REGULAR',
        tieId: init.tieId,
        groupId: init.groupId,
        scheduledAt: isoToLocalInput(init.scheduledAt),
      });
    } else if (this.isKnockoutPhase()) {
      // Em create + KO, alinha o round padrão com a primeira opção disponível
      const first = this.koStageOptions()[0];
      if (first) {
        this.form.controls.round.setValue(first.round);
        this.form.controls.matchType.setValue(first.matchType);
      }
    }
    if (this.isLocked()) {
      this.form.disable();
    }
  }

  /** Aplica round + matchType ao selecionar uma etapa no select de KO. */
  protected onEtapaChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value.startsWith('third:')) {
      const round = parseInt(value.slice(6), 10);
      this.form.controls.round.setValue(round);
      this.form.controls.matchType.setValue('THIRD_PLACE');
    } else if (value.startsWith('regular:')) {
      const round = parseInt(value.slice(8), 10);
      this.form.controls.round.setValue(round);
      this.form.controls.matchType.setValue('REGULAR');
    } else {
      return;
    }
    // Trocar de etapa/perna invalida a seleção de times e o vínculo de ida.
    this.form.controls.homeTeamId.setValue('');
    this.form.controls.awayTeamId.setValue('');
    this.form.controls.tieId.setValue(null);
  }

  /** Seleciona o jogo de ida ao qual a volta pertence (mando invertido). */
  protected onIdaTieChange(event: Event): void {
    const tieId = (event.target as HTMLSelectElement).value;
    const opt = this.idaTieOptions().find((o) => o.tieId === tieId);
    if (!opt) {
      this.form.controls.tieId.setValue(null);
      this.form.controls.homeTeamId.setValue('');
      this.form.controls.awayTeamId.setValue('');
      return;
    }
    this.form.controls.tieId.setValue(opt.tieId);
    this.form.controls.homeTeamId.setValue(opt.homeId);
    this.form.controls.awayTeamId.setValue(opt.awayId);
  }

  protected etapaOptionValue(opt: IKnockoutStageOption): string {
    return opt.matchType === 'THIRD_PLACE'
      ? `third:${opt.round}`
      : `regular:${opt.round}`;
  }

  /**
   * Trocar o grupo invalida a seleção de times quando o confronto é
   * restrito ao grupo (os times escolhidos podem ser de outro grupo).
   */
  protected onGroupChange(): void {
    if (!this.restrictToGroup()) return;
    this.form.controls.homeTeamId.setValue('');
    this.form.controls.awayTeamId.setValue('');
  }

  /**
   * Chaveamento fixo: ao escolher o mandante, o visitante é travado no vencedor
   * do confronto adjacente (ou no outro perdedor de semi, no 3º lugar). Some
   * quando o adversário fica indeterminado. Fora do par guiado, no-op.
   */
  protected onHomeTeamChange(): void {
    if (!this._isGuidedFixedPairing()) return;
    const opponent = this._requiredOpponentFor(
      this.form.controls.homeTeamId.value,
    );
    this.form.controls.awayTeamId.setValue(opponent ?? '');
  }

  /** Espelho de {@link onHomeTeamChange} quando o usuário ancora pelo visitante. */
  protected onAwayTeamChange(): void {
    if (!this._isGuidedFixedPairing()) return;
    const opponent = this._requiredOpponentFor(
      this.form.controls.awayTeamId.value,
    );
    this.form.controls.homeTeamId.setValue(opponent ?? '');
  }

  /** Label da option de time; com confronto entre grupos, mostra o grupo. */
  protected teamOptionLabel(t: IPhaseTeamResponse): string {
    let label = t.teamName;
    if (t.shortName) label += ` (${t.shortName})`;
    if (this.isGroupsPhase() && !this.playsInsideGroupOnly() && t.groupName) {
      label += ` · ${t.groupName}`;
    }
    return label;
  }

  protected roundError(): string | null {
    const c = this.form.controls.round;
    if (!c.touched || c.valid) return null;
    if (c.hasError('required')) return 'Obrigatório';
    if (c.hasError('min')) return 'Mínimo 1';
    return null;
  }

  /** Valida e monta o payload; retorna null quando o form está inválido. */
  private _buildPayload(): MatchFormPayload | null {
    if (this.submitting() || this.isLocked()) return null;
    void this._formStatus();

    if (this.isGroupsPhase() && !this.form.controls.groupId.value) {
      this.form.controls.groupId.markAsTouched();
      this.form.markAllAsTouched();
      return null;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return null;
    }

    const raw = this.form.getRawValue();
    const payload: ICreateMatchRequest = {
      homeTeamId: raw.homeTeamId,
      awayTeamId: raw.awayTeamId,
      round: raw.round,
      groupId: this.isGroupsPhase() ? raw.groupId : null,
      scheduledAt: localInputToIso(raw.scheduledAt),
      matchType: this.isKnockoutPhase() ? raw.matchType : null,
      // Só a volta (create) vincula um tie existente; o resto deixa o backend
      // gerar. A edição ignora tieId (IUpdateMatchRequest não o possui).
      tieId: this.mode() === 'create' ? (raw.tieId ?? null) : null,
    };
    return payload;
  }

  protected onSubmit(): void {
    const payload = this._buildPayload();
    if (!payload) return;
    this.pendingNew.set(false);
    this.saveForm.emit(payload);
  }

  protected onSubmitAndNew(): void {
    const payload = this._buildPayload();
    if (!payload) return;
    this.pendingNew.set(true);
    this.saveAndNew.emit(payload);
  }

  /**
   * Após "Salvar e criar outra": zera só os times, preservando grupo, rodada,
   * etapa e agendamento — agiliza o cadastro de partidas em bloco.
   */
  public resetForNext(): void {
    this.form.controls.homeTeamId.setValue('');
    this.form.controls.awayTeamId.setValue('');
    // Desvincula o jogo de ida (a volta anterior já foi criada).
    this.form.controls.tieId.setValue(null);
    this.form.controls.homeTeamId.markAsUntouched();
    this.form.controls.awayTeamId.markAsUntouched();
    this.form.controls.homeTeamId.markAsPristine();
    this.form.controls.awayTeamId.markAsPristine();
  }

  protected onCancel(): void {
    this.cancelForm.emit();
  }
}
