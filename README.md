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

## 📈 Versionamento

Este projeto utiliza o versionamento semântico. A versão atual é **v2.7.8**, representando uma evolução significativa na arquitetura e funcionalidades do sistema original.

### 📝 Histórico de Versões (v2.7.x)
- **v2.7.8:** Refatoração da visualização de pedidos: remoção do scanner de conferência, adição de resumo por tamanho (P/M/G) e simplificação da finalização de pedidos.
- **v2.7.7:** Correção do bug de fechamento das categorias no checklist técnico (trava de expansão automática).
- **v2.7.6:** Remoção do botão de filtro "Marca" na Central de Revisão para simplificação da interface.
- **v2.7.5:** Ajustes de alinhamento e melhorias na UX.

## 📄 Licença

Este projeto está sob a licença [MIT](LICENSE).

---
Desenvolvido com ❤️ por [Ronick](https://github.com/Ronickbr)
