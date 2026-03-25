#!/bin/bash
# Generate classes with methods containing unique strings
out_dir=$1

mkdir -p ${out_dir}/com/android/codebloat
for i in {0..300}; do
    file="${out_dir}/com/android/codebloat/GeneratedClass${i}.java"
    echo "package com.android.codebloat;" > ${file}
    echo "public class GeneratedClass${i} {" >> ${file}
    for j in {0..500}; do
        echo "    public static String method${j}() { return \"UniqueString_Class${i}_Method${j}_abcdefghijklmnopqrstuvwxyz_0123456789\"; }" >> ${file}
    done
    echo "    public static void doSomething() {" >> ${file}
    echo "        method0();" >> ${file}
    echo "    }" >> ${file}
    echo "}" >> ${file}
done