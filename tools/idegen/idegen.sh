#!/bin/bash

if [ ! -d development ]; then
    echo "Error: Run from the root of the tree."
    exit 1
fi

if [ -z $ANDROID_HOST_OUT ]; then
    if [ "$(type -t setpaths)" != function ]; then
      source build/envsetup.sh
    fi
    setpaths
fi

idegenjar=`find $ANDROID_HOST_OUT -name idegen.jar -follow | grep -v intermediates`
if [ -z "$idegenjar" ]; then
    echo "Couldn't find idegen.jar. Please run make first."
else
    java -cp $idegenjar Main
fi
