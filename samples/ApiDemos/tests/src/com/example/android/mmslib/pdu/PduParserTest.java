/*
 * Copyright (C) 2026 The Android Open Source Project
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

package com.example.android.mmslib.pdu;

import android.test.AndroidTestCase;

public class PduParserTest extends AndroidTestCase {

    public void testPduParserUnderflowOOM() {
        // CONTENT_TYPE (0x84), LENGTH_QUOTE (0x1F), uintvar for Integer.MIN_VALUE, well-known type (0x83)
        byte[] pdu = new byte[] {
                (byte) 0x84,
                (byte) 0x1F,
                (byte) 0x88,
                (byte) 0x80,
                (byte) 0x80,
                (byte) 0x80,
                (byte) 0x00,
                (byte) 0x83
        };

        try {
            PduParser parser = new PduParser(pdu, false);
            // This should not crash with OOM.
            parser.parse();
        } catch (OutOfMemoryError e) {
            fail("Triggered OutOfMemoryError due to integer underflow!");
        }
    }
}
