param(
    [Parameter(Mandatory=$true)][string]$PrinterName,
    [Parameter(Mandatory=$true)][string]$FilePath
)

# Verifica se o arquivo existe
if (-not (Test-Path $FilePath)) {
    Write-Error "Arquivo não encontrado: $FilePath"
    exit 1
}

try {
    # 1. Prioridade: SumatraPDF (Melhor para automação invisível)
    # Procura na pasta atual ou no PATH
    $sumatraPath = Join-Path $PSScriptRoot "SumatraPDF.exe"
    if (-not (Test-Path $sumatraPath)) {
        $sumatraPath = "SumatraPDF.exe"
    }

    if (Get-Command $sumatraPath -ErrorAction SilentlyContinue) {
        Write-Host "Usando SumatraPDF para impressão silenciosa..."
        $process = Start-Process -FilePath $sumatraPath -ArgumentList "-print-to `"$PrinterName`" -silent `"$FilePath`"" -PassThru -Wait
        Write-Host "Comando enviado via SumatraPDF."
        exit 0
    }

    # 2. Fallback: Microsoft Edge (Pode mostrar janela rapida)
    Write-Host "SumatraPDF não encontrado. Tentando Microsoft Edge..."
    $edgePath = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
    if (-not (Test-Path $edgePath)) {
        $edgePath = "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe"
    }

    if (Test-Path $edgePath) {
        Write-Host "Iniciando renderização via Edge para: $PrinterName"
        $fileUri = "file://" + $FilePath.Replace("\", "/")
        
        # O modo headless NAO imprime em papel fisico, por isso usamos kiosk
        $argList = "--kiosk-printing --new-window --no-pdf-header --printer-name=""$PrinterName"" ""$fileUri"""
        
        $process = Start-Process -FilePath $edgePath -ArgumentList $argList -PassThru
        
        # Aguarda no máximo 15 segundos para o spooler receber
        $timeout = 0
        while (-not $process.HasExited -and $timeout -lt 15) {
            Start-Sleep -Seconds 1
            $timeout++
        }
        
        if (-not $process.HasExited) {
            Write-Host "Encerrando processo do navegador..."
            $process | Stop-Process -Force
        }
        
        Write-Host "Comando finalizado via Edge."
        exit 0
    }

    # 3. Fallback Final: Sistema padrão
    Write-Host "Tentando método padrão do sistema..."
    $process = Start-Process -FilePath $FilePath -Verb PrintTo -ArgumentList $PrinterName -PassThru -ErrorAction SilentlyContinue
    if ($null -eq $process) {
         $originalPrinter = (Get-Printer | Where-Object { $_.IsDefault }).Name
         (Get-WmiObject -Query "Select * from Win32_Printer Where Name = '$PrinterName'").SetDefaultPrinter()
         Start-Process -FilePath $FilePath -Verb Print -Wait
         (Get-WmiObject -Query "Select * from Win32_Printer Where Name = '$originalPrinter'").SetDefaultPrinter()
    }
    
    exit 0
} catch {
    Write-Error "Erro fatal no script de impressão: $($_.Exception.Message)"
    exit 1
}
