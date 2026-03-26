# Analyzing Native Memory

Native memory refers to allocations made in C, C++, or Rust code using functions
like `malloc`, `free`, or operators like `new` and `delete`. Unlike Java, native
memory is not automatically garbage-collected; you are responsible for managing
the lifecycle of every allocation.

## Setup Instructions for Exercises

Throughout this guide, we will use the **MemoryLab** sample application to
demonstrate memory concepts. Before starting the exercises, ensure your device
is connected with `adb root` and build the app:

```bash
# From the root of your AOSP checkout
source build/envsetup.sh
lunch <your_target_device>-userdebug

adb root
adb wait-for-device

m MemoryLab
adb install -r $OUT/system/app/MemoryLab/MemoryLab.apk
```

## Profiling with heapprofd

`heapprofd` is the platform-wide native heap profiler for Android. It uses a
sampling-based approach to record allocations and deallocations with minimal
overhead.

### Using the heap_profile tool

The easiest way to capture a native heap profile is using the `heap_profile`
script provided by Perfetto.

1.  Download the script from the Perfetto repository:

    ```bash
    curl -O https://raw.githubusercontent.com/google/perfetto/master/tools/heap_profile
    chmod +x heap_profile
    ```

2.  Ensure your device is connected via ADB and run the tool, specifying the
    target process:

    ```bash
    ./heap_profile -n <package_name_or_process_name>
    ```

3.  Perform the user journey in your application.

4.  Stop the profiler (Ctrl+C). The script will automatically pull the profile,
    start a local `pprof` server, and open your web browser to view the
    flamegraph.

### Triggering Snapshots

You can also trigger a "dump" of the current heap state while a Perfetto trace
is running:

```bash
adb shell killall -USR1 heapprofd
```

This creates a snapshot (diamond icon) in the Perfetto UI. See
`configs/heapprofd.pbtxt` for an example configuration.

## Analyzing with pprof

The output of heapprofd is a set of `.pb.gz` files. If you used the
`heap_profile` script, these files are automatically pulled to your host
machine's temporary directory (e.g., `/tmp/heap_profile-XXXXXX` on Linux or
macOS), and a convenient symlink is created at `/tmp/heap_profile-latest`.

Note: If you recorded the heap profile as part of a full trace using the
Perfetto UI or CLI, the heap dumps are embedded within the `.pftrace` file. You
can extract them into `.pb.gz` format using the Perfetto `traceconv` tool.

See also:
[Recording memory profiles with Perfetto](https://perfetto.dev/docs/getting-started/memory-profiling)

You can manually analyze these files using pprof, a tool for visualization and
analysis of profiling data.

### Viewing Flamegraphs

Upload your profile to a `pprof` viewer such as Google pprof,
[available on GitHub](https://github.com/google/pprof).

**Note for Googlers:** You may use the internal
[pprof.corp.google.com](https://pprof.corp.google.com) tool, which is a
server-hosted version of Google pprof.

![Native Heap Flamegraph showing Unreleased Malloc Size for
com.android.memorylab](images/native-memory/pprof-flamegraph.png)

-   **Unreleased Memory**: Look for allocations that were made but never freed.
    A flamegraph will show the call stacks responsible for the most unreleased
    bytes.
-   **Total Allocations**: You can also view the total count or bytes allocated
    over the entire profile duration, which is useful for finding allocation
    churn in native code.

#### PerfettoSQL for Native Heap Profiles

If you captured the native heap profile within a full Perfetto trace (using
`heapprofd`), you can query the raw allocations. This is useful for counting
objects or summarizing bytes:

```sql
SELECT
  upid,
  count(id) AS allocation_count,
  sum(size) AS total_bytes
FROM heap_profile_allocation
GROUP BY upid
ORDER BY total_bytes DESC;
```

You can also view the total count or bytes allocated during the profile, even if they were subsequently freed. This is useful for finding "allocation churn."

### Symbolization

If you see "unknown" frames in your flamegraph, you need to symbolize the
profile. This requires providing the unstripped versions of your native
libraries (`.so` files with debug symbols).

**Where to find symbols in AOSP:** Symbols are generated during the build
process and stored at: `out/target/product/<device_name>/symbols/`

Use the `--sym-dir` flag with the `heap_profile` tool:

```bash
./heap_profile -n <process> --sym-dir $ANDROID_PRODUCT_OUT/symbols
```

## Analyzing Graphics and DMA-BUFs

On modern Android devices, a significant portion of memory is often consumed by
graphics buffers, known as **DMA-BUFs**. These are used for UI layers, camera
frames, and video buffers.

Because DMA-BUFs are shared between processes (e.g., between your app and the
`surfaceflinger` or camera service), they can be hard to track.

________________________________________________________________________________

**Next: [App Code is Memory](app-code.md)**
