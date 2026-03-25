# Fundamental Concepts

To understand memory usage on Android, you must look at the system from several
different perspectives, ranging from high-level Java objects down to low-level
kernel pages.

## The Performance Cliff

Memory use in and of itself is not a good or bad thing; what matters is what you
are using the memory for. However, as you approach the limit of available memory
on a device, you eventually "fall off a performance cliff."

![A graph showing stable performance until a certain memory threshold, followed
by a steep decline as the system starts thrashing and killing
processes](images/concepts/performance-cliff.png)

<!--
Source for the above diagram is located at: images/concepts/performance_cliff.dot
To regenerate: `dot -Tpng images/concepts/performance_cliff.dot -o images/concepts/performance-cliff.png`
-->

When you are far away from the cliff, adding a small amount of memory usage
(e.g., 50MB) may have no perceptible impact on performance. However, once you
reach the cliff, the operating system must start paging out memory and killing
processes to free up space. At this point, even a small increase in memory use
can lead to significant "thrashing," where the device becomes unresponsive or
appears to reboot because critical processes are killed.

## The Android Stack

Each layer of the Android stack has its own unique view of memory:

![A block diagram of the Android memory stack, showing Java applications at the
top, ART below them, and the Linux kernel with physical pages at the
bottom](images/concepts/android-stack.png)

<!--
Source for the above diagram is located at: images/concepts/android_stack.dot
To regenerate: `dot -Tpng images/concepts/android_stack.dot -o images/concepts/android-stack.png`
-->

1.  **Applications (Java/Kotlin)**: Developers primarily see Java objects
    allocated on the Java heap.
2.  **Android Runtime (ART)**: ART manages the Java heap by using virtual memory
    pages from the kernel. Formerly known as Dalvik (the terms are sometimes
    used interchangeably).
3.  **Linux Kernel**: The kernel sees memory in terms of physical and virtual
    **pages**. Traditionally, these are 4KB, but Android also supports 16KB page
    sizes. The kernel knows nothing about "Java objects."

If you want to optimize memory, you must either optimize within your own layer
(e.g., loading fewer bitmaps) or understand the layers below you to see how your
high-level allocations translate to physical page usage.

## The Zygote Process Model

Android minimizes the cost of starting new applications by using a process
called **Zygote**.

1.  Zygote starts up at boot and preloads common framework classes and resources
    into its memory. From the kernel's perspective, this becomes **anonymous
    dirty memory**, but it is unique to the Zygote process.
2.  When a new application starts, the system **forks** the Zygote process.
3.  The new child process inherits the memory of the Zygote using a **shared
    mapping** with **copy-on-write (COW)** semantics.

![A diagram illustrating the Zygote process sharing memory pages with newly
forked child processes using Copy-on-Write
semantics](images/concepts/zygote-cow.png)

<!--
Source for the above diagram is located at: images/concepts/zygote_cow.dot
To regenerate: `dot -Tpng images/concepts/zygote_cow.dot -o images/concepts/zygote-cow.png`
-->

As long as the child process only reads the memory inherited from Zygote, the
physical memory pages remain shared between all processes. When a child process
modifies a shared page, the kernel transparently creates a private copy of that
page for the process. This model allows many processes to share a large portion
of their memory—especially the framework code and resources—significantly
reducing the overall system memory footprint.

## RSS, PSS, and USS

Because memory is shared heavily between processes—primarily through the Zygote
model—there are three main ways to account for a process's memory usage:

![A diagram visualizing the difference between Resident Set Size (RSS),
Proportional Set Size (PSS), and Unique Set Size (USS) showing how shared memory
pages are accounted for](images/concepts/rss_pss_uss.png)

<!--
Source for the above diagram is located at: images/concepts/rss_pss_uss.dot
To regenerate: `dot -Tpng images/concepts/rss_pss_uss.dot -o images/concepts/rss_pss_uss.png`
-->

-   **RSS (Resident Set Size)**: The total number of pages the process has in
    RAM. This overestimates usage because it counts shared pages multiple times
    (once for every process sharing them).
-   **PSS (Proportional Set Size)**: The total amount of memory unique to the
    process, plus its proportional share of shared memory. If a page is shared
    by 5 processes, each process is charged for 1/5th of that page. PSS is the
    most useful metric for system-wide accounting.
-   **USS (Unique Set Size)**: The amount of memory that is unique to the
    process. This is the memory that would be returned to the system if the
    process were killed.

> **Note**: None of these metrics (RSS, PSS, or USS) include pages that have
> been compressed and swapped into ZRAM, or pages that have been reclaimed by
> the kernel. Memory usage metrics on Android generally represent "resident"
> memory.

## Memory Types: Anonymous vs. File-Backed

Before diving into how the OS reclaims memory, you must understand the two
fundamental categories of memory pages in Linux:

1.  **Anonymous Memory (`anon`)**: Memory that is *not* backed by a file on
    storage. This includes memory allocated by C/C++ `malloc` (like the Scudo
    allocator) and memory allocated for Java objects on the Dalvik heap. Because
    this memory has no source file to return to, the OS must either keep it in
    RAM or compress and swap it out to ZRAM when under pressure.
2.  **File-Backed Memory (`file`)**: Memory that is mapped directly from a file
    on storage. This includes executable code (DEX files, `.so` native
    libraries) and fonts.

## Memory Mapped Files (mmap)

Android uses `mmap` to map both file-backed and anonymous memory into a
process's address space.

When dealing with file-backed memory, pages are further classified into:

-   **Clean Memory**: Pages mapped from a file that have not been modified. If
    the system needs more memory, the kernel can simply drop these pages, as
    they can be re-loaded directly from the file on storage later.
-   **Dirty Memory**: Pages that have been modified by the process. These cannot
    be dropped; they behave like anonymous memory and must be kept in RAM or
    moved to ZRAM (compressed swap).

Android prefers file formats (like DEX) that are amenable to memory mapping,
allowing the system to easily reclaim clean memory under pressure. **Because
anonymous and dirty memory cannot be simply dropped, high private dirty/anon
memory is the primary cause of system thrashing and Low Memory Killer (LMK)
interventions.** If your application uses a lot of private dirty memory, you are
directly contributing to the performance cliff.

________________________________________________________________________________

**Next: [Quick Assessment Tools](tools-overview.md)**
