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

import {InputMethodServiceProto} from 'protos/protos/ime/udc/inputmethodservice_pb';
import {SoftInputWindowProto} from 'protos/protos/ime/udc/softinputwindow_pb';
import {EditorInfoProto} from 'protos/protos/ime/udc/editorinfo_pb';
import {InputConnectionCallProto} from 'protos/protos/ime/udc/inputconnection_pb';
import {BinaryReader} from 'google-protobuf';

/**
 * Patch InputMethodServiceProto.deserializeBinaryFromReader to handle legacy field 3 mismatch.
 * Field 3 (decor_view_visible) is bool (wire type 0), but some legacy traces use wire type 2.
 * @param message proto to deserialize
 * @param reader reader to read from
 * @returns deserialized proto
 */
InputMethodServiceProto.deserializeBinaryFromReader = function (
  message: InputMethodServiceProto, reader: BinaryReader,
) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    const field = reader.getFieldNumber();
    switch (field) {
      case 1: {
        const value = new SoftInputWindowProto();
        reader.readMessage(
          value,
          SoftInputWindowProto.deserializeBinaryFromReader,
        );
        message.setSoftInputWindow(value);
        break;
      }
      case 2:
        message.setViewsCreated(reader.readBool());
        break;
      case 3:
        // Patch: Check if wire type is 0 (Varint). If not, skip.
        // 0 = VARINT, 2 = DELIMITED
        if (reader.getWireType() !== 0) {
          if (reader.getWireType() === 2) {
            reader.readBytes();
          } else {
            reader.skipField();
          }
        } else {
          message.setDecorViewVisible(reader.readBool());
        }
        break;
      case 4:
        message.setDecorViewWasVisible(reader.readBool());
        break;
      case 5:
        message.setWindowVisible(reader.readBool());
        break;
      case 6:
        message.setInShowWindow(reader.readBool());
        break;
      case 7:
        message.setConfiguration(reader.readString());
        break;
      case 8:
        message.setToken(reader.readString());
        break;
      case 9:
        message.setInputBinding(reader.readString());
        break;
      case 10:
        message.setInputStarted(reader.readBool());
        break;
      case 11:
        message.setInputViewStarted(reader.readBool());
        break;
      case 12:
        message.setCandidatesViewStarted(reader.readBool());
        break;
      case 13: {
        const value = new EditorInfoProto();
        reader.readMessage(value, EditorInfoProto.deserializeBinaryFromReader);
        message.setInputEditorInfo(value);
        break;
      }
      case 14:
        message.setShowInputRequested(reader.readBool());
        break;
      case 15:
        message.setLastShowInputRequested(reader.readBool());
        break;
      case 18:
        message.setShowInputFlags(reader.readInt32());
        break;
      case 19:
        message.setCandidatesVisibility(reader.readInt32());
        break;
      case 20:
        message.setFullscreenApplied(reader.readBool());
        break;
      case 21:
        message.setIsFullscreen(reader.readBool());
        break;
      case 22:
        message.setExtractViewHidden(reader.readBool());
        break;
      case 23:
        message.setExtractedToken(reader.readInt32());
        break;
      case 24:
        message.setIsInputViewShown(reader.readBool());
        break;
      case 25:
        message.setStatusIcon(reader.readInt32());
        break;
      case 26: {
        const value = new InputMethodServiceProto.InsetsProto();
        reader.readMessage(
          value,
          InputMethodServiceProto.InsetsProto.deserializeBinaryFromReader,
        );
        message.setLastComputedInsets(value);
        break;
      }
      case 27:
        message.setSettingsObserver(reader.readString());
        break;
      case 28: {
        const value = new InputConnectionCallProto();
        reader.readMessage(
          value,
          InputConnectionCallProto.deserializeBinaryFromReader,
        );
        message.setInputConnectionCall(value);
        break;
      }
      default:
        reader.skipField();
        break;
    }
  }
  return message;
};
