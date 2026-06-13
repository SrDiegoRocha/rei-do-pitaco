import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import {
  IStandingRow,
  IStandingsResponse,
  StandingZoneStyle,
} from '@core/interfaces/standings.interface';
import { TeamBadgeComponent } from '@shared/components/team-badge/team-badge.component';

interface IZoneLegendEntry {
  zoneId: string;
  zoneName: string;
  nextPhaseName: string | null;
  style: StandingZoneStyle;
  colorIndex: number;
}

export type StandingsViewMode = 'simple' | 'full' | 'performance';

type StatKey =
  | 'played'
  | 'wins'
  | 'draws'
  | 'losses'
  | 'goalsFor'
  | 'goalsAgainst'
  | 'goalDifference'
  | 'performance';

interface IStatColumn {
  key: StatKey;
  label: string;
  title: string;
  tone?: 'win' | 'loss' | 'diff';
}

const STAT_COLUMNS: Record<StatKey, IStatColumn> = {
  played: { key: 'played', label: 'J', title: 'Jogos' },
  wins: { key: 'wins', label: 'V', title: 'Vitórias', tone: 'win' },
  draws: { key: 'draws', label: 'E', title: 'Empates' },
  losses: { key: 'losses', label: 'D', title: 'Derrotas', tone: 'loss' },
  goalsFor: { key: 'goalsFor', label: 'GP', title: 'Gols pró' },
  goalsAgainst: { key: 'goalsAgainst', label: 'GC', title: 'Gols contra' },
  goalDifference: {
    key: 'goalDifference',
    label: 'SG',
    title: 'Saldo de gols',
    tone: 'diff',
  },
  performance: {
    key: 'performance',
    label: '%',
    title: 'Aproveitamento',
  },
};

const STATS_BY_MODE: Record<StandingsViewMode, StatKey[]> = {
  simple: ['played', 'goalDifference'],
  full: [
    'played',
    'wins',
    'draws',
    'losses',
    'goalsFor',
    'goalsAgainst',
    'goalDifference',
  ],
  performance: ['played', 'performance'],
};

interface IViewModeOption {
  mode: StandingsViewMode;
  label: string;
}

const VIEW_MODE_OPTIONS: IViewModeOption[] = [
  { mode: 'simple', label: 'Simplificada' },
  { mode: 'full', label: 'Completa' },
  { mode: 'performance', label: 'Aproveitamento' },
];

@Component({
  selector: 'app-standings-table',
  standalone: true,
  imports: [TeamBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './standings-table.component.html',
  styleUrl: './standings-table.component.scss',
})
export class StandingsTableComponent {
  public readonly standings = input<IStandingsResponse | null>(null);
  public readonly density = input<'comfortable' | 'compact'>('comfortable');

  protected readonly viewModeOptions = VIEW_MODE_OPTIONS;
  /** Default: visualização simplificada. */
  protected readonly viewMode = signal<StandingsViewMode>('simple');

  protected readonly groups = computed(() => this.standings()?.groups ?? []);

  protected readonly visibleStats = computed<IStatColumn[]>(() =>
    STATS_BY_MODE[this.viewMode()].map((key) => STAT_COLUMNS[key]),
  );

  protected setViewMode(mode: StandingsViewMode): void {
    this.viewMode.set(mode);
  }

  protected statValue(row: IStandingRow, key: StatKey): string {
    if (key === 'performance') {
      if (row.played <= 0) return '—';
      const pct = Math.round((row.points / (row.played * 3)) * 100);
      return `${pct}%`;
    }
    if (key === 'goalDifference') {
      return row.goalDifference > 0
        ? `+${row.goalDifference}`
        : `${row.goalDifference}`;
    }
    return `${row[key]}`;
  }

  protected statToneClass(row: IStandingRow, col: IStatColumn): string {
    if (col.tone === 'win') return 'srow__stat--win';
    if (col.tone === 'loss') return 'srow__stat--loss';
    if (col.tone === 'diff') {
      if (row.goalDifference > 0) return 'srow__stat--positive';
      if (row.goalDifference < 0) return 'srow__stat--negative';
    }
    return '';
  }

  protected readonly zoneLegend = computed<IZoneLegendEntry[]>(() => {
    const s = this.standings();
    if (!s) return [];

    const seen = new Map<string, IZoneLegendEntry>();
    let colorIndex = 0;

    for (const group of s.groups) {
      for (const row of group.rows) {
        if (!row.zoneId) continue;
        if (seen.has(row.zoneId)) continue;
        seen.set(row.zoneId, {
          zoneId: row.zoneId,
          zoneName: row.zoneName ?? 'Zona',
          nextPhaseName: row.nextPhaseName,
          style: this._styleForZone(row),
          colorIndex: colorIndex++,
        });
      }
    }

    return Array.from(seen.values());
  });

  protected readonly zoneColorById = computed<Map<string, number>>(() => {
    const map = new Map<string, number>();
    for (const entry of this.zoneLegend()) {
      map.set(entry.zoneId, entry.colorIndex);
    }
    return map;
  });

  protected rowStyle(row: IStandingRow): StandingZoneStyle {
    return this._styleForRow(row);
  }

  protected rowColorIndex(row: IStandingRow): number | null {
    if (!row.zoneId) return null;
    return this.zoneColorById().get(row.zoneId) ?? null;
  }

  /**
   * Cor da linha: só destaca quem efetivamente avança (verde) ou está em zona
   * sem destino (vermelho). Quando a zona tem destino mas o time não foi
   * selecionado (caso BEST_RANKED), a linha fica sem cor — quem realmente
   * passou já está pintado de verde.
   */
  private _styleForRow(row: IStandingRow): StandingZoneStyle {
    if (row.qualifies) return 'qualified';
    if (row.zoneId == null) return 'none';
    if (row.nextPhaseId == null) return 'eliminated';
    return 'none';
  }

  /**
   * Cor da legenda: usa a *intenção* da zona, não o status do time. Zona com
   * destino = classifica (verde); zona sem destino = elimina (vermelho).
   */
  private _styleForZone(row: IStandingRow): StandingZoneStyle {
    return row.nextPhaseId != null ? 'qualified' : 'eliminated';
  }
}
