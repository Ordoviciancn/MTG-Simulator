$ErrorActionPreference = 'Stop'
$missing = @()
foreach ($name in @('java', 'javac', 'mvn', 'git')) {
    $tool = Get-Command $name -ErrorAction SilentlyContinue
    if ($tool) {
        Write-Output ("FOUND {0}: {1}" -f $name, $tool.Source)
    } else {
        Write-Output ("MISSING {0}" -f $name)
        $missing += $name
    }
}
if ($missing.Count -gt 0) {
    Write-Output 'Install JDK 17 and Maven 3.9.x, add their bin directories to PATH, then restart your terminal.'
    exit 1
}
Write-Output 'Tool paths found. Verify Java >= 17 and Maven >= 3.8.1 with java -version and mvn -version before building Forge.'
