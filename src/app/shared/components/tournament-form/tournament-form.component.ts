import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  OnInit,
  output,
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
  TiebreakCriteria,
  TournamentPrivacy,
} from '@core/interfaces/enums';
import {
  ICreateTournamentRequest,
  ITournamentResponse,
} from '@core/interfaces/tournament.interface';
import { ButtonComponent } from '@shared/components/button/button.component';
import { InputComponent } from '@shared/components/input/input.component';
import { TiebreakSelectorComponent } from '@shared/components/tiebreak-selector/tiebreak-selector.component';
import { Globe, Lock, LucideAngularModule } from 'lucide-angular';

export type TournamentFormMode = 'create' | 'edit';

const DEFAULT_TIEBREAK: TiebreakCriteria[] = [
  'POINTS',
  'WINS',
  'GOAL_DIFFERENCE',
  'GOALS_FOR',
];

function nonEmptyArrayValidator(
  control: AbstractControl,
): ValidationErrors | null {
  const value = control.value;
  return Array.isArray(value) && value.length > 0 ? null : { required: true };
}

@Component({
  selector: 'app-tournament-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    InputComponent,
    ButtonComponent,
    TiebreakSelectorComponent,
    LucideAngularModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tournament-form.component.html',
  styleUrl: './tournament-form.component.scss',
})
export class TournamentFormComponent implements OnInit {
  public readonly initial = input<ITournamentResponse | null>(null);
  public readonly mode = input<TournamentFormMode>('create');
  public readonly submitting = input<boolean>(false);
  public readonly deleting = input<boolean>(false);
  public readonly serverError = input<string | null>(null);

  public readonly saveForm = output<ICreateTournamentRequest>();
  public readonly deleteTournament = output<void>();
  public readonly cancelForm = output<void>();

  private readonly _fb = inject(FormBuilder);

  protected readonly globeIcon = Globe;
  protected readonly lockIcon = Lock;

  protected readonly form = this._fb.group({
    name: this._fb.nonNullable.control('', {
      validators: [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(80),
      ],
    }),
    description: this._fb.nonNullable.control('', {
      validators: [Validators.maxLength(500)],
    }),
    privacy: this._fb.nonNullable.control<TournamentPrivacy>('PUBLIC', {
      validators: [Validators.required],
    }),
    maxParticipants: this._fb.control<number | null>(null, {
      validators: [Validators.min(2)],
    }),
    maxTeams: this._fb.control<number | null>(null, {
      validators: [Validators.min(2)],
    }),
    settings: this._fb.nonNullable.group({
      winPoints: this._fb.nonNullable.control(3, {
        validators: [Validators.required, Validators.min(0)],
      }),
      drawPoints: this._fb.nonNullable.control(1, {
        validators: [Validators.required, Validators.min(0)],
      }),
      lossPoints: this._fb.nonNullable.control(0, {
        validators: [Validators.required, Validators.min(0)],
      }),
      exactScorePoints: this._fb.nonNullable.control(5, {
        validators: [Validators.required, Validators.min(0)],
      }),
      winnerPoints: this._fb.nonNullable.control(2, {
        validators: [Validators.required, Validators.min(0)],
      }),
      wrongPoints: this._fb.nonNullable.control(0, {
        validators: [Validators.required, Validators.min(0)],
      }),
      extraTimeExactScorePoints: this._fb.nonNullable.control(2, {
        validators: [Validators.required, Validators.min(0)],
      }),
      extraTimeWinnerPoints: this._fb.nonNullable.control(1, {
        validators: [Validators.required, Validators.min(0)],
      }),
      penaltyWinnerPoints: this._fb.nonNullable.control(2, {
        validators: [Validators.required, Validators.min(0)],
      }),
      // Palpitão (Pick'em de fase) — defaults 1, como no backend.
      pickemQualifierPoints: this._fb.nonNullable.control(1, {
        validators: [Validators.required, Validators.min(0)],
      }),
      pickemExactPositionPoints: this._fb.nonNullable.control(1, {
        validators: [Validators.required, Validators.min(0)],
      }),
      pickemFirstPlacePoints: this._fb.nonNullable.control(1, {
        validators: [Validators.required, Validators.min(0)],
      }),
      pickemKoMatchupExactPoints: this._fb.nonNullable.control(1, {
        validators: [Validators.required, Validators.min(0)],
      }),
      pickemKoMatchupPartialPoints: this._fb.nonNullable.control(1, {
        validators: [Validators.required, Validators.min(0)],
      }),
      pickemChampionPoints: this._fb.nonNullable.control(1, {
        validators: [Validators.required, Validators.min(0)],
      }),
      pickemRunnerUpPoints: this._fb.nonNullable.control(1, {
        validators: [Validators.required, Validators.min(0)],
      }),
      pickemThirdPlacePoints: this._fb.nonNullable.control(1, {
        validators: [Validators.required, Validators.min(0)],
      }),
      tiebreakCriteria: this._fb.nonNullable.control<TiebreakCriteria[]>(
        DEFAULT_TIEBREAK,
        { validators: [nonEmptyArrayValidator] },
      ),
    }),
  });

  private readonly _privacy = toSignal(
    this.form.controls.privacy.valueChanges,
    { initialValue: this.form.controls.privacy.value },
  );
  private readonly _tiebreak = toSignal(
    this.form.controls.settings.controls.tiebreakCriteria.valueChanges,
    {
      initialValue:
        this.form.controls.settings.controls.tiebreakCriteria.value,
    },
  );
  private readonly _formStatus = toSignal(this.form.statusChanges, {
    initialValue: this.form.status,
  });

  protected readonly privacy = this._privacy;
  protected readonly tiebreak = this._tiebreak;

  protected readonly submitLabel = computed(() =>
    this.mode() === 'create' ? 'Criar torneio' : 'Salvar alterações',
  );

  protected readonly statusBanner = computed<string | null>(() => {
    const status = this.initial()?.status;
    if (status === 'FINISHED') {
      return 'Este torneio está finalizado e não pode ser editado.';
    }
    if (status === 'IN_PROGRESS') {
      return 'Torneio em andamento — privacidade não pode ser alterada.';
    }
    return null;
  });

  protected readonly isFullyDisabled = computed(() => {
    void this._formStatus();
    return this.form.disabled;
  });

  protected readonly tiebreakInvalid = computed(() => {
    void this._formStatus();
    const c = this.form.controls.settings.controls.tiebreakCriteria;
    return c.touched && c.invalid;
  });

  constructor() {
    // Usabilidade: desabilita os campos durante o envio; ao terminar
    // (sucesso ou erro), restaura os locks de negócio (FINISHED trava o
    // form inteiro; IN_PROGRESS trava apenas a privacidade).
    effect(() => {
      if (this.submitting()) {
        this.form.disable();
        return;
      }
      const status = this.initial()?.status;
      if (status === 'FINISHED') return;
      this.form.enable();
      if (status === 'IN_PROGRESS') {
        this.form.controls.privacy.disable();
      }
    });
  }

  public ngOnInit(): void {
    const init = this.initial();
    if (init) {
      this.form.setValue({
        name: init.name,
        description: init.description ?? '',
        privacy: init.privacy,
        maxParticipants: init.maxParticipants,
        maxTeams: init.maxTeams,
        settings: {
          winPoints: init.settings.winPoints,
          drawPoints: init.settings.drawPoints,
          lossPoints: init.settings.lossPoints,
          exactScorePoints: init.settings.exactScorePoints,
          winnerPoints: init.settings.winnerPoints,
          wrongPoints: init.settings.wrongPoints,
          extraTimeExactScorePoints: init.settings.extraTimeExactScorePoints,
          extraTimeWinnerPoints: init.settings.extraTimeWinnerPoints,
          penaltyWinnerPoints: init.settings.penaltyWinnerPoints,
          pickemQualifierPoints: init.settings.pickemQualifierPoints,
          pickemExactPositionPoints: init.settings.pickemExactPositionPoints,
          pickemFirstPlacePoints: init.settings.pickemFirstPlacePoints,
          pickemKoMatchupExactPoints: init.settings.pickemKoMatchupExactPoints,
          pickemKoMatchupPartialPoints:
            init.settings.pickemKoMatchupPartialPoints,
          pickemChampionPoints: init.settings.pickemChampionPoints,
          pickemRunnerUpPoints: init.settings.pickemRunnerUpPoints,
          pickemThirdPlacePoints: init.settings.pickemThirdPlacePoints,
          tiebreakCriteria: [...init.settings.tiebreakCriteria],
        },
      });

      if (init.status === 'FINISHED') {
        this.form.disable();
      } else if (init.status === 'IN_PROGRESS') {
        this.form.controls.privacy.disable();
      }
    }
  }

  protected nameError(): string | null {
    const c = this.form.controls.name;
    if (!c.touched || c.valid) return null;
    if (c.hasError('required')) return 'Nome é obrigatório';
    if (c.hasError('minlength')) return 'Mínimo de 3 caracteres';
    if (c.hasError('maxlength')) return 'Máximo de 80 caracteres';
    return null;
  }

  protected descriptionError(): string | null {
    const c = this.form.controls.description;
    if (!c.touched || c.valid) return null;
    if (c.hasError('maxlength')) return 'Máximo de 500 caracteres';
    return null;
  }

  protected maxParticipantsError(): string | null {
    const c = this.form.controls.maxParticipants;
    if (!c.touched || c.valid) return null;
    if (c.hasError('min')) return 'Mínimo 2';
    return null;
  }

  protected maxTeamsError(): string | null {
    const c = this.form.controls.maxTeams;
    if (!c.touched || c.valid) return null;
    if (c.hasError('min')) return 'Mínimo 2';
    return null;
  }

  protected pointsError(field: string): string | null {
    const c = this.form.controls.settings.get(field);
    if (!c || !c.touched || c.valid) return null;
    if (c.hasError('required')) return 'Obrigatório';
    if (c.hasError('min')) return 'Mínimo 0';
    return null;
  }

  protected setPrivacy(value: TournamentPrivacy): void {
    if (this.form.controls.privacy.disabled) return;
    this.form.controls.privacy.setValue(value);
    this.form.controls.privacy.markAsDirty();
  }

  protected setTiebreak(criteria: TiebreakCriteria[]): void {
    const control = this.form.controls.settings.controls.tiebreakCriteria;
    control.setValue(criteria);
    control.markAsTouched();
    control.markAsDirty();
  }

  protected onSubmit(): void {
    if (this.submitting() || this.isFullyDisabled()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: ICreateTournamentRequest = {
      name: raw.name.trim(),
      description: raw.description.trim() || null,
      privacy: raw.privacy,
      maxParticipants: raw.maxParticipants,
      maxTeams: raw.maxTeams,
      settings: {
        winPoints: raw.settings.winPoints,
        drawPoints: raw.settings.drawPoints,
        lossPoints: raw.settings.lossPoints,
        exactScorePoints: raw.settings.exactScorePoints,
        winnerPoints: raw.settings.winnerPoints,
        wrongPoints: raw.settings.wrongPoints,
        extraTimeExactScorePoints: raw.settings.extraTimeExactScorePoints,
        extraTimeWinnerPoints: raw.settings.extraTimeWinnerPoints,
        penaltyWinnerPoints: raw.settings.penaltyWinnerPoints,
        pickemQualifierPoints: raw.settings.pickemQualifierPoints,
        pickemExactPositionPoints: raw.settings.pickemExactPositionPoints,
        pickemFirstPlacePoints: raw.settings.pickemFirstPlacePoints,
        pickemKoMatchupExactPoints: raw.settings.pickemKoMatchupExactPoints,
        pickemKoMatchupPartialPoints:
          raw.settings.pickemKoMatchupPartialPoints,
        pickemChampionPoints: raw.settings.pickemChampionPoints,
        pickemRunnerUpPoints: raw.settings.pickemRunnerUpPoints,
        pickemThirdPlacePoints: raw.settings.pickemThirdPlacePoints,
        tiebreakCriteria: raw.settings.tiebreakCriteria,
      },
    };

    this.saveForm.emit(payload);
  }

  protected onDelete(): void {
    this.deleteTournament.emit();
  }
}
