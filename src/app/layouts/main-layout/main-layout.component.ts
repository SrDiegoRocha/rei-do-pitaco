import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ChildrenOutletContexts, RouterOutlet } from '@angular/router';
import { routeFade } from '@shared/animations/animations';
import { AppBarComponent } from '@shared/components/app-bar/app-bar.component';
import { BottomNavComponent } from '@shared/components/bottom-nav/bottom-nav.component';
import { InstallBannerComponent } from '@shared/components/install-banner/install-banner.component';
import { SidebarComponent } from '@shared/components/sidebar/sidebar.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    AppBarComponent,
    BottomNavComponent,
    InstallBannerComponent,
    SidebarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
  animations: [routeFade],
})
export class MainLayoutComponent {
  private readonly _contexts = inject(ChildrenOutletContexts);

  protected getChildRouteKey(): string {
    const ctx = this._contexts.getContext('primary');
    const segments = ctx?.route?.snapshot?.url ?? [];
    if (segments.length === 0) return 'root';
    return segments.map((s) => s.path).join('/');
  }
}
