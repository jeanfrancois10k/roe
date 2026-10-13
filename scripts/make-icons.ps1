Add-Type -AssemblyName System.Drawing

$sourcePath = 'c:\Users\herod\OneDrive\Desktop\ROE\admin-web\public\logo.png'
$resPath = 'c:\Users\herod\OneDrive\Desktop\ROE\android-vendor\app\src\main\res'

$densities = @{
    'mipmap-mdpi' = 48
    'mipmap-hdpi' = 72
    'mipmap-xhdpi' = 96
    'mipmap-xxhdpi' = 144
    'mipmap-xxxhdpi' = 192
}

$srcImg = [System.Drawing.Image]::FromFile($sourcePath)

foreach ($d in $densities.Keys) {
    $dir = Join-Path $resPath $d
    if (-not (Test-Path $dir)) { 
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    
    $size = $densities[$d]
    $destBitmap = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($destBitmap)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($srcImg, 0, 0, $size, $size)
    $g.Dispose()

    $destBitmap.Save((Join-Path $dir 'ic_launcher.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    $destBitmap.Save((Join-Path $dir 'ic_launcher_round.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    $destBitmap.Dispose()
    Write-Host "Created $d ($size x $size)"
}

$drawableDir = Join-Path $resPath 'drawable'
if (-not (Test-Path $drawableDir)) { 
    New-Item -ItemType Directory -Path $drawableDir -Force | Out-Null
}
Copy-Item $sourcePath (Join-Path $drawableDir 'app_logo.png') -Force
Write-Host "Copied drawable/app_logo.png"

$srcImg.Dispose()
Write-Host "All icons generated successfully!"
