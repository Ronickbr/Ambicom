param(
    [Parameter(Mandatory=$true)][string]$PrinterName,
    [Parameter(Mandatory=$true)][string]$FilePath
)

# 1. Encontrar o Chrome
$ChromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $ChromePath)) {
    $ChromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
}
if (-not (Test-Path $ChromePath)) {
    $ChromePath = "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
}

if (-not (Test-Path $ChromePath)) {
    Write-Error "Chrome não encontrado no sistema."
    exit 1
}

# 2. Obter impressora padrão atual
$DefaultPrinter = Get-CimInstance -ClassName Win32_Printer -Filter "Default=True"

try {
    # 3. Mudar impressora padrão temporariamente
    if ($DefaultPrinter -and $DefaultPrinter.Name -ne $PrinterName) {
        $Printer = Get-CimInstance -ClassName Win32_Printer -Filter "Name='$PrinterName'"
        if ($Printer) {
            Invoke-CimMethod -InputObject $Printer -MethodName SetDefaultPrinter | Out-Null
        } else {
            Write-Error "Impressora '$PrinterName' não encontrada."
            exit 1
        }
    }

    # 4. Iniciar Chrome isolado
    # --user-data-dir isola este Chrome do navegador principal do usuário
    # --kiosk-printing força a impressão sem diálogo
    $TempProfile = Join-Path -Path $env:TEMP -ChildPath "ChromePrintProfile"
    
    $Args = @(
        "--user-data-dir=`"$TempProfile`"",
        "--kiosk-printing",
        "--disable-extensions",
        "--disable-plugins",
        "--incognito",
        "--window-position=-2000,-2000",
        "`"$FilePath`""
    )

    $Process = Start-Process -FilePath $ChromePath -ArgumentList $Args -PassThru
    
    # 5. Aguarda 10 segundos para dar tempo ao spooler do Windows receber o arquivo
    Start-Sleep -Seconds 10
    
    # 6. Força o encerramento do processo isolado
    if (-not $Process.HasExited) {
        Stop-Process -Id $Process.Id -Force
    }
    
    Write-Output "Impressão via Chrome enviada com sucesso para $PrinterName."

} finally {
    # 7. Restaurar impressora padrão original sempre
    if ($DefaultPrinter -and $DefaultPrinter.Name -ne $PrinterName) {
        Invoke-CimMethod -InputObject $DefaultPrinter -MethodName SetDefaultPrinter | Out-Null
    }
}
