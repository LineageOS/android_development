/*
 * Copyright (C) 2025 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.android.mechanics.demo

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.rememberNavController
import com.android.mechanics.demo.demos.VerticalContainerRevealDemo
import com.android.mechanics.demo.demos.VerticalFadeContentRevealDemo
import com.android.mechanics.demo.documentation.NotificationDismissDemoGoal
import com.android.mechanics.demo.documentation.NotificationDismissDemoStep1
import com.android.mechanics.demo.documentation.NotificationDismissDemoStep2
import com.android.mechanics.demo.documentation.NotificationDismissDemoStep3
import com.android.mechanics.demo.documentation.NotificationDismissDemoStep4
import com.android.mechanics.demo.documentation.NotificationDismissDemoStep5
import com.android.mechanics.demo.documentation.NotificationDismissDemoStep6
import com.android.mechanics.demo.documentation.NotificationDismissDemoStep7
import com.android.mechanics.demo.explanation.ExplanationDemo
import com.android.mechanics.demo.presentation.DirectionChangeDemo
import com.android.mechanics.demo.presentation.DirectionSpecDemo
import com.android.mechanics.demo.presentation.GuaranteeBoxDemo
import com.android.mechanics.demo.presentation.GuaranteeFadeDemo
import com.android.mechanics.demo.presentation.MagneticDetachDemo
import com.android.mechanics.demo.presentation.MagneticDetachWithOverdragDemo
import com.android.mechanics.demo.presentation.SpecDemo
import com.android.mechanics.demo.wallpaper.experiment0.CustomizationMechanicsDemo

@Composable
fun MechanicsDemo(startDestination: String?) {

    val Documentation =
        ParentScreen(
            "documentation",
            mapOf(
                "Codelab Demo Complete" to DemoScreen(NotificationDismissDemoGoal),
                "Codelab Demo 1" to DemoScreen(NotificationDismissDemoStep1),
                "Codelab Demo 2" to DemoScreen(NotificationDismissDemoStep2),
                "Codelab Demo 3" to DemoScreen(NotificationDismissDemoStep3),
                "Codelab Demo 4" to DemoScreen(NotificationDismissDemoStep4),
                "Codelab Demo 5" to DemoScreen(NotificationDismissDemoStep5),
                "Codelab Demo 6" to DemoScreen(NotificationDismissDemoStep6),
                "Codelab Demo 7" to DemoScreen(NotificationDismissDemoStep7),
            ),
            color = MaterialTheme.colorScheme.tertiaryContainer,
        )

    val Home =
        ParentScreen(
            "home",
            mapOf(
                "Documentation" to Documentation,
                "Simple Motion Spec examples" to DemoScreen(SpecDemo),
                "Directionality Hysteresis" to DemoScreen(DirectionChangeDemo),
                "Directionality Effects" to DemoScreen(DirectionSpecDemo),
                "Guaranteed Fade" to DemoScreen(GuaranteeFadeDemo),
                "Guaranteed Size" to DemoScreen(GuaranteeBoxDemo),
                "Magnetic detach" to DemoScreen(MagneticDetachDemo),
                "Magnetic detach with Overdrag" to DemoScreen(MagneticDetachWithOverdragDemo),
                "Customization Picker Mechanics" to DemoScreen(CustomizationMechanicsDemo),
                "MotionValue Explanation" to DemoScreen(ExplanationDemo),
                "Vertical Fade Content Reveal" to DemoScreen(VerticalFadeContentRevealDemo),
                "Vertical Container Reveal" to DemoScreen(VerticalContainerRevealDemo),
            ),
        )

    val rootScreen = Home

    Box(Modifier.fillMaxSize().systemBarsPadding()) {
        val navController = rememberNavController()
        NavHost(navController = navController, startDestination = rootScreen.identifier) {
            screen(rootScreen, navController, startDestination ?: "")
        }
    }
}
