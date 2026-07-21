import {
  knockoutLegLabel,
  knockoutMatchBucketLabel,
  knockoutRoundLabelByTieCount,
  knockoutStageForRound,
  knockoutStageOptions,
} from './round-label';

describe('knockoutStageForRound', () => {
  it('mapeia jogo único (16 times): 1 round por etapa', () => {
    const s = (r: number) => knockoutStageForRound(r, 16, 'SINGLE', null);
    expect(s(1)).toEqual({ stageOrdinal: 1, legIndex: 0, legTotal: 1 }); // oitavas
    expect(s(2)).toEqual({ stageOrdinal: 2, legIndex: 0, legTotal: 1 }); // quartas
    expect(s(3)).toEqual({ stageOrdinal: 3, legIndex: 0, legTotal: 1 }); // semis
    expect(s(4)).toEqual({ stageOrdinal: 4, legIndex: 0, legTotal: 1 }); // final
  });

  it('mapeia ida-e-volta (16 times): 2 rounds por etapa — a volta NÃO vira a próxima etapa', () => {
    const s = (r: number) => knockoutStageForRound(r, 16, 'TWO_LEGGED', null);
    expect(s(1)).toEqual({ stageOrdinal: 1, legIndex: 0, legTotal: 2 }); // oitavas ida
    expect(s(2)).toEqual({ stageOrdinal: 1, legIndex: 1, legTotal: 2 }); // oitavas VOLTA (era rotulada "quartas")
    expect(s(3)).toEqual({ stageOrdinal: 2, legIndex: 0, legTotal: 2 }); // quartas ida
    expect(s(4)).toEqual({ stageOrdinal: 2, legIndex: 1, legTotal: 2 }); // quartas volta
    expect(s(5)).toEqual({ stageOrdinal: 3, legIndex: 0, legTotal: 2 }); // semis ida
    expect(s(6)).toEqual({ stageOrdinal: 3, legIndex: 1, legTotal: 2 }); // semis volta
    expect(s(7)).toEqual({ stageOrdinal: 4, legIndex: 0, legTotal: 2 }); // final ida
    expect(s(8)).toEqual({ stageOrdinal: 4, legIndex: 1, legTotal: 2 }); // final volta
  });

  it('respeita finalLegMode: fase ida-e-volta com final em jogo único', () => {
    const s = (r: number) =>
      knockoutStageForRound(r, 16, 'TWO_LEGGED', 'SINGLE');
    expect(s(6)).toEqual({ stageOrdinal: 3, legIndex: 1, legTotal: 2 }); // semis volta
    expect(s(7)).toEqual({ stageOrdinal: 4, legIndex: 0, legTotal: 1 }); // final (jogo único)
    expect(s(8)).toBeNull(); // não existe volta da final
  });

  it('respeita finalLegMode: fase jogo único com final em ida-e-volta', () => {
    const s = (r: number) =>
      knockoutStageForRound(r, 16, 'SINGLE', 'TWO_LEGGED');
    expect(s(3)).toEqual({ stageOrdinal: 3, legIndex: 0, legTotal: 1 }); // semis (único)
    expect(s(4)).toEqual({ stageOrdinal: 4, legIndex: 0, legTotal: 2 }); // final ida
    expect(s(5)).toEqual({ stageOrdinal: 4, legIndex: 1, legTotal: 2 }); // final volta
  });

  it('fase só de final (2 times) em ida-e-volta', () => {
    const s = (r: number) => knockoutStageForRound(r, 2, 'TWO_LEGGED', null);
    expect(s(1)).toEqual({ stageOrdinal: 1, legIndex: 0, legTotal: 2 });
    expect(s(2)).toEqual({ stageOrdinal: 1, legIndex: 1, legTotal: 2 });
  });

  it('estrutura não potência de 2 → null (chamador cai em "Rodada N")', () => {
    expect(knockoutStageForRound(1, 6, 'SINGLE', null)).toBeNull();
    expect(knockoutStageForRound(0, 16, 'SINGLE', null)).toBeNull();
  });
});

describe('knockoutRoundLabelByTieCount', () => {
  it('nomeia a etapa pelo nº de confrontos da rodada (REDRAW)', () => {
    expect(knockoutRoundLabelByTieCount(1)).toBe('Final');
    expect(knockoutRoundLabelByTieCount(2)).toBe('Semifinais');
    expect(knockoutRoundLabelByTieCount(4)).toBe('Quartas de final');
    expect(knockoutRoundLabelByTieCount(8)).toBe('Oitavas de final');
    expect(knockoutRoundLabelByTieCount(16)).toBe('16-avos de final');
  });

  it('retorna null quando a contagem não mapeia numa etapa nomeada', () => {
    expect(knockoutRoundLabelByTieCount(3)).toBeNull(); // 6 times
    expect(knockoutRoundLabelByTieCount(12)).toBeNull(); // 24 times
    expect(knockoutRoundLabelByTieCount(0)).toBeNull();
    expect(knockoutRoundLabelByTieCount(-1)).toBeNull();
  });
});

describe('knockoutLegLabel', () => {
  it('rotula ida/volta/único', () => {
    expect(knockoutLegLabel(0, 1)).toBe('Jogo único');
    expect(knockoutLegLabel(0, 2)).toBe('Ida');
    expect(knockoutLegLabel(1, 2)).toBe('Volta');
  });
});

describe('knockoutMatchBucketLabel', () => {
  it('rotula a etapa com a perna em ida-e-volta (16 times)', () => {
    const l = (r: number) =>
      knockoutMatchBucketLabel(r, false, 16, 'TWO_LEGGED', null);
    expect(l(1)).toBe('Oitavas de final · Ida');
    expect(l(2)).toBe('Oitavas de final · Volta'); // antes: "Quartas de final"
    expect(l(3)).toBe('Quartas de final · Ida');
    expect(l(8)).toBe('Final · Volta');
  });

  it('rotula a etapa sem perna em jogo único', () => {
    const l = (r: number) =>
      knockoutMatchBucketLabel(r, false, 16, 'SINGLE', null);
    expect(l(1)).toBe('Oitavas de final');
    expect(l(2)).toBe('Quartas de final');
    expect(l(4)).toBe('Final');
  });

  it('disputa de 3º lugar acompanha a perna da final', () => {
    expect(knockoutMatchBucketLabel(7, true, 16, 'TWO_LEGGED', null)).toBe(
      'Disputa de 3º lugar · Ida',
    );
    expect(knockoutMatchBucketLabel(4, true, 16, 'SINGLE', null)).toBe(
      'Disputa de 3º lugar',
    );
  });
});

describe('knockoutStageOptions', () => {
  it('jogo único (16 times): 1 opção por etapa, round = ordinal', () => {
    const opts = knockoutStageOptions(16, 'SINGLE', null);
    expect(opts.map((o) => [o.round, o.label])).toEqual([
      [1, 'Oitavas de final'],
      [2, 'Quartas de final'],
      [3, 'Semifinais'],
      [4, 'Final'],
    ]);
  });

  it('ida-e-volta (16 times): 2 opções por etapa com rounds crus sequenciais', () => {
    const opts = knockoutStageOptions(16, 'TWO_LEGGED', null);
    expect(opts.map((o) => [o.round, o.label])).toEqual([
      [1, 'Oitavas de final · Ida'],
      [2, 'Oitavas de final · Volta'],
      [3, 'Quartas de final · Ida'],
      [4, 'Quartas de final · Volta'],
      [5, 'Semifinais · Ida'],
      [6, 'Semifinais · Volta'],
      [7, 'Final · Ida'],
      [8, 'Final · Volta'],
    ]);
  });

  it('final com modo próprio (fase ida-e-volta, final jogo único)', () => {
    const opts = knockoutStageOptions(16, 'TWO_LEGGED', 'SINGLE');
    const final = opts.filter((o) => o.stageOrdinal === 4);
    expect(final).toEqual([
      { round: 7, matchType: 'REGULAR', stageOrdinal: 4, legIndex: 0, legTotal: 1, label: 'Final' },
    ]);
  });

  it('inclui disputa de 3º lugar acompanhando a perna da final', () => {
    const opts = knockoutStageOptions(16, 'TWO_LEGGED', null, true);
    const third = opts.filter((o) => o.matchType === 'THIRD_PLACE');
    expect(third.map((o) => [o.round, o.label])).toEqual([
      [7, 'Disputa de 3º lugar · Ida'],
      [8, 'Disputa de 3º lugar · Volta'],
    ]);
  });

  it('estrutura não potência de 2 → []', () => {
    expect(knockoutStageOptions(6, 'SINGLE', null)).toEqual([]);
  });

  it('opções são consistentes com knockoutStageForRound', () => {
    for (const mode of ['SINGLE', 'TWO_LEGGED'] as const) {
      const opts = knockoutStageOptions(16, mode, null);
      for (const o of opts) {
        const info = knockoutStageForRound(o.round, 16, mode, null);
        expect(info).toEqual({
          stageOrdinal: o.stageOrdinal,
          legIndex: o.legIndex,
          legTotal: o.legTotal,
        });
      }
    }
  });
});
