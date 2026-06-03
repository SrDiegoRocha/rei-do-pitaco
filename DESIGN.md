# Rei do Pitaco — Design System

Documento de design para alimentar geração de UI (Stitch / IA de design). Cobre tokens, componentes base, layouts e cada tela do app. Plataforma alvo: **Angular 21 PWA mobile-first** (Chrome/Opera Android, Safari iOS) com suporte completo a desktop. Temas claro e escuro com cor primária verde.

---

## 1. Princípios

1. **Mobile-first sempre**. Layouts começam pelo celular (375–428 px) e expandem para tablet (768+) e desktop (1280+). Cada tela tem variante para os 3 tamanhos.
2. **PWA instalável**. App-like — sem chrome de navegador na experiência ideal. Bottom navigation no mobile, sidebar no desktop, splash screen consistente, ícones em todos os tamanhos.
3. **Padronização absoluta**. Nada de cor/font/espaçamento hardcoded em componente. Tudo passa por tokens (CSS variables) que mudam entre tema claro e escuro.
4. **Acessibilidade não negociável**. Contraste mínimo AA, áreas de toque ≥ 44×44 px, foco visível, suporte a leitor de tela, prefers-reduced-motion respeitado.
5. **Tipografia que escala**. Mobile usa fontes menores naturalmente; desktop usa maiores. Mas a hierarquia visual (h1 > h2 > body > caption) é preservada.
6. **Performance percebida**. Skeleton screens em vez de spinners onde possível. Transições curtas (150–200ms). Otimização para 60fps em devices baixos.
7. **Tom da marca**: competitivo mas amistoso. Verde de campo de futebol. Numerais com fonte tabular para placares.

---

## 2. Tokens — Cores

### 2.1 Paleta principal — **Pitch Green** (verde do gramado)

Cor da marca. Aplicada em CTAs, headers ativos, marcadores de vitória, badges de status positivo.

| Token | Hex | Uso típico |
| ----- | --- | ---------- |
| `--green-50` | `#ECFDF5` | Backgrounds muito sutis em light, hover states |
| `--green-100` | `#D1FAE5` | Highlights de cards em light, badge backgrounds |
| `--green-200` | `#A7F3D0` | Bordas sutis, dividers ativos |
| `--green-300` | `#6EE7B7` | Ilustrações, gradient stops |
| `--green-400` | `#34D399` | Ícones em dark, gradientes |
| `--green-500` | `#10B981` | **Primary brand color** |
| `--green-600` | `#059669` | Primary hover, primary press |
| `--green-700` | `#047857` | Texto sobre fundos green-100/200 |
| `--green-800` | `#065F46` | Headers em dark sobre superfícies elevadas |
| `--green-900` | `#064E3B` | Áreas decorativas no dark |
| `--green-950` | `#022C22` | Backgrounds tonalizados em dark |

### 2.2 Paleta de destaque — **Trophy Amber** (troféu / acerto exato)

Reservada para conquistas — acerto de placar exato, ícone de troféu no ranking, indicadores de "destaque do torneio".

| Token | Hex |
| ----- | --- |
| `--amber-50` | `#FFFBEB` |
| `--amber-100` | `#FEF3C7` |
| `--amber-200` | `#FDE68A` |
| `--amber-300` | `#FCD34D` |
| `--amber-400` | `#FBBF24` |
| `--amber-500` | `#F59E0B` |
| `--amber-600` | `#D97706` |
| `--amber-700` | `#B45309` |
| `--amber-800` | `#92400E` |
| `--amber-900` | `#78350F` |

### 2.3 Neutros — **Court Gray**

Texto, bordas, surfaces, divisores.

| Token | Hex |
| ----- | --- |
| `--gray-50` | `#F8FAFC` |
| `--gray-100` | `#F1F5F9` |
| `--gray-200` | `#E2E8F0` |
| `--gray-300` | `#CBD5E1` |
| `--gray-400` | `#94A3B8` |
| `--gray-500` | `#64748B` |
| `--gray-600` | `#475569` |
| `--gray-700` | `#334155` |
| `--gray-800` | `#1E293B` |
| `--gray-900` | `#0F172A` |
| `--gray-950` | `#020617` |

### 2.4 Semânticas

| Token | Light | Dark | Uso |
| ----- | ----- | ---- | --- |
| `--success` | `#10B981` (green-500) | `#34D399` (green-400) | Confirmações, vitória, acerto |
| `--warning` | `#F59E0B` (amber-500) | `#FBBF24` (amber-400) | Atenção, deadline próximo |
| `--danger` | `#DC2626` (red-600) | `#F87171` (red-400) | Erro, ban, eliminação, derrota |
| `--info` | `#2563EB` (blue-600) | `#60A5FA` (blue-400) | Mensagens neutras, dicas |

Cores complementares:

- **Red** (erro/derrota): `#FEF2F2`, `#FEE2E2`, `#FECACA`, `#FCA5A5`, `#F87171`, `#EF4444`, `#DC2626`, `#B91C1C`, `#991B1B`, `#7F1D1D`.
- **Blue** (info): `#EFF6FF`, `#DBEAFE`, `#BFDBFE`, `#93C5FD`, `#60A5FA`, `#3B82F6`, `#2563EB`, `#1D4ED8`, `#1E40AF`, `#1E3A8A`.

### 2.5 Atribuição por tema

#### Light theme (default)

```css
:root, [data-theme="light"] {
  --bg-base:        #FFFFFF;
  --bg-surface:     #F8FAFC;   /* cards, panels */
  --bg-elevated:    #FFFFFF;   /* modais, popovers acima do surface */
  --bg-muted:       #F1F5F9;   /* inputs vazios, áreas de fundo secundárias */
  --bg-accent-subtle: #ECFDF5; /* cards com toque verde */

  --text-primary:   #0F172A;
  --text-secondary: #475569;
  --text-muted:     #64748B;
  --text-inverse:   #FFFFFF;
  --text-on-brand:  #FFFFFF;

  --border-default: #E2E8F0;
  --border-strong:  #CBD5E1;
  --border-brand:   #10B981;
  --border-focus:   #10B981;

  --brand:          #10B981;
  --brand-hover:    #059669;
  --brand-press:    #047857;
  --brand-subtle:   #ECFDF5;

  --accent:         #F59E0B;
  --accent-subtle:  #FFFBEB;

  --overlay:        rgba(15, 23, 42, 0.45);
}
```

#### Dark theme

```css
[data-theme="dark"] {
  --bg-base:        #0A0F0A;    /* verde-quase-preto sutil, não preto puro */
  --bg-surface:     #14201A;    /* cards */
  --bg-elevated:    #1C2A23;    /* modais */
  --bg-muted:       #1E2E26;
  --bg-accent-subtle: #022C22;

  --text-primary:   #F8FAFC;
  --text-secondary: #CBD5E1;
  --text-muted:     #94A3B8;
  --text-inverse:   #0F172A;
  --text-on-brand:  #022C22;     /* texto escuro sobre o verde brilhante */

  --border-default: #1E2E26;
  --border-strong:  #334155;
  --border-brand:   #34D399;
  --border-focus:   #34D399;

  --brand:          #34D399;     /* verde mais claro no dark para garantir contraste */
  --brand-hover:    #10B981;
  --brand-press:    #059669;
  --brand-subtle:   #064E3B;

  --accent:         #FBBF24;
  --accent-subtle:  #78350F;

  --overlay:        rgba(0, 0, 0, 0.65);
}
```

A troca de tema é por atributo `data-theme="light|dark"` no `<html>`. Persistido em `localStorage`. Default segue `prefers-color-scheme`.

---

## 3. Tokens — Tipografia

### 3.1 Família

- **Sans (UI)**: `Inter`, fallback `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- **Mono / tabular (placares e números)**: `JetBrains Mono`, fallback `ui-monospace, "SF Mono", Menlo, monospace`.

Inter tem variação variable que pesa pouco e renderiza ótimo em PWA. JetBrains Mono é usado quando importa que dígitos tenham mesma largura (placar 2–1 alinhado com 12–10).

### 3.2 Escala responsiva

Mobile-first. `clamp()` em CSS para escalar suave entre breakpoints. Base `1rem = 16px` em desktop; em mobile o `<html>` recebe `font-size: 14px` para encolher tudo proporcionalmente (alternativa: usar `clamp` direto).

| Token | Mobile (≤ 767px) | Tablet/Desktop (≥ 768px) | Uso |
| ----- | ---------------- | ------------------------ | --- |
| `--text-xs` | 11px / 16px lh | 12px / 16px lh | Captions, metadata |
| `--text-sm` | 13px / 18px lh | 14px / 20px lh | Body secundário, labels de form |
| `--text-base` | 14px / 20px lh | 16px / 24px lh | Body padrão |
| `--text-lg` | 16px / 22px lh | 18px / 26px lh | Body destaque, lead text |
| `--text-xl` | 18px / 24px lh | 20px / 28px lh | Subtítulos |
| `--text-2xl` | 20px / 26px lh | 24px / 32px lh | Section headings |
| `--text-3xl` | 24px / 30px lh | 30px / 36px lh | Page headings |
| `--text-4xl` | 28px / 32px lh | 36px / 40px lh | Hero, números grandes |
| `--text-5xl` | 36px / 40px lh | 48px / 52px lh | Placares destacados |

### 3.3 Pesos

| Token | Weight |
| ----- | ------ |
| `--font-regular` | 400 |
| `--font-medium` | 500 |
| `--font-semibold` | 600 |
| `--font-bold` | 700 |

Letterspacing default: `0`. Em headings maiores (`--text-3xl`+) usar `-0.01em` para apertar.

### 3.4 Estilos nomeados

| Nome | Token | Weight | Uso |
| ---- | ----- | ------ | --- |
| Display | `--text-4xl` ou `--text-5xl` | bold | Hero de splash, placares destaque |
| H1 | `--text-3xl` | bold | Page title |
| H2 | `--text-2xl` | semibold | Section heading |
| H3 | `--text-xl` | semibold | Subseções, card titles |
| H4 | `--text-lg` | semibold | Sub-cards |
| Body | `--text-base` | regular | Texto padrão |
| Body strong | `--text-base` | semibold | Destaques em parágrafo |
| Caption | `--text-xs` | medium | Metadata abaixo de cards |
| Label | `--text-sm` | medium | Form labels |
| Number / Score | `--text-4xl` mono | bold | Placar de match |
| Tabular small | `--text-sm` mono | medium | Tabelas, standings |

---

## 4. Tokens — Espaçamento

Escala baseada em 4px. CSS custom properties.

```css
--space-0:  0;
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-7:  28px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
--space-20: 80px;
--space-24: 96px;
```

**Convenções**:
- Padding interno de card: `--space-4` (16) em mobile, `--space-6` (24) em desktop.
- Gap entre seções: `--space-6` em mobile, `--space-10` em desktop.
- Padding lateral da viewport (margem segura): `--space-4` em mobile (16), `--space-8` (32) em tablet, max-width centralizado em desktop (ver §5).

---

## 5. Tokens — Layout / Breakpoints

```css
--bp-sm:  640px;   /* large phones landscape */
--bp-md:  768px;   /* tablets */
--bp-lg:  1024px;  /* small laptops */
--bp-xl:  1280px;  /* desktops */
--bp-2xl: 1536px;  /* large desktops */
```

**Containers**:

- Mobile (default): `width: 100%` com padding lateral `--space-4`.
- Tablet (≥ 768): `max-width: 720px`, centralizado, padding `--space-6`.
- Desktop (≥ 1024): `max-width: 960px`, padding `--space-8`.
- XL (≥ 1280): `max-width: 1120px` para conteúdo principal; sidebar opcional fora desse container.

**Safe areas iOS**: padding-top/bottom usando `env(safe-area-inset-*)`.

---

## 6. Tokens — Bordas e raios

```css
--radius-none: 0;
--radius-sm:   4px;     /* badges, tags pequenos */
--radius-md:   8px;     /* inputs, botões padrão */
--radius-lg:   12px;    /* cards */
--radius-xl:   16px;    /* cards destaque, modais */
--radius-2xl:  24px;    /* bottom sheets */
--radius-full: 9999px;  /* avatares, FAB, pills */
```

Bordas (espessura) padrão `1px`. Em dark theme, contar mais com `--bg-surface` contrastante e menos com bordas (bordas em dark ficam muito visíveis).

---

## 7. Tokens — Sombras

Sombras com cor neutra em light, e quase ausentes em dark (substituídas por elevação via cor de fundo).

```css
/* Light */
--shadow-xs: 0 1px 2px rgba(15, 23, 42, 0.04);
--shadow-sm: 0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04);
--shadow-md: 0 4px 6px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.04);
--shadow-lg: 0 10px 15px rgba(15, 23, 42, 0.10), 0 4px 6px rgba(15, 23, 42, 0.04);
--shadow-xl: 0 20px 25px rgba(15, 23, 42, 0.12), 0 10px 10px rgba(15, 23, 42, 0.04);

/* Dark — quase sem sombra, depender de bg-elevated */
--shadow-xs-dark: 0 1px 2px rgba(0, 0, 0, 0.30);
--shadow-sm-dark: 0 1px 3px rgba(0, 0, 0, 0.35);
--shadow-md-dark: 0 4px 6px rgba(0, 0, 0, 0.40);
```

---

## 8. Tokens — Z-index

```css
--z-base:    0;
--z-dropdown: 100;
--z-sticky:   200;
--z-overlay:  900;
--z-modal:   1000;
--z-toast:   1100;
--z-tooltip: 1200;
```

---

## 9. Tokens — Motion

```css
--duration-fast:    150ms;
--duration-base:    200ms;
--duration-slow:    300ms;

--easing-default: cubic-bezier(0.4, 0, 0.2, 1);  /* ease-out-quart-ish */
--easing-emphasis: cubic-bezier(0.2, 0, 0.13, 1.5);
--easing-decel:   cubic-bezier(0, 0, 0.2, 1);
```

**Respeitar `prefers-reduced-motion: reduce`** → reduzir durações a `1ms` ou desligar transforms.

---

## 10. Iconografia

- **Biblioteca**: Lucide (consistente, traço fino, license MIT). Tamanho default 20px em mobile, 24px em desktop. Stroke width 2.
- **Ícones-chave** do app: `trophy`, `flag`, `users`, `user`, `calendar`, `clock`, `check-circle`, `x-circle`, `chevron-right`, `chevron-down`, `arrow-left`, `plus`, `pencil`, `trash-2`, `settings`, `bell`, `home`, `medal`, `target`, `share-2`, `log-out`, `sun`, `moon`.
- Cores: usar `currentColor` para herdar do contexto.

---

## 11. Componentes base

### 11.1 Botões

**Variantes**:

- **Primary** — `bg: --brand`, `color: --text-on-brand`, hover `--brand-hover`. Para CTAs principais (criar torneio, salvar palpite).
- **Secondary** — `bg: transparent`, `border: 1px solid --border-strong`, `color: --text-primary`. Para ações secundárias.
- **Ghost** — `bg: transparent`, `color: --text-primary`, hover `bg: --bg-muted`. Para ações terciárias e botões em toolbar.
- **Destructive** — `bg: --danger`, `color: --text-inverse`. Para deletes, ban.
- **Brand outline** — `bg: transparent`, `border: 1px solid --brand`, `color: --brand`. Variante para o tema verde.

**Tamanhos**:

| Size | Height | Padding X | Font |
| ---- | ------ | --------- | ---- |
| sm | 32px | 12px | `--text-sm` |
| md | 40px | 16px | `--text-base` |
| lg | 48px | 20px | `--text-base` semibold |
| xl | 56px | 24px | `--text-lg` semibold |

**Touch target**: mínimo 44px de altura efetiva (incluir padding/área tappable) em mobile.

**Estados**: default, hover, press, focus (anel `2px solid --border-focus` com offset 2px), disabled (`opacity: 0.4, cursor: not-allowed`), loading (spinner inline, texto trocado por "…" ou mantido com spinner à esquerda).

**FAB (Floating Action Button)**: 56×56px, `radius-full`, `bg: --brand`, `shadow-lg`, posicionado bottom-right `--space-6` acima do bottom nav.

### 11.2 Inputs

- **Height**: 48px em mobile, 44px em desktop.
- **Radius**: `--radius-md`.
- **Border**: `1px solid --border-default`. Focus: `2px solid --border-focus`, sem deslocar layout.
- **Padding**: `--space-3` lateral, `--space-2` vertical (mas height é fixo).
- **Label flutuante**: opcional. Quando usar, label acima do input (não inside) com `--text-sm` medium e `color: --text-secondary`.
- **Helper / Error**: linha abaixo do input, `--text-xs`. Error: `color: --danger`.
- **Tipos**: text, email, password (com toggle de visibilidade), number, color (preview de cor à esquerda), date/time (usar `<input type="datetime-local">` mobile-native), select (chevron-down ícone à direita).
- **Disabled**: `bg: --bg-muted`, `color: --text-muted`, `cursor: not-allowed`.

### 11.3 Card

```
+----------------------------------+
| (header opcional)                |
| Title                            |
| Subtitle (opcional)              |
+----------------------------------+
| (corpo)                          |
| Conteúdo do card                 |
+----------------------------------+
| (footer opcional)                |
| [Ação 1]   [Ação 2]              |
+----------------------------------+
```

- `bg: --bg-surface`, `border-radius: --radius-lg`, `padding: --space-4` mobile / `--space-6` desktop.
- Sombra `--shadow-sm` em light. Em dark, usar `bg: --bg-elevated` em vez de sombra.
- Variante interativa: hover translada Y -2px e ganha `--shadow-md`.

### 11.4 Avatar

- Tamanhos: 24, 32, 40, 56, 80px.
- `radius-full`.
- Fallback: iniciais do nome com `bg: --brand-subtle` em light, `bg: --brand` em dark; cor do texto contrastante.
- Default em ausência de `avatarUrl`: ícone `user` em `--text-muted`.

### 11.5 Badge / Tag

- Pequenos pills com estado:
  - **Neutro**: `bg: --bg-muted`, `color: --text-secondary`
  - **Brand**: `bg: --brand-subtle`, `color: --brand` ou `--green-700` no light
  - **Success**: `bg: --green-100`, `color: --green-700`
  - **Warning**: `bg: --amber-100`, `color: --amber-700`
  - **Danger**: `bg: red-100`, `color: red-700`
- Altura: 24px. Padding lateral: `--space-2` (8). Font: `--text-xs` medium.
- Radius: `--radius-full` para pills, `--radius-sm` para tags angulares.

### 11.6 Status badges específicos do app

| Texto | Cor de fundo | Cor do texto |
| ----- | ------------ | ------------ |
| `DRAFT` | gray-100 / gray-800 | gray-700 / gray-200 |
| `OPEN` | green-100 / green-900 | green-700 / green-300 |
| `IN_PROGRESS` | amber-100 / amber-900 | amber-700 / amber-300 |
| `FINISHED` | gray-200 / gray-700 | gray-600 / gray-300 |
| `SCHEDULED` | blue-100 / blue-900 | blue-700 / blue-300 |
| `COMPLETED` | green-100 / green-900 | green-700 / green-300 |
| `CANCELLED` | red-100 / red-900 | red-700 / red-300 |
| `ACTIVE` (member) | green-100 | green-700 |
| `LEFT` (member) | gray-100 | gray-600 |
| `BANNED` (member) | red-100 | red-700 |

### 11.7 Empty state

- Ícone grande (48–64px) em `--text-muted`.
- Título H3.
- Descrição em body secondary.
- CTA primário centralizado.
- Background: transparente. Padding vertical generoso (`--space-12`).

### 11.8 Toast / Snackbar

- Posição: bottom-center mobile, top-right desktop.
- Largura: max 360px.
- Variantes: success (verde), error (vermelho), info (azul), warning (amber). Ícone à esquerda.
- Auto-dismiss: 4s default, 6s para erros.
- Animação: slide-in 200ms, slide-out 150ms.

### 11.9 Modal / Bottom sheet

- **Mobile**: bottom sheet com `border-radius: --radius-2xl --radius-2xl 0 0`, ocupa até 90% da altura. Drag handle (small bar) no topo. Backdrop com `--overlay`.
- **Tablet/Desktop**: modal centralizado, max-width 480px (small) ou 720px (large), `--radius-xl`, `shadow-xl`.
- Header: título à esquerda, botão de fechar (`X` ícone, ghost) à direita.
- Footer: ações alinhadas à direita (desktop) ou stacked (mobile com botão primário ocupando 100%).

### 11.10 Tabs

- **Top tabs** (dentro de um page): underline-style. Tab ativa com borda inferior 2px `--brand` e texto `--text-primary` semibold. Tabs inativas em `--text-secondary`.
- Em mobile, tabs com scroll horizontal quando excedem viewport.
- Altura da bar: 48px.

### 11.11 Lists

- **List item padrão**:
  - 56px altura mínima em mobile (touch-friendly).
  - Estrutura: avatar/ícone à esquerda, conteúdo principal (título + subtítulo), trailing à direita (chevron, badge, ou ação).
  - Divider `1px solid --border-default` entre items (ou usar gap em vez de border).
- **Empty list**: empty state component dentro do espaço da lista.

### 11.12 Tabelas (standings, ranking)

- Em **mobile**: converter pra cards verticais (cada linha vira um card com label/valor stack). Ou tabela horizontal com scroll quando necessário (rare).
- Em **desktop**: tabela tradicional. Header sticky com `bg: --bg-base`. Linhas com hover `bg: --bg-muted`.
- **Numerais sempre em `--font-mono` tabular** para alinhamento.
- Linhas zebradas: opcional. Se usar, alternar com `--bg-surface`.

### 11.13 Score component (placar de match)

Componente específico do app, central nas experiências:

```
+--------------------------------------+
|   [escudo]  Time A    2 — 1   Time B [escudo]   |
|                  scheduledAt                    |
|              status badge                       |
+--------------------------------------+
```

- Em **mobile**: escudos 32px, nome do time `--text-sm` semibold, placar `--text-3xl` mono bold com `—` ou `x` entre.
- Em **desktop**: escudos 40px, nome `--text-base` semibold, placar `--text-4xl` mono bold.
- Variante "match em andamento" (futuro): pulse animation no placar.
- Variante "cancelled": placar com linha tachada, status badge "CANCELADO" em vermelho.

### 11.14 Skeleton loaders

- Bloco com `bg: --bg-muted`, `radius` igual ao componente final, animação shimmer (gradient horizontal de 1.5s linear infinite).
- Usar onde for haver lista carregando: lista de torneios, lista de matches, ranking.

### 11.15 Color swatch (campo de cor primária/secundária do time)

- Input customizado: círculo 32×32 mostrando a cor atual, ao clicar abre color picker. Suporta entrada manual em hex.
- Validação visual: borda vermelha se hex inválido.

---

## 12. Layout / Navegação

### 12.1 Mobile (< 768px)

```
+---------------------------+
| Top app bar (56px height) |
|  ← Title           ⋮      |
+---------------------------+
| Conteúdo                  |
|   scroll vertical         |
|                           |
|                           |
+---------------------------+
| Bottom nav (64px + safe)  |
| [Home] [Torneios] [Times] [Eu] |
+---------------------------+
```

- **Top bar**: 56px, `bg: --bg-base`, border-bottom `1px solid --border-default`. Conteúdo: back arrow (se não home), título centralizado ou alinhado à esquerda, ações à direita (max 2 ícones; mais = overflow menu).
- **Bottom nav**: 64px + safe-area-inset-bottom. 4 items: Home, Torneios (mine + joined), Times, Eu (perfil). Item ativo com ícone preenchido e cor `--brand`; inativo em `--text-secondary`. Label opcional embaixo (`--text-xs`).
- **FAB** quando aplicável (criar torneio, novo time): bottom-right, acima do bottom nav.

### 12.2 Tablet (768–1023px)

- Mesmo layout, mas com `max-width: 720px` e padding lateral maior.
- Bottom nav permanece.

### 12.3 Desktop (≥ 1024px)

```
+----+-------------------------------+
| S  | Top bar (sticky)              |
| i  +-------------------------------+
| d  | Conteúdo (max-width centered) |
| e  |                               |
| b  |                               |
| a  |                               |
| r  |                               |
+----+-------------------------------+
```

- **Sidebar** fixa à esquerda, 240px de largura. Logo no topo, navegação principal, perfil/logout em baixo.
- Sem bottom nav.
- Top bar mantém: breadcrumb opcional, ações contextuais, theme toggle, avatar do usuário (menu dropdown).

### 12.4 Estrutura de rotas (Angular)

```
/auth/signup
/auth/signin

/                                    → Home/Dashboard
/tournaments                         → Lista (com tabs: mine | public | joined)
/tournaments/new                     → Criar
/tournaments/:id                     → Detalhe do torneio
/tournaments/:id/edit                → Editar configurações
/tournaments/:id/members             → Lista de membros
/tournaments/:id/teams               → Times vinculados
/tournaments/:id/phases              → Lista de phases
/tournaments/:id/phases/:pid         → Detalhe da phase (com tabs: matches, groups, teams, zones, standings)
/tournaments/:id/phases/:pid/matches/:mid          → Detalhe do match
/tournaments/:id/phases/:pid/matches/:mid/predict  → Tela de palpite (modal/sheet em mobile)
/tournaments/:id/ranking             → Ranking
/tournaments/:id/my-predictions      → Meus palpites no torneio

/teams                               → Meus times
/teams/new                           → Criar time
/teams/:id                           → Detalhe/editar time

/join                                → Entrar com código de convite

/profile                             → Perfil do usuário
/profile/settings                    → Configurações (tema, etc.)
```

---

## 13. PWA

### 13.1 Manifest

```json
{
  "name": "Rei do Pitaco",
  "short_name": "Rei do Pitaco",
  "description": "Crie torneios de futebol e palpite com seus amigos",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0A0F0A",
  "theme_color": "#10B981",
  "orientation": "portrait-primary",
  "icons": [
    { "src": "/icons/icon-72.png",  "sizes": "72x72",   "type": "image/png" },
    { "src": "/icons/icon-96.png",  "sizes": "96x96",   "type": "image/png" },
    { "src": "/icons/icon-128.png", "sizes": "128x128", "type": "image/png" },
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-256.png", "sizes": "256x256", "type": "image/png" },
    { "src": "/icons/icon-384.png", "sizes": "384x384", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### 13.2 Splash

Imagem com fundo `#0A0F0A` (dark) ou `#10B981` (acento), logo centralizado 25% da menor dimensão. Gerar para todas as resoluções iOS comuns.

### 13.3 Install banner

Custom prompt no primeiro retorno do usuário (não na primeira visita), via `beforeinstallprompt`. Card com texto curto "Instale o Rei do Pitaco" + botão primário "Instalar" + ghost "Agora não". Persistir dismiss.

---

## 14. Acessibilidade

- Contraste mínimo **AA**: texto normal 4.5:1, large text 3:1, componentes UI 3:1.
- Focus visível: anel `2px solid --border-focus` com `outline-offset: 2px`.
- Áreas de toque: ≥ 44×44 px.
- `aria-label` em todo ícone clicável sem texto.
- Forms com `<label>` associado, `aria-invalid` quando erro, `aria-describedby` apontando pro helper/error.
- Skip link "Pular para conteúdo" no topo de cada página.
- Atalhos: `Esc` fecha modal/sheet. `Enter` submete forms.

---

## 15. Estados globais (loading / error / empty)

Padrão em todas as listagens:

1. **Loading**: skeletons no formato dos cards/list items.
2. **Empty**: empty state component (§11.7) com CTA contextual.
3. **Error**: card centralizado com ícone `--danger`, mensagem amigável, botão "Tentar novamente". Em caso de erro de rede, mostrar "Sem conexão" com ícone offline.

---

## 16. Telas

### 16.1 Splash / Inicial

Mostra logo central + nome "Rei do Pitaco" + tagline curta ("Seu bolão com os amigos"). Fundo verde escuro `--green-950` em dark / `--green-50` em light. Animação simples de fade-in 300ms. Permanece até first paint do roteador.

### 16.2 Signin

```
[ ← back (opcional) ]
                              Rei do Pitaco (logo)
                                
                   Entre na sua conta
                   
   ┌────────────────────────────────┐
   │ Email                          │
   └────────────────────────────────┘
   ┌────────────────────────────────┐
   │ Senha             [👁]         │
   └────────────────────────────────┘
   
                       [esqueci a senha →]
   
   ┌────────────────────────────────┐
   │          ENTRAR (primary)      │
   └────────────────────────────────┘
   
                  Não tem conta?
                     [Cadastre-se]
```

- Background com leve gradiente verde no topo (50/2% opacidade).
- Inputs full-width, espaçamento `--space-4` entre eles.
- Botão primário full-width em mobile, max-width 360px em desktop centralizado.
- Erro de credenciais aparece em toast vermelho + helper text vermelho sob os inputs.

### 16.3 Signup

Mesma estrutura do signin com mais campos: nome, email, senha (com força visual: barra colorida), avatar URL (opcional). Botão "Cadastrar". Link "Já tem conta? Entre" no rodapé.

### 16.4 Home / Dashboard

```
Top bar: "Rei do Pitaco" (logo + nome) | [tema toggle] [bell] [avatar]

┌─ Card de boas-vindas (saudação + nome) ─┐
│ Olá, Gustavo 👋                          │
│ 3 torneios ativos · 12 palpites feitos   │
└──────────────────────────────────────────┘

  Próximos jogos (horizontal scroll)
  ┌──────┐ ┌──────┐ ┌──────┐
  │match │ │match │ │match │
  └──────┘ └──────┘ └──────┘

  Meus torneios em andamento
  ┌─ TournamentCard ─────────────┐
  │ Brasileirão 2026             │
  │ IN_PROGRESS · 24 participantes│
  │ Próximo: hoje 21:00          │
  └──────────────────────────────┘
  
  [Ver todos →]

Bottom nav (mobile)
```

Cards com transição hover (desktop). Em mobile: shimmer skeleton enquanto carrega.

### 16.5 Lista de torneios `/tournaments`

Top tabs: **Meus | Públicos | Participo**

Cada tab carrega uma `Page<TournamentResponse>`. Card por torneio:

```
┌──────────────────────────────────────┐
│ [Badge: OPEN]    [Privacy ícone: 🔒] │
│                                      │
│ Nome do Torneio                      │
│ Descrição em 2 linhas max...         │
│                                      │
│ 👥 24 / 50    ⚽ 12 times            │
│ Criado em 21/05/2026                 │
└──────────────────────────────────────┘
```

FAB "+ Criar torneio" no canto inferior direito.

### 16.6 Criar / editar torneio

Form em **etapas (stepper)** em mobile, painel único em desktop:

**Etapa 1 — Básico**: nome, descrição, privacy (toggle Público/Privado).
**Etapa 2 — Capacidade**: maxParticipants (slider ou input numérico), maxTeams.
**Etapa 3 — Pontuação**: 6 inputs numéricos em grid 2×3 (vit/emp/derrota + exato/vencedor/erro).
**Etapa 4 — Desempate**: lista ordenável (drag-and-drop) dos `TiebreakCriteria` selecionados; tap pra adicionar/remover. Mostrar regra "ordem importa".
**Confirmação**: revisar tudo + botão "Criar torneio".

### 16.7 Detalhe do torneio `/tournaments/:id`

Hero no topo:

```
┌────────────────────────────────────────┐
│ [Badge status]   [Privacy]             │
│                                        │
│ NOME DO TORNEIO                        │
│ Descrição                              │
│                                        │
│ Código de convite: ABC123XY  [📋 copy] │
│                                        │
│ 24 participantes · 12 times · 3 fases  │
└────────────────────────────────────────┘
```

Botão "Compartilhar convite" (share sheet nativo).

Tabs abaixo: **Visão geral | Phases | Membros | Times | Ranking**

Visão geral mostra: próximos matches, status atual, ranking top 5, ações rápidas para owner (avançar status, regenerar código, editar).

### 16.8 Lista de phases `/tournaments/:id/phases`

Linha do tempo vertical:

```
●  Fase 1 — Grupos      [GROUPS]
│  4 grupos · 16 times
│  12/12 matches concluídos
│  [Ver detalhes →]
│
●  Fase 2 — Mata-mata   [KNOCKOUT]
│  8 times · ida e volta
│  0/4 matches
│  [Ver detalhes →]
│
●  + Adicionar phase (só owner, só em DRAFT/OPEN)
```

### 16.9 Detalhe da phase `/tournaments/:id/phases/:pid`

Sub-tabs: **Matches | Grupos | Times | Zonas | Classificação**

- **Matches**: lista de match cards agrupados por rodada (collapsible). Botão "+ Match" (manual) ou "Gerar partidas" (automático). Filtros: rodada, grupo.
- **Grupos** (só GROUPS phase): grid de cards, cada um com nome do grupo e lista de times. Botão "+ Grupo" e "Sortear distribuição".
- **Times**: lista de PhaseTeam. Drag-and-drop entre grupos.
- **Zonas**: cards verticais com `fromPos–toPos`, regra de avanço, modo de seleção. Botão "+ Zona". Visual: cores indicando destino (verde=avança, vermelho=eliminado, amarelo=BEST_RANKED).
- **Classificação**: tabela de standings (ver §11.12 e §11.13). Em mobile, cards stack. Em desktop, tabela completa.

### 16.10 Detalhe do match

```
┌─────────────────────────────────────────┐
│              [Phase 1 · Rodada 3]       │
│              [Grupo A]                  │
│                                         │
│   [escudo]                  [escudo]    │
│   Flamengo                  Palmeiras   │
│                                         │
│                2  —  1                  │
│                                         │
│           21/05/2026 21:00              │
│           [COMPLETED badge]             │
└─────────────────────────────────────────┘

Meu palpite: 2x1 ✓ (5 pontos)  [editar]

Outros palpites (após deadline)
  ┌─ Outra: 1x0 · 2 pts ─┐
  ┌─ Pedro: 3x2 · 0 pts ─┐
  ...

Ações (admin, se aplicável):
  [Lançar resultado] [Editar agendamento] [Cancelar]
```

### 16.11 Lançar resultado (modal/sheet)

Mobile = bottom sheet, desktop = modal centrado.

```
┌─────────────────────────────────┐
│ Lançar resultado                X│
├─────────────────────────────────┤
│  [escudo]         [escudo]      │
│  Flamengo         Palmeiras     │
│                                  │
│   [-]  2  [+]    [-]  1  [+]    │
│   home             away          │
│                                  │
│  ⓘ Após salvar, pontos dos      │
│    palpites serão recalculados  │
│                                  │
│         [Cancelar] [Salvar]     │
└─────────────────────────────────┘
```

Stepper de número grande (touch-friendly): - / valor / +.

### 16.12 Fazer palpite (modal/sheet)

Estrutura visual semelhante ao "lançar resultado", mas:
- Title "Seu palpite"
- Mostrar deadline ("Palpites fecham em 2h 15min")
- Botão primário "Salvar palpite"

Bloqueado se `now >= scheduledAt` — substituir o sheet pelo card "Palpites encerrados" com link para ver palpites de todos.

### 16.13 Meus palpites no torneio

Lista cronológica de matches com colunas:

```
Match (mandante vs visitante)  | Meu palpite | Real | Pontos
```

Em mobile: cards verticais. Em desktop: tabela.

Filtros: por phase, por status (futuros / passados).

### 16.14 Ranking `/tournaments/:id/ranking`

Top 3 com pódio visual (1º maior, dourado / 2º prateado / 3º bronze). Embaixo, lista do 4º em diante.

```
        🥇
       ┌──┐
       │1º│
   🥈  │  │  🥉
  ┌──┐ │  │ ┌──┐
  │2º│ │  │ │3º│
  └──┘ └──┘ └──┘
   
  4. Ana — 38 pts
  5. Pedro — 32 pts
  ...
```

Cada linha: avatar + nome + (em desktop também: exact hits / winner hits / wrongs separados em colunas).

### 16.15 Membros `/tournaments/:id/members`

Lista. Cada item: avatar + nome + role badge + status badge. Owner aparece com coroa.

Ações (só owner): banir (com confirm dialog vermelho).

Filtros: ACTIVE / LEFT / BANNED.

### 16.16 Times do torneio `/tournaments/:id/teams`

Grid de cards de times vinculados (em mobile 1 coluna, em tablet 2, em desktop 3).

Cada card: badge do time (badgeUrl ou cor primária como fallback) + nome + shortName.

Botão "+ Adicionar time" abre seletor com times do owner ainda não vinculados.

### 16.17 Meus times `/teams`

Mesmo padrão de grid. Card de time com:

```
┌─────────────────┐
│   [Badge cor]   │
│   ⚽            │
│                 │
│ Flamengo (FLA)  │
│ [editar][delete]│
└─────────────────┘
```

Fallback de badge: círculo dividido em duas metades com primaryColor e secondaryColor. Iniciais sobre.

### 16.18 Criar / editar time

Form mobile-first:

```
Nome *           [_______________]
Sigla (opcional) [___]
Escudo (URL)     [_______________]  [preview]

Cor primária     [🟥]  #FF0000
Cor secundária   [⬛]  #000000

[preview do badge final]

[Salvar]
```

Cores via color picker custom.

### 16.19 Tela de "Entrar em torneio com código" `/join`

Centro da tela:

```
       Entrar em torneio
       
   Digite o código que você recebeu:
   
   ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐
   │  │ │  │ │  │ │  │ │  │ │  │ │  │ │  │
   └──┘ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘
   
                  [ENTRAR]
```

8 inputs de 1 char com auto-advance entre eles. Suporte a colar código inteiro.

### 16.20 Perfil `/profile`

```
┌─────────────────────────────────┐
│         [avatar 80px]           │
│                                 │
│         Gustavo Silva           │
│         gustavo@reidopitaco.com      │
│                                 │
│  ┌───────┐ ┌───────┐ ┌───────┐ │
│  │   12  │ │   85  │ │   3   │ │
│  │ Tor.  │ │ Palp. │ │ 1º lg │ │
│  └───────┘ └───────┘ └───────┘ │
└─────────────────────────────────┘

  ⚙ Configurações
  🌓 Tema
  ❓ Ajuda
  ↪ Sair
```

### 16.21 Configurações

Toggle de tema (claro / escuro / sistema). Idioma (preparar pra i18n).

### 16.22 Erro 404 / sem permissão

Card central com ilustração simples (bola perdida no campo), mensagem "Página não encontrada" e botão "Voltar pra Home".

---

## 17. Animações / Motion

| Componente | Animação |
| ---------- | -------- |
| Bottom sheet open | slide-up 250ms easing-decel |
| Modal open | scale 0.95 → 1 + fade-in 200ms |
| Toast | slide-in 200ms, slide-out 150ms |
| Tab change | fade content 150ms |
| List item enter (after load) | stagger 30ms entre items, fade+slide 200ms |
| Score reveal (após setResult) | pulse highlight verde 600ms |
| Button hover (desktop) | bg-color transition 150ms |
| Page transition | fade 200ms (Angular Router transitions) |

Respeitar `prefers-reduced-motion`.

---

## 18. CSS variables — Snippet pronto

Colocar em `src/styles/tokens.css` e importar no `styles.scss` principal.

```css
:root {
  /* Brand */
  --green-50:  #ECFDF5;
  --green-100: #D1FAE5;
  --green-200: #A7F3D0;
  --green-300: #6EE7B7;
  --green-400: #34D399;
  --green-500: #10B981;
  --green-600: #059669;
  --green-700: #047857;
  --green-800: #065F46;
  --green-900: #064E3B;
  --green-950: #022C22;

  /* Accent */
  --amber-50:  #FFFBEB;
  --amber-100: #FEF3C7;
  --amber-200: #FDE68A;
  --amber-300: #FCD34D;
  --amber-400: #FBBF24;
  --amber-500: #F59E0B;
  --amber-600: #D97706;
  --amber-700: #B45309;
  --amber-800: #92400E;
  --amber-900: #78350F;

  /* Neutral */
  --gray-50:  #F8FAFC;
  --gray-100: #F1F5F9;
  --gray-200: #E2E8F0;
  --gray-300: #CBD5E1;
  --gray-400: #94A3B8;
  --gray-500: #64748B;
  --gray-600: #475569;
  --gray-700: #334155;
  --gray-800: #1E293B;
  --gray-900: #0F172A;
  --gray-950: #020617;

  /* Semantic — defaults light */
  --bg-base:        #FFFFFF;
  --bg-surface:     #F8FAFC;
  --bg-elevated:    #FFFFFF;
  --bg-muted:       #F1F5F9;
  --bg-accent-subtle: #ECFDF5;

  --text-primary:   #0F172A;
  --text-secondary: #475569;
  --text-muted:     #64748B;
  --text-inverse:   #FFFFFF;
  --text-on-brand:  #FFFFFF;

  --border-default: #E2E8F0;
  --border-strong:  #CBD5E1;
  --border-brand:   #10B981;
  --border-focus:   #10B981;

  --brand:          #10B981;
  --brand-hover:    #059669;
  --brand-press:    #047857;
  --brand-subtle:   #ECFDF5;

  --accent:         #F59E0B;
  --accent-subtle:  #FFFBEB;

  --success:        #10B981;
  --warning:        #F59E0B;
  --danger:         #DC2626;
  --info:           #2563EB;

  --overlay:        rgba(15, 23, 42, 0.45);

  /* Spacing */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-7:  28px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;

  /* Radius */
  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --radius-xl:   16px;
  --radius-2xl:  24px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-xs: 0 1px 2px rgba(15, 23, 42, 0.04);
  --shadow-sm: 0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04);
  --shadow-md: 0 4px 6px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.04);
  --shadow-lg: 0 10px 15px rgba(15, 23, 42, 0.10), 0 4px 6px rgba(15, 23, 42, 0.04);
  --shadow-xl: 0 20px 25px rgba(15, 23, 42, 0.12), 0 10px 10px rgba(15, 23, 42, 0.04);

  /* Z-index */
  --z-dropdown: 100;
  --z-sticky:   200;
  --z-overlay:  900;
  --z-modal:   1000;
  --z-toast:   1100;
  --z-tooltip: 1200;

  /* Motion */
  --duration-fast:  150ms;
  --duration-base:  200ms;
  --duration-slow:  300ms;
  --easing-default: cubic-bezier(0.4, 0, 0.2, 1);
  --easing-emphasis: cubic-bezier(0.2, 0, 0.13, 1.5);
  --easing-decel:   cubic-bezier(0, 0, 0.2, 1);

  /* Typography */
  --font-sans: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;

  --text-xs:   12px;
  --text-sm:   14px;
  --text-base: 16px;
  --text-lg:   18px;
  --text-xl:   20px;
  --text-2xl:  24px;
  --text-3xl:  30px;
  --text-4xl:  36px;
  --text-5xl:  48px;
}

/* Mobile-first: reduce base font on small screens */
@media (max-width: 767px) {
  :root {
    --text-xs:   11px;
    --text-sm:   13px;
    --text-base: 14px;
    --text-lg:   16px;
    --text-xl:   18px;
    --text-2xl:  20px;
    --text-3xl:  24px;
    --text-4xl:  28px;
    --text-5xl:  36px;
  }
}

[data-theme="dark"] {
  --bg-base:        #0A0F0A;
  --bg-surface:     #14201A;
  --bg-elevated:    #1C2A23;
  --bg-muted:       #1E2E26;
  --bg-accent-subtle: #022C22;

  --text-primary:   #F8FAFC;
  --text-secondary: #CBD5E1;
  --text-muted:     #94A3B8;
  --text-inverse:   #0F172A;
  --text-on-brand:  #022C22;

  --border-default: #1E2E26;
  --border-strong:  #334155;
  --border-brand:   #34D399;
  --border-focus:   #34D399;

  --brand:          #34D399;
  --brand-hover:    #10B981;
  --brand-press:    #059669;
  --brand-subtle:   #064E3B;

  --accent:         #FBBF24;
  --accent-subtle:  #78350F;

  --success:        #34D399;
  --warning:        #FBBF24;
  --danger:         #F87171;
  --info:           #60A5FA;

  --overlay:        rgba(0, 0, 0, 0.65);

  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.30);
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.35);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.40);
  --shadow-lg: 0 6px 12px rgba(0, 0, 0, 0.50);
  --shadow-xl: 0 10px 20px rgba(0, 0, 0, 0.55);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    transition-duration: 1ms !important;
  }
}
```

---

## 19. Logo e identidade

- **Símbolo**: bola de futebol estilizada (pentágonos) com um corte verde sutil indicando movimento.
- **Wordmark**: "Rei do Pitaco" em Inter ExtraBold, com o "B" levemente customizado (sugestão: ponto verde no lugar do contra-form interno).
- **Versões**: ícone só, wordmark só, lockup (ícone + wordmark).
- **Espaço de respiro mínimo**: 1× a altura do símbolo em todas as direções.

---

## 20. Boas práticas para manutenção

- **Tudo em CSS variables** — nunca usar hex direto em componente. Quando precisar de uma cor que ainda não tem token, adicionar token primeiro.
- **Componentes em pasta `shared/components`**, cada um com `.html`, `.scss` e `.ts`. SCSS consome só variáveis CSS.
- **Theme toggle**: serviço Angular `ThemeService` que aplica `data-theme` no `<html>` e persiste em `localStorage`. Default = `prefers-color-scheme`.
- **Storybook recomendado** (opcional) para documentar cada componente isoladamente com knobs para temas.
- **Acessibilidade**: rodar Lighthouse periodicamente. Manter score AA mínimo.
- **Performance**: lazy-load de rotas pesadas, pre-fetch da próxima provável (ex. detalhe do torneio quando hover no card).

---

## 21. Checklist visual antes de cada release

- [ ] Funciona em viewport 360×640 (Android baixo)?
- [ ] Funciona em iPhone SE 375×667?
- [ ] Funciona em iPad 768×1024?
- [ ] Funciona em 1280×800 desktop?
- [ ] Tema claro e escuro renderizam corretamente?
- [ ] Contraste passa em AA em todos os textos?
- [ ] Animações desligadas com `prefers-reduced-motion`?
- [ ] PWA instala em Chrome Android e Safari iOS?
- [ ] Splash screen aparece consistente?
- [ ] Áreas de toque ≥ 44px?
- [ ] Skeletons aparecem antes do conteúdo em listagens?
- [ ] Empty states cobrem todas as listas vazias?
- [ ] Erros de API exibidos em toast + helper text?
