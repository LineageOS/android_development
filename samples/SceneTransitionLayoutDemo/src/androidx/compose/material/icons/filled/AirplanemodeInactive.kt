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

package androidx.compose.material.icons.filled

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.materialIcon
import androidx.compose.material.icons.materialPath
import androidx.compose.ui.graphics.vector.ImageVector

public val Icons.Filled.AirplanemodeInactive: ImageVector
    get() {
        if (_airplanemodeInactive != null) {
            return _airplanemodeInactive!!
        }
        _airplanemodeInactive =
            materialIcon(name = "Filled.AirplanemodeInactive") {
                materialPath {
                    moveTo(10.5f, 7.67f)
                    verticalLineTo(3.5f)
                    curveTo(10.5f, 2.67f, 11.17f, 2.0f, 12.0f, 2.0f)
                    curveToRelative(0.83f, 0.0f, 1.5f, 0.67f, 1.5f, 1.5f)
                    verticalLineTo(9.0f)
                    lineToRelative(8.5f, 5.0f)
                    verticalLineToRelative(2.0f)
                    lineToRelative(-4.49f, -1.32f)
                    lineTo(10.5f, 7.67f)
                    close()
                    moveTo(19.78f, 22.61f)
                    lineToRelative(1.41f, -1.41f)
                    lineTo(13.5f, 13.5f)
                    lineTo(9.56f, 9.56f)
                    lineTo(2.81f, 2.81f)
                    lineTo(1.39f, 4.22f)
                    lineToRelative(6.38f, 6.38f)
                    lineTo(2.0f, 14.0f)
                    verticalLineToRelative(2.0f)
                    lineToRelative(8.5f, -2.5f)
                    verticalLineTo(19.0f)
                    lineTo(8.0f, 20.5f)
                    lineTo(8.0f, 22.0f)
                    lineToRelative(4.0f, -1.0f)
                    lineToRelative(4.0f, 1.0f)
                    lineToRelative(0.0f, -1.5f)
                    lineTo(13.5f, 19.0f)
                    verticalLineToRelative(-2.67f)
                    lineTo(19.78f, 22.61f)
                    close()
                }
            }
        return _airplanemodeInactive!!
    }

private var _airplanemodeInactive: ImageVector? = null
