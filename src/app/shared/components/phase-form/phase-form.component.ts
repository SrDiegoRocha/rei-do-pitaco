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
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  BracketMode,
  MatchGenerationMode,
  MatchLegMode,
  TournamentPhaseType,
} from '@core/interfaces/enums';
import {
  ICreatePhaseRequest,
  IPhaseResponse,
} from '@core/interfaces/phase.interface';
import { ButtonComponent } from '@shared/components/button/button.component';
import { InputComponent } from '@shared/components/input/input.component';
import {
  ArrowLeftRight,
  ArrowRight,
  Crown,
  GitFork,
  Grid3x3,
  LucideAngularModule,
  PenLine,
  Repeat,
  Shuffle,
  Sparkles,
} from 'lucide-angular';

export type PhaseFormMode = 'create' | 'edit';

/** Formato da rodada final no form: herda o modo da fase ou fixa um próprio. */
type FinalLegChoice = 'INHERIT' | MatchLegMode;

interface IPhaseFormParent {
  status: 'DRAFT' | 'OPEN' | 'IN_PROGRESS' | 'FINISHED';
}

@Component({
  selector: 'app-phase-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    InputComponent,
    ButtonComponent,
    LucideAngularModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './phase-form.component.html',
  styleUrl: './phase-form.component.scss',
})
export class PhaseFormComponent implements OnInit {
  public readonly initial = input<IPhaseResponse | null>(null);
  public readonly tournamentStatus = input<IPhaseFormParent['status'] | null>(
    null,
  );
  public readonly mode = input<PhaseFormMode>('create');
  public readonly submitting = input<boolean>(false);
  public readonly deleting = input<boolean>(false);
  public readonly serverError = input<string | null>(null);

  public readonly saveForm = output<ICreatePhaseRequest>();
  public readonly deletePhase = output<void>();
  public readonly cancelForm = output<void>();

  private readonly _fb = inject(FormBuilder);

  protected readonly repeatIcon = Repeat;
  protected readonly crownIcon = Crown;
  protected readonly gridIcon = Grid3x3;
  protected readonly arrowRightIcon = ArrowRight;
  protected readonly arrowLeftRightIcon = ArrowLeftRight;
  protected readonly sparklesIcon = Sparkles;
  protected readonly penLineIcon = PenLine;
  protected readonly gitForkIcon = GitFork;
  protected readonly shuffleIcon = Shuffle;

  protected readonly form = this._fb.group({
    name: this._fb.nonNullable.control('', {
      validators: [
        Validators.required,
        Validators.minLength(1),
        Validators.maxLength(60),
      ],
    }),
    phaseType: this._fb.nonNullable.control<TournamentPhaseType>(
      'ROUND_ROBIN',
      { validators: [Validators.required] },
    ),
    matchLegMode: this._fb.nonNullable.control<MatchLegMode>('SINGLE', {
      validators: [Validators.required],
    }),
    matchGenerationMode: this._fb.nonNullable.control<MatchGenerationMode>(
      'AUTOMATIC',
      { validators: [Validators.required] },
    ),
    playsInsideGroupOnly: this._fb.nonNullable.control<boolean>(false),
    hasThirdPlace: this._fb.nonNullable.control<boolean>(false),
    finalLegMode: this._fb.nonNullable.control<FinalLegChoice>('INHERIT'),
    bracketMode: this._fb.nonNullable.control<BracketMode>('FIXED_BRACKET'),
  });

  private readonly _phaseType = toSignal(
    this.form.controls.phaseType.valueChanges,
    { initialValue: this.form.controls.phaseType.value },
  );
  private readonly _legMode = toSignal(
    this.form.controls.matchLegMode.valueChanges,
    { initialValue: this.form.controls.matchLegMode.value },
  );
  private readonly _genMode = toSignal(
    this.form.controls.matchGenerationMode.valueChanges,
    { initialValue: this.form.controls.matchGenerationMode.value },
  );
  private readonly _playsInsideGroupOnly = toSignal(
    this.form.controls.playsInsideGroupOnly.valueChanges,
    { initialValue: this.form.controls.playsInsideGroupOnly.value },
  );
  private readonly _hasThirdPlace = toSignal(
    this.form.controls.hasThirdPlace.valueChanges,
    { initialValue: this.form.controls.hasThirdPlace.value },
  );
  private readonly _finalLegMode = toSignal(
    this.form.controls.finalLegMode.valueChanges,
    { initialValue: this.form.controls.finalLegMode.value },
  );
  private readonly _bracketMode = toSignal(
    this.form.controls.bracketMode.valueChanges,
    { initialValue: this.form.controls.bracketMode.value },
  );
  private readonly _formStatus = toSignal(this.form.statusChanges, {
    initialValue: this.form.status,
  });

  protected readonly phaseType = this._phaseType;
  protected readonly legMode = this._legMode;
  protected readonly genMode = this._genMode;
  protected readonly playsInsideGroupOnly = this._playsInsideGroupOnly;
  protected readonly hasThirdPlace = this._hasThirdPlace;
  protected readonly finalLegMode = this._finalLegMode;
  protected readonly bracketMode = this._bracketMode;

  protected readonly isGroups = computed(() => this.phaseType() === 'GROUPS');
  protected readonly isKnockout = computed(
    () => this.phaseType() === 'KNOCKOUT',
  );

  protected readonly statusBanner = computed<string | null>(() => {
    const status = this.tournamentStatus();
    if (status === 'IN_PROGRESS') {
      return 'Torneio em andamento — a estrutura das fases está congelada.';
    }
    if (status === 'FINISHED') {
      return 'Torneio finalizado — fases não podem ser modificadas.';
    }
    return null;
  });

  protected readonly isLocked = computed(() => {
    const status = this.tournamentStatus();
    return status === 'IN_PROGRESS' || status === 'FINISHED';
  });

  protected readonly submitLabel = computed(() =>
    this.mode() === 'create' ? 'Criar fase' : 'Salvar alterações',
  );

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
        name: init.name,
        phaseType: init.phaseType,
        matchLegMode: init.matchLegMode,
        matchGenerationMode: init.matchGenerationMode,
        playsInsideGroupOnly: init.playsInsideGroupOnly ?? false,
        hasThirdPlace: init.hasThirdPlace,
        finalLegMode: init.finalLegMode ?? 'INHERIT',
        bracketMode: init.bracketMode ?? 'FIXED_BRACKET',
      });
    }
    if (this.isLocked()) {
      this.form.disable();
    }
  }

  protected nameError(): string | null {
    const c = this.form.controls.name;
    if (!c.touched || c.valid) return null;
    if (c.hasError('required')) return 'Nome é obrigatório';
    if (c.hasError('maxlength')) return 'Máximo de 60 caracteres';
    return null;
  }

  protected setPhaseType(value: TournamentPhaseType): void {
    if (this.form.controls.phaseType.disabled) return;
    this.form.controls.phaseType.setValue(value);
    this.form.controls.phaseType.markAsDirty();
  }

  protected setLegMode(value: MatchLegMode): void {
    if (this.form.controls.matchLegMode.disabled) return;
    this.form.controls.matchLegMode.setValue(value);
    this.form.controls.matchLegMode.markAsDirty();
  }

  protected setGenMode(value: MatchGenerationMode): void {
    if (this.form.controls.matchGenerationMode.disabled) return;
    this.form.controls.matchGenerationMode.setValue(value);
    this.form.controls.matchGenerationMode.markAsDirty();
  }

  protected togglePlaysInsideGroupOnly(): void {
    if (this.form.controls.playsInsideGroupOnly.disabled) return;
    this.form.controls.playsInsideGroupOnly.setValue(
      !this.form.controls.playsInsideGroupOnly.value,
    );
    this.form.controls.playsInsideGroupOnly.markAsDirty();
  }

  protected setFinalLegMode(value: FinalLegChoice): void {
    if (this.form.controls.finalLegMode.disabled) return;
    this.form.controls.finalLegMode.setValue(value);
    this.form.controls.finalLegMode.markAsDirty();
  }

  protected setBracketMode(value: BracketMode): void {
    if (this.form.controls.bracketMode.disabled) return;
    this.form.controls.bracketMode.setValue(value);
    this.form.controls.bracketMode.markAsDirty();
  }

  protected toggleHasThirdPlace(): void {
    if (this.form.controls.hasThirdPlace.disabled) return;
    this.form.controls.hasThirdPlace.setValue(
      !this.form.controls.hasThirdPlace.value,
    );
    this.form.controls.hasThirdPlace.markAsDirty();
  }

  protected onSubmit(): void {
    if (this.submitting() || this.isLocked()) return;
    void this._formStatus();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: ICreatePhaseRequest = {
      name: raw.name.trim(),
      phaseType: raw.phaseType,
      matchLegMode: raw.matchLegMode,
      matchGenerationMode: raw.matchGenerationMode,
      playsInsideGroupOnly:
        raw.phaseType === 'GROUPS' ? raw.playsInsideGroupOnly : null,
      hasThirdPlace:
        raw.phaseType === 'KNOCKOUT' ? raw.hasThirdPlace : false,
      finalLegMode:
        raw.phaseType === 'KNOCKOUT' && raw.finalLegMode !== 'INHERIT'
          ? raw.finalLegMode
          : null,
      // Sempre explícito em KO (o default por modo de geração existe só para
      // clientes antigos — ver CHAVEAMENTO.md §2.2).
      bracketMode: raw.phaseType === 'KNOCKOUT' ? raw.bracketMode : null,
    };

    this.saveForm.emit(payload);
  }

  protected onDelete(): void {
    this.deletePhase.emit();
  }
}
