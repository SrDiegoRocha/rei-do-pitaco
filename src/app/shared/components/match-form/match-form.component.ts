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
  IRoundOption,
  knockoutRoundLabel,
  knockoutRoundOptions,
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
      groupId: this._fb.control<string | null>(null),
      scheduledAt: this._fb.nonNullable.control(''),
    },
    { validators: [differentTeamsValidator] },
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

  /**
   * Times elegíveis para a etapa selecionada.
   * - REGULAR + round > 1: vencedores da rodada anterior
   * - THIRD_PLACE: perdedores da semifinal (rodada anterior à final)
   * - REGULAR + round 1: sem filtro (todos)
   * Retorna `null` = sem filtro (ex.: não-KO, primeira rodada).
   */
  private readonly _eligibleKnockoutTeamIds = computed<Set<string> | null>(
    () => {
      if (!this.isKnockoutPhase()) return null;
      const round = this._roundValue();
      const matchType = this._matchTypeValue();
      if (typeof round !== 'number') return null;

      // 3º lugar: perdedores da semifinal (round - 1 já que 3º lugar é
      // disputado na mesma rodada da final).
      if (matchType === 'THIRD_PLACE') {
        const semiRound = round - 1;
        if (semiRound < 1) return new Set();
        const bracket = this.bracket();
        if (!bracket) return new Set();
        const semi = bracket.rounds.find((r) => r.round === semiRound);
        if (!semi) return new Set();
        const losers = new Set<string>();
        for (const tie of semi.ties) {
          if (tie.thirdPlace) continue;
          if (!tie.winner || !tie.homeTeam || !tie.awayTeam) continue;
          const loserId =
            tie.winner.id === tie.homeTeam.id
              ? tie.awayTeam.id
              : tie.homeTeam.id;
          losers.add(loserId);
        }
        return losers;
      }

      // REGULAR + round 1 → todos elegíveis
      if (round <= 1) return null;

      // REGULAR + round > 1: vencedores da rodada anterior
      const bracket = this.bracket();
      if (!bracket) return new Set();
      const prev = bracket.rounds.find((r) => r.round === round - 1);
      if (!prev) return new Set();
      const winners = new Set<string>();
      for (const tie of prev.ties) {
        if (tie.thirdPlace) continue;
        if (tie.winner) winners.add(tie.winner.id);
      }
      return winners;
    },
  );

  /** Mensagem amigável sobre quem pode ser selecionado em KO. */
  protected readonly knockoutEligibilityMessage = computed<string | null>(() => {
    if (!this.isKnockoutPhase()) return null;
    const round = this._roundValue();
    const matchType = this._matchTypeValue();
    if (typeof round !== 'number') return null;
    const eligible = this._eligibleKnockoutTeamIds();
    if (eligible === null) return null;

    if (matchType === 'THIRD_PLACE') {
      const semiLabel = knockoutRoundLabel(round - 1, this.phaseTeams().length);
      if (eligible.size === 0) {
        return `Lance os resultados das ${semiLabel} antes de criar a disputa de 3º lugar.`;
      }
      return `Apenas os ${eligible.size} times que perderam as ${semiLabel} aparecem nos selects.`;
    }

    if (round <= 1) return null;
    const prevLabel = knockoutRoundLabel(round - 1, this.phaseTeams().length);
    if (eligible.size === 0) {
      return `Lance os resultados de ${prevLabel} antes de criar partidas desta etapa.`;
    }
    return `Apenas os ${eligible.size} times que venceram ${prevLabel} aparecem nos selects.`;
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

  protected readonly koRoundOptions = computed<IRoundOption[]>(() => {
    if (!this.isKnockoutPhase()) return [];
    const teamCount = this.phaseTeams().length;
    const all = knockoutRoundOptions(teamCount, this.hasThirdPlace());
    const currentMatchId = this.initial()?.id ?? null;
    // Filtra etapas já lotadas (sem vagas para mais partidas), exceto a
    // etapa da partida sendo editada.
    return all.filter((opt) => {
      const expected =
        opt.matchType === 'THIRD_PLACE'
          ? 1
          : teamCount / Math.pow(2, opt.round);
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
    return knockoutRoundLabel(round, this.phaseTeams().length);
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
        groupId: init.groupId,
        scheduledAt: isoToLocalInput(init.scheduledAt),
      });
    } else if (this.isKnockoutPhase()) {
      // Em create + KO, alinha o round padrão com a primeira opção disponível
      const first = this.koRoundOptions()[0];
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
      // Em 3º lugar os times mudam (vencedores → perdedores); zera seleção
      // pra evitar combinação inválida.
      this.form.controls.homeTeamId.setValue('');
      this.form.controls.awayTeamId.setValue('');
    } else if (value.startsWith('regular:')) {
      const round = parseInt(value.slice(8), 10);
      this.form.controls.round.setValue(round);
      this.form.controls.matchType.setValue('REGULAR');
      // Mudou de 3º p/ regular ou de rodada → idem
      this.form.controls.homeTeamId.setValue('');
      this.form.controls.awayTeamId.setValue('');
    }
  }

  protected etapaOptionValue(opt: IRoundOption): string {
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
    return {
      homeTeamId: raw.homeTeamId,
      awayTeamId: raw.awayTeamId,
      round: raw.round,
      groupId: this.isGroupsPhase() ? raw.groupId : null,
      scheduledAt: localInputToIso(raw.scheduledAt),
      matchType: this.isKnockoutPhase() ? raw.matchType : null,
    };
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
    this.form.controls.homeTeamId.markAsUntouched();
    this.form.controls.awayTeamId.markAsUntouched();
    this.form.controls.homeTeamId.markAsPristine();
    this.form.controls.awayTeamId.markAsPristine();
  }

  protected onCancel(): void {
    this.cancelForm.emit();
  }
}
