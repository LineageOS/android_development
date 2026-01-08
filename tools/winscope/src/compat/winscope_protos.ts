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
import {perfetto} from 'protos/perfetto/trace/static';

import AndroidWindowInputDispatchEvent = perfetto.protos.AndroidWindowInputDispatchEvent;
import IInputMethodClientsTraceProto = perfetto.protos.IInputMethodClientsTraceProto;
import InputMethodClientsTraceProto = perfetto.protos.InputMethodClientsTraceProto;
import IInputMethodServiceTraceProto = perfetto.protos.IInputMethodServiceTraceProto;
import IInputMethodManagerServiceTraceProto = perfetto.protos.IInputMethodManagerServiceTraceProto;
import IInputMethodManagerServiceProto = perfetto.protos.IInputMethodManagerServiceProto;
import IInputMethodServiceProto = perfetto.protos.IInputMethodServiceProto;
import InputMethodManagerServiceTraceProto = perfetto.protos.InputMethodManagerServiceTraceProto;
import InputMethodServiceTraceProto = perfetto.protos.InputMethodServiceTraceProto;
import ProtoLogViewerConfig = perfetto.protos.ProtoLogViewerConfig;
import ProtoLogLevel = perfetto.protos.ProtoLogLevel;
import IProtoLogViewerConfig = perfetto.protos.IProtoLogViewerConfig;
import ProtoLogMessage = perfetto.protos.ProtoLogMessage;
import HwcCompositionType = perfetto.protos.HwcCompositionType;
import LayersSnapshotProto = perfetto.protos.LayersSnapshotProto;
import TransactionTraceEntry = perfetto.protos.TransactionTraceEntry;
import LayerState = perfetto.protos.LayerState;
import ShellHandlerMappings = perfetto.protos.ShellHandlerMappings;
import ShellHandlerMapping = perfetto.protos.ShellHandlerMapping;
import IShellTransition = perfetto.protos.IShellTransition;
import ShellTransition = perfetto.protos.ShellTransition;
import ViewCapture = perfetto.protos.ViewCapture;
import WindowManagerTraceEntry = perfetto.protos.WindowManagerTraceEntry;

export {
  AndroidWindowInputDispatchEvent,
  IInputMethodServiceProto,
  IInputMethodClientsTraceProto,
  InputMethodClientsTraceProto,
  IInputMethodServiceTraceProto,
  IInputMethodManagerServiceTraceProto,
  IInputMethodManagerServiceProto,
  InputMethodManagerServiceTraceProto,
  InputMethodServiceTraceProto,
  ProtoLogViewerConfig,
  ProtoLogLevel,
  IProtoLogViewerConfig,
  ProtoLogMessage,
  HwcCompositionType,
  LayersSnapshotProto,
  TransactionTraceEntry,
  LayerState,
  ShellHandlerMappings,
  ShellHandlerMapping,
  IShellTransition,
  ShellTransition,
  ViewCapture,
  WindowManagerTraceEntry,
};
