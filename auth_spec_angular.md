# Especificação Técnica: Telas de Autenticação (Login & Cadastro) - Rei do Pitaco

Este documento detalha as especificações para a implementação das telas de **Login** e **Cadastro** no framework **Angular 21**, seguindo uma arquitetura componentizada, dinâmica e escalável.

---

## 1. Visão Geral
- **Objetivo**: Implementar o fluxo inicial de acesso ao app Rei do Pitaco.
- **Plataforma**: PWA Mobile-first (Angular 21).
- **Referências Visuais**:
  - Login: `{{DATA:SCREEN:SCREEN_14}}`
  - Cadastro: `{{DATA:SCREEN:SCREEN_12}}`
  - Logo Final (SVG): `{{DATA:IMAGE:IMAGE_10}}`

---

## 2. Tokens de Design (Tailwind/CSS)
Utilizar as seguintes variáveis de cor conforme o `DESIGN.md`:
- **Primary (Fut)**: `#10B981` (Pitch Green)
- **Secondary (Bet/Texto)**: `#0F172A` (Court Gray 900)
- **Background**: `#FFFFFF` (Light) / `#0A0F0A` (Dark)
- **Inputs**: Background `#F8FAFC`, Borda `#E2E8F0`, Focus `#10B981`
- **Raio de Borda**: `8px` (`rounded-md`)

---

## 3. Arquitetura de Componentes

### 3.1 Componentes Compartilhados (`shared/components`)
- **`AuthLayoutComponent`**: Wrapper que contém o background (gradiente sutil verde), o container centralizado e o logo.
- **`InputComponent`**: Componente de input genérico com suporte a:
  - Label flutuante ou fixa.
  - Ícone de prefixo (Lucide Icons: `mail`, `lock`, `user`).
  - Toggle de visibilidade para senhas (`eye`/`eye-off`).
  - Mensagens de erro de validação (Angular Reactive Forms).
- **`ButtonComponent`**: Suporta variantes `primary` (verde cheio) e `secondary` (outline/ghost).
- **`LogoComponent`**: Renderiza o SVG `{{DATA:IMAGE:IMAGE_10}}` de forma responsiva.

---

## 4. Especificações das Telas

### 4.1 Tela de Login (`auth/login`)
- **Campos**:
  - Email (Validação: obrigatório, formato email).
  - Senha (Validação: obrigatório).
- **Ações**:
  - Botão "ENTRAR" (Primary): Submete o formulário.
  - Link "Esqueci a senha": Redireciona para recuperação.
  - Botão "Cadastre-se" (Secondary): Substitui o antigo "Entrar como convidado", redireciona para `/signup`.
- **Lógica**: Utilizar `AuthService` para comunicação com API e `Router` para redirecionar para `/dashboard` após sucesso.

### 4.2 Tela de Cadastro (`auth/signup`)
- **Campos**:
  - Nome Completo (`text`).
  - Email (`email`).
  - Senha (`password` com visualizador de força da senha).
  - Confirmar Senha (`password`).
  - URL do Avatar (`url`, opcional).
- **Ações**:
  - Botão "CADASTRAR" (Primary).
  - Link no rodapé: "Já tem conta? Entre" (Redireciona para `/login`).
- **Lógica**: Validação cross-field para garantir que as senhas coincidam.

---

## 5. Requisitos Técnicos Angular
- **Formulários**: Usar `ReactiveFormsModule` para validações em tempo real.
- **Gerenciamento de Estado**: Injetar `AuthStore` (Signals ou RxJS) para gerenciar o token JWT e dados do usuário.
- **Animações**: Implementar transição de slide suave entre as duas telas usando `BrowserAnimationsModule`.
- **PWA**: Garantir que as telas usem as cores do `manifest.webmanifest` para a barra de status.

---

## 6. Referência do Ativo (Logo)
O logo deve ser importado via SVG inline para permitir manipulação de cores se necessário:
```html
<!-- Fragmento do {{DATA:IMAGE:IMAGE_10}} -->
<svg ...>
  <tspan fill="#10b981">Fut</tspan><tspan fill="#0F172A">Bet</tspan>
</svg>
```

---

*Documento gerado pelo Stitch para implementação via Claude/Angular.*