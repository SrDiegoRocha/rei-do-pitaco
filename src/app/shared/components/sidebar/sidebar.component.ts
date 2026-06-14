import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthState } from '@core/auth/auth-state';
import { AuthService } from '@core/services/auth.service';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { LogoComponent } from '@shared/components/logo/logo.component';
import { ThemeService } from '@shared/services/theme.service';
import {
  Bell,
  CalendarDays,
  Globe,
  LogOut,
  LucideAngularModule,
  Moon,
  Settings,
  Shield,
  Sun,
  Ticket,
  Trophy,
} from 'lucide-angular';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    LucideAngularModule,
    LogoComponent,
    AvatarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  private readonly _authState = inject(AuthState);
  private readonly _authService = inject(AuthService);
  private readonly _themeService = inject(ThemeService);
  private readonly _router = inject(Router);

  protected readonly user = this._authState.user;
  protected readonly userName = computed(() => this.user()?.name ?? '');
  protected readonly userAvatar = computed(() => this.user()?.avatarUrl ?? null);
  protected readonly isDark = computed(
    () => this._themeService.resolved() === 'dark',
  );

  protected readonly calendarIcon = CalendarDays;
  protected readonly trophyIcon = Trophy;
  protected readonly globeIcon = Globe;
  protected readonly shieldIcon = Shield;
  protected readonly logOutIcon = LogOut;
  protected readonly sunIcon = Sun;
  protected readonly moonIcon = Moon;
  protected readonly ticketIcon = Ticket;
  protected readonly settingsIcon = Settings;
  protected readonly bellIcon = Bell;

  protected toggleTheme(): void {
    this._themeService.toggle();
  }

  protected signOut(): void {
    this._authService.signOut();
    void this._router.navigate(['/auth/signin']);
  }
}
