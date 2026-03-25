# Understanding and Troubleshooting Android Memory

Memory is a critical and finite resource on Android devices. As an Android
platform developer or OEM, understanding how memory works at every level—from
the Java runtime down to the Linux kernel—is essential for building a performant
and stable system.

This guide provides a comprehensive overview of Android memory architecture, the
tools available for analysis, and hands-on exercises to help you identify and
resolve memory-related issues.

## Objectives

After completing this guide, you will be able to:

- Explain the fundamental concepts of Android memory, including the Zygote
  process model and memory-mapped files.
- Differentiate between Resident Set Size (RSS), Proportional Set Size (PSS),
  and Unique Set Size (USS).
- Use standard command-line tools like `dumpsys meminfo` and `showmap` to
  quickly assess memory usage.
- Capture and analyze Java heap dumps using AHAT to find leaks and excessive
  allocations.
- Use Perfetto and `heapprofd` to profile both Java and native memory across
  the entire system.
- Understand system-wide memory pressure indicators like Pressure Stall
  Information (PSI) and monitor Low Memory Killer (LMK) activity.

## Guide Structure

This guide is organized into the following sections, designed to be read sequentially:

1. **[Fundamental Concepts](concepts.md)**: The core technical principles of
   Android memory.
2. **[Quick Assessment Tools](tools-overview.md)**: Using `meminfo`, `showmap`,
   and `procstats` for rapid triage.
3. **[Analyzing Java Memory](java-memory.md)**: Deep dives into the Java heap
   with AHAT.
4. **[Analyzing Native Memory](native-memory.md)**: Profiling C/C++ memory with
   Perfetto and `heapprofd`.
5. **[App Code is Memory](app-code.md)**: Understanding how class loading and
   dex bloat impact RAM.
6. **[Threads and Memory](threads.md)**: Analyzing the cost of native thread
   stacks.
7. **[System-wide Troubleshooting](system-wide-memory.md)**: Monitoring the
   kernel, LMK, and system pressure.

## Getting Started: Device Setup

To follow the hands-on exercises in this guide, you should have an Android device with root access connected to your development machine.

**If you are using acloud:**

You can create a virtual Cuttlefish device suitable for testing:

```bash
source build/envsetup.sh
lunch aosp_cf_arm64_phone-trunk_staging-userdebug
acloud create --build-target aosp_cf_arm64_phone-trunk_staging-userdebug --local-image
```

**If you are using a physical device:** Ensure your device is running a
**userdebug** build, and enable USB debugging.

**Ensure Root Access:**
Most of the tools used in this guide require elevated privileges. Verify your device is connected and rooted:
```bash
adb root
adb wait-for-device
```

---

**Start Here: [Fundamental Concepts](concepts.md)**
