#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
AVD_NAME="${AVD_NAME:-}"
API_BASE_URL="${API_BASE_URL:-http://10.0.2.2:5001}"
OAUTH_ORIGIN="${OAUTH_ORIGIN:-http://10.0.2.2:3000}"
BOOT_TIMEOUT="${BOOT_TIMEOUT:-180}"

usage() {
    cat <<'EOF'
Build, install, and launch eCricketCoach on an Android emulator.

Usage:
  ./deploy-emulator.sh [--avd NAME] [--api-base-url URL] [--oauth-origin URL]

Options:
  --avd NAME             AVD to start when no emulator is already running.
  --api-base-url URL     API origin (default: http://10.0.2.2:5001).
  --oauth-origin URL     Web/API OAuth origin (default: http://10.0.2.2:3000).
  -h, --help             Show this help.

ANDROID_SDK_ROOT, ANDROID_HOME, AVD_NAME, API_BASE_URL, OAUTH_ORIGIN, and
BOOT_TIMEOUT can also be set through environment variables.
EOF
}

fail() {
    printf 'Error: %s\n' "$*" >&2
    exit 1
}

while (($#)); do
    case "$1" in
        --avd)
            (($# >= 2)) || fail "--avd needs an AVD name."
            AVD_NAME="$2"
            shift 2
            ;;
        --api-base-url)
            (($# >= 2)) || fail "--api-base-url needs a URL."
            API_BASE_URL="$2"
            shift 2
            ;;
        --oauth-origin)
            (($# >= 2)) || fail "--oauth-origin needs a URL."
            OAUTH_ORIGIN="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            fail "Unknown option: $1 (use --help for usage)."
            ;;
    esac
done

if [[ -z "$SDK_ROOT" ]]; then
    if [[ -n "${LOCALAPPDATA:-}" && -d "${LOCALAPPDATA}/Android/Sdk" ]]; then
        SDK_ROOT="${LOCALAPPDATA}/Android/Sdk"
    elif [[ -d "${HOME}/Android/Sdk" ]]; then
        SDK_ROOT="${HOME}/Android/Sdk"
    else
        fail "Set ANDROID_SDK_ROOT or ANDROID_HOME to your Android SDK directory."
    fi
fi

if command -v cygpath >/dev/null 2>&1; then
    SDK_ROOT="$(cygpath -u "$SDK_ROOT")"
fi

ADB="${SDK_ROOT}/platform-tools/adb"
EMULATOR="${SDK_ROOT}/emulator/emulator"
if [[ ! -x "$ADB" && -x "${ADB}.exe" ]]; then
    ADB="${ADB}.exe"
fi
if [[ ! -x "$EMULATOR" && -x "${EMULATOR}.exe" ]]; then
    EMULATOR="${EMULATOR}.exe"
fi
[[ -x "$ADB" ]] || fail "Android adb was not found at ${ADB}."
[[ -x "$EMULATOR" ]] || fail "Android emulator was not found at ${EMULATOR}."
[[ -x "${SCRIPT_DIR}/gradlew" ]] || fail "Gradle wrapper was not found in ${SCRIPT_DIR}."

java_bin_in() {
    [[ -x "$1/bin/java" || -x "$1/bin/java.exe" ]]
}

if [[ -n "${JAVA_HOME:-}" ]] && command -v cygpath >/dev/null 2>&1; then
    JAVA_HOME="$(cygpath -u "$JAVA_HOME")"
fi
if [[ -n "${JAVA_HOME:-}" ]] && ! java_bin_in "$JAVA_HOME"; then
    fail "JAVA_HOME (${JAVA_HOME}) does not contain bin/java."
fi
if [[ -z "${JAVA_HOME:-}" ]] && ! command -v java >/dev/null 2>&1; then
    # Fall back to the JDK bundled with Android Studio (JBR).
    JAVA_CANDIDATES=()
    if [[ -n "${PROGRAMFILES:-}" ]]; then
        JAVA_CANDIDATES+=("${PROGRAMFILES}/Android/Android Studio/jbr")
    fi
    if [[ -n "${LOCALAPPDATA:-}" ]]; then
        JAVA_CANDIDATES+=("${LOCALAPPDATA}/Programs/Android Studio/jbr")
    fi
    JAVA_CANDIDATES+=(
        "/c/Program Files/Android/Android Studio/jbr"
        "/Applications/Android Studio.app/Contents/jbr/Contents/Home"
        "/opt/android-studio/jbr"
        "${HOME}/android-studio/jbr"
        "/snap/android-studio/current/jbr"
    )
    for candidate in "${JAVA_CANDIDATES[@]}"; do
        if command -v cygpath >/dev/null 2>&1; then
            candidate="$(cygpath -u "$candidate")"
        fi
        if java_bin_in "$candidate"; then
            JAVA_HOME="$candidate"
            break
        fi
    done
    [[ -n "${JAVA_HOME:-}" ]] || fail "Java was not found. Install Android Studio or set JAVA_HOME to a JDK 17+ directory."
fi
if [[ -n "${JAVA_HOME:-}" ]]; then
    export JAVA_HOME
    export PATH="${JAVA_HOME}/bin:${PATH}"
    printf 'Using Java from %s.\n' "$JAVA_HOME"
fi

export ANDROID_SDK_ROOT="$SDK_ROOT"
export ANDROID_HOME="$SDK_ROOT"
export PATH="${SDK_ROOT}/platform-tools:${SDK_ROOT}/emulator:${PATH}"

"$ADB" start-server >/dev/null

DEVICE_SERIAL="$("$ADB" devices | awk '$1 ~ /^emulator-/ && ($2 == "device" || $2 == "offline") { print $1; exit }')"
if [[ -n "$DEVICE_SERIAL" ]]; then
    printf 'Using running emulator %s.\n' "$DEVICE_SERIAL"
else
    if [[ -z "$AVD_NAME" ]]; then
        AVD_NAME="$("$EMULATOR" -list-avds | sed -n '1p' | tr -d '\r')"
    fi
    [[ -n "$AVD_NAME" ]] || fail "No AVD is configured. Create one in Android Studio or pass --avd NAME."

    EMULATOR_LOG="${TMPDIR:-/tmp}/ecricketcoach-emulator-${AVD_NAME}.log"
    printf 'Starting emulator %s (log: %s).\n' "$AVD_NAME" "$EMULATOR_LOG"
    # Start the emulator detached from this shell so it keeps running (and shuts
    # down cleanly) after the script or terminal exits.
    if command -v cygpath >/dev/null 2>&1 && command -v powershell.exe >/dev/null 2>&1; then
        WIN_EMULATOR="$(cygpath -w "$EMULATOR")"
        WIN_LOG="$(cygpath -w "$EMULATOR_LOG")"
        EMULATOR_PID="$(powershell.exe -NoProfile -NonInteractive -Command \
            "\$p = Start-Process -FilePath '${WIN_EMULATOR}' -ArgumentList '-avd','${AVD_NAME}' -RedirectStandardOutput '${WIN_LOG}' -RedirectStandardError '${WIN_LOG}.err' -PassThru; \$p.Id" | tr -d '\r')"
        emulator_alive() {
            powershell.exe -NoProfile -NonInteractive -Command \
                "if (Get-Process -Id ${EMULATOR_PID} -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" >/dev/null 2>&1
        }
    else
        if command -v setsid >/dev/null 2>&1; then
            nohup setsid "$EMULATOR" -avd "$AVD_NAME" >"$EMULATOR_LOG" 2>&1 </dev/null &
        else
            nohup "$EMULATOR" -avd "$AVD_NAME" >"$EMULATOR_LOG" 2>&1 </dev/null &
        fi
        EMULATOR_PID=$!
        disown "$EMULATOR_PID" 2>/dev/null || true
        emulator_alive() { kill -0 "$EMULATOR_PID" 2>/dev/null; }
    fi
    [[ -n "$EMULATOR_PID" ]] || fail "Could not start the emulator. See ${EMULATOR_LOG}."
    printf 'Emulator process started (PID %s).\n' "$EMULATOR_PID"
fi

printf 'Waiting for an emulator to connect'
SECONDS_WAITED=0
while [[ -z "$DEVICE_SERIAL" && "$SECONDS_WAITED" -lt "$BOOT_TIMEOUT" ]]; do
    DEVICE_SERIAL="$("$ADB" devices | awk '$1 ~ /^emulator-/ && ($2 == "device" || $2 == "offline") { print $1; exit }')"
    if [[ -z "$DEVICE_SERIAL" ]]; then
        if [[ -n "${EMULATOR_PID:-}" ]] && ! emulator_alive; then
            printf '\n'
            fail "The emulator exited during startup. See ${EMULATOR_LOG} and ${EMULATOR_LOG}.err (if present)."
        fi
        printf '.'
        sleep 2
        SECONDS_WAITED=$((SECONDS_WAITED + 2))
    fi
done
printf '\n'
[[ -n "$DEVICE_SERIAL" ]] || fail "No emulator connected after ${BOOT_TIMEOUT} seconds."

printf 'Waiting for Android to finish booting on %s' "$DEVICE_SERIAL"
SECONDS_WAITED=0
while [[ "$SECONDS_WAITED" -lt "$BOOT_TIMEOUT" ]]; do
    BOOT_STATE="$("$ADB" -s "$DEVICE_SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
    if [[ "$BOOT_STATE" == "1" ]]; then
        break
    fi
    printf '.'
    sleep 2
    SECONDS_WAITED=$((SECONDS_WAITED + 2))
done
printf '\n'
[[ "${BOOT_STATE:-}" == "1" ]] || fail "Android did not finish booting within ${BOOT_TIMEOUT} seconds."

printf 'Building debug APK (API: %s; OAuth: %s).\n' "$API_BASE_URL" "$OAUTH_ORIGIN"
"${SCRIPT_DIR}/gradlew" -p "$SCRIPT_DIR" --no-daemon :app:assembleDebug \
    "-PapiBaseUrl=${API_BASE_URL}" \
    "-PoauthOrigin=${OAUTH_ORIGIN}"

APK="${SCRIPT_DIR}/app/build/outputs/apk/debug/app-debug.apk"
[[ -f "$APK" ]] || fail "Gradle succeeded but the APK was not found at ${APK}."

printf 'Installing app on %s.\n' "$DEVICE_SERIAL"
"$ADB" -s "$DEVICE_SERIAL" install -r "$APK"

printf 'Launching eCricketCoach.\n'
"$ADB" -s "$DEVICE_SERIAL" shell am start -n com.ecricketcoach.mobile/.MainActivity
