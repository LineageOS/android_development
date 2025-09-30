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

public val Icons.Filled.NearbyOff: ImageVector
    get() {
        if (_nearbyOff != null) {
            return _nearbyOff!!
        }
        _nearbyOff =
            materialIcon(name = "Filled.NearbyOff") {
                materialPath {
                    moveTo(21.41f, 13.42f)
                    lineTo(18.83f, 16.0f)
                    lineToRelative(-1.81f, -1.81f)
                    lineTo(19.2f, 12.0f)
                    lineTo(12.0f, 4.8f)
                    lineTo(9.81f, 6.99f)
                    lineTo(8.0f, 5.17f)
                    lineToRelative(2.58f, -2.58f)
                    curveToRelative(0.78f, -0.78f, 2.05f, -0.78f, 2.83f, 0.0f)
                    lineToRelative(8.0f, 8.0f)
                    curveTo(22.2f, 11.37f, 22.2f, 12.63f, 21.41f, 13.42f)
                    close()
                    moveTo(21.19f, 21.19f)
                    lineToRelative(-1.41f, 1.41f)
                    lineTo(16.0f, 18.83f)
                    lineToRelative(-2.58f, 2.58f)
                    curveToRelative(-0.78f, 0.78f, -2.05f, 0.78f, -2.83f, 0.0f)
                    lineToRelative(-8.0f, -8.0f)
                    curveToRelative(-0.78f, -0.78f, -0.78f, -2.05f, 0.0f, -2.83f)
                    lineTo(5.17f, 8.0f)
                    lineTo(1.39f, 4.22f)
                    lineTo(2.8f, 2.81f)
                    lineTo(21.19f, 21.19f)
                    close()
                    moveTo(14.19f, 17.02f)
                    lineToRelative(-1.39f, -1.39f)
                    lineToRelative(-0.8f, 0.8f)
                    lineTo(7.58f, 12.0f)
                    lineToRelative(0.8f, -0.8f)
                    lineToRelative(-1.4f, -1.39f)
                    lineTo(4.8f, 12.0f)
                    lineToRelative(7.2f, 7.2f)
                    lineTo(14.19f, 17.02f)
                    close()
                    moveTo(16.42f, 12.0f)
                    lineTo(12.0f, 7.58f)
                    lineToRelative(-0.8f, 0.8f)
                    lineToRelative(4.42f, 4.42f)
                    lineTo(16.42f, 12.0f)
                    close()
                }
            }
        return _nearbyOff!!
    }

private var _nearbyOff: ImageVector? = null
