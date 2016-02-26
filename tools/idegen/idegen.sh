#!/bin/bash

if [ ! -d development ]; then
    echo "Error: Run from the root of the tree."
    exit 1
fi

if [ -z "$ANDROID_HOST_OUT" ]; then
    echo "Couldn't find host out directory. Make sure ANDROID_HOST_OUT is in your environment."
    exit 127
fi

idegenjar=`find $ANDROID_HOST_OUT -name idegen.jar -follow | grep -v intermediates`
if [ -z "$idegenjar" ]; then
    echo "Couldn't find idegen.jar. Please run 'make idegen' first."
else
    java -cp $idegenjar Main
fi
