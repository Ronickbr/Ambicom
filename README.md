# Ambicom

![Ambicom Logo](https://ambicom.com.br/wp-content/uploads/2019/03/logoambicom.jpg) <!-- Substitua por um logo real se disponível -->

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
   git clone https://github.com/Ambicom/Etiquetas.git
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

Este projeto utiliza o versionamento semântico. A versão atual é **v2.32.11**, representando uma evolução significativa na arquitetura e funcionalidades do sistema original.

### 📝 Histórico de Versões
  - **v2.32.11**:
    - **Remoção de Sombras na Impressão**: Limpeza total dos estilos de interface (sombras, bordas de modal e fundos cinzas) que vazavam para o documento impresso. Implementação de margens de segurança físicas (8mm) para evitar cortes nas bordas do papel em impressoras e drivers mobile.
  - **v2.32.10**:
    - **Ajuste de Visualização Mobile (Preview)**: Correção do layout do cabeçalho do preview e implementação de rolagem horizontal no container do documento. Agora, o relatório mantém as dimensões A4 reais sem cortes, permitindo navegação completa em telas pequenas.
  - **v2.32.9**:
    - **Otimização de Impressão Mobile**: Correção do problema de corte do relatório em dispositivos móveis. Implementação de viewport fixo (1024px) no iframe de impressão para garantir a renderização correta do layout A4 e ajuste das margens e dimensões no CSS `@media print`.
  - **v2.32.8**:
    - **Correção da Impressão de Pedidos**: Implementação de estilos `@media print` e a classe `no-print` para isolar o relatório de pedidos durante a impressão. Otimização da lógica de foco no iframe de impressão para evitar que o navegador imprima a página inteira ou elementos da interface do modal.
  - **v2.32.7**:
    - **Otimização de Modal Mobile**: Ajuste no alinhamento vertical (`items-start`) para garantir que o cabeçalho do modal de clientes nunca seja cortado em telas de baixa resolução, mantendo a centralização apenas em tablets e computadores.
  - **v2.32.6**:
    - **Responsividade Mobile**: Correção na centralização e visibilidade do modal de gestão de clientes em dispositivos móveis. Implementação de container de rolagem e ajuste no empilhamento de campos para garantir acesso completo aos botões e ao cabeçalho.
  - **v2.32.5**:
    - **Configuração de Ambiente**: Criação do arquivo `.env` com as credenciais do Supabase e do arquivo `.env.example` para documentação do projeto.
  - **v2.32.4**:
    - **Correção Etiqueta**: Resolvido problema em que campos técnicos (PNC, Carga de Gás, Compressor, etc.) não eram exibidos na etiqueta quando impressa a partir da página de Inventário. Ajuste na lógica de fallback da frequência para 60 Hz.
  - **v2.32.3**:
    - **Visualização de PDF**: Correção na interface de pré-visualização de ordens, onde fontes claras e transparentes dificultavam a leitura. Ajustes CSS base para suportar e forçar o texto no formato impressão independentemente do tema ativo na aplicação.
  - **v2.32.2**:
    - **Limpeza de Repositório**: Remoção de scripts temporários de teste, configurações duplicadas e backups obsoletos para higienização do projeto.
  - **v2.32.0**:
    - **Otimização de UI/UX**: Correção de visibilidade e contraste nos temas claro/escuro.
    - **Ajuste de Tabelas**: Colunas fixas agora utilizam fundo sólido para evitar sobreposição de dados.
    - **Modal de Exclusão**: Padronização do fundo do modal de inventário para suporte dinâmico a temas.
  - **v2.31.0**:
    - **Normalização de Dados**: Disponibilização de script de manutenção para correção massiva de encoding (UTF-8) no banco de dados.
  - **v2.30.1**:
    - **Correção de OCR**: Ajuste fino na sintaxe da API OpenAI e resolução de erro de autenticação (401) na Edge Function.
  - **v2.30.0**:
    - **Ajuste de Payload**: Otimização manual do formato de envio de imagem (Base64) para a Edge Function.
  - **v2.29.0**:
    - **Migração de IA**: Substituição do provedor OpenRouter pela OpenAI oficial.
    - **Otimização de Modelo**: Implementação do modelo `gpt-4o-mini` para OCR de alta performance e baixo custo.
    - **Atualização de Edge Functions**: Refatoração completa da função de OCR para suporte nativo à API da OpenAI.
  - **v2.27.0**:
    - **Unificação de Temas (Modais)**: Padronização visual completa dos modais de detalhes em Aprovações e Inventário, corrigindo alto contraste e visibilidade no tema claro.
    - **Otimização de Tabelas (No-Scroll)**: Remoção do scroll vertical interno das tabelas de listagem, aproveitando o fluxo natural da página já paginada.
    - **Simplificação de Arquitetura**: Remoção da biblioteca de virtualização e refatoração do mapeamento de dados no módulo de Inventário.
## 📄 Licença

Este projeto está sob a licença [MIT](LICENSE).

---
Desenvolvido com ❤️ por [RNBConsultoria](https://github.com/Ronickbr)
