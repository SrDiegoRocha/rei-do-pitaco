import { Routes } from '@angular/router';
import { authGuard } from '@core/auth/guards/auth.guard';
import { noAuthGuard } from '@core/auth/guards/no-auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    canActivate: [noAuthGuard],
    canActivateChild: [noAuthGuard],
    children: [
      {
        path: 'signin',
        loadComponent: () =>
          import(
            '@pages/authentication/sign-in/sign-in.component'
          ).then((m) => m.SignInComponent),
        title: 'Entrar · FutBet',
        data: { animation: 'signIn' },
      },
      {
        path: 'signup',
        loadComponent: () =>
          import(
            '@pages/authentication/sign-up/sign-up.component'
          ).then((m) => m.SignUpComponent),
        title: 'Cadastro · FutBet',
        data: { animation: 'signUp' },
      },
      { path: '', pathMatch: 'full', redirectTo: 'signin' },
    ],
  },
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    loadComponent: () =>
      import('@layouts/main-layout/main-layout.component').then(
        (m) => m.MainLayoutComponent,
      ),
    children: [
      {
        path: 'tournaments',
        pathMatch: 'full',
        loadComponent: () =>
          import('@pages/my-tournaments/my-tournaments.component').then(
            (m) => m.MyTournamentsComponent,
          ),
        title: 'Meus torneios · FutBet',
      },
      {
        path: 'tournaments/public',
        loadComponent: () =>
          import(
            '@pages/public-tournaments/public-tournaments.component'
          ).then((m) => m.PublicTournamentsComponent),
        title: 'Torneios públicos · FutBet',
      },
      {
        path: 'tournaments/new',
        loadComponent: () =>
          import(
            '@pages/create-tournament/create-tournament.component'
          ).then((m) => m.CreateTournamentComponent),
        title: 'Novo torneio · FutBet',
      },
      {
        path: 'tournaments/:id/edit',
        loadComponent: () =>
          import(
            '@pages/edit-tournament/edit-tournament.component'
          ).then((m) => m.EditTournamentComponent),
        title: 'Editar torneio · FutBet',
      },
      {
        path: 'tournaments/:id/members',
        loadComponent: () =>
          import(
            '@pages/tournament-members/tournament-members.component'
          ).then((m) => m.TournamentMembersComponent),
        title: 'Membros · FutBet',
      },
      {
        path: 'tournaments/:id/participants/:userId',
        loadComponent: () =>
          import(
            '@pages/participant-detail/participant-detail.component'
          ).then((m) => m.ParticipantDetailComponent),
        title: 'Participante · FutBet',
      },
      {
        path: 'tournaments/:id/predictions/me',
        redirectTo: 'tournaments/:id?tab=predictions',
        pathMatch: 'full',
      },
      {
        path: 'tournaments/:id/ranking',
        redirectTo: 'tournaments/:id?tab=ranking',
        pathMatch: 'full',
      },
      {
        path: 'tournaments/:id/teams',
        loadComponent: () =>
          import(
            '@pages/tournament-teams/tournament-teams.component'
          ).then((m) => m.TournamentTeamsComponent),
        title: 'Times do torneio · FutBet',
      },
      {
        path: 'tournaments/:id/phases',
        pathMatch: 'full',
        loadComponent: () =>
          import(
            '@pages/tournament-phases/tournament-phases.component'
          ).then((m) => m.TournamentPhasesComponent),
        title: 'Gerenciar fases · FutBet',
      },
      {
        path: 'tournaments/:id/phases/new',
        loadComponent: () =>
          import('@pages/create-phase/create-phase.component').then(
            (m) => m.CreatePhaseComponent,
          ),
        title: 'Nova fase · FutBet',
      },
      {
        path: 'tournaments/:id/phases/:pid/edit',
        loadComponent: () =>
          import('@pages/edit-phase/edit-phase.component').then(
            (m) => m.EditPhaseComponent,
          ),
        title: 'Editar fase · FutBet',
      },
      {
        path: 'tournaments/:id/phases/:pid/teams',
        loadComponent: () =>
          import('@pages/phase-teams/phase-teams.component').then(
            (m) => m.PhaseTeamsComponent,
          ),
        title: 'Times da fase · FutBet',
      },
      {
        path: 'tournaments/:id/phases/:pid/groups',
        loadComponent: () =>
          import('@pages/phase-groups/phase-groups.component').then(
            (m) => m.PhaseGroupsComponent,
          ),
        title: 'Grupos da fase · FutBet',
      },
      {
        path: 'tournaments/:id/phases/:pid/zones',
        pathMatch: 'full',
        loadComponent: () =>
          import('@pages/phase-zones/phase-zones.component').then(
            (m) => m.PhaseZonesComponent,
          ),
        title: 'Zonas da fase · FutBet',
      },
      {
        path: 'tournaments/:id/phases/:pid/zones/new',
        loadComponent: () =>
          import('@pages/create-zone/create-zone.component').then(
            (m) => m.CreateZoneComponent,
          ),
        title: 'Nova zona · FutBet',
      },
      {
        path: 'tournaments/:id/phases/:pid/zones/:zid/edit',
        loadComponent: () =>
          import('@pages/edit-zone/edit-zone.component').then(
            (m) => m.EditZoneComponent,
          ),
        title: 'Editar zona · FutBet',
      },
      {
        path: 'tournaments/:id/phases/:pid/matches',
        pathMatch: 'full',
        loadComponent: () =>
          import('@pages/phase-matches/phase-matches.component').then(
            (m) => m.PhaseMatchesComponent,
          ),
        title: 'Partidas · FutBet',
      },
      {
        path: 'tournaments/:id/phases/:pid/standings',
        loadComponent: () =>
          import('@pages/phase-standings/phase-standings.component').then(
            (m) => m.PhaseStandingsComponent,
          ),
        title: 'Classificação · FutBet',
      },
      {
        path: 'tournaments/:id/phases/:pid/bracket',
        loadComponent: () =>
          import('@pages/phase-bracket/phase-bracket.component').then(
            (m) => m.PhaseBracketComponent,
          ),
        title: 'Chaveamento · FutBet',
      },
      {
        path: 'tournaments/:id/phases/:pid/matches/new',
        loadComponent: () =>
          import('@pages/create-match/create-match.component').then(
            (m) => m.CreateMatchComponent,
          ),
        title: 'Nova partida · FutBet',
      },
      {
        path: 'tournaments/:id/phases/:pid/matches/:mid/edit',
        loadComponent: () =>
          import('@pages/edit-match/edit-match.component').then(
            (m) => m.EditMatchComponent,
          ),
        title: 'Editar partida · FutBet',
      },
      {
        path: 'tournaments/:id/phases/:pid/matches/:mid',
        pathMatch: 'full',
        loadComponent: () =>
          import('@pages/match-detail/match-detail.component').then(
            (m) => m.MatchDetailComponent,
          ),
        title: 'Partida · FutBet',
      },
      {
        path: 'tournaments/:id/phases/:pid',
        pathMatch: 'full',
        loadComponent: () =>
          import('@pages/phase-detail/phase-detail.component').then(
            (m) => m.PhaseDetailComponent,
          ),
        title: 'Fase · FutBet',
      },
      {
        path: 'tournaments/:id',
        pathMatch: 'full',
        loadComponent: () =>
          import(
            '@pages/tournament-detail/tournament-detail.component'
          ).then((m) => m.TournamentDetailComponent),
        title: 'Torneio · FutBet',
      },
      {
        path: 'join',
        loadComponent: () =>
          import(
            '@pages/join-tournament/join-tournament.component'
          ).then((m) => m.JoinTournamentComponent),
        title: 'Entrar em torneio · FutBet',
      },
      {
        path: 'teams',
        pathMatch: 'full',
        loadComponent: () =>
          import('@pages/my-teams/my-teams.component').then(
            (m) => m.MyTeamsComponent,
          ),
        title: 'Meus times · FutBet',
      },
      {
        path: 'teams/new',
        loadComponent: () =>
          import('@pages/create-team/create-team.component').then(
            (m) => m.CreateTeamComponent,
          ),
        title: 'Novo time · FutBet',
      },
      {
        path: 'teams/:id',
        loadComponent: () =>
          import('@pages/edit-team/edit-team.component').then(
            (m) => m.EditTeamComponent,
          ),
        title: 'Editar time · FutBet',
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('@pages/settings/settings.component').then(
            (m) => m.SettingsComponent,
          ),
        title: 'Configurações · FutBet',
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('@pages/profile/profile.component').then(
            (m) => m.ProfileComponent,
          ),
        title: 'Perfil · FutBet',
      },
      {
        path: 'predictions/upcoming',
        loadComponent: () =>
          import(
            '@pages/upcoming-predictions/upcoming-predictions.component'
          ).then((m) => m.UpcomingPredictionsComponent),
        title: 'Próximos palpites · FutBet',
      },
      { path: '', pathMatch: 'full', redirectTo: 'tournaments' },
    ],
  },
  { path: '**', redirectTo: '' },
];
