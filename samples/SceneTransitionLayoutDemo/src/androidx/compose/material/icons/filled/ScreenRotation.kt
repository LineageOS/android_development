/*
 * Copyright 2024 The Android Open Source Project
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

package androidx.compose.material.icons.filled

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.materialIcon
import androidx.compose.material.icons.materialPath
import androidx.compose.ui.graphics.vector.ImageVector

public val Icons.Filled.ScreenRotation: ImageVector
    get() {
        if (_screenRotation != null) {
            return _screenRotation!!
        }
        _screenRotation =
            materialIcon(name = "Filled.ScreenRotation") {
                materialPath {
                    moveTo(16.48f, 2.52f)
                    curveToRelative(3.27f, 1.55f, 5.61f, 4.72f, 5.97f, 8.48f)
                    horizontalLineToRelative(1.5f)
                    curveTo(23.44f, 4.84f, 18.29f, 0.0f, 12.0f, 0.0f)
                    lineToRelative(-0.66f, 0.03f)
                    lineToRelative(3.81f, 3.81f)
                    lineToRelative(1.33f, -1.32f)
                    close()
                    moveTo(10.23f, 1.75f)
                    curveToRelative(-0.59f, -0.59f, -1.54f, -0.59f, -2.12f, 0.0f)
                    lineTo(1.75f, 8.11f)
                    curveToRelative(-0.59f, 0.59f, -0.59f, 1.54f, 0.0f, 2.12f)
                    lineToRelative(12.02f, 12.02f)
                    curveToRelative(0.59f, 0.59f, 1.54f, 0.59f, 2.12f, 0.0f)
                    lineToRelative(6.36f, -6.36f)
                    curveToRelative(0.59f, -0.59f, 0.59f, -1.54f, 0.0f, -2.12f)
                    lineTo(10.23f, 1.75f)
                    close()
                    moveTo(14.83f, 21.19f)
                    lineTo(2.81f, 9.17f)
                    lineToRelative(6.36f, -6.36f)
                    lineToRelative(12.02f, 12.02f)
                    lineToRelative(-6.36f, 6.36f)
                    close()
                    moveTo(7.52f, 21.48f)
                    curveTo(4.25f, 19.94f, 1.91f, 16.76f, 1.55f, 13.0f)
                    lineTo(0.05f, 13.0f)
                    curveTo(0.56f, 19.16f, 5.71f, 24.0f, 12.0f, 24.0f)
                    lineToRelative(0.66f, -0.03f)
                    lineToRelative(-3.81f, -3.81f)
                    lineToRelative(-1.33f, 1.32f)
                    close()
                }
            }
        return _screenRotation!!
    }

private var _screenRotation: ImageVector? = null
