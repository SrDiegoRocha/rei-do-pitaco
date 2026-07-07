import {
  animate,
  animateChild,
  group,
  query,
  stagger,
  style,
  transition,
  trigger,
} from '@angular/animations';

const EASE_OUT = 'cubic-bezier(0.4, 0, 0.2, 1)';
const EASE_DECEL = 'cubic-bezier(0, 0, 0.2, 1)';
// Overshoot elástico leve — dá um "pop" ao mudar o placar.
const EASE_SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

/**
 * Fade cruzado entre rotas irmãs. Aplicar no container do `<router-outlet>` com
 * `[@routeFade]="getRouteAnimationData()"` para disparar a cada troca.
 */
export const routeFade = trigger('routeFade', [
  transition('* <=> *', [
    style({ position: 'relative' }),
    query(
      ':enter, :leave',
      [
        style({
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          width: '100%',
        }),
      ],
      { optional: true },
    ),
    query(':enter', [style({ opacity: 0 })], { optional: true }),
    query(':leave', animateChild(), { optional: true }),
    group([
      query(
        ':leave',
        [animate(`160ms ${EASE_OUT}`, style({ opacity: 0 }))],
        { optional: true },
      ),
      query(
        ':enter',
        [animate(`200ms ${EASE_OUT}`, style({ opacity: 1 }))],
        { optional: true },
      ),
    ]),
    query(':enter', animateChild(), { optional: true }),
  ]),
]);

/**
 * Stagger pra listas. Aplica-se no container com `[@listStagger]="items().length"`.
 * Cada filho que entra ganha fade + slide up, com 40ms entre eles.
 */
export const listStagger = trigger('listStagger', [
  transition('* => *', [
    query(
      ':enter',
      [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        stagger('40ms', [
          animate(
            `260ms ${EASE_OUT}`,
            style({ opacity: 1, transform: 'translateY(0)' }),
          ),
        ]),
      ],
      { optional: true },
    ),
  ]),
]);

/**
 * Slide horizontal direcional entre as seções principais + fade para o resto.
 *
 * Use vinculando ao índice numérico da seção quando estiver numa delas, ou a
 * uma string (o path) nas demais rotas: `[@routeSections]="getRouteState()"`.
 * Avançar de seção (índice maior) → nova página entra pela direita; voltar →
 * entra pela esquerda. Transições de/para rotas não-seção caem no fade.
 */
function routeSlide(direction: 'forward' | 'back') {
  const enterFrom = direction === 'forward' ? '100%' : '-100%';
  const leaveTo = direction === 'forward' ? '-100%' : '100%';
  return [
    style({ position: 'relative' }),
    query(
      ':enter, :leave',
      [
        style({
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          width: '100%',
        }),
      ],
      { optional: true },
    ),
    query(
      ':enter',
      [style({ transform: `translateX(${enterFrom})`, opacity: 0.5 })],
      { optional: true },
    ),
    group([
      query(
        ':leave',
        [
          animate(
            `280ms ${EASE_OUT}`,
            style({ transform: `translateX(${leaveTo})`, opacity: 0.5 }),
          ),
        ],
        { optional: true },
      ),
      query(
        ':enter',
        [
          animate(
            `280ms ${EASE_OUT}`,
            style({ transform: 'translateX(0)', opacity: 1 }),
          ),
        ],
        { optional: true },
      ),
    ]),
  ];
}

export const routeSections = trigger('routeSections', [
  transition(':increment', routeSlide('forward')),
  transition(':decrement', routeSlide('back')),
  // Demais trocas de rota: fade cruzado (igual ao routeFade).
  transition('* <=> *', [
    style({ position: 'relative' }),
    query(
      ':enter, :leave',
      [
        style({
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          width: '100%',
        }),
      ],
      { optional: true },
    ),
    query(':enter', [style({ opacity: 0 })], { optional: true }),
    query(':leave', animateChild(), { optional: true }),
    group([
      query(':leave', [animate(`160ms ${EASE_OUT}`, style({ opacity: 0 }))], {
        optional: true,
      }),
      query(':enter', [animate(`200ms ${EASE_OUT}`, style({ opacity: 1 }))], {
        optional: true,
      }),
    ]),
    query(':enter', animateChild(), { optional: true }),
  ]),
]);

/**
 * Modal/dialog enter (scale + fade). Aplica-se no elemento renderizado por @if.
 */
export const modalScale = trigger('modalScale', [
  transition(':enter', [
    style({ opacity: 0, transform: 'scale(0.96) translateY(8px)' }),
    animate(
      `200ms ${EASE_DECEL}`,
      style({ opacity: 1, transform: 'scale(1) translateY(0)' }),
    ),
  ]),
  transition(':leave', [
    animate(
      `150ms ${EASE_OUT}`,
      style({ opacity: 0, transform: 'scale(0.96) translateY(4px)' }),
    ),
  ]),
]);

/**
 * Fade puro para modais cujo `transform` é controlado por outra fonte
 * (ex.: bottom-sheet arrastável). Não anima transform para não conflitar.
 */
export const dialogFade = trigger('dialogFade', [
  transition(':enter', [
    style({ opacity: 0 }),
    animate(`180ms ${EASE_DECEL}`, style({ opacity: 1 })),
  ]),
  transition(':leave', [
    animate(`140ms ${EASE_OUT}`, style({ opacity: 0 })),
  ]),
]);

/**
 * Backdrop overlay enter/leave fade.
 */
export const backdropFade = trigger('backdropFade', [
  transition(':enter', [
    style({ opacity: 0 }),
    animate(`160ms ${EASE_OUT}`, style({ opacity: 1 })),
  ]),
  transition(':leave', [animate(`120ms ${EASE_OUT}`, style({ opacity: 0 }))]),
]);

/**
 * Toast/snackbar slide in/out. Mobile: bottom. Desktop: right.
 */
export const toastSlide = trigger('toastSlide', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(20px)' }),
    animate(
      `220ms ${EASE_DECEL}`,
      style({ opacity: 1, transform: 'translateY(0)' }),
    ),
  ]),
  transition(':leave', [
    animate(
      `160ms ${EASE_OUT}`,
      style({ opacity: 0, transform: 'translateY(8px) scale(0.97)' }),
    ),
  ]),
]);

/**
 * Slide direcional entre abas, disparado por mudança do índice numérico da aba
 * ativa: `[@tabSlide]="activeTabIndex()"`. Avançar (índice maior) entra pela
 * direita; voltar (índice menor) entra pela esquerda. Vale para swipe e clique.
 */
export const tabSlide = trigger('tabSlide', [
  transition(':increment', [
    style({ transform: 'translateX(28px)', opacity: 0 }),
    animate(
      `240ms ${EASE_OUT}`,
      style({ transform: 'translateX(0)', opacity: 1 }),
    ),
  ]),
  transition(':decrement', [
    style({ transform: 'translateX(-28px)', opacity: 0 }),
    animate(
      `240ms ${EASE_OUT}`,
      style({ transform: 'translateX(0)', opacity: 1 }),
    ),
  ]),
]);

/**
 * Expande/colapsa uma seção condicional (prorrogação, pênaltis) suavemente,
 * animando altura + opacidade + margem — em vez do "pulo" instantâneo quando o
 * bloco entra ou sai do DOM.
 *
 * Requer que o espaçamento entre os irmãos venha de `margin-top` (não do `gap`
 * do flex): o `gap` não é animável por item e deixaria um vão fantasma no fim
 * da animação. Como o projeto usa `box-sizing: border-box`, animar `height`
 * até 0 colapsa também padding e borda do bloco.
 */
export const collapseSection = trigger('collapseSection', [
  transition(':enter', [
    style({ height: '0', opacity: 0, marginTop: '0', overflow: 'hidden' }),
    animate(
      `260ms ${EASE_DECEL}`,
      style({ height: '*', opacity: 1, marginTop: '*' }),
    ),
  ]),
  transition(':leave', [
    style({ overflow: 'hidden' }),
    animate(
      `200ms ${EASE_OUT}`,
      style({ height: '0', opacity: 0, marginTop: '0' }),
    ),
  ]),
]);

/**
 * Pulso ao mudar o placar: cresce ao incrementar, encolhe ao decrementar, com
 * um leve overshoot elástico. Vincule ao valor numérico do campo:
 * `[@scorePulse]="homeScore()"`. Não dispara na abertura (só em mudanças).
 */
export const scorePulse = trigger('scorePulse', [
  transition(':increment', [
    style({ transform: 'scale(1.22)' }),
    animate(`260ms ${EASE_SPRING}`, style({ transform: 'scale(1)' })),
  ]),
  transition(':decrement', [
    style({ transform: 'scale(0.82)' }),
    animate(`260ms ${EASE_SPRING}`, style({ transform: 'scale(1)' })),
  ]),
]);

/**
 * Bottom sheet slide up (mobile).
 */
export const sheetSlideUp = trigger('sheetSlideUp', [
  transition(':enter', [
    style({ transform: 'translateY(100%)' }),
    animate(`250ms ${EASE_DECEL}`, style({ transform: 'translateY(0)' })),
  ]),
  transition(':leave', [
    animate(`200ms ${EASE_OUT}`, style({ transform: 'translateY(100%)' })),
  ]),
]);
