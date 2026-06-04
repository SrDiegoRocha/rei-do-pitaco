import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
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
import { Router, RouterLink } from '@angular/router';
import { ApiException } from '@core/errors/api-error';
import { AuthService } from '@core/services/auth.service';
import { AuthLayoutComponent } from '@shared/components/auth-layout/auth-layout.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { InputComponent } from '@shared/components/input/input.component';
import { Lock, Mail, User } from 'lucide-angular';

function passwordsMatchValidator(
  control: AbstractControl,
): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirm = control.get('confirmPassword')?.value;
  if (!password || !confirm) return null;
  return password === confirm ? null : { passwordsMismatch: true };
}

@Component({
  selector: 'app-sign-up',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AuthLayoutComponent,
    ButtonComponent,
    InputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sign-up.component.html',
  styleUrl: './sign-up.component.scss',
})
export class SignUpComponent {
  private readonly _fb = inject(FormBuilder);
  private readonly _auth = inject(AuthService);
  private readonly _router = inject(Router);

  protected readonly userIcon = User;
  protected readonly mailIcon = Mail;
  protected readonly lockIcon = Lock;

  protected readonly form = this._fb.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(100)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatchValidator },
  );

  private readonly _passwordValue = toSignal(
    this.form.controls.password.valueChanges,
    { initialValue: '' },
  );

  protected readonly submitting = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly passwordStrength = computed(() =>
    this._calculateStrength(this._passwordValue() ?? ''),
  );

  protected readonly strengthLabel = computed(() => {
    const score = this.passwordStrength();
    if (score === 0) return '';
    if (score <= 2) return 'Fraca';
    if (score <= 4) return 'Média';
    return 'Forte';
  });

  protected readonly strengthClass = computed(() => {
    const score = this.passwordStrength();
    if (score <= 2) return 'weak';
    if (score <= 4) return 'medium';
    return 'strong';
  });

  protected nameError(): string | null {
    const c = this.form.controls.name;
    if (!c.touched || c.valid) return null;
    if (c.hasError('required')) return 'Nome é obrigatório';
    if (c.hasError('minlength')) return 'Mínimo de 2 caracteres';
    if (c.hasError('maxlength')) return 'Máximo de 120 caracteres';
    return null;
  }

  protected emailError(): string | null {
    const c = this.form.controls.email;
    if (!c.touched || c.valid) return null;
    if (c.hasError('required')) return 'Email é obrigatório';
    if (c.hasError('email')) return 'Email inválido';
    return null;
  }

  protected passwordError(): string | null {
    const c = this.form.controls.password;
    if (!c.touched || c.valid) return null;
    if (c.hasError('required')) return 'Senha é obrigatória';
    if (c.hasError('minlength')) return 'Mínimo de 8 caracteres';
    if (c.hasError('maxlength')) return 'Máximo de 100 caracteres';
    return null;
  }

  protected confirmError(): string | null {
    const c = this.form.controls.confirmPassword;
    if (!c.touched) return null;
    if (c.hasError('required')) return 'Confirme sua senha';
    if (this.form.hasError('passwordsMismatch')) return 'As senhas não coincidem';
    return null;
  }

  protected submit(): void {
    if (this.submitting()) return;
    this.formError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload = {
      name: raw.name.trim(),
      email: raw.email.trim(),
      password: raw.password,
    };

    this.submitting.set(true);
    // Usabilidade: trava os campos enquanto a requisição está em voo.
    this.form.disable();
    this._auth.signUp(payload).subscribe({
      next: () => {
        void this._router.navigate(['/']);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.form.enable();
        this.formError.set(this._extractMessage(err));
      },
    });
  }

  private _calculateStrength(value: string): number {
    if (!value) return 0;
    let score = 0;
    if (value.length >= 8) score++;
    if (value.length >= 12) score++;
    if (/[a-z]/.test(value)) score++;
    if (/[A-Z]/.test(value)) score++;
    if (/\d/.test(value)) score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;
    return Math.min(5, score);
  }

  private _extractMessage(err: unknown): string {
    if (err instanceof ApiException) {
      if (err.isConflict) return 'Este email já está em uso.';
      if (err.isValidationError && err.fieldErrors.length > 0) {
        return err.fieldErrors[0].message;
      }
      return err.message;
    }
    return 'Não foi possível concluir o cadastro. Tente novamente.';
  }
}
