import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ITeamRef } from '@core/interfaces/match.interface';
import { TeamBadgeComponent } from '@shared/components/team-badge/team-badge.component';
import { Check, LucideAngularModule, Medal, Trophy } from 'lucide-angular';
import {
  emptyTreeSlot,
  IBracketTreeData,
  IBracketTreeSlot,
} from './bracket-tree.model';

/** Escolha emitida no modo interativo (Pick'em). */
export interface IBracketTreePick {
  slot: IBracketTreeSlot;
  teamId: string;
}

interface IColumnVM {
  key: string;
  side: 'left' | 'right' | 'center';
  roundNumber: number;
  label: string;
  slots: IBracketTreeSlot[];
  /** Coluna com um único confronto (conector reto, sem junção em par). */
  lone: boolean;
  /** Recebe conector da rodada anterior. */
  hasPrev: boolean;
}

/** Rótulo curto da rodada pela quantidade de times que entram nela. */
function shortRoundLabel(roundNumber: number, totalRounds: number): string {
  const entering = Math.pow(2, totalRounds - roundNumber + 1);
  switch (entering) {
    case 2:
      return 'Final';
    case 4:
      return 'Semis';
    case 8:
      return 'Quartas';
    case 16:
      return 'Oitavas';
    case 32:
      return '16-avos';
    case 64:
      return '32-avos';
    default:
      return `Rodada ${roundNumber}`;
  }
}

/**
 * Árvore espelhada de mata-mata (estilo "bracket challenge"): as duas metades
 * convergem para a final no centro, com o card de campeão no topo e a disputa
 * de 3º lugar embaixo. Componente presentacional: o estado (escolhas do
 * Pick'em, chaveamento real) vive no pai.
 */
@Component({
  selector: 'app-bracket-tree',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink, LucideAngularModule, TeamBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bracket-tree.component.html',
  styleUrl: './bracket-tree.component.scss',
})
export class BracketTreeComponent {
  public readonly data = input.required<IBracketTreeData>();
  /** true = modo Pick'em (tocar num time o escolhe como vencedor). */
  public readonly interactive = input(false);
  public readonly tournamentId = input<string | null>(null);
  public readonly phaseId = input<string | null>(null);

  /** Modo interativo: time tocado num slot. */
  public readonly teamPick = output<IBracketTreePick>();
  /** Modo leitura: confronto aberto (id da partida, para lembrar retorno). */
  public readonly slotOpen = output<string>();

  protected readonly trophyIcon = Trophy;
  protected readonly medalIcon = Medal;
  protected readonly checkIcon = Check;

  protected readonly columns = computed<IColumnVM[]>(() => {
    const d = this.data();
    const total = d.totalRounds;
    if (total < 1) return [];
    const byRound = new Map(d.rounds.map((r) => [r.roundNumber, r]));

    const slotsOf = (r: number): IBracketTreeSlot[] => {
      const expected = Math.pow(2, total - r);
      const provided = byRound.get(r)?.slots ?? [];
      const out: IBracketTreeSlot[] = [];
      for (let i = 0; i < expected; i++) {
        out.push(
          provided.find((s) => s.slotIndex === i) ?? emptyTreeSlot(r, i),
        );
      }
      return out;
    };

    const cols: IColumnVM[] = [];
    for (let r = 1; r < total; r++) {
      const all = slotsOf(r);
      const half = all.length / 2;
      cols.push({
        key: `L${r}`,
        side: 'left',
        roundNumber: r,
        label: shortRoundLabel(r, total),
        slots: all.slice(0, half),
        lone: half === 1,
        hasPrev: r > 1,
      });
    }
    cols.push({
      key: 'C',
      side: 'center',
      roundNumber: total,
      label: 'Final',
      slots: slotsOf(total),
      lone: true,
      hasPrev: total > 1,
    });
    for (let r = total - 1; r >= 1; r--) {
      const all = slotsOf(r);
      const half = all.length / 2;
      cols.push({
        key: `R${r}`,
        side: 'right',
        roundNumber: r,
        label: shortRoundLabel(r, total),
        slots: all.slice(half),
        lone: half === 1,
        hasPrev: r > 1,
      });
    }
    return cols;
  });

  protected readonly columnCount = computed(() => this.columns().length);

  /** Template do grid: laterais compactas, coluna central mais larga. */
  protected readonly gridTemplate = computed(() => {
    const n = (this.columnCount() - 1) / 2;
    if (n <= 0) return 'minmax(0, 1fr)';
    const side = `repeat(${n}, minmax(var(--bt-colmin), 1fr))`;
    return `${side} minmax(var(--bt-colcenter), 1.6fr) ${side}`;
  });

  protected readonly finalSlot = computed<IBracketTreeSlot | null>(() => {
    const d = this.data();
    const final = d.rounds.find((r) => r.roundNumber === d.totalRounds);
    return final?.slots[0] ?? null;
  });

  protected slotKey(slot: IBracketTreeSlot): string {
    return `${slot.roundNumber}:${slot.slotIndex}:${slot.matchType}`;
  }

  protected isWinner(slot: IBracketTreeSlot, team: ITeamRef | null): boolean {
    return !!team && slot.winnerTeamId === team.id;
  }

  protected isLoser(slot: IBracketTreeSlot, team: ITeamRef | null): boolean {
    return !!team && !!slot.winnerTeamId && slot.winnerTeamId !== team.id;
  }

  protected canPick(slot: IBracketTreeSlot, team: ITeamRef | null): boolean {
    return this.interactive() && !!team && slot.pickable !== false;
  }

  protected pickTeam(slot: IBracketTreeSlot, team: ITeamRef | null): void {
    if (!this.canPick(slot, team) || !team) return;
    this.teamPick.emit({ slot, teamId: team.id });
  }

  /** Link para a partida (modo leitura do chaveamento real). */
  protected slotLink(slot: IBracketTreeSlot): string | null {
    if (this.interactive()) return null;
    const tid = this.tournamentId();
    const pid = this.phaseId();
    if (!tid || !pid || !slot.matchId) return null;
    return `/tournaments/${tid}/phases/${pid}/matches/${slot.matchId}`;
  }

  protected onOpen(slot: IBracketTreeSlot): void {
    if (slot.matchId) this.slotOpen.emit(slot.matchId);
  }

  protected scoreOf(
    slot: IBracketTreeSlot,
    side: 'home' | 'away',
  ): string | null {
    return (side === 'home' ? slot.homeScore : slot.awayScore) ?? null;
  }

  protected pensOf(
    slot: IBracketTreeSlot,
    side: 'home' | 'away',
  ): number | null {
    return (side === 'home' ? slot.homePenalties : slot.awayPenalties) ?? null;
  }
}
