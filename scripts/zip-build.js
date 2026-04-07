import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Verifica se está rodando na Vercel
if (process.env.VERCEL === '1') {
    console.log('Ambiente Vercel detectado. Pulando compressão do build.');
    process.exit(0);
}

// Em módulos ESM, usamos process.cwd() ou import.meta.url para resolver caminhos
const rootPath = process.cwd();
const packageJsonPath = path.join(rootPath, 'package.json');
const distPath = path.join(rootPath, 'dist');

try {
    // Obtém a versão do package.json
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const version = pkg.version.replace(/\./g, '_');
    const zipName = `versao${version}.zip`;
    const zipPath = path.join(distPath, zipName);

    console.log(`Iniciando compressão do build local (v${pkg.version})...`);

    if (!fs.existsSync(distPath)) {
        console.error('Erro: Pasta "dist" não encontrada. Execute o build primeiro.');
        process.exit(1);
    }

    const isWindows = process.platform === 'win32';

    if (isWindows) {
        console.log('Ambiente Windows detectado. Usando PowerShell...');
        const command = `powershell -Command "Compress-Archive -Path '${distPath}/*' -DestinationPath '${zipPath}' -Force"`;
        execSync(command, { stdio: 'inherit' });
    } else {
        console.log('Ambiente Unix detectado. Verificando comando "zip"...');
        try {
            // Tenta usar o comando 'zip' do sistema
            execSync(`cd "${distPath}" && zip -r "${zipName}" .`, { stdio: 'inherit' });
        } catch (e) {
            console.warn('Aviso: Comando "zip" não encontrado ou falhou. O arquivo .zip não foi gerado.');
        }
    }

    if (fs.existsSync(zipPath)) {
        console.log(`Sucesso! Arquivo gerado em: ${zipPath}`);
    }
} catch (error) {
    console.error('Erro durante a compressão:', error.message);
    process.exit(1);
}
