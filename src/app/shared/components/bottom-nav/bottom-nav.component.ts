import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  CalendarDays,
  Globe,
  LucideAngularModule,
  Shield,
  Trophy,
} from 'lucide-angular';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bottom-nav.component.html',
  styleUrl: './bottom-nav.component.scss',
})
export class BottomNavComponent {
  protected readonly calendarIcon = CalendarDays;
  protected readonly trophyIcon = Trophy;
  protected readonly globeIcon = Globe;
  protected readonly shieldIcon = Shield;
}
