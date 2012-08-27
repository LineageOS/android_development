ifeq ($(BUILD_EMULATOR_OPENGL),true)
include $(call all-makefiles-under,$(call my-dir))
endif
# or...
ifeq ($(TARGET_PRODUCT),vbox_x86)
include $(call all-makefiles-under,$(call my-dir))
endif
