#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

if [ -d "$PROJECT_ROOT/.tools/jdk" ]; then
  PROJECT_JDK=$(find "$PROJECT_ROOT/.tools/jdk" -maxdepth 3 -type d -name Home -print -quit)
  export JAVA_HOME="$PROJECT_JDK"
fi
if [ -d "$PROJECT_ROOT/.tools/android-sdk" ]; then
  export ANDROID_HOME="$PROJECT_ROOT/.tools/android-sdk"
fi
export GRADLE_USER_HOME="$PROJECT_ROOT/.tools/gradle-cache"

if [ -z "${ANDROID_HOME:-}" ]; then
  echo "请先安装 Android Studio 和 Android SDK，并设置 ANDROID_HOME。"
  exit 1
fi

npm run android:sync
cd android
./gradlew assembleDebug --no-daemon -Pandroid.builder.sdkDownload=false
mkdir -p "$PROJECT_ROOT/artifacts"
cp app/build/outputs/apk/debug/app-debug.apk "$PROJECT_ROOT/artifacts/leaf-reader-debug.apk"
echo "测试 APK: $PROJECT_ROOT/artifacts/leaf-reader-debug.apk"
