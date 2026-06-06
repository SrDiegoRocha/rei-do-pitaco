import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ChildrenOutletContexts,
  NavigationEnd,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { routeSections } from '@shared/animations/animations';
import { AppBarComponent } from '@shared/components/app-bar/app-bar.component';
import { BottomNavComponent } from '@shared/components/bottom-nav/bottom-nav.component';
import { InstallBannerComponent } from '@shared/components/install-banner/install-banner.component';
import { NotificationBannerComponent } from '@shared/components/notification-banner/notification-banner.component';
import { SidebarComponent } from '@shared/components/sidebar/sidebar.component';
import { SwipeNavDirective } from '@shared/directives/swipe-nav.directive';
import { SwipeNavRegistry } from '@shared/services/swipe-nav-registry.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    AppBarComponent,
    BottomNavComponent,
    InstallBannerComponent,
    NotificationBannerComponent,
    SidebarComponent,
    SwipeNavDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
  animations: [routeSections],
})
export class MainLayoutComponent {
  private readonly _contexts = inject(ChildrenOutletContexts);
  private readonly _swipeRegistry = inject(SwipeNavRegistry);
  private readonly _router = inject(Router);
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // O scroll do app fica num container interno (.layout__main), não na janela,
    // então o scrollPositionRestoration do router não o alcança. Ao navegar para
    // frente (clique/link = 'imperative'), reposicionamos esse container no topo
    // para a nova tela não começar no meio. Em 'popstate' (voltar/gesto) não
    // mexemos: a restauração de aba + âncora de cada tela roda depois do load e
    // cuida de rolar até o card de origem.
    let trigger: NavigationStart['navigationTrigger'] = 'imperative';
    this._router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationStart) {
        trigger = event.navigationTrigger ?? 'imperative';
      } else if (event instanceof NavigationEnd && trigger === 'imperative') {
        this._host.nativeElement
          .querySelector<HTMLElement>('.layout__main')
          ?.scrollTo({ top: 0 });
      }
    });
  }

  /** Gesto global captado no scroll do layout → delega à tela ativa. */
  protected onSwipe(delta: 1 | -1): void {
    this._swipeRegistry.handle(delta);
  }

  /** Ordem das seções principais (mesma do menu inferior). */
  private static readonly _sections = [
    'tournaments',
    'tournaments/public',
    'teams',
  ];

  /**
   * Estado para a animação de rota: índice numérico quando está numa das
   * seções principais (habilita o slide direcional via :increment/:decrement),
   * ou o path como string nas demais rotas (caem no fade).
   */
  protected getRouteState(): number | string {
    const ctx = this._contexts.getContext('primary');
    const segments = ctx?.route?.snapshot?.url ?? [];
    const path = segments.map((s) => s.path).join('/');
    const index = MainLayoutComponent._sections.indexOf(path);
    return index === -1 ? path || 'root' : index;
  }
}
