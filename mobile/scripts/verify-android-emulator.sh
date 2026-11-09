#!/usr/bin/env bash
set -euo pipefail

APK="mobile/android/app/build/outputs/apk/debug/app-debug.apk"
PACKAGE="com.marketinggenius.commandcentre"

timeout 60s adb wait-for-device

package_manager_ready=false
for attempt in $(seq 1 30); do
  if timeout 5s adb shell cmd package list packages >/dev/null 2>&1; then
    package_manager_ready=true
    break
  fi
  echo "Waiting for Android Package Manager ($attempt/30)"
  sleep 2
done

if [ "$package_manager_ready" != true ]; then
  timeout 10s adb shell getprop sys.boot_completed || true
  echo "Android Package Manager did not become ready after emulator boot."
  exit 1
fi

timeout 90s adb install "$APK"
timeout 10s adb shell pm path "$PACKAGE"
timeout 10s adb shell am force-stop "$PACKAGE" || true
timeout 20s adb shell monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1

app_started=false
for attempt in $(seq 1 20); do
  if timeout 5s adb shell pidof "$PACKAGE" >/dev/null 2>&1; then
    app_started=true
    break
  fi
  sleep 2
done

if [ "$app_started" != true ]; then
  timeout 20s adb logcat -d -t 1000
  echo "Marketing Genius did not start in the Android emulator."
  exit 1
fi

timeout 10s adb shell pidof "$PACKAGE"
timeout 15s adb shell dumpsys activity activities | grep -q "$PACKAGE"

# Allow Capacitor's splash screen to clear and the local WebView to paint
# before taking the screenshot. The screenshot is uploaded for visual QA.
sleep 12
timeout 30s adb exec-out screencap -p > marketing-genius-virtual-device.png
test -s marketing-genius-virtual-device.png
file marketing-genius-virtual-device.png
python3 - <<'PY'
from pathlib import Path
import struct
image = Path("marketing-genius-virtual-device.png").read_bytes()
assert image.startswith(b"\x89PNG\r\n\x1a\n"), "Emulator screenshot is not a PNG"
width, height = struct.unpack(">II", image[16:24])
assert width >= 320 and height >= 640, f"Unexpected emulator screenshot size: {width}x{height}"
print(f"Android screenshot captured: {width}x{height}, {len(image)} bytes")
PY
echo "Android emulator verification passed: APK installed, app process and activity confirmed, post-launch screenshot captured."
