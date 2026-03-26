# Memory Guide Contributor Guidelines

This directory contains the primary documentation and hands-on sample
applications for Android Platform Memory Analysis. If you are modifying,
extending, or translating these guides, please adhere to the following rules to
ensure consistency and high quality.

## Writing Style

1.  **Self-Sufficient Pages**: Each Markdown file in this guide should be
    readable as a standalone document. If a specific tool requires setup (e.g.,
    `adb root`, `lunch`, or installing a sample app), briefly mention or link to
    those setup instructions rather than assuming the user just read the
    previous page.
2.  **Linear Flow**: The `README.md` acts as the Table of Contents. Every page
    must be directly reachable from `README.md`. Each page should end with a
    distinct `**Next: [Page Name](link.md)**` footer, guiding the reader through
    the preferred linear learning path, except for the last page in the linear
    flow which should link back to `README.md`. You may also include links
    between chapters when it may be helpful for the reader.
3.  **Show, Don't Just Tell**: Every technical concept (e.g., LMKs, GC churn,
    DMA-BUFs) must be paired with a reproducible command-line snippet or a
    reference to an exercise that may be completed using a sample applications.
4.  **Omit Android Studio**: This guide is explicitly for *platform developers*
    and *OEMs*. Focus exclusively on command-line tools available in the AOSP
    tree (`adb`, `dumpsys meminfo`, `showmap`, `perfetto`, `heapprofd`, `ahat`,
    `trace_processor`). Do not mention Android Studio's memory profiler.
5.  **Formatting**: All markdown files must be formatted using `mdformat` to
    ensure consistent wrapping and list numbering. All Java or Kotlin code must
    be formatted accordingly, and must pass `alint` checks.

## Visuals and Diagrams

*   **Graphviz/DOT**: System architecture and conceptual diagrams should be
    written in `.dot` format. Keep the `.dot` source file next to the generated
    `.png` in the `images/` directory.
*   **Screenshots**: It's helpful to the reader to provide screenshots from the
    different tools used. Automatically generating screenshots can be
    challenging to automate from the CLI. Instead, generate artifacts to open
    with the tools (e.g. Perfetto traces to open with ui.perfetto.dev), add a
    placeholder image in the markdown, and add a markdown comment with the word
    TODO and instructions for how to produce the required screenshot using the
    tool. Work with the user to have them generate the screenshot image.
*   **Accessibility**: All images referenced in markdown should include
    descriptive alt text.

## Sample Applications

*   If you introduce a new memory concept, write a small, focused activity in
    `samples/MemoryLab` or create a new dedicated sample app to trigger that
    exact behavior.
*   Samples should be built using the standard AOSP `Android.bp` build system.

## Verification

### Verify exercise instructions

All exercises included in the guide must have clear instructions that are easy
to follow. You must repeat the same instructions yourself and verify that you
are able to complete the exercises. You should be able to complete most
exercises on a virtual device, such as a local "acloud" instance.

### Verify artifacts produced

All artifacts produced during exercises or from sample apps must be verified for
correctness and completeness.

*   Perfetto traces: you can check the contents of a trace using
    `trace_processor` and PerfettoSQL queries. For instance, if a trace should
    include a certain slice, write a PerfettoSQL query to find it.
*   Heap dumps: you can load an hprof file using AHAT, navigate AHAT as a web
    client, and verify that the expected hprof contents are included. For
    instance, if a heap dump should include some object with a certain size,
    look for it using AHAT.

The user will help you generate screenshots from tools such as Perfetto and
AHAT. You should include placeholders in markdown to reference the screenshots
that the user should generate, along with descriptive alt text. When adding an
image placeholder, also include a markdown comment with a TODO to generate the
screenshot, clarifying what the screenshot from the tool is expected to show,
and how to find the content to show using said tool.

### Verify measurements and other claims

Before committing changes, you must verify that the outputs you claim a tool
produces actually match reality. If you claim an unoptimized app uses 30MB of
`mem.rss.file`, you must build it, trace it on a standard emulator (e.g.,
`aosp_cf_x86_64_phone`), and query the trace using `trace_processor` to verify
the math. Do not hallucinate metrics.
