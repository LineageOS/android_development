LOCAL_DIR := $(GET_LOCAL_DIR)
MODULE := $(LOCAL_DIR)
MODULE_CRATE_NAME := either
MODULE_RUST_CRATE_TYPES := rlib
MODULE_SRCS := $(LOCAL_DIR)/src/lib.rs
MODULE_RUST_EDITION := 2018
MODULE_RUSTFLAGS += \
	--cfg 'feature="default"' \
	--cfg 'feature="use_std"'

MODULE_LIBRARY_DEPS := \
	

include make/library.mk
