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
  TournamentPhaseType,
  TournamentStatus,
  ZoneSelectionMode,
} from '@core/interfaces/enums';
import { IPhaseResponse } from '@core/interfaces/phase.interface';
import {
  ICreateZoneRequest,
  IZoneResponse,
} from '@core/interfaces/zone.interface';
import { ButtonComponent } from '@shared/components/button/button.component';
import { InputComponent } from '@shared/components/input/input.component';
import { ArrowRight, Award, LucideAngularModule } from 'lucide-angular';

export type ZoneFormMode = 'create' | 'edit';

function rangeValidator(group: AbstractControl): ValidationErrors | null {
  const from = group.get('fromPosition')?.value;
  const to = group.get('toPosition')?.value;
  if (typeof from !== 'number' || typeof to !== 'number') return null;
  return to >= from ? null : { rangeInvalid: true };
}

function bestRankedConsistencyValidator(
  group: AbstractControl,
): ValidationErrors | null {
  const mode = group.get('selectionMode')?.value;
  if (mode !== 'BEST_RANKED') return null;
  const from = group.get('fromPosition')?.value;
  const to = group.get('toPosition')?.value;
  if (typeof from !== 'number' || typeof to !== 'number') return null;
  return from === to ? null : { brRangeMustEqual: true };
}

function bestRankedCountValidator(
  group: AbstractControl,
): ValidationErrors | null {
  const mode = group.get('selectionMode')?.value;
  if (mode !== 'BEST_RANKED') return null;
  const count = group.get('bestRankedCount')?.value;
  if (typeof count !== 'number' || !Number.isFinite(count) || count < 1) {
    return { brCountRequired: true };
  }
  return null;
}

@Component({
  selector: 'app-zone-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    InputComponent,
    ButtonComponent,
    LucideAngularModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './zone-form.component.html',
  styleUrl: './zone-form.component.scss',
})
export class ZoneFormComponent implements OnInit {
  public readonly initial = input<IZoneResponse | null>(null);
  public readonly mode = input<ZoneFormMode>('create');
  public readonly phaseType = input<TournamentPhaseType | null>(null);
  public readonly groupCount = input<number>(0);
  public readonly futurePhases = input<IPhaseResponse[]>([]);
  public readonly tournamentStatus = input<TournamentStatus | null>(null);
  public readonly submitting = input<boolean>(false);
  public readonly deleting = input<boolean>(false);
  public readonly serverError = input<string | null>(null);

  public readonly saveForm = output<ICreateZoneRequest>();
  public readonly deleteZone = output<void>();
  public readonly cancelForm = output<void>();

  private readonly _fb = inject(FormBuilder);

  protected readonly arrowRightIcon = ArrowRight;
  protected readonly awardIcon = Award;

  protected readonly form = this._fb.group(
    {
      name: this._fb.nonNullable.control('', {
        validators: [
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(60),
        ],
      }),
      fromPosition: this._fb.nonNullable.control(1, {
        validators: [Validators.required, Validators.min(1)],
      }),
      toPosition: this._fb.nonNullable.control(1, {
        validators: [Validators.required, Validators.min(1)],
      }),
      selectionMode: this._fb.nonNullable.control<ZoneSelectionMode>('ALL', {
        validators: [Validators.required],
      }),
      bestRankedCount: this._fb.control<number | null>(null, {
        validators: [Validators.min(1)],
      }),
      nextPhaseId: this._fb.control<string | null>(null),
    },
    {
      validators: [
        rangeValidator,
        bestRankedConsistencyValidator,
        bestRankedCountValidator,
      ],
    },
  );

  private readonly _selectionMode = toSignal(
    this.form.controls.selectionMode.valueChanges,
    { initialValue: this.form.controls.selectionMode.value },
  );
  private readonly _formStatus = toSignal(this.form.statusChanges, {
    initialValue: this.form.status,
  });

  protected readonly selectionMode = this._selectionMode;
  protected readonly isBestRanked = computed(
    () => this.selectionMode() === 'BEST_RANKED',
  );

  protected readonly statusBanner = computed<string | null>(() => {
    if (this.tournamentStatus() === 'FINISHED') {
      return 'Torneio finalizado — zonas não podem ser modificadas.';
    }
    return null;
  });

  protected readonly isLocked = computed(
    () => this.tournamentStatus() === 'FINISHED',
  );

  protected readonly canUseBestRanked = computed(
    () => this.phaseType() === 'GROUPS',
  );

  protected readonly submitLabel = computed(() =>
    this.mode() === 'create' ? 'Criar zona' : 'Salvar alterações',
  );

  protected readonly maxBestRanked = computed(() =>
    Math.max(1, this.groupCount()),
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
        fromPosition: init.fromPosition,
        toPosition: init.toPosition,
        selectionMode: init.selectionMode,
        bestRankedCount: init.bestRankedCount,
        nextPhaseId: init.nextPhaseId,
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

  protected fromPositionError(): string | null {
    const c = this.form.controls.fromPosition;
    if (!c.touched || c.valid) return null;
    if (c.hasError('required')) return 'Obrigatório';
    if (c.hasError('min')) return 'Mínimo 1';
    return null;
  }

  protected toPositionError(): string | null {
    const c = this.form.controls.toPosition;
    if (!c.touched || c.valid) return null;
    if (c.hasError('required')) return 'Obrigatório';
    if (c.hasError('min')) return 'Mínimo 1';
    return null;
  }

  protected rangeError(): string | null {
    void this._formStatus();
    if (!this.form.touched) return null;
    if (this.form.hasError('rangeInvalid')) {
      return 'Posição final precisa ser ≥ posição inicial';
    }
    if (this.form.hasError('brRangeMustEqual')) {
      return 'No modo "Melhor classificado", as posições inicial e final devem ser iguais';
    }
    return null;
  }

  protected bestRankedCountError(): string | null {
    void this._formStatus();
    if (!this.form.touched) return null;
    if (!this.isBestRanked()) return null;
    if (this.form.hasError('brCountRequired')) {
      return 'Informe quantos times serão escolhidos (≥ 1)';
    }
    const c = this.form.controls.bestRankedCount;
    if (c.hasError('min')) return 'Mínimo 1';
    const value = c.value;
    if (typeof value === 'number' && value > this.maxBestRanked()) {
      return `Máximo ${this.maxBestRanked()} (total de grupos)`;
    }
    return null;
  }

  protected setSelectionMode(value: ZoneSelectionMode): void {
    if (this.form.controls.selectionMode.disabled) return;
    if (value === 'BEST_RANKED' && !this.canUseBestRanked()) return;
    this.form.controls.selectionMode.setValue(value);
    this.form.controls.selectionMode.markAsDirty();
    if (value === 'ALL') {
      this.form.controls.bestRankedCount.setValue(null);
    }
  }

  protected onSubmit(): void {
    if (this.submitting() || this.isLocked()) return;
    void this._formStatus();

    if (this.isBestRanked()) {
      const count = this.form.controls.bestRankedCount.value;
      if (
        typeof count === 'number' &&
        count > this.maxBestRanked()
      ) {
        this.form.controls.bestRankedCount.setErrors({ max: true });
      }
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: ICreateZoneRequest = {
      name: raw.name.trim(),
      fromPosition: raw.fromPosition,
      toPosition: raw.toPosition,
      selectionMode: raw.selectionMode,
      bestRankedCount:
        raw.selectionMode === 'BEST_RANKED' ? raw.bestRankedCount : null,
      nextPhaseId: raw.nextPhaseId,
    };

    this.saveForm.emit(payload);
  }

  protected onCancel(): void {
    this.cancelForm.emit();
  }

  protected onDelete(): void {
    this.deleteZone.emit();
  }
}
