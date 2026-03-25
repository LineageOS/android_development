#include <jni.h>
#include <vector>
#include <cstdlib>
#include <cstring>
#include <sys/mman.h>
#include <unistd.h>
#include <fcntl.h>
#include <utility>
#include <sys/prctl.h>

// Note: PR_SET_VMA_ANON_NAME is an Android-specific addition to the Linux prctl
// that allows naming virtual memory areas.
#ifndef PR_SET_VMA
#define PR_SET_VMA 0x53564d41
#endif
#ifndef PR_SET_VMA_ANON_NAME
#define PR_SET_VMA_ANON_NAME 0
#endif

static std::vector<void*> gNativeAllocations;
static std::vector<std::pair<void*, size_t>> gMmapAllocations;

extern "C" JNIEXPORT void JNICALL
Java_com_android_memorylab_MainActivity_nativeAllocate(JNIEnv* env, jobject thiz, jint megabytes) {
    (void)env;
    (void)thiz;
    // Allocate in 10MB chunks to avoid monolithic allocation failures
    int num_chunks = megabytes / 10;
    if (num_chunks <= 0) num_chunks = 1;

    for (int c = 0; c < num_chunks; ++c) {
        size_t size = 10 * 1024 * 1024;
        void* ptr = malloc(size);
        if (ptr) {
            // Fill with random data so ZRAM cannot easily compress it
            uint8_t* byte_ptr = static_cast<uint8_t*>(ptr);
            for (size_t i = 0; i < size; i += 4096) {
                byte_ptr[i] = rand() % 256;
                for(size_t j = 0; j < 64; ++j) {
                     byte_ptr[i + (rand() % 4096)] = rand() % 256;
                }
            }
            gNativeAllocations.push_back(ptr);
        }
    }
}

extern "C" JNIEXPORT void JNICALL
Java_com_android_memorylab_MainActivity_nativeFreeAll(JNIEnv* env, jobject thiz) {
    (void)env;
    (void)thiz;
    for (void* ptr : gNativeAllocations) {
        free(ptr);
    }
    gNativeAllocations.clear();

    for (auto const& [ptr, size] : gMmapAllocations) {
        munmap(ptr, size);
    }
    gMmapAllocations.clear();
}

extern "C" JNIEXPORT void JNICALL
Java_com_android_memorylab_MainActivity_nativeMmap(JNIEnv* env, jobject thiz, jint megabytes) {
    (void)env;
    (void)thiz;
    size_t size = static_cast<size_t>(megabytes) * 1024 * 1024;
    // Anonymous private mapping
    void* ptr = mmap(NULL, size, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
    if (ptr != MAP_FAILED) {
        // Name the mapping so it shows up as [anon:memorylab-clean] in showmap
        prctl(PR_SET_VMA, PR_SET_VMA_ANON_NAME, (unsigned long)ptr, size, (unsigned long)"memorylab-clean");
        gMmapAllocations.push_back({ptr, size});
    }
}

extern "C" JNIEXPORT void JNICALL
Java_com_android_memorylab_MainActivity_nativeConsumeStack(JNIEnv* env, jobject thiz, jint kilobytes) {
    (void)env;
    (void)thiz;

    // Using a fixed size local buffer to ensure stack allocation.
    // 64KB is safe for Android's 1MB default stack.
    if (kilobytes > 64) kilobytes = 64;

    char buffer[64 * 1024];
    memset(buffer, 1, kilobytes * 1024);
}
