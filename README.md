# Ambicom

![Ambicom Logo](https://via.placeholder.com/150) <!-- Substitua por um logo real se disponível -->

Uma plataforma moderna e intuitiva para gerenciamento de inventário, controle de clientes e geração de relatórios automatizados. O **Ambicom** foi desenvolvido para otimizar processos logísticos e operacionais, integrando tecnologias de ponta para oferecer uma experiência premium.

## 🚀 Funcionalidades Principais

- **🔍 OCR Labeling:** Captura automática de dados de etiquetas e documentos utilizando reconhecimento óptico de caracteres (OCR).
- **📦 Gestão de Inventário:** Controle detalhado de entradas, saídas e movimentações de produtos.
- **👥 Controle de Clientes:** Cadastro e acompanhamento de clientes com histórico de interações.
- **📄 Exportação Avançada:** Geração de relatórios profissionais em formatos **PDF** (via jspdf) e **Excel** (via xlsx).
- **📋 Gestão de Protocolos:** Personalização e ordenação dinâmica das categorias e itens do checklist de auditoria.
- **📱 PWA Ready:** Aplicativo pronto para ser instalado e utilizado em dispositivos móveis, com suporte offline.
- **🌐 Impressão Industrial Remota (Print Bridge):** Fila de impressão via nuvem com suporte a **PDF de alta fidelidade** e auditoria local.
- **📱 Scanner Industrial:** Otimizado para OCR de alta precisão e resiliência em hardware mid-range.
- **☁️ Integração Supabase:** Backend escalável com autenticação segura e banco de dados em tempo real.

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React 19, Vite, Tailwind CSS 4.
- **Estado & Roteamento:** React Router Dom v7, Lucide React (ícones).
- **Backend:** Supabase (Auth, Database, Storage).
- **Relatórios:** jsPDF, jsPDF-AutoTable, XLSX.
- **Funcionalidades Mobile:** React Webcam, Vite Plugin PWA.

## 📦 Instalação e Desenvolvimento

Siga os passos abaixo para rodar o projeto localmente:

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/Ronickbr/Ambicom.git
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente:**
   Crie um arquivo `.env` na raiz do projeto com suas credenciais do Supabase:
   ```env
   VITE_SUPABASE_URL=sua_url_aqui
   VITE_SUPABASE_ANON_KEY=sua_chave_aqui
   ```

4. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

Este projeto utiliza o versionamento semântico. A versão atual é **v2.26.4**, representando uma evolução significativa na arquitetura e funcionalidades do sistema original.

### 📝 Histórico de Versões
- **v2.26.4**:
  - **Higienização de Dados**: Implementada detecção inteligente de unidades para evitar duplicidade (ex: "V V").
  - **Ajuste de Margem Física**: Altura lógica reduzida para 75mm para garantir o encaixe em 100% da etiqueta física sem pular o sensor de GAP.
  - **Correção de Sobreposição**: Reajuste de coordenadas Y no cabeçalho (SAC e Endereço) para eliminar conflitos visuais com a grade técnica.
- **v2.26.3**:
  - **Estratégia TSPL (Native Print)**: Migração total da impressão industrial de PDF para a linguagem nativa TSPL (Elgin L42 Pro), eliminando problemas de orientação causados por drivers Windows.
  - **Calibração Retrato (55x80mm)**: Implementação do layout técnico portrait otimizado para bobinas de 55x80mm, com redução de margens de segurança para evitar cortes no cabeçote.
  - **Unificação de Protocolo**: Sincronização entre gerador TSPL e PDF para garantir paridade visual entre o download local e a impressão física via bridge.
- **v2.26.2**:
  - **Correção de Layout (Labels PDF)**: Reconstrução das coordenadas da etiqueta gerada em PDF, convertidas de "rotacionadas 90°" para o landscape nativo. Corrige encavalamento e textos "espremidos" durante a saída para bobinas de 80x55.
- **v2.26.1**:
  - **Correção de Build**: Removido importação não utilizada do `generateLabelTSPL` que causava falha no processo de compilação da aplicação.
- **v2.26.0**:
  - **Redesign Industrial (PDF Rotacionado)**: Reconstrução total da etiqueta baseada na imagem de referência, utilizando rotação de 90° para saída vertical em bobinas industriais horizontais (80x55mm).
  - **Limpeza de Código Legado**: Remoção definitiva de todos os motores de geração ZPL e TSPL, consolidando o PDF como padrão único de alta fidelidade.
  - **Sincronização de Fluxo**: Atualização do hook `useRemotePrint` para operar exclusivamente com payloads PDF em Base64, integrando perfeitamente com a nova ponte.
- **v2.25.0**:
  - **Motor de Impressão Nativo (Bridge)**: Substituição dos scripts PowerShell para PDF pelo componente `pdf-to-printer` na ponte de impressão local, garantindo maior estabilidade no Windows.
  - **Independência de Hardware**: Melhoria na listagem de impressoras do sistema operacional utilizando APIs Node nativas via `pdf-to-printer`.
  - **Refatoração da Ponte**: Otimização do loop de monitoramento e tratamento de erros no executor local (`bridge.js`).
- **v2.24.0**:
  - **Migração ZPL Master**: Substituição definitiva do motor TSPL por um gerador nativo ZPL (Zebra), utilizando o template de alta fidelidade fornecido pelo usuário.
  - **Dinamização de Template**: Implementação de injeção automática de dados técnicos (Modelo, Serial, Gás, Volumes) dentro do código ZPL.
  - **Estabilização de Hardware**: Correção definitiva de rotação e alinhamento de GAP através de comandos de baixo nível (^FWT, ^PW, ^LL).
- **v2.23.0**:
  - **Calibração Master Landscape**: Retorno às dimensões físicas reais (80x55) para resolver definitivamente o salto de GAP e invasão de etiquetas próximas.
  - **Simulação Vertical via Software**: Rotação individual de 100% dos elementos (TEXT, BAR, BOX, QR) para 90 graus, atingindo fidelidade absoluta ao modelo 1086 em bobinas horizontais.
  - **Otimização de Largura de Cabeçote**: Redistribuição da grade técnica ao longo dos 640 dots (80mm) para evitar clipping lateral.
- **v2.22.1**:
  - **Calibração de Espaçamento (Anti-Overlap)**: Rebaixamento da grade técnica para Y=360 para isolar o Serial Gigante e eliminar colisões de buffer.
  - **Reparo de Visibilidade QR**: Deslocamento do QR Code para X=25 (Safe Zone) para garantir impressão dentro da largura física de 55mm.
  - **Fix de Clipping**: Reajuste de margens no campo de Tamanho para evitar cortes na borda direita.
- **v2.22.0**:
  - **Arquitetura Vertical Nativa**: Redefinição do canvas para 55x80 (SIZE 55, 80), eliminando bugs de rotação de firmware.
  - **Replicação de Grade Puzzle**: Implementação fiel do layout 1086 com Modelo/Voltagem paralelos e Serial gigante centralizado.
  - **Estabilização de Linhas de Precisão**: Grade técnica desenhada com linhas de 4 dots para fidelidade mecânica absoluta.
- **v2.21.0**:
  - **Estratégia Clean Fidelity**: Implementação de zonas de segurança com margens de 120 dots entre colunas técnicas, eliminando colisões de texto em firmwares Elgin antigos.
  - **Reparo de QR Code Pro**: Reposicionamento para Y=310 com comando simplificado para garantir renderização em alta velocidade.
  - **Refinamento de Matriz**: Reorganização dos dados de Gás, Compressor e Volumes em 3 blocos laterais independentes.
- **v2.20.0**:
  - **Reconstrução Master de Layout**: Migração do motor de design para uma grade modular de linhas e colunas combinadas (multi-box). Reorganização de Modelo e Voltagem para posicionamento horizontal paralelo.
  - **Destaque de Rastreabilidade**: Serial Ambicom e QR Code centralizados com hierarquia tipográfica reforçada.
  - **Matriz Técnica Industrial**: Implementação de sub-grades para Gás, Compressores e Eficiência Energética, atingindo fidelidade máxima ao modelo de referência.
- **v2.19.0**:
  - **Reconstrução de Fidelidade Absoluta**: Motor TSPL redesenhado do zero para replicar exatamente a grade industrial técnica de 5 colunas lógicas.
  - **Mapeamento de Linhas HQ**: Implementação de divisórias reforçadas (espessura 4 e 6) para evitar falhas de impressão em bobinas térmicas industriais.
  - **Posicionamento de Rastreabilidade**: QR Code e Serial verticalizado integrados na coluna lateral direita.
- **v2.18.2**:
  - **Otimização de Visibilidade**: Aumento da espessura das linhas (`BAR`) para 6 dots, garantindo renderização em ribbons de baixa densidade.
  - **Reparo de QR Code**: Reposicionamento para zona central (Y=240) para evitar falhas de leitura em bordas curvas.
  - **Ajuste Institucional**: Afastamento do cabeçalho da borda física para evitar cortes de endereço.
- **v2.18.1**:
  - **Calibração Industrial Final**: Ajuste de coordenadas absolutas (Y-anchor) para evitar o transbordamento de buffer observado na v2.18.0.
  - **Estabilização de Fontes**: Redimensionamento das fontes técnicas para evitar sobreposição em rotação de 90 graus.
- **v2.18.0**:
  - **TSPL Portrait Designer (Software Mapping)**: Implementação de um mapeador de coordenadas virtual que traduz um design Retrato (55x80) para o plano Físico da impressora via software. Isso resolve definitivamente as falhas de rotação de firmware em impressoras Elgin L42 Pro.
  - **Deduplicação de Unidades**: Lógica de limpeza de strings para evitar dados repetidos (ex: "127 V V").
  - **Otimização de Bordas**: Ajuste milimétrico nas margens da grade técnica para evitar cortes de conteúdo (fix: clipping "GRANDE").
- **v2.17.2**:
  - **Layout Paisagem Industrial Nativo (0°)**: Redesenho total do template para operação em 0 graus de rotação. Esta mudança elimina instabilidades de firmware que causavam sobreposições e fontes gigantes em rotações de 90/270 graus.
  - **Distribuição em 3 Colunas Horizontais**: Reorganização dos dados técnicos (Gás, Voltagem, Volumes, Serial) em um canvas de 640x440 dots para máximo aproveitamento da largura de 80mm.
- **v2.17.1**:
  - **Correção de Âncoras 90°**: Reajuste total do motor TSPL para utilizar rotação de 90 graus com âncoras na base da etiqueta (Y=430). Isso resolve a sobreposição de fontes gigantes observada em firmwares específicos da Elgin L42 Pro.
  - **Estabilização de Grade**: Refinamento das coordenadas `X` e `Y` para garantir que o cabeçalho Ambicom e os dados técnicos não ultrapassem o limite físico de 55mm.
- **v2.17.0**:
  - **Layout Industrial de Alta Fidelidade**: Implementação completa do template técnico baseado em referência visual, utilizando grade 3x6 em 270 graus.
  - **Otimização de Fontes Nativas**: Uso de fontes tipográficas escala 0-5 para máxima clareza em parâmetros de volume e pressão.
  - **Cabeçalho Lateralizado**: Reposicionamento institucional para leitura vertical industrial.
- **v2.16.1**:
  - **Layout Paisagem Real (0°)**: Migração do motor de design para orientação Paisagem nativa. O texto agora flui paralelo ao lado de 80mm, resolvendo o problema de transbordamento de GAP observado na impressão física.
  - **Redesenho de Coordenadas**: Otimização milimétrica da grade técnica para o novo canvas horizontal de 640x440 dots.
- **v2.16.0**:
  - **TSPL Builder**: Implementação de um motor de design dinâmico que permite o mapeamento de coordenadas e rotação global (0° ou 180°) de todo o conteúdo da etiqueta.
  - **Otimização Física**: Ajuste nos comandos de sensor (`GAP` e `SIZE`) para garantir alinhamento perfeito na Elgin L42 Pro, evitando saltos de etiqueta.
- **v2.15.5**:
  - **Ajuste de Buffer**: Adição de espaço final no template TSPL para otimizar o processamento do comando de fechamento pela impressora.
- **v2.15.4**:
  - **Refinamento de Grade com BAR**: Substituição da estrutura de tabela por comandos `BAR` granulares para bordas e divisórias, permitindo maior controle milimétrico.
  - **Cabeçalho Otimizado**: Consolidação de endereço e SAC em formato linear para melhor aproveitamento da largura da bobina.
  - **Estabilização de Fontes**: Ajuste fino das coordenadas e fontes técnicos para máxima clareza em 90 graus.
- **v2.15.3**:
  - **Cabeçalho em Pilha Vertical**: Reorganização completa do topo da etiqueta em 270°, empilhando Ambicom, Bloco de Garantia e Endereço para melhor aproveitamento de largura.
  - **Otimização de Margem Zero**: Configuração definitiva de `GAP 0mm` e realinhamento da grade industrial para bobinas de 80x55mm.
- **v2.15.2**:
  - **Padronização TSPL**: Limpeza e normalização de espaçamentos em comandos e coordenadas para maior estabilidade de renderização.
  - **Correção de Caracteres**: Ajuste de strings de cabeçalho e endereço para evitar artefatos visuais na impressão física.
  - **Layout Técnico Consolidado**: Estabilização do design em 90 graus com grade industrial harmônica.
- **v2.15.1**:
  - **Realinhamento Estrutural TSPL**: Ajuste milimétrico de grade e fontes (tipo 0 a 5) baseado no feedback de impressão física e calibração de escala.
  - **Sincronização de Banco**: Execução de recarga de cache no Supabase para garantir a propagação da nova constraint de `payload_type`.
- **v2.15.0**:
  - **Layout Invertido (270°)**: Reorientação completa de todos os elementos da etiqueta para o ângulo de 270 graus.
  - **Otimização de Fontes Nativas**: Substituição de fontes customizadas por fontes nativas do sistema TSPL (0-5) para nitidez industrial máxima.
  - **Ajuste de Fluxo**: Inversão estratégica do cabeçalho e rodapé para melhor saída física na Elgin L42 Pro.
- **v2.14.9**:
  - **Conversão ZPL p/ TSPL**: Mapeamento técnico de comandos legados `^GB` para a sintaxe `BAR`/`BOX`, replicando o layout industrial histórico no novo protocolo.
  - **Fontes Dinâmicas**: Implementação de fonte tipo "0" com escalonamento personalizado de largura e altura para campos de dados técnicos.
  - **Realinhamento de Cabeçalho**: Ajuste de coordenadas para o bloco de endereço e garantia, otimizando o espaço superior da bobina.
- **v2.14.8**:
  - **Layout TSPL Homologado**: Implementação da versão oficial da tabela industrial com moldura `BOX` e divisórias `BAR` calibradas.
  - **Ajuste de Hardware**: Configuração de `GAP 3mm` e realinhamento de coordenadas para garantir estabilidade na Elgin L42 Pro.
  - **Refinamento de Dados**: Posicionamento preciso de QR Code, Seriais e informações técnicas para máxima conformidade visual.
- **v2.14.7**:
  - **Layout TSPL Definitivo**: Consolidação da estrutura técnica da etiqueta industrial utilizando uma combinação avançada de `BOX` e `BAR`.
  - **Cálculo de Volume Inteligente**: Integração da função `formatTotalVolume` diretamente no template para exibição precisa de volumes.
  - **Otimização de Hardware**: Configuração de `GAP 0mm` e calibração fina de fontes nativas (0-5) e QR Code (`M2, S7`) para máxima legibilidade na Elgin L42 Pro.
- **v2.14.6**:
  - **Realinhamento de Tabela TSPL**: Ajuste fino nas bordas externas e divisórias internas (usando comandos `BAR`) para garantir encaixe perfeito nas margens da bobina.
  - **Hierarquia de Informação**: Reorganização dos blocos técnicos e do cabeçalho institucional para uma leitura mais fluida e equilibrada.
- **v2.14.5**:
  - **Estruturação de Tabela Técnica (BOX)**: Implementação de moldura completa via comando `BOX` e realinhamento de todas as células técnicas em formato tabular avançado.
  - **Header e Rodapé Dinâmicos**: Reposicionamento do bloco Ambicom e dados de garantia para as margens, maximizando a área central para dados técnicos.
  - **Aprimoramento de QR Code**: Ajuste de posição e escala do QR Code dentro da nova estrutura de grade industrial girada.
- **v2.14.4**:
  - **Ajuste de Grade TSPL**: Reestruturação das colunas verticais e divisórias horizontais internas para otimizar o preenchimento da bobina.
  - **Padronização de Rótulos**: Consolidação de campos técnicos e ajustes de alinhamento para melhor aproveitamento de espaço.
- **v2.14.3**:
  - **Otimização de Coordenadas TSPL**: Ajuste fino de alinhamento e espaçamento em todas as células da grade técnica.
  - **Melhoria de Legibilidade**: Aumento estratégico de fontes em campos críticos e padronização de rótulos técnicos.
  - **Correção de Grade**: Ajuste milimétrico das linhas divisórias para garantir clareza visual e evitar sobreposições.
- **v2.14.2**:
  - **Refinamento do Layout TSPL**: Implementação de novo layout com rotação de 90 graus em todos os campos e grade técnica desenhada via comandos `BAR`, otimizando a legibilidade nas bobinas industriais de 80x55mm.
  - **Estabilização de Comandos**: Inclusão de `REFERENCE 0,0` e ajustes de sintaxe nos parâmetros de `GAP` e `DIRECTION`.
- **v2.14.1**:
  - **Correção de Restrição de Payload**: Atualização da constraint de banco de dados no Supabase para permitir o tipo `tspl`, corrigindo o erro 400 na submissão de trabalhos de impressão.
- **v2.14.0**:
  - **Migração Completa para TSPL**: Substituição do motor de impressão ZPL pelo padrão TSPL (Taiwan Semiconductor Printing Language) em todo o sistema, visando 100% de compatibilidade e fidelidade com a impressora Elgin L42 Pro.
  - **Atualização do Print Bridge**: Fila de impressão industrial agora processa jobs TSPL nativamente via PowerShell RAW.
  - **Precisão Dimensional**: Ajuste fino de coordenadas TSPL para bobinas de 80x55mm com layout técnico expandido.
- **v2.13.8**:
  - **Retorno à Orientação Paisagem (ZPL)**: Reversão do layout industrial para o modo Paisagem (640x440) para melhor compatibilidade com o hardware Elgin L42 Pro.
  - **Ajuste de Rotação**: Implementação da flag `^FWR` para alinhamento correto das etiquetas na bobina.
- **v2.13.7**:
  - **Consolidação de Layout ZPL**: Estabilização dos campos técnicos expandidos na etiqueta de 100x55mm, garantindo o correto mapeamento de Gases, Pressões e Volumes para impressão industrial via Print Bridge.
  - **Otimização de Exportação**: Refinamento dos utilitários de geração de PDF e ZPL para maior performance e precisão dimensional.
- **v2.13.6**:
  - **Redesign Completo do Layout ZPL**: Implementação de novo grid vertical otimizado para etiquetas de 100x55mm, incluindo campos técnicos expandidos (Volume Freezer/Refrig, Pressões, Capacidade de Congelamento, Potência de Degelo e Carga de Gás).
- **v2.13.5**:
  - **Refinamento de Layout ZPL**: Ajuste fino das coordenadas e margens para melhorar a legibilidade e o alinhamento das informações técnicas nas etiquetas.
- **v2.13.4:**
  - **Orientação Nativa para Impressora**: Remoção do comando `^FWR` (rotação forçada) para permitir que a Elgin L42 Pro gerencie a orientação via driver ou hardware.
  - **Recalibração ZPL**: Layout redesenhado para o modo Retrato (55x80mm) com coordenadas nativas.
- **v2.13.3:**
  - **Arquitetura de Impressão Componentizada**: Criação do hook `useRemotePrint` e do componente `RemotePrinterSelector` para centralizar a lógica de gestão de pontes e envio de jobs ZPL.
  - **Reversão para ZPL**: Retorno ao motor de impressão nativo ZPL por questões de estabilidade no ambiente industrial.
  - **Template 55x80mm Estabilizado**: Implementação do novo layout industrial em orientação paisagem (^FWR).
- **v2.13.1:**
  - **Calibração de Dimensões PDF**: Ajuste do formato para 80x55mm seguindo especificações industriais.
  - **Zero Margin Design**: Redução drástica das margens do PDF para garantir preenchimento total da bobina.
- **v2.13.0:**
  - **Migração para PDF**: Substituição completa do motor de impressão de ZPL para PDF em todo o sistema.
- **v2.12.8:**
  - **Refinamento de Rotação ZPL**: Substituição de `^FWB` por `^FWT` para ajuste de orientação superior.
  - **Consolidação de Layout**: Manutenção das dimensões 640x440 para alinhamento horizontal.
- **v2.12.7:**
  - **Ajuste de Rotação ZPL**: Substituição de `^POI` por `^FWB` para controle granular de orientação de campos.
  - **Redimensionamento de Bobina**: Ajuste para 640x440 dots visando alinhamento horizontal preciso.
- **v2.12.6:**
  - **Ajuste de Orientação ZPL**: Implementação do comando `^POI` (Print Orientation Inverted) para compatibilidade específica com a bobina física.
  - **Redimensionamento Vertical**: Ajuste de `^LL` para 640 dots visando melhor encaixe no papel atual.
- **v2.12.5:** 
  - **Calibração Dimensional Final**: Ajuste rigoroso dos templates ZPL para 100x55mm.
  - **Zero Margin Design**: Remoção de todas as bordas e offsets no ZPL para garantir impressão full-bleed.
  - **Correção de Sincronia**: Alinhamento das chaves de dados do OCR com os campos do banco de dados (InventoryProduct).
  - **ZPL Orientation Sync**: Sincronia modular entre `ScanPage` e `InventoryPage` respeitando a preferência do perfil.
- **v2.12.4:** Ajuste dimensional rigoroso para etiquetas de 100 x 55 mm (800x440 dots) com remoção completa de margens (bleed zero) em todos os modos.
- **v2.12.3:** Implementação de Orientação de Marcas Flexível: Restaurado layout vertical (v2.11.5) como padrão e adicionada opção de alternar para modo Paisagem (Horizontal) diretamente no Perfil do Usuário.
- **v2.12.1:** Rotação completa do layout ZPL da etiqueta industrial em 90 graus (retrato para paisagem) para suportar bobinas largas no perfil de impressão Print Bridge, aplicando um novo grid customizado de campos.
- **v2.12.0:** Implementação de Soft Delete no protocolo técnico. Itens excluídos agora são marcados como inativos (`is_active: false`), preservando a integridade de logs históricos enquanto limpa a interface do Admin, Técnico e Central de Revisão. Contagem de status técnico na aba de aprovações agora reflete apenas itens ativos.
- **v2.11.10:** Melhoria na Central de Revisão: implementada filtragem e agrupamento por categoria dos itens de checklist, garantindo que apenas itens do protocolo atual sejam exibidos no processo de aprovação.
- **v2.11.9:** Refinamento na formatação do "Volume Total" impresso nas etiquetas. O sistema agora extrai e soma inteligentemente os dados numéricos de `volume_freezer` e `volume_refrigerator` para compor o volume final impresso.
- **v2.11.8:** Correção na formatação do "Volume Total" impresso nas etiquetas PDF e ZPL, para exibir apenas o valor final (filtrando o padrão "Volume X / Volume Y / Total").
- **v2.11.7:** Implementação da impressão remota automática em lote diretamente da tela de Controle de Inventário, utilizando o Print Bridge configurado no perfil do usuário, com fallback para PDF.
- **v2.11.6:** Refatoração do fluxo de Impressão Remota (Print Bridge) removendo dependência legada e adotando PowerShell nativo. Otimização da UI de scan com um novo Modal Pós-Scan intuitivo.
- **v2.11.5:** Implementação do sistema de Impressão Remota Industrial e estabilização de lifecycle.
- **v2.11.4:** Correção de erro no script de `build` que impedia o build em ambientes baseados em Linux/sh (como Vercel). Implementação de script Node.js multiplataforma para compressão do build, configurado para rodar apenas em ambiente local (pula na Vercel).
- **v2.11.3:** Correção do erro fatal `setPhotoOptions failed` ao fechar a tela de scan. Implementação de proteção de ciclo de vida (`isMounted`) e tratamento robusto de exceções em constraints de hardware para evitar toasts de erro em segundo plano no encerramento da câmera.
- **v2.11.2:** Restauração e auditoria de segurança da função OCR. Ajuste de bypass de autenticação JWT em nível de gateway para resolver erro 401 e garantir funcionamento imediato do scanner, mantendo proteção via CORS e ocultação de chaves.
- **v2.11.1:** Ajuste de compatibilidade do ambiente de desenvolvimento. Adicionada declaração global para `Deno` na Edge Function para eliminar avisos visuais do IDE (VS Code/Cursor).
- **v2.11.0:** Melhoria crítica de segurança. Migração da lógica de OCR para Supabase Edge Functions, protegendo a chave de API do OpenRouter e centralizando o processamento de IA no servidor.
- **v2.10.11:** Correções críticas de compatibilidade para dispositivos de médio custo (Moto G35 5G). Implementação de aplicação granular de constraints, redução estratégica de resolução para 720p (evitando modo de compatibilidade do Chrome) e refinamento do ciclo de refoco de hardware.
- **v2.10.10:** Ativação manual do Modo Macro de hardware (`CONTROL_AF_MODE_MACRO`) e sincronização de exposição contínua para captura ultra-nítida de etiquetas em dispositivos Android.
- **v2.10.9:** Implementação de Zoom Automático (2x) e priorização inteligente da lente principal traseira para melhorar a leitura de etiquetas em dispositivos Motorola/Android.
- **v2.10.8:** Otimização profunda para dispositivos Android (Motorola). Implementação de controle real de hardware para foco contínuo e ciclo de refoco ativo ao clicar, melhorando capturas macro de etiquetas.
- **v2.10.7:** Correção de erro crítico no mapeamento de categorias de checklist (`TypeError: Cannot read properties of undefined (reading 'map')`) e implementação de estado vazio intuitivo ("Nenhum dado encontrado").
- **v2.10.6:** Correção profunda no fechamento automático da câmera. Implementação de atualizações silenciosas tanto no carregamento de detalhes do pedido quanto na atualização global da lista, garantindo a estabilidade do scanner.
- **v2.10.5:** Correção no fechamento automático da câmera de pedidos. Implementação de atualização silenciosa de dados para manter o scanner ativo e persistente durante o escaneamento de múltiplos itens.
- **v2.10.4:** Build de produção e atualização de versionamento conforme as diretrizes do projeto.
- **v2.10.3:** Correção crítica no encerramento da sessão da câmera. Uso de `useRef` para garantir a liberação do hardware ao fechar o scanner, evitando conflitos de "câmera já em uso".
- **v2.10.2:** Ajuste no fluxo de escaneamento para leitura manual via botão de captura, garantindo maior precisão e eliminando o loop de notificações para itens duplicados.
- **v2.10.1:** Melhorias significativanas na UX da câmera de pedidos: escaneamento contínuo (câmera persistente), botão de captura manual e notificações inteligentes para itens duplicados ou indisponíveis.
- **v2.10.0:** Implementação de Controle de Acesso Baseado em Função (RBAC). Menus expandidos para Técnicos, Supervisores e Gestores conforme necessidade operacional. Restrição de segurança: apenas Administradores podem excluir pedidos com status "CONCLUÍDO".
- **v2.9.1:** Ajuste no layout mobile do modal de pedidos, garantindo altura uniforme e largura total aos botões de ação para melhor usabilidade.
- **v2.9.0:** Padronização Global da experiência móvel (Mobile UX). Todas as listagens de tabelas foram refatoradas para o padrão Compact Expandable List, otimizando o uso de tela e acessibilidade em dispositivos móveis.
- **v2.8.2:** Correção de erro crítico na edição de inventário (crash de formatação de data) e melhoria no acesso a dados relacionados.
- **v2.8.1:** Adicionada validação para impedir a finalização de pedidos vazios sem produtos.
- **v2.7.11:** Substituição dos botões do modal de acompanhamento do pedido por um único botão "Aguardar" para otimização do fluxo.
- **v2.7.10:** Refatoração do fluxo de criação de Pedidos (criação simplificada com adição posterior de itens via scanner) e detalhamento aprimorado.
- **v2.7.9:** Correção na exibição do Preço Unitário nos detalhes do pedido (campo ausente na consulta).
- **v2.7.8:** Refatoração da visualização de pedidos: remoção do scanner de conferência, adição de resumo por tamanho (P/M/G) e simplificação da finalização de pedidos.
- **v2.7.7:** Correção do bug de fechamento das categorias no checklist técnico (trava de expansão automática).
- **v2.7.6:** Remoção do botão de filtro "Marca" na Central de Revisão para simplificação da interface.
- **v2.7.5:** Ajustes de alinhamento e melhorias na UX.

## 📄 Licença

Este projeto está sob a licença [MIT](LICENSE).

---
Desenvolvido com ❤️ por [Ronick](https://github.com/Ronickbr)
