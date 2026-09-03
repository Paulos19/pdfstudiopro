# 🎨 Design System & Arquitetura da Landing Page — PDF Studio Pro

> **Diretriz de Estilo:** Alegre, luminoso, tátil e divertido, combinando a sofisticação do motor nativo C++17 com o frescor de produtos de IA modernos. Inspirado na harmonia de micro-interações, órbitas dinâmicas, sombras esculpidas e tipografia marcante dos templates *Synto*, *Vantoora*, *Absorva+* e *AICM*.

---

## 1. Visão do Produto & Tese de Design

O software tradicional de PDF é tipicamente associado a interfaces cinzas, corporativas, lentas e burocráticas.  
A tese visual do **PDF Studio Pro** quebra esse paradigma: **é um playground de superpoderes documentais, ultrarrápido (C++ nativo em 0.04s), amigável, inteligente e divertido**.

### O Trabalho Único da Landing Page (Single Job):
1. **Acesso Imediato ao Estúdio Web / Dashboard:** Botão de ação rápida para abrir a aplicação localmente (`/studio`) sem atrito.
2. **Download Instantâneo do Pacote Windows:** Cartão central de download que fornece tanto o instalador executável (`PDF Studio Pro Setup.exe`), a versão portátil sem instalação (`PDF Studio Pro Portable.exe`) e o pacote compactado `.zip`.
3. **Showcase Lúdico dos Recursos:** Demonstração interativa e tangível das 5 grandes forças:
   - ⚡ *Motor C++17 Nativo* (Inspeção de baixo nível em microssegundos)
   - ✍️ *Assinaturas Manuscritas 100% Transparentes & Selos Autênticos*
   - 🖼️ *Mesclador de Múltiplas Imagens para PDF*
   - ✂️ *Extrator & Organizador de Páginas Seletivo*
   - 🤖 *Copilot de IA com Gemini Flash Integrado*

---

## 2. Síntese dos Templates de Referência

A partir dos 4 materiais gráficos fornecidos pelo usuário, extraímos os elementos mais ricos e originais:

| Referência | Elementos Extraídos | Como Aplicamos no PDF Studio Pro |
| :--- | :--- | :--- |
| **1. Synto (AI Shop)** | • Gradiente magenta/coral vibrante sobre esferas concêntricas.<br>• Badges e botões circulares flutuantes ("GET STARTED").<br>• Conexões orbitais e pílulas flutuantes com sombras suaves. | O Hero terá uma **Órbita de Ferramentas**, com botões-pílula flutuantes que reagem ao mouse em física elástica, orbitando o motor central C++. |
| **2. Vantoora** | • Fundo azul céu etéreo (`#96C7F2` / azul brisa) com contraste limpo.<br>• Menu flutuante com abas ricas em ícones e micro-descrições.<br>• Tipografia display monumental na base da página. | A barra de navegação terá um card translúcido de acesso rápido ("Protocolo / Recursos / Dashboard") e tipografia ousada e geométrica. |
| **3. Absorva+** | • Fundo luminoso com céu e nuvens suaves, transmitindo leveza.<br>• Carrossel em arco com cantos hiper-arredondados (estilo pílula).<br>• Emojis e badges lúdicos ("⚡ Pure power", "💊", "🧴"). | A seção de recursos será disposta em um **Arco Dinâmico** com cartões coloridos (verde menta, coral, lilás e amarelo sol) e badges interativos. |
| **4. AICM** | • Fundo 3D clean com relevo esculpido e ranhuras táteis com sombras de luz solar.<br>• Elementos táteis físicos (moeda 3D se encaixando na cavidade).<br>• Ícone prismático com gradiente violeta/laranja. | O card de download e as demonstrações interativas usam relevo esculpido suave (*neomorphism* moderno refinado), transmitindo qualidade de engenharia. |

---

## 3. Tokens do Sistema de Design (Design Tokens)

### 3.1. Paleta de Cores ("Alegre, Enérgica & Iluminada")

Em conformidade com o `/frontend-design`, a paleta abandona o cinza corporativo e adota tons luminosos, contrastantes e cheios de vitalidade:

```css
:root {
    /* Superfícies & Fundo Luminoso */
    --canvas-bg: #F4F8FE;               /* Azul névoa claríssimo, fresco e arejado */
    --canvas-surface: #FFFFFF;          /* Branco puro com brilho tátil */
    --canvas-elevated: #F9FBFF;         /* Superfície flutuante translúcida */
    --canvas-tint-subtle: #E8F1FD;      /* Destaque suave para containers de relevo */

    /* Tipografia & Contraste Forte */
    --text-headline: #0F172A;           /* Azul ardósia profundo, máximo contraste e legibilidade */
    --text-body: #334155;               /* Cinza neutro quente confortável para leitura longa */
    --text-muted: #64748B;              /* Texto de suporte e legendas */

    /* Cores de Ação & Superpoderes (Alegres e Saturadas) */
    --spark-blue: #2563EB;              /* Azul elétrico clássico, base de confiança */
    --spark-violet: #7C3AED;            /* Violeta tecnológico do motor de IA */
    --spark-coral: #FF4D6D;             /* Coral energético (botões de conversão e gravações) */
    --spark-emerald: #10B981;           /* Verde menta alegre (sucesso, downloads e velocidade) */
    --spark-amber: #F59E0B;             /* Amarelo dourado solar (badges de destaque e selos) */
    --spark-cyan: #06B6D4;              /* Ciano piscina (imagens para PDF e ferramentas visuais) */

    /* Gradientes Assinatura */
    --grad-hero: linear-gradient(135deg, #FF4D6D 0%, #7C3AED 50%, #2563EB 100%);
    --grad-bubble: radial-gradient(circle at 30% 30%, rgba(255, 77, 109, 0.18), rgba(124, 58, 237, 0.12) 60%, transparent 80%);
    --grad-mint-glow: radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%);

    /* Bordas e Sombras Esculpidas */
    --border-light: rgba(148, 163, 184, 0.2);
    --border-vibrant: rgba(99, 102, 241, 0.3);
    --shadow-soft: 0 10px 30px -5px rgba(37, 99, 235, 0.08), 0 4px 12px -2px rgba(15, 23, 42, 0.04);
    --shadow-float: 0 20px 45px -10px rgba(124, 58, 237, 0.14), 0 8px 20px -4px rgba(15, 23, 42, 0.06);
    --shadow-clay: 0 6px 0px 0px #CBD5E1, 0 12px 24px rgba(0, 0, 0, 0.08); /* Efeito tátil de botão físico */
}
```

---

### 3.2. Tipografia (Emparelhamento com Personalidade)

- **Display & Títulos:** `Plus Jakarta Sans` + `Outfit` (pesos 700 e 800). Letras geométricas com curvas generosas e alegres, transmitindo modernidade e dinamismo.
- **Corpo & Menus:** `Plus Jakarta Sans` (pesos 400, 500, 600). Alta legibilidade em qualquer resolução.
- **Números & Telemetria:** `Space Grotesk` ou `JetBrains Mono` para métricas do motor ("0.04s", "115 MB", "100% Nativo").

```css
font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
```

---

## 4. Elemento Assinatura da Página: "O Playground Orbital"

Para atender à regra de ouro do `/frontend-design` (*"Spend your boldness in one place"*), o destaque central da Landing Page é a **Arena Orbital de Demonstração Interativa (Interactive Superpower Arena)**:

- Um palco circular tátil no centro do Hero.
- No centro, um card físico flutuante simulando um documento PDF interativo.
- Orbitando ao redor, **5 Tokens Interativos Clicáveis** (em cores vibrantes):
  1. ⚡ **Motor C++** (*Ciano / Roxo*): Dispara um raio de luz na tela e exibe a velocidade de execução (`42ms`) e a árvore Cos de baixo nível.
  2. ✍️ **Assinatura Mágica** (*Azul Cobalto*): Desenha instantaneamente uma assinatura manuscrita transparente sobre a folha.
  3. 🖼️ **Mesclar Imagens** (*Rosa Coral*): Transforma 3 fotos em miniatura em páginas de um mini-PDF com som e animação de empilhamento.
  4. ✂️ **Cortar Páginas** (*Laranja Solar*): Separa visualmente folhas com efeito de tesoura magnética.
  5. 🤖 **IA Gemini** (*Verde Esmeralda*): Executa uma auditoria de PII / LGPD em tempo real com faixas pretas e selo de aprovação.
- Ao clicar em qualquer token, o documento central reage em tempo real, sem carregar outra página!

---

## 5. Wireframe & Estrutura da Landing Page

```
+-------------------------------------------------------------------------------+
|  [📄 PDF Studio Pro]    Recursos   Superpoderes   Motor C++   FAQ   | [🚀 Abrir Dashboard] [⬇ Baixar Suite] |
+-------------------------------------------------------------------------------+
|                                                                               |
|      [ ✨ NOVO: Versão 1.0.2 com Juntar Imagens e Extrator de Páginas ]       |
|                                                                               |
|                   O Editor de PDF Definitivo.                                 |
|               Nativo em C++. Turbinado por IA.                                |
|                                                                               |
|       Edite textos in-place, una imagens, extraia páginas e assine documentos |
|       com a velocidade da luz e a inteligência do Gemini Flash.               |
|                                                                               |
|       [ ⚡ Acessar Dashboard Online ]     [ 📦 Baixar Pacote Completo (ZIP) ] |
|       (Roda no navegador imediatamente)   (Instalador Setup + Portátil 115MB)  |
|                                                                               |
|  +-------------------------------------------------------------------------+  |
|  |                ARENA ORBITAL INTERATIVA (HERO PLAYGROUND)               |  |
|  |                                                                         |  |
|  |   (⚡ 0.04s C++)        [ MINI-DOCUMENTO INTERATIVO ]     (✍️ Assinar)   |  |
|  |                                                                         |  |
|  |   (🖼️ Juntar Imagens)                               (✂️ Cortar Páginas) |  |
|  |                               (🤖 Copilot IA)                           |  |
|  +-------------------------------------------------------------------------+  |
|                                                                               |
+-------------------------------------------------------------------------------+
|                      ESTAÇÃO DE DOWNLOAD IMEDIATO (3 OPÇÕES)                  |
|                                                                               |
|   +-------------------+     +---------------------+     +-----------------+   |
|   | 📦 PACOTE ZIP     |     | 💻 INSTALADOR SETUP |     | 🚀 PORTÁTIL     |   |
|   | Tudo incluso      |     | Instalação guiada   |     | Sem instalação  |   |
|   | • Instalador NSIS |     | • Menu Iniciar      |     | • Execução USB  |   |
|   | • Executável .exe |     | • Atalho desktop    |     | • Plug-and-play |   |
|   | [ Baixar ZIP ]    |     | [ Baixar Setup ]    |     | [ Baixar .exe ] |   |
|   +-------------------+     +---------------------+     +-----------------+   |
+-------------------------------------------------------------------------------+
|                  CARROSSEL EM ARCO: OS 5 SUPERPODERES                         |
|   [Card 1: C++ Core]  [Card 2: Assinatura]  [Card 3: Imagens]  [Card 4: IA]   |
+-------------------------------------------------------------------------------+
|                 ACESSO RÁPIDO AO DASHBOARD / WEBSOCKET AO VIVO                |
|   Demonstração do servidor local rodando na porta 3000 com live-reload        |
+-------------------------------------------------------------------------------+
|                        RODAPÉ CLEAN & CRÉDITOS                                |
+-------------------------------------------------------------------------------+
```

---

## 6. Recursos & Elementos Interativos

1. **Botões Táteis "Squishy / Clay"**:
   - Botões principais com leve relevo de 4px na parte inferior.
   - No clique (`:active`), descem 3px com som de clique suave e feedback háptico visual.
2. **Download Direto com Progresso / Animação**:
   - Um clique no botão `Baixar ZIP` gera o arquivo `.zip` dinamicamente contendo:
     - `PDF Studio Pro Setup 1.0.2.exe`
     - `PDF Studio Pro Portable 1.0.2.exe`
     - `LEIA-ME.txt` com instruções e resumo das novidades.
   - Mostra contagem regressiva e confetes coloridos (*canvas confetti*) celebrando o download!
3. **Card do Dashboard com Telemetria em Tempo Real**:
   - Indicador pulsante verde: `Motor C++ Online • Porta 3000 Ativa`.
   - Botão grande e iluminado: **"Entrar no Estúdio Agora"** redirecionando para `/studio` ou para a rota desejada com 1 clique.
4. **Modo Claro por Padrão com Fundo Alegre**:
   - Céu em gradiente suave com esferas orgânicas que flutuam sutilmente com base no movimento do cursor do mouse (efeito parallax).
   - Sombras coloridas suaves (*colored ambient shadows*), fazendo os cartões parecerem brinquedos tecnológicos premium.

---

## 7. Roteiro de Implementação de Código

Para garantir integração limpa e sem interferir no SPA principal existente:

1. **Página Dedicada da Landing Page:**
   - Criar `public/landing.html` (ou integrar na rota raiz `/` do servidor Node.js com alternância inteligente: se acessar `/landing` ou `/`, exibe a LP de apresentação com botões para ir ao `/app` ou `/studio`).
2. **Estilo Dedicado:**
   - Criar `public/css/landing.css` com todas as variáveis de cores alegres, fontes do Google Fonts (`Plus Jakarta Sans` & `Outfit`), animações de órbita e cartões em arco.
3. **Script Interativo:**
   - Criar `public/js/landing.js` com os handlers da Arena Orbital, confetes de download, gerador de ZIP via endpoint backend `/api/download-suite-zip` e redirecionamento rápido ao dashboard.
4. **Endpoint no Backend (`app.js`):**
   - Criar a rota `GET /api/download-suite-zip`: compacta em tempo real (ou entrega pré-compactado) os dois executáveis de `dist/` em um arquivo `PDF_Studio_Pro_v1.0.2_Suite.zip` para download com 1 clique!
