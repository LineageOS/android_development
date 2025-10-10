LOCAL_DIR := $(GET_LOCAL_DIR)
MODULE := $(LOCAL_DIR)
MODULE_CRATE_NAME := aho_corasick
MODULE_RUST_CRATE_TYPES := rlib
MODULE_SRCS := $(LOCAL_DIR)/src/lib.rs
MODULE_RUST_EDITION := 2018
MODULE_RUSTFLAGS += \
	--cfg 'feature="default"' \
	--cfg 'feature="std"'

MODULE_LIBRARY_DEPS := \
	$(call FIND_CRATE,memchr)

include make/library.mk
