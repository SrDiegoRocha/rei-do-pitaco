import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiException } from '@core/errors/api-error';
import { AuthService } from '@core/services/auth.service';
import { AuthLayoutComponent } from '@shared/components/auth-layout/auth-layout.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { InputComponent } from '@shared/components/input/input.component';
import { Lock, Mail } from 'lucide-angular';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AuthLayoutComponent,
    ButtonComponent,
    InputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.scss',
})
export class SignInComponent {
  private readonly _fb = inject(FormBuilder);
  private readonly _auth = inject(AuthService);
  private readonly _router = inject(Router);

  protected readonly mailIcon = Mail;
  protected readonly lockIcon = Lock;

  protected readonly form = this._fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected readonly submitting = signal(false);
  protected readonly formError = signal<string | null>(null);

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
    return null;
  }

  protected submit(): void {
    if (this.submitting()) return;
    this.formError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.form.getRawValue();
    this.submitting.set(true);
    // Usabilidade: trava os campos enquanto a requisição está em voo.
    this.form.disable();
    this._auth.signIn(payload).subscribe({
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

  private _extractMessage(err: unknown): string {
    if (err instanceof ApiException) {
      if (err.isUnauthorized) return 'Email ou senha inválidos.';
      return err.message;
    }
    return 'Não foi possível entrar. Tente novamente.';
  }
}
