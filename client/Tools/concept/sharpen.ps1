Add-Type -AssemblyName System.Drawing

function Sharpen-And-Upscale($inFile, $outFile, [int]$scale = 4) {
  $src = [System.Drawing.Bitmap]::FromFile($inFile)
  $w = $src.Width * $scale
  $h = $src.Height * $scale

  # Step 1: High Quality Bicubic Upscale
  $upscaled = [System.Drawing.Bitmap]::new($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($upscaled)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.DrawImage($src, 0, 0, $w, $h)
  $g.Dispose()
  $src.Dispose()

  # Step 2: Unsharp Mask Convolution on Pixel Bytes
  $sharpened = [System.Drawing.Bitmap]::new($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  
  # LockBits for fast direct memory processing
  $rect = [System.Drawing.Rectangle]::new(0, 0, $w, $h)
  $srcData = $upscaled.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $dstData = $sharpened.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

  $bytes = [Math]::Abs($srcData.Stride) * $h
  $srcBuf = New-Object byte[] $bytes
  $dstBuf = New-Object byte[] $bytes

  [System.Runtime.InteropServices.Marshal]::Copy($srcData.Scan0, $srcBuf, 0, $bytes)
  [System.Runtime.InteropServices.Marshal]::Copy($srcData.Scan0, $dstBuf, 0, $bytes)

  $stride = $srcData.Stride

  # 3x3 Sharpen Kernel:
  # [ -0.5, -1.0, -0.5 ]
  # [ -1.0,  7.0, -1.0 ]
  # [ -0.5, -1.0, -0.5 ]
  # Sum of weights = 1.0 (conserves energy, boosts high frequencies)
  for ($y = 1; $y -lt $h - 1; $y++) {
    $rowPrev = ($y - 1) * $stride
    $rowCurr = $y * $stride
    $rowNext = ($y + 1) * $stride

    for ($x = 1; $x -lt $w - 1; $x++) {
      $colPrev = ($x - 1) * 4
      $colCurr = $x * 4
      $colNext = ($x + 1) * 4

      # Process B, G, R channels (indices 0, 1, 2)
      for ($c = 0; $c -lt 3; $c++) {
        $p00 = $srcBuf[$rowPrev + $colPrev + $c]
        $p01 = $srcBuf[$rowPrev + $colCurr + $c]
        $p02 = $srcBuf[$rowPrev + $colNext + $c]
        $p10 = $srcBuf[$rowCurr + $colPrev + $c]
        $p11 = $srcBuf[$rowCurr + $colCurr + $c]
        $p12 = $srcBuf[$rowCurr + $colNext + $c]
        $p20 = $srcBuf[$rowNext + $colPrev + $c]
        $p21 = $srcBuf[$rowNext + $colCurr + $c]
        $p22 = $srcBuf[$rowNext + $colNext + $c]

        $val = ($p11 * 7.0) - ($p01 + $p10 + $p12 + $p21) * 1.0 - ($p00 + $p02 + $p20 + $p22) * 0.5

        # Contrast enhancement (S-curve around mid-tones)
        $enhanced = (($val - 128.0) * 1.15) + 128.0

        # Clamp to 0..255
        if ($enhanced -lt 0) { $enhanced = 0 }
        elseif ($enhanced -gt 255) { $enhanced = 255 }

        $dstBuf[$rowCurr + $colCurr + $c] = [byte]$enhanced
      }
      # Preserve Alpha
      $dstBuf[$rowCurr + $colCurr + 3] = $srcBuf[$rowCurr + $colCurr + 3]
    }
  }

  [System.Runtime.InteropServices.Marshal]::Copy($dstBuf, 0, $dstData.Scan0, $bytes)

  $upscaled.UnlockBits($srcData)
  $sharpened.UnlockBits($dstData)
  $upscaled.Dispose()

  $sharpened.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
  $sharpened.Dispose()
  Write-Output "Sharpened 4X saved: $outFile"
}

$crops = @(
  "char_hun_hit_boy.png",
  "char_hun_hit_girl.png",
  "char_da_dit_kicker.png",
  "char_da_dit_screaming.png",
  "char_comforting_boy.png",
  "char_crying_girl.png",
  "img3_vendor_lower.png",
  "pair1_hun_hit.png",
  "pair2_da_dit.png",
  "pair4_an_ui.png"
)

foreach ($c in $crops) {
  $inPath = "client/Tools/concept/crops/$c"
  $outPath = "client/Tools/concept/crops/sharpened_$c"
  if (Test-Path $inPath) {
    Sharpen-And-Upscale $inPath $outPath 4
  }
}
