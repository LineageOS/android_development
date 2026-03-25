# App Code is Memory

The code you write is itself a form of memory use. Every class, method, and
string constant in your application must be loaded into RAM when it is executed.
The larger your application's code base, the more memory it will consume just to
exist.

## File-Backed Memory and Demand Paging

Android loads executable code from your `.apk` (like `.oat` or `.so` files)
using `mmap`. This means the code is **file-backed**.

Crucially, Android uses **demand paging**. When your app starts, the kernel does
not load the entire APK into RAM immediately. Instead, it only maps the file
into the process's virtual address space. As your app executes, and the CPU
jumps to a new function, it triggers a "page fault." The kernel pauses the
thread, reads that specific 4KB page of code from the storage into physical RAM,
and resumes execution.

![A diagram illustrating demand paging, showing virtual pages being mapped to
physical RAM pages only when accessed](images/app-code/demand_paging.png)

<!--
Source for the above diagram is located at: images/app-code/demand_paging.dot
To regenerate: `dot -Tpng images/app-code/demand_paging.dot -o images/app-code/demand_paging.png`
-->

This means that code you *package* but never *execute* does not use physical
memory for the code pages themselves. However, unused libraries still increase
the overall APK size and can significantly increase the memory used by the
system's internal metadata (like DEX indices and class descriptors), which must
be read to even *know* that the code exists. Furthermore, many libraries contain
static initializers or are touched by dependency injection frameworks during app
startup, causing them to be paged into RAM anyway.

### Page Eviction and Slowdowns

Because file-backed memory can always be re-read from storage, the kernel considers
these pages "clean". When the system experiences memory pressure, the kernel
will **evict** (drop) these clean code pages from RAM to make room for other
things.

If your app later needs to execute that code again, the CPU will fault, and the
kernel must re-read the page from storage. **The more code your app has, the more
vulnerable it is to having its code evicted.** When a user returns to your
bloated app after using other apps, they will experience random jank and
slowdowns as the CPU constantly stalls waiting for code to be paged back in from
storage.

**The Cost of a Page Fault:** While it varies heavily based on the device's
storage speed (UFS vs. eMMC) and kernel state, a major page fault (reading 4KB
from storage) can cost anywhere from **0.5ms to 5ms**. If your startup path touches
500 different pages of unoptimized code, you could easily introduce several
hundred milliseconds of pure I/O latency to your app startup time.

## Dead Code and R8

Because every executed method takes up memory, having a "bloated" app with
unnecessary initializations or unused libraries can severely impact startup
performance and baseline memory usage.

This is why tools like [R8](https://r8.googlesource.com/r8) (ProGuard) are
critical. R8 analyzes your application's bytecode and removes any classes or
methods that are never called ("dead code stripping").

## Hands-on Exercise: The Cost of Bloat

To demonstrate the impact of code size, we have created two versions of an
application in the `samples/CodeBloat/` directory.

The build script `generate_code.sh` artificially creates 300 Java classes, each
with 500 methods containing unique strings.

-   **CodeBloat**: The standard, unoptimized build containing all generated
    classes.
-   **CodeBloatOptimized**: The same source code, but compiled with R8 shrinking
    enabled.

The `MainActivity` in both apps attempts to touch all 300 classes on a
background thread during startup.

### 1. Build and Install

```bash
m CodeBloat CodeBloatOptimized
adb install -r $OUT/system/app/CodeBloat/CodeBloat.apk
adb install -r $OUT/system/app/CodeBloatOptimized/CodeBloatOptimized.apk
```

### 2. Speed Compile

To maximize the file-backed memory impact, we will use the `cmd package compile`
tool to ahead-of-time (AOT) compile the apps into `.oat` files.

```bash
adb shell cmd package compile -m speed -f com.android.codebloat
adb shell cmd package compile -m speed -f com.android.codebloat.optimized
```

### 3. Launch and Compare

Launch the unoptimized app and check its memory footprint:

```bash
adb shell am start -W -n com.android.codebloat/.MainActivity
sleep 5 # Wait for the background thread to touch the classes
adb shell dumpsys meminfo -s com.android.codebloat
```

Now do the same for the optimized app:

```bash
adb shell am start -W -n com.android.codebloat.optimized/com.android.codebloat.MainActivity
sleep 5
adb shell dumpsys meminfo -s com.android.codebloat.optimized
```

**The Results:**

If you look at the **Code** row in the `App Summary` section, you will see a
massive difference:

-   **Unoptimized `Code`**: ~30,000 KB (30 MB)
-   **Optimized `Code`**: ~2,000 KB (2 MB)

Because R8 determined that the 500 methods inside those classes were never
actually doing anything useful (the `doSomething()` method only calls
`method0()`, and the results are ignored), it stripped almost all of the
artificially generated code out of the final APK.

### 4. View Startup in Perfetto

The impact of this code bloat is extremely visible during application startup.

**Unoptimized App (`mem.rss.file` climbs massively):**

![A screenshot of the Perfetto UI showing the com.android.codebloat process
startup with the mem.rss.file track climbing significantly, resulting in a 1.2s
startup delay](images/app-code/code-bloat-perfetto.png)

In the unoptimized app, the `mem.rss.file` track (representing file-backed
memory) increases dramatically during the application startup phase. As the app
touches the bloated, artificially generated classes, the operating system is
forced to page in large amounts of code from the compiled `.oat` file on storage.
You can visually see this impact in the thread state track for the main thread:
the high frequency of **yellow slices** indicates the thread is frequently
blocked and stalling on file I/O while waiting for these code pages to be read.
The bottom panel shows a massive delta value, adding up to over 141MB of
file-backed memory paged into RAM. This heavy I/O causes the startup to take
over 1.2 seconds, resulting in a noticeably sluggish user experience.

Note: the trace screenshots demonstrate a memory trend, but actual magnitudes
will vary by device characteristics.

**Optimized App (`mem.rss.file` peaks at a lower value):**

![A screenshot of the Perfetto UI showing the com.android.codebloat.optimized
process startup with a relatively flat mem.rss.file track, taking only
743ms](images/app-code/code-opt-perfetto.png)

<--! TODO retake screenshots, showing the breakdown of thread state time, and
zooming on classloading slices. -->

In the optimized app, R8 has stripped the dead code out of the APK during the
build process, leaving far fewer executable pages to read from storage. The
`mem.rss.file` track climbs much less (a delta of only ~114MB), and the total
startup time is drastically reduced to roughly 743ms. This prevents I/O stalls
and leaves more free memory for the rest of the system.

**Startup Comparison:**

Metric                   | Unoptimized (CodeBloat) | Optimized (CodeBloatOptimized)
:----------------------- | :---------------------- | :-----------------------------
**Startup Time**         | ~1.25 seconds           | ~743 ms
**`mem.rss.file` Delta** | ~141 MB                 | ~114 MB

#### PerfettoSQL for File-Backed Memory

You can run a query to track the maximum amount of file-backed memory that any
`codebloat` application touched during its execution:

```sql
SELECT
  p.name AS process_name,
  max(c.value)/1024.0/1024.0 AS max_rss_file_mb
FROM counter c
JOIN process_counter_track t ON c.track_id = t.id
JOIN process p USING (upid)
WHERE p.name LIKE 'com.android.codebloat%' AND t.name = 'mem.rss.file'
GROUP BY p.name;
```

________________________________________________________________________________

**Next: [Threads and Memory](threads.md)**
