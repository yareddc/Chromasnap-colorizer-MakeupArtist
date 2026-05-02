Add-Type -AssemblyName System.Drawing

$W = 1024; $H = 500
$half = [int]($W / 2)
$outDir = Join-Path $PSScriptRoot "..\android\playstore\feature-graphics"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$purple   = [System.Drawing.Color]::FromArgb(255,192,132,252)
$darkPurp = [System.Drawing.Color]::FromArgb(255,80,10,130)
$deepBg   = [System.Drawing.Color]::FromArgb(255,8,6,22)
$midBg    = [System.Drawing.Color]::FromArgb(255,45,5,75)

$sf = New-Object System.Drawing.StringFormat
$sf.Alignment     = [System.Drawing.StringAlignment]::Center
$sf.LineAlignment = [System.Drawing.StringAlignment]::Center
$sf.FormatFlags   = [System.Drawing.StringFormatFlags]::NoClip

# ─── GRAPHIC 1: Before / After ───────────────────────────────────────────────
$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g   = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

# Left: near-black; Right: dark purple
$g.FillRectangle([System.Drawing.Brushes]::Black, 0, 0, $half, $H)
$bRight = New-Object System.Drawing.SolidBrush($darkPurp)
$g.FillRectangle($bRight, $half, 0, $half, $H)
$bRight.Dispose()

# Divider
$divPen = New-Object System.Drawing.Pen($purple, 3)
$g.DrawLine($divPen, $half, 0, $half, $H)
$divPen.Dispose()

# Labels
$fLabel = New-Object System.Drawing.Font("Arial", 15, [System.Drawing.FontStyle]::Bold)
$bGray  = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(160,255,255,255))
$bPurp  = New-Object System.Drawing.SolidBrush($purple)
$bWhite = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$g.DrawString("BEFORE", $fLabel, $bGray,  (New-Object System.Drawing.RectangleF(0,    24, $half, 32)), $sf)
$g.DrawString("AFTER",  $fLabel, $bPurp,  (New-Object System.Drawing.RectangleF($half, 24, $half, 32)), $sf)

# Main title
$fTitle = New-Object System.Drawing.Font("Arial", 62, [System.Drawing.FontStyle]::Bold)
$g.DrawString("ChromaSnap", $fTitle, $bWhite, (New-Object System.Drawing.RectangleF(12, 160, $W-24, 140)), $sf)

# Subtitle
$fSub = New-Object System.Drawing.Font("Arial", 17)
$g.DrawString("AI Photo Colorizer - bring memories back to life", $fSub, $bGray, (New-Object System.Drawing.RectangleF(40, 318, $W-80, 44)), $sf)

# Decorative soft circles (right side)
$cBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(30,255,255,255))
$g.FillEllipse($cBrush, 700,  12, 160, 160)
$g.FillEllipse($cBrush, 845, 295, 100, 100)
$cBrush.Dispose()

$bmp.Save("$outDir\feature-graphic-1-before-after.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
$fLabel.Dispose(); $fTitle.Dispose(); $fSub.Dispose()
$bGray.Dispose(); $bPurp.Dispose(); $bWhite.Dispose()
Write-Host "Graphic 1 done"

# ─── GRAPHIC 2: AI Power ─────────────────────────────────────────────────────
$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g   = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$grad2 = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Rectangle(0,0,$W,$H)),
    $deepBg, $midBg,
    [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal)
$g.FillRectangle($grad2, 0, 0, $W, $H)
$grad2.Dispose()

# Dot grid
$dotB = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(20,192,132,252))
for ($dx=0; $dx -lt $W; $dx+=40) {
    for ($dy=0; $dy -lt $H; $dy+=40) {
        $g.FillEllipse($dotB, $dx-2, $dy-2, 5, 5)
    }
}
$dotB.Dispose()

$bWhite2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$bPurp2  = New-Object System.Drawing.SolidBrush($purple)
$bLight2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(170,255,255,255))

$fBig2  = New-Object System.Drawing.Font("Arial", 62, [System.Drawing.FontStyle]::Bold)
$fMed2  = New-Object System.Drawing.Font("Arial", 20)
$fItal2 = New-Object System.Drawing.Font("Arial", 15, [System.Drawing.FontStyle]::Italic)
$fPill2 = New-Object System.Drawing.Font("Arial", 13)

$g.DrawString("ChromaSnap",               $fBig2,  $bPurp2,  (New-Object System.Drawing.RectangleF(12, 100, $W-24, 140)), $sf)
$g.DrawString("Powered by Google Vertex AI", $fMed2, $bWhite2, (New-Object System.Drawing.RectangleF(40, 258, $W-80,  46)), $sf)
$g.DrawString("Colorize  ·  Animate  ·  Enhance", $fItal2, $bLight2, (New-Object System.Drawing.RectangleF(40, 312, $W-80, 36)), $sf)

# Pill badges
$pillB = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(55,192,132,252))
$labels = @("AI Colorization","Smart Animation","One-Tap Enhance")
$px = 155
foreach ($lbl in $labels) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $r=22; $pw=216; $ph=42
    $path.AddArc($px,$py,$r,$r,180,90) | Out-Null
    $path.AddArc($px+$pw-$r,394,$r,$r,270,90) | Out-Null
    $path.AddArc($px+$pw-$r,394+$ph-$r,$r,$r,0,90) | Out-Null
    $path.AddArc($px,394+$ph-$r,$r,$r,90,90) | Out-Null
    $path.CloseFigure()
    $g.FillPath($pillB, $path)
    $path.Dispose()
    $g.DrawString($lbl, $fPill2, $bWhite2, (New-Object System.Drawing.RectangleF($px, 394, 216, 42)), $sf)
    $px += 250
}
$pillB.Dispose()

$bmp.Save("$outDir\feature-graphic-2-ai-power.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
$fBig2.Dispose(); $fMed2.Dispose(); $fItal2.Dispose(); $fPill2.Dispose()
$bWhite2.Dispose(); $bPurp2.Dispose(); $bLight2.Dispose()
Write-Host "Graphic 2 done"

# ─── GRAPHIC 3: Restore Memories ─────────────────────────────────────────────
$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g   = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$grad3 = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Rectangle(0,0,$W,$H)),
    [System.Drawing.Color]::FromArgb(255,10,4,4),
    [System.Drawing.Color]::FromArgb(255,45,6,55),
    [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal)
$g.FillRectangle($grad3, 0, 0, $W, $H)
$grad3.Dispose()

# Diagonal stripes
$sP = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(9,255,255,255), 1)
for ($si = -$H; $si -lt $W+$H; $si += 28) {
    $g.DrawLine($sP, $si, 0, $si+$H, $H)
}
$sP.Dispose()

$bWhite3 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$bPurp3  = New-Object System.Drawing.SolidBrush($purple)
$bLight3 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(150,255,255,255))

$fHero3  = New-Object System.Drawing.Font("Georgia", 40, [System.Drawing.FontStyle]::Italic)
$fBig3   = New-Object System.Drawing.Font("Arial",   58, [System.Drawing.FontStyle]::Bold)
$fSub3   = New-Object System.Drawing.Font("Arial",   17)

$g.DrawString("Restore Your Memories",  $fHero3, $bLight3, (New-Object System.Drawing.RectangleF(20,  68, $W-40,  76)), $sf)
$g.DrawString("ChromaSnap",             $fBig3,  $bPurp3,  (New-Object System.Drawing.RectangleF(12, 158, $W-24, 116)), $sf)
$g.DrawString("Turn old black-and-white photos into vivid, colorful moments", $fSub3, $bWhite3, (New-Object System.Drawing.RectangleF(80, 292, $W-160, 56)), $sf)

# Bottom accent line — simple gradient left transparent → purple → transparent
$acL = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Rectangle(180, 380, $W-360, 4)),
    [System.Drawing.Color]::FromArgb(0,192,132,252),
    $purple,
    [System.Drawing.Drawing2D.LinearGradientMode]::Horizontal)
$g.FillRectangle($acL, 180, 380, $W-360, 4)
$acL.Dispose()

$bmp.Save("$outDir\feature-graphic-3-memories.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
$fHero3.Dispose(); $fBig3.Dispose(); $fSub3.Dispose()
$bWhite3.Dispose(); $bPurp3.Dispose(); $bLight3.Dispose()
Write-Host "Graphic 3 done"

Write-Host ""
Get-ChildItem $outDir | ForEach-Object { "  " + $_.Name + "  " + [math]::Round($_.Length/1KB,1) + " KB" }
