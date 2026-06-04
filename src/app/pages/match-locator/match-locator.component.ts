import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatchesService } from '@core/services/matches.service';

/**
 * Resolve um link curto /m/:matchId para a rota completa da partida.
 * Em caso de falha (id inválido / partida inexistente) volta para os torneios.
 * O acesso é protegido por authGuard, então usuários deslogados passam pelo
 * login e retornam para cá via returnUrl.
 */
@Component({
  selector: 'app-match-locator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="locator">
      <span class="locator__spinner" aria-hidden="true"></span>
      <p class="locator__text">Abrindo partida…</p>
    </div>
  `,
  styles: [
    `
      .locator {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        min-height: 100dvh;
        padding: 2rem;
        color: var(--text-secondary, #64748b);
      }

      .locator__spinner {
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 50%;
        border: 3px solid var(--border, #e2e8f0);
        border-top-color: var(--primary, #16a34a);
        animation: locator-spin 0.8s linear infinite;
      }

      .locator__text {
        margin: 0;
        font-size: 0.95rem;
      }

      @keyframes locator-spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class MatchLocatorComponent implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _matches = inject(MatchesService);

  public ngOnInit(): void {
    const matchId = this._route.snapshot.paramMap.get('matchId');
    if (!matchId) {
      void this._router.navigate(['/tournaments'], { replaceUrl: true });
      return;
    }

    this._matches.locate(matchId).subscribe({
      next: (location) => {
        void this._router.navigate(
          [
            '/tournaments',
            location.tournamentId,
            'phases',
            location.phaseId,
            'matches',
            location.matchId,
          ],
          { replaceUrl: true },
        );
      },
      error: () => {
        void this._router.navigate(['/tournaments'], { replaceUrl: true });
      },
    });
  }
}
