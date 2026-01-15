$content = Get-Content -Path "c:\MLB\roster-europe.html" -Raw
$newContent = $content -replace '<button class="<button class="stats-modal-close" id="statsModalClose" aria-label="Fermer"></button>', '<button class="stats-modal-close" id="statsModalClose" aria-label="Fermer">×</button>'
$newContent | Set-Content -Path "c:\MLB\roster-europe.html" -Encoding UTF8
Write-Host "Fixed"
