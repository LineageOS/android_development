LOCAL_DIR := $(GET_LOCAL_DIR)
MODULE := $(LOCAL_DIR)
MODULE_CRATE_NAME := plotters
MODULE_RUST_CRATE_TYPES := rlib
MODULE_SRCS := $(LOCAL_DIR)/src/lib.rs
MODULE_RUST_EDITION := 2018
MODULE_RUSTFLAGS += \
	--cfg 'feature="area_series"' \
	--cfg 'feature="line_series"' \
	--cfg 'feature="plotters-svg"' \
	--cfg 'feature="svg_backend"'

MODULE_LIBRARY_DEPS := \
	$(call FIND_CRATE,num-traits) \
	$(call FIND_CRATE,plotters-backend) \
	$(call FIND_CRATE,plotters-svg)

include make/library.mk
