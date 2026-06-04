import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthState } from '@core/auth/auth-state';
import { ApiException } from '@core/errors/api-error';
import { TournamentMemberStatus } from '@core/interfaces/enums';
import { ITournamentMemberResponse } from '@core/interfaces/tournament-member.interface';
import { ITournamentResponse } from '@core/interfaces/tournament.interface';
import { TournamentMembersService } from '@core/services/tournament-members.service';
import { TournamentsService } from '@core/services/tournaments.service';
import { listStagger } from '@shared/animations/animations';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ToastService } from '@shared/services/toast.service';
import { Crown, LucideAngularModule, Users } from 'lucide-angular';

type MemberFilter = 'ALL' | TournamentMemberStatus;

const STATUS_LABEL: Record<TournamentMemberStatus, string> = {
  ACTIVE: 'Ativo',
  LEFT: 'Saiu',
  BANNED: 'Banido',
};

@Component({
  selector: 'app-tournament-members',
  standalone: true,
  imports: [
    LucideAngularModule,
    PageHeaderComponent,
    AvatarComponent,
    EmptyStateComponent,
    ConfirmDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tournament-members.component.html',
  styleUrl: './tournament-members.component.scss',
  animations: [listStagger],
})
export class TournamentMembersComponent implements OnInit {
  private readonly _tournamentsService = inject(TournamentsService);
  private readonly _membersService = inject(TournamentMembersService);
  private readonly _authState = inject(AuthState);
  private readonly _toast = inject(ToastService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  protected readonly crownIcon = Crown;
  protected readonly usersIcon = Users;

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly tournament = signal<ITournamentResponse | null>(null);
  protected readonly members = signal<ITournamentMemberResponse[]>([]);

  protected readonly filter = signal<MemberFilter>('ALL');
  protected readonly actionInProgress = signal(false);

  protected readonly confirmBan = signal<ITournamentMemberResponse | null>(
    null,
  );
  protected readonly confirmLeave = signal(false);

  protected readonly isOwner = computed(() => {
    const t = this.tournament();
    const user = this._authState.user();
    return !!(t && user && t.owner.id === user.id);
  });

  protected readonly currentUserId = computed(
    () => this._authState.user()?.id ?? null,
  );

  protected readonly counts = computed(() => {
    const list = this.members();
    return {
      ALL: list.length,
      ACTIVE: list.filter((m) => m.status === 'ACTIVE').length,
      LEFT: list.filter((m) => m.status === 'LEFT').length,
      BANNED: list.filter((m) => m.status === 'BANNED').length,
    };
  });

  protected readonly filteredMembers = computed(() => {
    const f = this.filter();
    const list = this.members();
    if (f === 'ALL') return list;
    return list.filter((m) => m.status === f);
  });

  protected readonly banDescription = computed(() => {
    const m = this.confirmBan();
    if (!m) return '';
    return `${m.name} não poderá mais entrar neste torneio. Essa ação é permanente.`;
  });

  public ngOnInit(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      this.loadError.set('Torneio não encontrado.');
      return;
    }
    this._load(id);
  }

  protected statusLabel(status: TournamentMemberStatus): string {
    return STATUS_LABEL[status];
  }

  protected setFilter(f: MemberFilter): void {
    this.filter.set(f);
  }

  protected canBan(member: ITournamentMemberResponse): boolean {
    if (!this.isOwner()) return false;
    if (member.role === 'OWNER') return false;
    if (member.status !== 'ACTIVE') return false;
    return member.userId !== this.currentUserId();
  }

  protected canLeave(member: ITournamentMemberResponse): boolean {
    if (member.userId !== this.currentUserId()) return false;
    if (member.role === 'OWNER') return false;
    return member.status === 'ACTIVE';
  }

  protected requestBan(member: ITournamentMemberResponse): void {
    this.confirmBan.set(member);
  }

  protected confirmBanAction(): void {
    const target = this.confirmBan();
    const tid = this.tournament()?.id;
    if (!target || !tid || this.actionInProgress()) return;

    this.actionInProgress.set(true);
    this._membersService
      .ban(tid, target.userId)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.actionInProgress.set(false);
          this.confirmBan.set(null);
          const nowIso = new Date().toISOString();
          this.members.update((list) =>
            list.map((m) =>
              m.userId === target.userId
                ? { ...m, status: 'BANNED' as const, bannedAt: nowIso }
                : m,
            ),
          );
          this._toast.success(`${target.name} foi banido.`);
        },
        error: (err: unknown) => {
          this.actionInProgress.set(false);
          this.confirmBan.set(null);
          this._toast.error(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível banir.',
          );
        },
      });
  }

  protected cancelBan(): void {
    this.confirmBan.set(null);
  }

  protected requestLeave(): void {
    this.confirmLeave.set(true);
  }

  protected confirmLeaveAction(): void {
    const tid = this.tournament()?.id;
    if (!tid || this.actionInProgress()) return;

    this.actionInProgress.set(true);
    this._membersService
      .leave(tid)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.actionInProgress.set(false);
          this.confirmLeave.set(false);
          this._toast.success('Você saiu do torneio.');
          void this._router.navigate(['/tournaments']);
        },
        error: (err: unknown) => {
          this.actionInProgress.set(false);
          this.confirmLeave.set(false);
          this._toast.error(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível sair do torneio.',
          );
        },
      });
  }

  protected cancelLeave(): void {
    this.confirmLeave.set(false);
  }

  private _load(id: string): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      tournament: this._tournamentsService.getById(id),
      page: this._membersService.list(id, {
        page: 0,
        size: 100,
        sort: 'joinedAt,desc',
      }),
    })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: ({ tournament, page }) => {
          this.tournament.set(tournament);
          this.members.set(page.content);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          if (err instanceof ApiException && err.isNotFound) {
            this.loadError.set('Torneio não encontrado.');
          } else if (err instanceof ApiException && err.isForbidden) {
            this.loadError.set('Você não tem acesso a este torneio.');
          } else {
            this.loadError.set(
              err instanceof ApiException
                ? err.message
                : 'Não foi possível carregar os membros.',
            );
          }
        },
      });
  }
}
