# AppJankTest

This is a sample Android application for testing jank instrumentation.

## Features

- **Scrolling Category**:
  - **ListView**: A basic `ListView` implementation with 1000 items.
  - **RecyclerView**: A basic `RecyclerView` implementation with 1000 items.
  - **LazyColumn**: A Jetpack Compose `LazyColumn` implementation with 1000 items.

## How to build

This project uses the Gradle build system. To build the project, run:

```bash
./gradlew assembleDebug
```

(Note: You may need to generate the Gradle wrapper files if they are not present)
