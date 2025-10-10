LOCAL_DIR := $(GET_LOCAL_DIR)
MODULE := $(LOCAL_DIR)
MODULE_CRATE_NAME := rustc_demangle
MODULE_RUST_CRATE_TYPES := staticlib
MODULE_SRCS := $(LOCAL_DIR)/src/lib.rs
MODULE_RUST_EDITION := 2015
MODULE_LIBRARY_DEPS := \
	$(call FIND_CRATE,rustc-demangle)

include make/library.mk
