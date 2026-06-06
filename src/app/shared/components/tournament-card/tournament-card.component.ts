import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import {
  TournamentPrivacy,
  TournamentStatus,
} from '@core/interfaces/enums';
import { ITournamentResponse } from '@core/interfaces/tournament.interface';
import {
  Globe,
  Lock,
  LucideAngularModule,
  Shield,
  Trophy,
  Users,
} from 'lucide-angular';

const STATUS_LABEL: Record<TournamentStatus, string> = {
  DRAFT: 'Rascunho',
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em andamento',
  FINISHED: 'Finalizado',
};

const PRIVACY_LABEL: Record<TournamentPrivacy, string> = {
  PUBLIC: 'Público',
  PRIVATE: 'Privado',
};

@Component({
  selector: 'app-tournament-card',
  standalone: true,
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tournament-card.component.html',
  styleUrl: './tournament-card.component.scss',
})
export class TournamentCardComponent {
  public readonly tournament = input.required<ITournamentResponse>();
  public readonly showOwner = input<boolean>(false);

  protected readonly globeIcon = Globe;
  protected readonly lockIcon = Lock;
  protected readonly trophyIcon = Trophy;
  protected readonly shieldIcon = Shield;
  protected readonly usersIcon = Users;

  protected readonly statusLabel = computed(
    () => STATUS_LABEL[this.tournament().status],
  );
  protected readonly privacyLabel = computed(
    () => PRIVACY_LABEL[this.tournament().privacy],
  );
  protected readonly statusClass = computed(() => {
    const status = this.tournament().status;
    return `tournament-card__status tournament-card__status--${status.toLowerCase()}`;
  });

  protected readonly memberCountLabel = computed(() => {
    const t = this.tournament();
    if (t.maxParticipants !== null) {
      return `${t.memberCount} / ${t.maxParticipants}`;
    }
    return String(t.memberCount);
  });

  protected readonly teamCountLabel = computed(() => {
    const t = this.tournament();
    if (t.maxTeams !== null) {
      return `${t.teamCount} / ${t.maxTeams}`;
    }
    return String(t.teamCount);
  });
}
