#!/bin/sh
# รัน Firestore Emulator จากไฟล์ jar โดยตรง (ไม่ต้องติดตั้ง firebase-tools) แล้วรันเทสต์ใน tests/emu
set -e
VERSION=1.19.8
DIR="${XDG_CACHE_HOME:-$HOME/.cache}/firebase-emulators"
JAR="$DIR/cloud-firestore-emulator-v$VERSION.jar"
mkdir -p "$DIR"
[ -f "$JAR" ] || curl -sSfL -o "$JAR" "https://storage.googleapis.com/firebase-preview-drop/emulator/cloud-firestore-emulator-v$VERSION.jar"

java -jar "$JAR" --host 127.0.0.1 --port 8080 >/tmp/firestore-emulator.log 2>&1 &
EMU_PID=$!
trap 'kill $EMU_PID 2>/dev/null' EXIT
i=0
until curl -s -o /dev/null http://127.0.0.1:8080/; do
  i=$((i + 1)); [ $i -gt 120 ] && { echo "emulator did not start"; cat /tmp/firestore-emulator.log; exit 1; }
  sleep 0.5
done
node --test ${EMU_TESTS:-tests/emu/*.test.mjs}
