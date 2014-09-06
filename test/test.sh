#!/bin/sh

CUR_PATH=`pwd`
$CUR_PATH/src/antvm -b $CUR_PATH/test/linuxstart.bin -f $CUR_PATH/test/root.bin -k $CUR_PATH/test/vmlinux-2.6.20.bin
