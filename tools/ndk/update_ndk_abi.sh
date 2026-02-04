#!/bin/bash
set -e

if [ -z "$TARGET_RELEASE" ]; then
    echo "TARGET_RELEASE must be set. Either 'lunch' something or prepend your call like this 'TARGET_RELEASE=<release> $0'"
    exit 1
fi

set -x

THIS_DIR=$(dirname "$(realpath $0)")
TOP=$(realpath $THIS_DIR/../../..)

$TOP/build/soong/soong_ui.bash --make-mode update-ndk-abi
$TOP/out/host/linux-x86/bin/update-ndk-abi --src-dir $TOP $TOP/ndk-abi-out "$@"
