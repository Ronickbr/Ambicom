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
    Write-Host "Enviando PDF para impressora: $PrinterName"
    
    # Tenta usar o verbo 'PrintTo' que permite especificar a impressora
    # Este verbo é suportado por visualizadores como Adobe Reader, SumatraPDF, etc.
    $process = Start-Process -FilePath $FilePath -Verb PrintTo -ArgumentList $PrinterName -PassThru -ErrorAction SilentlyContinue
    
    if ($null -eq $process) {
        Write-Host "Verbo PrintTo não suportado. Tentando alterar impressora padrão temporariamente..."
        
        # Fallback: Altera a impressora padrão, imprime e restaura
        $originalPrinter = (Get-Printer | Where-Object { $_.IsDefault }).Name
        
        (Get-WmiObject -Query "Select * from Win32_Printer Where Name = '$PrinterName'").SetDefaultPrinter()
        Start-Process -FilePath $FilePath -Verb Print -Wait
        
        if ($originalPrinter) {
            (Get-WmiObject -Query "Select * from Win32_Printer Where Name = '$originalPrinter'").SetDefaultPrinter()
        }
    } else {
        # Aguarda um pouco para o spooler processar e fecha se o processo não fechar sozinho
        Start-Sleep -Seconds 5
        if (-not $process.HasExited) {
            $process | Stop-Process -Force
        }
    }
    
    Write-Host "Sucesso ao enviar PDF para o spooler."
    exit 0
} catch {
    Write-Error "Erro ao imprimir PDF: $($_.Exception.Message)"
    exit 1
}
