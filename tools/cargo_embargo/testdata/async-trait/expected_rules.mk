LOCAL_DIR := $(GET_LOCAL_DIR)
MODULE := $(LOCAL_DIR)
MODULE_CRATE_NAME := async_trait
MODULE_RUST_CRATE_TYPES := proc-macro
MODULE_SRCS := $(LOCAL_DIR)/src/lib.rs
MODULE_RUST_EDITION := 2021
MODULE_LIBRARY_DEPS := \
	$(call FIND_CRATE,proc-macro2) \
	$(call FIND_CRATE,quote) \
	$(call FIND_CRATE,syn)

include make/library.mk
