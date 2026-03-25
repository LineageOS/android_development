# Quick Assessment Tools

When you need to investigate memory usage, start with high-level assessment
tools to identify which categories of memory are most significant.

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

## dumpsys meminfo

The most common way to get an overview of an application's memory usage is
`dumpsys meminfo`. To see a detailed breakdown including all memory mappings, it
is often helpful to include the `-a` flag:

```bash
adb shell dumpsys meminfo -a <package_name_or_pid>
```

Here is a sample output from an application under some memory pressure (notice
the high SwapPss):

```text
** MEMINFO in pid 4562 [com.android.memorylab] **
                   Pss  Private  Private  SwapPss      Rss     Heap     Heap     Heap
                 Total    Dirty    Clean    Dirty    Total     Size    Alloc     Free
                ------   ------   ------   ------   ------   ------   ------   ------
  Native Heap      394      268       64    17440     4264    29416    18128     8040
  Dalvik Heap      165        8        0      672     8196    40949    32757     8192
 Dalvik Other       47       28        0      604     1132
        Stack      112      108        4      312      120
...
        TOTAL    33197      580      788    21920   167776    70365    50885    16232

 App Summary
                       Pss(KB)                        Rss(KB)
                        ------                         ------
           Java Heap:       12                          32608
         Native Heap:      268                           4264
                Code:      724                         125672
               Stack:      108                            120
            Graphics:        0                              0
       Private Other:      256
              System:    31829
             Unknown:                                    5112

           TOTAL PSS:    33197            TOTAL RSS:   167776       TOTAL SWAP PSS:    21920

 Objects
               Views:       15         ViewRootImpl:        1
         AppContexts:        5           Activities:        1
...
```

### Interpreting the Data

-   **Pss Total**: The Proportional Set Size. This is the sum of `Private
    Dirty` + `Private Clean` + your process's equitable share of memory shared
    with other processes (like the Zygote boot image). This is the best metric
    for "how much memory is this app responsible for."
-   **Private Dirty**: This is RAM that only your process is using and has been
    modified (or is anonymous memory). This is the most critical number for
    finding leaks because this memory cannot be dropped.
-   **Private Clean**: RAM that only your process is using, but is an unmodified
    copy of a file on storage (like a DEX file). It can be dropped by the OS if
    memory is low.
-   **SwapPss**: Memory that has been compressed and swapped into ZRAM. This can
    happen either because the system is under memory pressure or because the
    Android Runtime has identified background processes to compact (moving their
    unused or inactive pages to ZRAM). In the example above, almost all of the
    `Native Heap` and `Dalvik Heap` have been moved to ZRAM.

> **Important Note on App Summary Metrics**: The **Java Heap** and **Native Heap**
> values in the "App Summary" section represent **resident** (physical) memory.
> If an application's memory has been compressed into ZRAM, these specific
> summary values may appear much lower than expected. Always check the **TOTAL
> SWAP PSS** or the detailed `SwapPss` column to get the full picture.

-   **App Summary**: A higher-level categorization combining the detailed rows
    into understandable buckets.
-   **Objects**: Useful for tracking leaked `Activities` and `ViewRootImpl`
    instances. If you back out of your app and force a GC, the `Activities`
    count should return to 0.

### Hands-on Exercise: Quick Triage with meminfo

In this exercise, you will observe how different types of allocations show up in
`meminfo`.

1.  **Launch the app**:

    ```bash
    adb shell am start -W -n com.android.memorylab/.MainActivity
    ```

2.  **Check baseline memory**:

    ```bash
    adb shell dumpsys meminfo -s com.android.memorylab
    ```

    (The `-s` flag provides a short, concise summary of memory categories).

3.  **Allocate Java Memory**: Tap the **Allocate Java Memory (10MB)** button 3
    times in the app.

4.  **Observe the change**: Run `meminfo -s` again. You should see the **Java
    Heap** value increase by approximately 30,000 KB (30MB).

5.  **Allocate Native Memory**: Tap the **Allocate Native Memory (500MB)**
    button once.

6.  **Observe the change**: Run `meminfo -s` again. The **Native Heap** value
    should now show a massive increase (~500,000 KB).

### Global View

To see memory usage across the entire system, run:

```bash
adb shell dumpsys meminfo
```

This provides a summary of RAM usage, including total RAM, free RAM, and a list
of processes sorted by PSS.

#### Key System Metrics:

-   **ZRAM**: Compressed swap in RAM.
-   **DMA-BUF**: Graphics and shared memory buffers. Modern Android versions use
    DMA-BUF extensively for UI rendering. If the `DMA-BUF` total is very high,
    investigate graphics-heavy processes using
    `/sys/kernel/debug/dma_buf/bufinfo`.
-   **Lost RAM**: Memory that is not accounted for by the kernel or any process
    (e.g., hardware-reserved regions).

## showmap

For a much more detailed breakdown of a process's memory mappings, use
`showmap`. This tool reads from `/proc/<pid>/smaps`.

```bash
adb shell showmap <pid>
```

`showmap` lists every memory map in the process. Key mappings to look for
include:

-   **`[anon:scudo:primary]` or `[anon:libc_malloc]`**: The native heap. Modern
    Android versions use the Scudo allocator.
-   **`*.art`**: Java heap images (e.g., boot image).
-   **`[anon:dalvik-main space]`**: The main Java heap.
-   **`*.so`**: Shared libraries.
-   **`*.{oat,dex,odex,vdex}`**: Compiled DEX code.

You can sort the output to find the largest private memory consumers:

```bash
# Sort by private clean + private dirty memory
adb shell showmap <pid> | awk '{print $6+$7, $0}' | sort -rn | head -n 10
```

Sample output:

```text
2776    18176     5784     2823        0     3008      308     2468     4700     4700         0         0         0        0        0        0   47 [anon:scudo:primary]
560      952      876      657      316        0      560        0       12       12         0         0         0        0        0        0    8 /data/app/.../base.apk
448   393216      448      448        0        0        0      448        0        0         0         0         0        0        0        0    2 [anon:dalvik-main space]
...
```

### Hands-on Exercise: Deep Dive with showmap

Learn how to identify specific memory mappings and differentiate between clean
and dirty memory.

1.  **Mmap Clean Memory**: Tap the **Mmap Clean Memory (10MB)** button in the
    MemoryLab app once.
2.  **Get the Process ID**: The app's UI shows its PID. You can also find it
    with this command:

    ```bash
    adb shell pidof com.android.memorylab
    ```

3.  **Inspect with showmap**:

    ```bash
    # Replace <PID> with the actual process ID from the previous step
    adb shell showmap <PID> | grep "memorylab-clean"
    ```

4.  **Identify the mapping**: You should see an anonymous mapping labeled
    **`[anon:memorylab-clean]`** with a virtual size of exactly 10240 KB. Note
    that the **private dirty** value for this map is likely 0. This is "clean"
    anonymous memory because we used `mmap` to reserve the virtual space but
    haven't written to it yet (so no physical RAM is actually consumed).

5.  **Native Heap Comparison**: Contrast this with the `[anon:scudo:primary]`
    mappings which would have appeared in `showmap` if you had run it after step
    5 of the `meminfo` exercise. Because that 500MB native allocation actually
    writes to every page, those pages are "dirty" and will show up heavily in
    the **private dirty** column.

6.  **Pro-tip (Large Objects)**: Notice the **Java Heap** allocations from the
    `meminfo` exercise. Because they are 10MB byte arrays, they likely appear in
    `showmap` as `[anon:dalvik-free list large object space]`. The Android
    Runtime (ART) puts objects larger than 12KB into a separate Large Object
    Space (LOS) to avoid fragmentation in the main heap.

## procstats

While `meminfo` provides a snapshot in time, `procstats` provides historical
data by periodically sampling the state and memory use of all running
applications. This is the primary tool used for long-term memory health
monitoring and is what drives the memory usage reporting in Android Settings.

```bash
# View stats for the last 3 hours
adb shell dumpsys procstats --hours 3
```

### Understanding the States

The output of `procstats` can be overwhelming. The most critical part is the
parenthetical metrics next to each process state:

```text
Top: 100% (54MB-64MB-67MB / 49MB-58MB-61MB / 110MB-120MB-130MB over 4)
```

The format is:
**(% time in state) (minPss-avgPss-maxPss / minUss-avgUss-maxUss / minRss-avgRss-maxRss over samples)**

-   **Pss (Proportional Set Size)**: Shared memory is divided proportionally
    among processes.
-   **Uss (Unique Set Size)**: Memory used only by this process (equivalent to
    Private Clean + Private Dirty).
-   **Rss (Resident Set Size)**: Total physical memory used, including all
    shared pages (tends to over-count).

**Why this matters:**
-   **Stable App**: min/avg/max are close together.
-   **Memory Leak**: max is significantly higher than min, and the average
    creeps up over time as sample count increases.
-   **Spiky Usage**: max is much higher than avg, indicating transient heavy
    operations (like image processing) that might cause OOMs if they happen at
    the wrong time.

### Process States

`procstats` tracks apps across several states (often abbreviated):

-   **Persist**: Critical system processes that are always running.
-   **Top**: The app is currently in the foreground and visible to the user.
-   **ImpFg** (Important Foreground): Critical background processes (like IMEs)
    or apps with a foreground service.
-   **ImpBg** (Important Background): Background processes that are
    considered important to the system.
-   **Fgs** / **BFgs**: Foreground Services or Bound Foreground Services.
-   **Service** / **ServRst**: Background services or services currently
    restarting.
-   **Cached** / **LastAct**: Apps that are cached in the background for quick
    restart. These are safe for the system to kill.

### Device Memory State and Run Time Stats

`procstats` also tracks how much time the *entire device* spent under memory
pressure. Look for the **Run time Stats** section:

```text
Run time Stats:
  SOff/Norm: +1h10m15s
   SOn/Norm: +15m20s
        Low: +2m10s
       Crit: +45s
```

-   **SOff / SOn**: Screen Off vs. Screen On.
-   **Norm / Mod / Low / Crit**: Memory pressure levels (Normal, Moderate, Low,
    Critical).

If a device is spending significant time in **Low** or **Crit** states, it
will feel sluggish as the kernel aggressively reclaims memory and the Low
Memory Killer (LMK) starts terminating background processes. You can then
look through the per-package stats to see which apps have high memory usage
specifically when the device is in these stressed states.


________________________________________________________________________________

**Next: [Analyzing Java Memory](java-memory.md)**
