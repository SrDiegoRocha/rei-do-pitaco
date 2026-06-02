import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  HostListener,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { AuthState } from '@core/auth/auth-state';
import { ApiException } from '@core/errors/api-error';
import { IPredictionResponse } from '@core/interfaces/prediction.interface';
import { ITournamentResponse } from '@core/interfaces/tournament.interface';
import { PredictionsService } from '@core/services/predictions.service';
import { TournamentsService } from '@core/services/tournaments.service';
import { UsersService } from '@core/services/users.service';
import {
  backdropFade,
  modalScale,
} from '@shared/animations/animations';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { InputComponent } from '@shared/components/input/input.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ToastService } from '@shared/services/toast.service';
import {
  KeyRound,
  LucideAngularModule,
  Pencil,
  Settings,
  Sparkles,
  Trophy,
  Users,
  X,
} from 'lucide-angular';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    RouterLink,
    LucideAngularModule,
    ReactiveFormsModule,
    PageHeaderComponent,
    AvatarComponent,
    ButtonComponent,
    InputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  animations: [modalScale, backdropFade],
})
export class ProfileComponent implements OnInit {
  private readonly _authState = inject(AuthState);
  private readonly _tournamentsService = inject(TournamentsService);
  private readonly _predictionsService = inject(PredictionsService);
  private readonly _usersService = inject(UsersService);
  private readonly _toast = inject(ToastService);
  private readonly _fb = inject(FormBuilder);
  private readonly _destroyRef = inject(DestroyRef);

  protected readonly trophyIcon = Trophy;
  protected readonly sparklesIcon = Sparkles;
  protected readonly usersIcon = Users;
  protected readonly settingsIcon = Settings;
  protected readonly pencilIcon = Pencil;
  protected readonly keyIcon = KeyRound;
  protected readonly xIcon = X;

  protected readonly editProfileOpen = signal(false);
  protected readonly editProfileSubmitting = signal(false);
  protected readonly editProfileError = signal<string | null>(null);

  protected readonly changePasswordOpen = signal(false);
  protected readonly changePasswordSubmitting = signal(false);
  protected readonly changePasswordError = signal<string | null>(null);

  protected readonly profileForm = this._fb.group({
    name: this._fb.nonNullable.control('', {
      validators: [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(120),
      ],
    }),
    avatarUrl: this._fb.nonNullable.control(''),
  });

  protected readonly passwordForm = this._fb.group({
    currentPassword: this._fb.nonNullable.control('', {
      validators: [Validators.required],
    }),
    newPassword: this._fb.nonNullable.control('', {
      validators: [
        Validators.required,
        Validators.minLength(8),
        Validators.maxLength(100),
      ],
    }),
  });

  protected readonly user = this._authState.user;
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly ownedCount = signal(0);
  protected readonly joinedCount = signal(0);
  protected readonly totalPredictions = signal(0);
  protected readonly totalPoints = signal(0);

  protected readonly userName = computed(() => this.user()?.name ?? '');
  protected readonly userEmail = computed(() => this.user()?.email ?? '');
  protected readonly userAvatar = computed(() => this.user()?.avatarUrl ?? null);
  protected readonly userRoleLabel = computed(() => {
    const role = this.user()?.role;
    if (role === 'ADMIN') return 'Administrador';
    if (role === 'USER') return 'Usuário';
    return role ?? '';
  });

  protected readonly memberSinceLabel = computed(() => {
    const iso = this.user()?.createdAt;
    if (!iso) return '';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(new Date(iso));
    } catch {
      return '';
    }
  });

  protected readonly totalTournaments = computed(
    () => this.ownedCount() + this.joinedCount(),
  );

  public ngOnInit(): void {
    this._load();
    this._refreshMe();
  }

  protected openEditProfile(): void {
    const u = this.user();
    if (!u) return;
    this.profileForm.reset({
      name: u.name,
      avatarUrl: u.avatarUrl ?? '',
    });
    this.editProfileError.set(null);
    this.editProfileOpen.set(true);
  }

  protected closeEditProfile(): void {
    if (this.editProfileSubmitting()) return;
    this.editProfileOpen.set(false);
    this.editProfileError.set(null);
  }

  protected submitProfile(): void {
    if (this.editProfileSubmitting()) return;
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    const raw = this.profileForm.getRawValue();
    const trimmedAvatar = raw.avatarUrl.trim();

    this.editProfileSubmitting.set(true);
    this.editProfileError.set(null);

    this._usersService
      .updateMe({
        name: raw.name.trim(),
        avatarUrl: trimmedAvatar.length > 0 ? trimmedAvatar : null,
      })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.editProfileSubmitting.set(false);
          this.editProfileOpen.set(false);
          this._toast.success('Perfil atualizado.');
        },
        error: (err: unknown) => {
          this.editProfileSubmitting.set(false);
          this.editProfileError.set(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível atualizar o perfil.',
          );
        },
      });
  }

  protected openChangePassword(): void {
    this.passwordForm.reset({ currentPassword: '', newPassword: '' });
    this.changePasswordError.set(null);
    this.changePasswordOpen.set(true);
  }

  protected closeChangePassword(): void {
    if (this.changePasswordSubmitting()) return;
    this.changePasswordOpen.set(false);
    this.changePasswordError.set(null);
  }

  protected submitPassword(): void {
    if (this.changePasswordSubmitting()) return;
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const raw = this.passwordForm.getRawValue();

    this.changePasswordSubmitting.set(true);
    this.changePasswordError.set(null);

    this._usersService
      .changePassword({
        currentPassword: raw.currentPassword,
        newPassword: raw.newPassword,
      })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.changePasswordSubmitting.set(false);
          this.changePasswordOpen.set(false);
          this._toast.success('Senha alterada com sucesso.');
        },
        error: (err: unknown) => {
          this.changePasswordSubmitting.set(false);
          this.changePasswordError.set(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível alterar a senha.',
          );
        },
      });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.editProfileOpen() && !this.editProfileSubmitting()) {
      this.closeEditProfile();
      return;
    }
    if (this.changePasswordOpen() && !this.changePasswordSubmitting()) {
      this.closeChangePassword();
    }
  }

  protected nameError(): string | null {
    const c = this.profileForm.controls.name;
    if (!c.touched || c.valid) return null;
    if (c.hasError('required') || c.hasError('minlength')) {
      return 'Nome precisa ter ao menos 2 caracteres.';
    }
    if (c.hasError('maxlength')) return 'Máximo de 120 caracteres.';
    return null;
  }

  protected currentPasswordError(): string | null {
    const c = this.passwordForm.controls.currentPassword;
    if (!c.touched || c.valid) return null;
    if (c.hasError('required')) return 'Informe a senha atual.';
    return null;
  }

  protected newPasswordError(): string | null {
    const c = this.passwordForm.controls.newPassword;
    if (!c.touched || c.valid) return null;
    if (c.hasError('required')) return 'Informe a nova senha.';
    if (c.hasError('minlength')) return 'Mínimo de 8 caracteres.';
    if (c.hasError('maxlength')) return 'Máximo de 100 caracteres.';
    return null;
  }

  private _refreshMe(): void {
    this._usersService
      .getMe()
      .pipe(
        takeUntilDestroyed(this._destroyRef),
        catchError(() => of(null)),
      )
      .subscribe();
  }

  private _load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    forkJoin({
      mine: this._tournamentsService.listMine({ page: 0, size: 100 }).pipe(
        catchError(() => of({ content: [] as ITournamentResponse[], totalElements: 0 })),
      ),
      joined: this._tournamentsService.listJoined({ page: 0, size: 100 }).pipe(
        catchError(() => of({ content: [] as ITournamentResponse[], totalElements: 0 })),
      ),
    })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: ({ mine, joined }) => {
          this.ownedCount.set(mine.totalElements ?? mine.content.length);
          this.joinedCount.set(joined.totalElements ?? joined.content.length);
          this._loadPredictionAggregates([...mine.content, ...joined.content]);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.loadError.set(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível carregar suas informações.',
          );
        },
      });
  }

  private _loadPredictionAggregates(tournaments: ITournamentResponse[]): void {
    const dedup = new Map<string, ITournamentResponse>();
    for (const t of tournaments) dedup.set(t.id, t);
    const list = Array.from(dedup.values());

    if (list.length === 0) {
      this.totalPredictions.set(0);
      this.totalPoints.set(0);
      this.loading.set(false);
      return;
    }

    const calls = list.map((t) =>
      this._predictionsService.listMineInTournament(t.id).pipe(
        catchError(() => of<IPredictionResponse[]>([])),
        map((predictions) => predictions),
      ),
    );

    forkJoin(calls)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (results) => {
          let total = 0;
          let points = 0;
          for (const predictions of results) {
            total += predictions.length;
            points += predictions.reduce((sum, p) => sum + p.points, 0);
          }
          this.totalPredictions.set(total);
          this.totalPoints.set(points);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        },
      });
  }
}
