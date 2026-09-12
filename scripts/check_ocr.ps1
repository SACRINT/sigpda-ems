Add-Type -AssemblyName System.Drawing
[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
$langs = [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages
Write-Output "Available OCR Languages count: $($langs.Count)"
foreach ($l in $langs) {
    Write-Output " - $($l.LanguageTag): $($l.DisplayName)"
}
