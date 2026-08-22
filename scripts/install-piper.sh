#!/usr/bin/env bash
#
# Fetches piper and one voice into the deploy image, for the gather's spoken
# announcements.
#
# Piper is not an apt package - it is a release tarball plus a separately
# downloaded voice model - so it cannot come from RAILPACK_DEPLOY_APT_PACKAGES
# like espeak-ng does. Everything lands under /app, which is what the runtime
# image keeps.
#
# Never fails the build. A voice line is optional; engine deploys are not, and
# a github outage or a moved url must not be able to stop one. When anything
# here does not work the engine simply reports voice as unavailable and stays
# quiet, so the failure is visible in its logs rather than in a red build.
#
# Point the service at it with:
#   GATHER_VOICE_ENGINE=piper
#   PIPER_BIN=/app/vendor/piper/run-piper
#   PIPER_MODEL=/app/vendor/piper/voices/en_GB-alan-medium.onnx

set -uo pipefail

PIPER_VERSION="${PIPER_VERSION:-2023.11.14-2}"
VOICE_NAME="${PIPER_VOICE:-en_GB-alan-medium}"
VOICE_PATH="${PIPER_VOICE_PATH:-en/en_GB/alan/medium}"

VENDOR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/vendor"
PIPER_DIR="$VENDOR_DIR/piper"
VOICES_DIR="$PIPER_DIR/voices"
RELEASE_URL="https://github.com/rhasspy/piper/releases/download/${PIPER_VERSION}/piper_linux_x86_64.tar.gz"
VOICE_URL="https://huggingface.co/rhasspy/piper-voices/resolve/main/${VOICE_PATH}/${VOICE_NAME}"

skip() {
  echo "install-piper: $1; skipping (voice announcements will be unavailable)"
  exit 0
}

command -v curl >/dev/null 2>&1 || skip "curl not available"

if [ -x "$PIPER_DIR/piper" ] && [ -f "$VOICES_DIR/$VOICE_NAME.onnx" ]; then
  echo "install-piper: already installed at $PIPER_DIR"
  exit 0
fi

mkdir -p "$VOICES_DIR" || skip "could not create $VOICES_DIR"

echo "install-piper: downloading piper $PIPER_VERSION"
if ! curl -fsSL --retry 3 --max-time 180 "$RELEASE_URL" -o /tmp/piper.tar.gz; then
  skip "could not download $RELEASE_URL"
fi
# The tarball contains a piper/ directory, so unpack into vendor/ rather than
# vendor/piper/ to avoid vendor/piper/piper/.
if ! tar -xzf /tmp/piper.tar.gz -C "$VENDOR_DIR"; then
  skip "could not unpack piper"
fi
rm -f /tmp/piper.tar.gz
mkdir -p "$VOICES_DIR"

echo "install-piper: downloading voice $VOICE_NAME"
for suffix in onnx onnx.json; do
  if ! curl -fsSL --retry 3 --max-time 300 \
    "$VOICE_URL.$suffix?download=true" -o "$VOICES_DIR/$VOICE_NAME.$suffix"; then
    skip "could not download $VOICE_NAME.$suffix"
  fi
done

# piper ships its shared libraries and phoneme data beside the binary and finds
# neither unless told, so it is invoked through a wrapper rather than directly.
cat > "$PIPER_DIR/run-piper" <<'WRAPPER'
#!/usr/bin/env bash
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export LD_LIBRARY_PATH="$here${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
if [ -d "$here/espeak-ng-data" ]; then
  exec "$here/piper" --espeak_data "$here/espeak-ng-data" "$@"
fi
exec "$here/piper" "$@"
WRAPPER
chmod +x "$PIPER_DIR/run-piper" "$PIPER_DIR/piper" 2>/dev/null

# Prove it actually renders here, rather than discovering it cannot at the
# moment a gather is waiting to be told where to go.
if echo "test" | "$PIPER_DIR/run-piper" --model "$VOICES_DIR/$VOICE_NAME.onnx" \
  --output_file /tmp/piper-check.wav >/dev/null 2>&1 && [ -s /tmp/piper-check.wav ]; then
  echo "install-piper: ok - $(du -h "/tmp/piper-check.wav" | cut -f1) test render from $VOICE_NAME"
  rm -f /tmp/piper-check.wav
else
  skip "piper installed but could not render"
fi
