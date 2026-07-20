import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { ITeamRef } from '@core/interfaces/match.interface';
import {
  IPhasePredictionResponse,
  IPositionRow,
  ITieRow,
} from '@core/interfaces/pickem.interface';
import { BracketTreeComponent } from '@shared/components/bracket-tree/bracket-tree.component';
import {
  IBracketTreeData,
  IBracketTreeSlot,
} from '@shared/components/bracket-tree/bracket-tree.model';
import { TeamBadgeComponent } from '@shared/components/team-badge/team-badge.component';
import {
  Award,
  Check,
  LucideAngularModule,
  Medal,
  Trophy,
  X,
} from 'lucide-angular';

interface IPositionBlockVM {
  key: string;
  groupName: string | null;
  rows: IPositionRow[];
}

interface ITerminalRowVM {
  key: 'champion' | 'runnerUp' | 'thirdPlace';
  label: string;
  team: ITeamRef;
  hit: boolean | null;
}

type RowState = 'exact' | 'partial' | 'miss' | null;

/**
 * Leitura de um Pick'em de fase (Palpitão) com o feedback de acerto por item:
 * tabela (posições previstas) ou bracket (árvore espelhada + terminais).
 */
@Component({
  selector: 'app-pickem-view',
  standalone: true,
  imports: [LucideAngularModule, TeamBadgeComponent, BracketTreeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pickem-view.component.html',
  styleUrl: './pickem-view.component.scss',
})
export class PickemViewComponent {
  public readonly pickem = input.required<IPhasePredictionResponse>();
  /** Formato do bracket (do template); null = derivar dos palpites. */
  public readonly totalRounds = input<number | null>(null);

  protected readonly trophyIcon = Trophy;
  protected readonly awardIcon = Award;
  protected readonly medalIcon = Medal;
  protected readonly checkIcon = Check;
  protected readonly xIcon = X;

  protected readonly isTable = computed(
    () => this.pickem().phaseType !== 'KNOCKOUT',
  );

  /** Posições agrupadas por grupo (RR: bloco único). */
  protected readonly positionBlocks = computed<IPositionBlockVM[]>(() => {
    const blocks = new Map<string, IPositionBlockVM>();
    for (const row of this.pickem().positions) {
      const key = row.groupId ?? '__all__';
      let block = blocks.get(key);
      if (!block) {
        block = { key, groupName: row.groupName, rows: [] };
        blocks.set(key, block);
      }
      block.rows.push(row);
    }
    const out = Array.from(blocks.values());
    for (const block of out) {
      block.rows.sort((a, b) => a.predictedPosition - b.predictedPosition);
    }
    return out.sort((a, b) =>
      (a.groupName ?? '').localeCompare(b.groupName ?? ''),
    );
  });

  protected rowState(row: IPositionRow): RowState {
    const o = row.outcome;
    if (!o || o.qualifiedHit === null) return null;
    if (o.exactPositionHit) return 'exact';
    if (o.qualifiedHit) return 'partial';
    return 'miss';
  }

  private _tieToSlot(row: ITieRow): IBracketTreeSlot {
    return {
      roundNumber: row.roundNumber,
      slotIndex: row.slotIndex,
      matchType: row.matchType,
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
      winnerTeamId: row.winnerTeam.id,
      outcome: row.outcome?.matchup ?? null,
      winnerAdvanced: row.outcome?.winnerAdvanced ?? null,
      pointsAwarded: row.outcome?.pointsAwarded ?? null,
    };
  }

  /** Árvore do bracket a partir dos palpites gravados. */
  protected readonly tree = computed<IBracketTreeData | null>(() => {
    const p = this.pickem();
    if (p.phaseType !== 'KNOCKOUT' || p.ties.length === 0) return null;

    const regular = p.ties.filter((t) => t.matchType === 'REGULAR');
    const maxRound = regular.reduce((m, t) => Math.max(m, t.roundNumber), 1);
    const total = Math.max(this.totalRounds() ?? maxRound, maxRound);

    const byRound = new Map<number, IBracketTreeSlot[]>();
    for (const row of regular) {
      const list = byRound.get(row.roundNumber) ?? [];
      list.push(this._tieToSlot(row));
      byRound.set(row.roundNumber, list);
    }
    const rounds = Array.from(byRound.entries())
      .map(([roundNumber, slots]) => ({ roundNumber, name: '', slots }))
      .sort((a, b) => a.roundNumber - b.roundNumber);

    const thirdRow = p.ties.find((t) => t.matchType === 'THIRD_PLACE') ?? null;
    const finalRow =
      regular.find((t) => t.roundNumber === total && t.slotIndex === 0) ?? null;

    const champion = finalRow?.winnerTeam ?? null;
    const runnerUp =
      finalRow && champion
        ? (finalRow.homeTeam.id === champion.id
            ? finalRow.awayTeam
            : finalRow.homeTeam)
        : null;

    return {
      totalRounds: total,
      rounds,
      thirdPlace: thirdRow ? this._tieToSlot(thirdRow) : null,
      champion,
      runnerUp,
      thirdPlaceWinner: thirdRow?.winnerTeam ?? null,
      championHit: p.terminals?.championHit ?? null,
    };
  });

  /** Resumo dos terminais (campeão/vice/3º) com acerto. */
  protected readonly terminalRows = computed<ITerminalRowVM[]>(() => {
    const t = this.tree();
    if (!t) return [];
    const terminals = this.pickem().terminals;
    const rows: ITerminalRowVM[] = [];
    if (t.champion) {
      rows.push({
        key: 'champion',
        label: 'Campeão',
        team: t.champion,
        hit: terminals?.championHit ?? null,
      });
    }
    if (t.runnerUp) {
      rows.push({
        key: 'runnerUp',
        label: 'Vice',
        team: t.runnerUp,
        hit: terminals?.runnerUpHit ?? null,
      });
    }
    if (t.thirdPlaceWinner) {
      rows.push({
        key: 'thirdPlace',
        label: '3º lugar',
        team: t.thirdPlaceWinner,
        hit: terminals?.thirdPlaceHit ?? null,
      });
    }
    return rows;
  });

  protected terminalIcon(key: ITerminalRowVM['key']) {
    if (key === 'champion') return this.trophyIcon;
    if (key === 'runnerUp') return this.awardIcon;
    return this.medalIcon;
  }
}
