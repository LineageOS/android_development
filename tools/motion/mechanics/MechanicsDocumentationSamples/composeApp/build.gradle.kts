import org.jetbrains.kotlin.gradle.ExperimentalWasmDsl

plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.composeCompiler)
}

kotlin {
    @OptIn(ExperimentalWasmDsl::class)
    wasmJs {
        browser()
        binaries.executable()
    }

    sourceSets {
        commonMain {
            kotlin {
                languageSettings.languageVersion = "2.0"
                languageSettings.apiVersion = "1.9"
                srcDirs(listOf("src/mechanics", "src/facade"))
                exclude {
                    it.path.endsWith("mechanics/view") || it.name == "SpringTensionHapticPlayer.kt"
                }
            }

            dependencies {
                implementation(kotlin("stdlib"))

                implementation("androidx.annotation:annotation:1.9.1")
                implementation("androidx.collection:collection:1.5.0")
                implementation(compose.foundation)
                implementation(compose.material3)
                implementation(compose.materialIconsExtended)
                implementation(compose.ui)
                implementation(compose.components.resources)
                implementation(compose.components.uiToolingPreview)
            }
        }

        commonTest.dependencies { implementation(libs.kotlin.test) }
    }
}
