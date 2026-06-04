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
  ICreateTeamRequest,
  ITeamResponse,
} from '@core/interfaces/team.interface';
import { ButtonComponent } from '@shared/components/button/button.component';
import { ColorPickerComponent } from '@shared/components/color-picker/color-picker.component';
import { InputComponent } from '@shared/components/input/input.component';
import { TeamBadgeComponent } from '@shared/components/team-badge/team-badge.component';
import { Image, Tag, Trophy } from 'lucide-angular';

const URL_REGEX =
  /^https?:\/\/[\w-]+(\.[\w-]+)+([\w\-._~:/?#[\]@!$&'()*+,;=%]*)?$/i;
const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

const DEFAULT_PRIMARY = '#10B981';
const DEFAULT_SECONDARY = '#0F172A';

export type TeamFormMode = 'create' | 'edit';

@Component({
  selector: 'app-team-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    InputComponent,
    ButtonComponent,
    ColorPickerComponent,
    TeamBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './team-form.component.html',
  styleUrl: './team-form.component.scss',
})
export class TeamFormComponent implements OnInit {
  public readonly initial = input<ITeamResponse | null>(null);
  public readonly mode = input<TeamFormMode>('create');
  public readonly submitting = input<boolean>(false);
  public readonly deleting = input<boolean>(false);
  public readonly serverError = input<string | null>(null);

  public readonly saveForm = output<ICreateTeamRequest>();
  public readonly deleteTeam = output<void>();
  public readonly cancelForm = output<void>();

  private readonly _fb = inject(FormBuilder);

  protected readonly trophyIcon = Trophy;
  protected readonly tagIcon = Tag;
  protected readonly imageIcon = Image;

  protected readonly form = this._fb.nonNullable.group({
    name: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(80),
      ],
    ],
    shortName: ['', [Validators.minLength(2), Validators.maxLength(5)]],
    badgeUrl: [
      '',
      [Validators.maxLength(500), Validators.pattern(URL_REGEX)],
    ],
    primaryColor: [
      DEFAULT_PRIMARY,
      [Validators.required, Validators.pattern(HEX_REGEX)],
    ],
    secondaryColor: [
      DEFAULT_SECONDARY,
      [Validators.required, Validators.pattern(HEX_REGEX)],
    ],
  });

  private readonly _nameValue = toSignal(this.form.controls.name.valueChanges, {
    initialValue: '',
  });
  private readonly _shortNameValue = toSignal(
    this.form.controls.shortName.valueChanges,
    { initialValue: '' },
  );
  private readonly _badgeUrlValue = toSignal(
    this.form.controls.badgeUrl.valueChanges,
    { initialValue: '' },
  );
  private readonly _primaryValue = toSignal(
    this.form.controls.primaryColor.valueChanges,
    { initialValue: DEFAULT_PRIMARY },
  );
  private readonly _secondaryValue = toSignal(
    this.form.controls.secondaryColor.valueChanges,
    { initialValue: DEFAULT_SECONDARY },
  );

  protected readonly previewName = computed(
    () => this._nameValue() || 'Nome do time',
  );
  protected readonly previewShortName = computed(
    () => this._shortNameValue() || null,
  );
  protected readonly previewBadgeUrl = computed(
    () => this._badgeUrlValue() || null,
  );
  protected readonly previewPrimary = computed(
    () => this._primaryValue() || DEFAULT_PRIMARY,
  );
  protected readonly previewSecondary = computed(
    () => this._secondaryValue() || DEFAULT_SECONDARY,
  );

  protected readonly submitLabel = computed(() =>
    this.mode() === 'create' ? 'Criar time' : 'Salvar alterações',
  );

  constructor() {
    // Usabilidade: desabilita todos os campos durante o envio e reabilita
    // quando a requisição termina (sucesso ou erro).
    effect(() => {
      if (this.submitting()) {
        this.form.disable();
      } else {
        this.form.enable();
      }
    });
  }

  public ngOnInit(): void {
    const init = this.initial();
    if (init) {
      this.form.setValue({
        name: init.name,
        shortName: init.shortName ?? '',
        badgeUrl: init.badgeUrl ?? '',
        primaryColor: init.primaryColor,
        secondaryColor: init.secondaryColor,
      });
    }
  }

  protected nameError(): string | null {
    const c = this.form.controls.name;
    if (!c.touched || c.valid) return null;
    if (c.hasError('required')) return 'Nome é obrigatório';
    if (c.hasError('minlength')) return 'Mínimo de 2 caracteres';
    if (c.hasError('maxlength')) return 'Máximo de 80 caracteres';
    return null;
  }

  protected shortNameError(): string | null {
    const c = this.form.controls.shortName;
    if (!c.touched || c.valid) return null;
    if (c.hasError('minlength')) return 'Mínimo de 2 caracteres';
    if (c.hasError('maxlength')) return 'Máximo de 5 caracteres';
    return null;
  }

  protected badgeUrlError(): string | null {
    const c = this.form.controls.badgeUrl;
    if (!c.touched || c.valid) return null;
    if (c.hasError('pattern')) return 'URL inválida (use http:// ou https://)';
    if (c.hasError('maxlength')) return 'Máximo de 500 caracteres';
    return null;
  }

  protected primaryError(): string | null {
    const c = this.form.controls.primaryColor;
    if (!c.touched || c.valid) return null;
    if (c.hasError('required')) return 'Cor obrigatória';
    if (c.hasError('pattern')) return 'Formato inválido (#RRGGBB)';
    return null;
  }

  protected secondaryError(): string | null {
    const c = this.form.controls.secondaryColor;
    if (!c.touched || c.valid) return null;
    if (c.hasError('required')) return 'Cor obrigatória';
    if (c.hasError('pattern')) return 'Formato inválido (#RRGGBB)';
    return null;
  }

  protected onSubmit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: ICreateTeamRequest = {
      name: raw.name.trim(),
      shortName: raw.shortName.trim() || null,
      badgeUrl: raw.badgeUrl.trim() || null,
      primaryColor: raw.primaryColor.toUpperCase(),
      secondaryColor: raw.secondaryColor.toUpperCase(),
    };

    this.saveForm.emit(payload);
  }

  protected onCancel(): void {
    this.cancelForm.emit();
  }

  protected onDelete(): void {
    this.deleteTeam.emit();
  }
}
