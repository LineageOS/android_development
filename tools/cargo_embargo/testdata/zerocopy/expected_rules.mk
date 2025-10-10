LOCAL_DIR := $(GET_LOCAL_DIR)
MODULE := $(LOCAL_DIR)
MODULE_CRATE_NAME := zerocopy
MODULE_RUST_CRATE_TYPES := rlib
MODULE_SRCS := $(LOCAL_DIR)/src/lib.rs
MODULE_RUST_EDITION := 2021
MODULE_RUSTFLAGS += \
	--cfg 'feature="alloc"' \
	--cfg 'feature="derive"' \
	--cfg 'feature="simd"' \
	--cfg 'feature="std"' \
	--cfg 'feature="zerocopy-derive"'

MODULE_LIBRARY_DEPS := \
	$(call FIND_CRATE,zerocopy-derive)

include make/library.mk
LOCAL_DIR := $(GET_LOCAL_DIR)
MODULE := $(LOCAL_DIR)
MODULE_CRATE_NAME := zerocopy
MODULE_RUST_CRATE_TYPES := rlib
MODULE_SRCS := $(LOCAL_DIR)/src/lib.rs
MODULE_ADD_IMPLICIT_DEPS := false
MODULE_RUST_EDITION := 2021
MODULE_RUSTFLAGS += \
	--cfg 'feature="alloc"' \
	--cfg 'feature="derive"' \
	--cfg 'feature="simd"' \
	--cfg 'feature="zerocopy-derive"'

MODULE_LIBRARY_DEPS := \
	$(call FIND_CRATE,zerocopy-derive) \
	trusty/user/base/lib/liballoc-rust \
	trusty/user/base/lib/libcompiler_builtins-rust \
	trusty/user/base/lib/libcore-rust

include make/library.mk
LOCAL_DIR := $(GET_LOCAL_DIR)
MODULE := $(LOCAL_DIR)
MODULE_CRATE_NAME := zerocopy
MODULE_RUST_CRATE_TYPES := rlib
MODULE_SRCS := $(LOCAL_DIR)/src/lib.rs
MODULE_ADD_IMPLICIT_DEPS := false
MODULE_RUST_EDITION := 2021
MODULE_RUSTFLAGS += \
	--cfg 'feature="derive"' \
	--cfg 'feature="simd"' \
	--cfg 'feature="zerocopy-derive"'

MODULE_LIBRARY_DEPS := \
	$(call FIND_CRATE,zerocopy-derive) \
	trusty/user/base/lib/libcompiler_builtins-rust \
	trusty/user/base/lib/libcore-rust

include make/library.mk
LOCAL_DIR := $(GET_LOCAL_DIR)
MODULE := $(LOCAL_DIR)
MODULE_CRATE_NAME := zerocopy
MODULE_RUST_CRATE_TYPES := rlib
MODULE_SRCS := $(LOCAL_DIR)/src/lib.rs
MODULE_ADD_IMPLICIT_DEPS := false
MODULE_RUST_EDITION := 2021
MODULE_RUSTFLAGS += \
	--cfg 'feature="alloc"' \
	--cfg 'feature="derive"' \
	--cfg 'feature="zerocopy-derive"'

MODULE_LIBRARY_DEPS := \
	$(call FIND_CRATE,zerocopy-derive) \
	trusty/user/base/lib/liballoc-rust \
	trusty/user/base/lib/libcompiler_builtins-rust \
	trusty/user/base/lib/libcore-rust

include make/library.mk
