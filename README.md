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

Este projeto utiliza o versionamento semântico. A versão atual é **v2.10.8**, representando uma evolução significativa na arquitetura e funcionalidades do sistema original.

### 📝 Histórico de Versões
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
