import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ChildrenOutletContexts, RouterOutlet } from '@angular/router';
import { routeSections } from '@shared/animations/animations';
import { AppBarComponent } from '@shared/components/app-bar/app-bar.component';
import { BottomNavComponent } from '@shared/components/bottom-nav/bottom-nav.component';
import { InstallBannerComponent } from '@shared/components/install-banner/install-banner.component';
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
