# Ambicom Print Bridge

O **Ambicom Print Bridge** é um serviço local (Node.js) que atua como o "braço executor" para a fila de impressão gerenciada via Supabase. Ele permite que o sistema web envie comandos de impressão de qualquer lugar, que são capturados e executados pela impressora física conectada a este computador.

## 🚀 Novidades (v2.24.1)
- **Integração Nativa Node:** Migração do motor de impressão PDF para o componente `pdf-to-printer`.
- **Independência de Scripts:** Removida a dependência direta de scripts PowerShell para manipulação de PDFs.
- **Auto-Discovery:** Listagem de impressoras do Windows realizada nativamente via Node.

## 🛠️ Pré-requisitos
- **Node.js** (v18 ou superior).
- **Impressora Industrial** instalada e configurada no Windows (ex: Elgin L42 Pro).
- Acesso à internet para sincronização com o Supabase.

## 📦 Instalação

1. Acesse o diretório da ponte:
   ```bash
   cd tools/print-bridge
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure o arquivo `.env`:
   Crie ou edite o `.env` com as credenciais do seu projeto Supabase:
   ```env
   SUPABASE_URL=https://sua-url.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role
   BRIDGE_NAME=Estacao-Impressao-01
   ```
   *Nota: Use a chave `service_role` para que a ponte tenha permissão de atualizar o status dos jobs.*

## 🏃 Como Rodar

Para iniciar a ponte:
```bash
npm start
```

A ponte ficará online e aparecerá como uma opção de destino nas telas de **Scan** e **Inventário** do painel Ambicom.

## 📄 Formatos Suportados
- **PDF (Recomendado):** Impressão de alta fidelidade processada via `pdf-to-printer`.
- **ZPL/TSPL:** Comandos industriais brutos (enviados via socket/driver raw).

## 🔍 Logs
O histórico de operações pode ser consultado no arquivo `bridge.log` gerado na mesma pasta.
