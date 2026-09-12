param(
    [string]$ImagePath
)

Add-Type -AssemblyName System.Drawing
[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.StorageFile, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null

function Get-OcrText([string]$fileFullPath) {
    $fileTask = [Windows.Storage.StorageFile]::GetFileFromPathAsync($fileFullPath)
    $asTaskMethod = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
        $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -match 'IAsyncOperation' 
    } | Select-Object -First 1

    # Using awaiter pattern
    $file = $fileTask.GetAwaiter().GetResult()
    $streamTask = $file.OpenAsync([Windows.Storage.FileAccessMode]::Read)
    $stream = $streamTask.GetAwaiter().GetResult()

    $decoderTask = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
    $decoder = $decoderTask.GetAwaiter().GetResult()

    $bitmapTask = $decoder.GetSoftwareBitmapAsync()
    $bitmap = $bitmapTask.GetAwaiter().GetResult()

    $lang = [Windows.Globalization.Language]::new('es-MX')
    $ocrEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
    $ocrResultTask = $ocrEngine.RecognizeAsync($bitmap)
    $ocrResult = $ocrResultTask.GetAwaiter().GetResult()

    return $ocrResult.Text
}

$fullPath = [System.IO.Path]::GetFullPath($ImagePath)
$text = Get-OcrText $fullPath
Write-Output "=== OCR RESULT FOR $fullPath ==="
Write-Output $text
