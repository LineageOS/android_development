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

public val Icons.Filled.Bedtime: ImageVector
    get() {
        if (_bedtime != null) {
            return _bedtime!!
        }
        _bedtime =
            materialIcon(name = "Filled.Bedtime") {
                materialPath {
                    moveTo(12.34f, 2.02f)
                    curveTo(6.59f, 1.82f, 2.0f, 6.42f, 2.0f, 12.0f)
                    curveToRelative(0.0f, 5.52f, 4.48f, 10.0f, 10.0f, 10.0f)
                    curveToRelative(3.71f, 0.0f, 6.93f, -2.02f, 8.66f, -5.02f)
                    curveTo(13.15f, 16.73f, 8.57f, 8.55f, 12.34f, 2.02f)
                    close()
                }
            }
        return _bedtime!!
    }

private var _bedtime: ImageVector? = null
