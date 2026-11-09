#!/usr/bin/env bash
set -euo pipefail

APK="mobile/android/app/build/outputs/apk/debug/app-debug.apk"
PACKAGE="com.marketinggenius.commandcentre"

timeout 60s adb wait-for-device

package_manager_ready=false
for attempt in $(seq 1 60); do
  if timeout 15s adb shell cmd package list packages >/dev/null 2>&1; then
    package_manager_ready=true
    break
  fi
  echo "Waiting for Android Package Manager ($attempt/60)"
  sleep 2
done

if [ "$package_manager_ready" != true ]; then
  timeout 15s adb shell getprop sys.boot_completed || true
  timeout 15s adb shell service list || true
  echo "Android Package Manager did not become ready after emulator boot."
  exit 1
fi

timeout 90s adb install "$APK"
timeout 15s adb shell pm path "$PACKAGE"
timeout 15s adb shell am force-stop "$PACKAGE" || true
timeout 30s adb shell monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1

app_started=false
for attempt in $(seq 1 30); do
  if timeout 15s adb shell pidof "$PACKAGE" >/dev/null 2>&1; then
    app_started=true
    break
  fi
  sleep 2
done

if [ "$app_started" != true ]; then
  timeout 30s adb logcat -d -t 1500
  echo "Marketing Genius did not start in the Android emulator."
  exit 1
fi

timeout 15s adb shell pidof "$PACKAGE"
timeout 30s adb shell dumpsys activity activities | grep -q "$PACKAGE"

# A live process can still be showing Capacitor's native splash screen.
# Give the local WebView time to load before inspecting its visible accessibility tree.
sleep 10
timeout 25s adb shell uiautomator dump /data/local/tmp/mgcc-window.xml >/dev/null
ui_dump="$(timeout 10s adb exec-out cat /data/local/tmp/mgcc-window.xml 2>/dev/null || true)"
ui_ready=false
if printf '%s' "$ui_dump" | grep -Eqi 'I.m Kira|YOUR MARKETING DIRECTOR|Meet Kira|Kira.s marketing world'; then
  ui_ready=true
  echo "Kira workspace appeared in Android accessibility tree."
fi

# Stream a diagnostic screenshot directly to the runner, even on failure.
timeout 45s adb exec-out screencap -p > marketing-genius-virtual-device.png
test -s marketing-genius-virtual-device.png
file marketing-genius-virtual-device.png

if [ "$ui_ready" != true ]; then
  printf '%s\\n' "$ui_dump" | head -c 12000
  timeout 30s adb logcat -d -t 1500
  echo "The Android app process started, but the actual Kira workspace did not appear. Refusing to pass on the splash screen alone."
  exit 1
fi

echo "Android emulator verification passed: APK installed, Kira workspace rendered, app activity confirmed, screenshot captured."
