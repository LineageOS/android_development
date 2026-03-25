# Threads and Memory

Every time your application creates a new thread, the operating system must
allocate memory to support it. While threads are generally considered
"lightweight" compared to full processes, their memory cost is not zero. Leaking
threads is a very common way to leak memory on Android.

## The Cost of a Thread

When a thread is created on Android, two main components consume memory:

1.  **The Native Stack**: The `pthread` library allocates a stack for the thread
    to store local variables and call frames. On Android, this is typically 1MB
    by default.
2.  **Internal JVM/Kernel Structures**: The ART runtime and the Linux kernel
    must allocate data structures (like `pthread_internal_t` and
    `java.lang.Thread` objects) to track and manage the thread.

### Stack Memory and `mmap`

It is important to understand that Android allocates the 1MB native stack using
`mmap` with the `MAP_ANONYMOUS | MAP_NORESERVE` flags.

This means the OS reserves 1MB of *virtual* memory address space, but it does
not allocate 1MB of *physical* RAM immediately. Physical memory is only
allocated (paged in) as the thread actually executes code and pushes data onto
the stack. A thread that does nothing will consume very little physical RAM for
its stack.

## Hands-on Exercise: Leaking Threads

We will use the **MemoryLab** sample application to observe what happens when
an application creates hundreds of idle threads.

### 1. Build and Install

```bash
# If you haven't already built MemoryLab
m MemoryLab
adb install -r $OUT/system/app/MemoryLab/MemoryLab.apk
```

### 2. Launch and Baseline

Launch the app and take a baseline memory reading:

```bash
adb shell am start -W -n com.android.memorylab/.MainActivity
adb shell dumpsys meminfo -s com.android.memorylab
```

Look at the `Stack` and `Native Heap` rows in the output. They will likely be
small.

### 3. Create 100 Threads

Tap the **Create 100 Threads** button. The application will spawn 100 new
threads. To ensure the stack memory is actually paged into physical RAM (so we
can see it in our tools), each thread allocates and writes to a small 10KB array
on its stack before it begins waiting.

Run the meminfo command again while the threads are alive:

```bash
adb shell dumpsys meminfo -s com.android.memorylab
```

**The Results:**

Compare the new output to your baseline. You will notice significant increases
while the threads are alive:

-   **`Stack`**: Increased by a megabyte or more. This represents the physical
    pages allocated for the 100 thread stacks (each touching at least 10KB).
-   **`Native Heap` / `Private Other`**: Increased due to the internal `pthread`
    structures allocated by the system for each thread.

To clean up, tap the **Destroy All Threads** button.

### 4. Viewing Threads in Perfetto

Perfetto is excellent for tracking thread lifecycles and counts over time.

![A screenshot of the Perfetto UI showing a counter track with the number of
active threads, and threads starting and exiting in the memorylab
app](images/threads/perfetto-threads.png)

#### PerfettoSQL for Thread Analysis

You can query the trace to count exactly how many threads were spawned by the
application:

```sql
SELECT p.name AS process_name, COUNT(t.id) as thread_count
FROM thread t JOIN process p USING (upid)
WHERE p.name = 'com.android.memorylab' AND t.name LIKE 'LeakedThread-%';
```

A query like this can be used to generate a debug track with a counter as shown
in the screenshot.

________________________________________________________________________________

**Next: [System-wide Troubleshooting](system-wide-memory.md)**
