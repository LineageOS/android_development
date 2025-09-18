This contains the interactive, inline demos for the go/mechanics-docs.

-   [commonMain](./composeApp/src/commonMain/kotlin) is a symbolic link and
    contains the source from `frameworks/libs/systemui/mechanics`. While the
    code is mostly multiplat compatible, there are a few files excluded in
    Gradle (such as the View specific implementations)
-   [commonMain](./composeApp/src/facade) contains stand-ins for non-compatible
    code we cannot remove from the mechanics library
-   [wasmJsMain](./composeApp/src/wasmJsMain) contains the actual demo for the
    documentation.

### Build and Run Web Application

To build and run the development version of the web app, use the run
configuration from the run widget in your IDE’s toolbar or run it directly from
the terminal: - on macOS/Linux `shell
./gradlew :composeApp:wasmJsBrowserDevelopmentRun` - on Windows `shell
.\gradlew.bat :composeApp:wasmJsBrowserDevelopmentRun`

### Deploy

Copy the output to /google/data/rw/teams/mechanics-docs/
