param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [Parameter(Mandatory = $false)]
    [string]$RuntimeServiceAccount
)

$ErrorActionPreference = 'Stop'

$secrets = @(
    'GEMINI_API_KEY',
    'JWT_SECRET',
    'ADMIN_API_KEY',
    'CAPTCHA_SECRET_KEY',
    'CAPTCHA_BYPASS_TOKEN'
)

function Test-SecretExists {
    param([string]$SecretName)

    gcloud secrets describe $SecretName --project $ProjectId *> $null
    return $LASTEXITCODE -eq 0
}

function Ensure-Secret {
    param([string]$SecretName)

    if (Test-SecretExists -SecretName $SecretName) {
        Write-Host "Secret exists: $SecretName"
    }
    else {
        Write-Host "Creating secret: $SecretName"
        gcloud secrets create $SecretName --project $ProjectId --replication-policy automatic | Out-Null
    }
}

function Read-SecretValue {
    param([string]$SecretName)

    $envValue = [Environment]::GetEnvironmentVariable($SecretName)
    if (-not [string]::IsNullOrWhiteSpace($envValue)) {
        return $envValue
    }

    $secureValue = Read-Host -AsSecureString "Enter value for $SecretName (leave empty to skip)"
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
    try {
        $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
        return $plain
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

function Add-SecretVersion {
    param(
        [string]$SecretName,
        [string]$SecretValue
    )

    if ([string]::IsNullOrWhiteSpace($SecretValue)) {
        Write-Host "Skipped version add for $SecretName"
        return
    }

    $tempFile = [System.IO.Path]::GetTempFileName()
    try {
        [System.IO.File]::WriteAllText($tempFile, $SecretValue)
        gcloud secrets versions add $SecretName --project $ProjectId --data-file $tempFile | Out-Null
        Write-Host "Added new version for $SecretName"
    }
    finally {
        Remove-Item -Path $tempFile -ErrorAction SilentlyContinue
    }
}

function Grant-SecretAccess {
    param([string]$SecretName)

    if ([string]::IsNullOrWhiteSpace($RuntimeServiceAccount)) {
        return
    }

    gcloud secrets add-iam-policy-binding $SecretName `
        --project $ProjectId `
        --member "serviceAccount:$RuntimeServiceAccount" `
        --role roles/secretmanager.secretAccessor | Out-Null

    Write-Host "Granted secret access on $SecretName to $RuntimeServiceAccount"
}

Write-Host "Using project: $ProjectId"
if ([string]::IsNullOrWhiteSpace($RuntimeServiceAccount)) {
    Write-Host 'Runtime service account not provided; skipping IAM grants.'
}
else {
    Write-Host "Runtime service account: $RuntimeServiceAccount"
}

Write-Host ''
foreach ($secret in $secrets) {
    Ensure-Secret -SecretName $secret
    $value = Read-SecretValue -SecretName $secret
    Add-SecretVersion -SecretName $secret -SecretValue $value
    Grant-SecretAccess -SecretName $secret
    Write-Host ''
}

Write-Host 'Secret setup complete.'
Write-Host 'Next: gcloud builds submit --config cloudbuild.private.yaml --substitutions _SERVICE=chromasnap-server,_REGION=us-central1,_GCP_LOCATION=us-central1'
