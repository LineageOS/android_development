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

import {descriptors as perfettoTraceDescriptorsBin} from '@protos/perfetto/trace/descriptors';
import {EditorInfoProto as EditorInfoProtoUdc} from '@protos/protos/ime/udc/editorinfo_pb';
import {InputConnectionCallProto as InputConnectionCallProtoUdc} from '@protos/protos/ime/udc/inputconnection_pb';
import {InputMethodServiceTraceFileProto as InputMethodServiceTraceFileProtoUdc, InputMethodServiceTraceProto as InputMethodServiceTraceProtoUdc,} from '@protos/protos/ime/udc/inputmethodeditortrace_pb';
import {InputMethodClientsTraceFileProto as InputMethodClientsTraceFileProtoUdc, InputMethodClientsTraceProto as InputMethodClientsTraceProtoUdc,} from '@protos/protos/ime/udc/inputmethodeditortrace_pb';
import {InputMethodManagerServiceTraceFileProto as InputMethodManagerServiceTraceFileProtoUdc, InputMethodManagerServiceTraceProto as InputMethodManagerServiceTraceProtoUdc,} from '@protos/protos/ime/udc/inputmethodeditortrace_pb';
import {InputMethodServiceProto as InputMethodServiceProtoUdc} from '@protos/protos/ime/udc/inputmethodservice_pb';
import {SoftInputWindowProto as SoftInputWindowProtoUdc} from '@protos/protos/ime/udc/softinputwindow_pb';
import {ProtoLogLevel as PerfettoProtoLogLevel} from '@protos/protos/perfetto/common/protolog_common_pb';
import {QueryArgs as PerfettoQueryArgs, RegisterSqlPackageArgs as PerfettoRegisterSqlPackageArgs, ResetTraceProcessorArgs as PerfettoResetTraceProcessorArgs, TraceProcessorRpc as PerfettoTraceProcessorRpc, TraceProcessorRpcStream as PerfettoTraceProcessorRpcStream,} from '@protos/protos/perfetto/trace_processor/trace_processor_pb';
import {InputMethodServiceTraceProto as PerfettoInputMethodServiceTraceProto} from '@protos/protos/perfetto/trace/android/inputmethodeditor_pb';
import {InputMethodClientsTraceProto as PerfettoInputMethodClientsTraceProto} from '@protos/protos/perfetto/trace/android/inputmethodeditor_pb';
import {InputMethodManagerServiceTraceProto as PerfettoInputMethodManagerServiceTraceProto} from '@protos/protos/perfetto/trace/android/inputmethodeditor_pb';
import {ProtoLogViewerConfig as PerfettoProtoLogViewerConfig} from '@protos/protos/perfetto/trace/android/protolog_pb';
import {ProtoLogMessage as PerfettoProtoLogMessage} from '@protos/protos/perfetto/trace/android/protolog_pb';
import {WindowManagerServiceDumpProto as PerfettoWindowManagerServiceDumpProto} from '@protos/protos/perfetto/trace/android/server/windowmanagerservice_pb';
import {ShellHandlerMapping as PerfettoShellHandlerMapping, ShellHandlerMappings as PerfettoShellHandlerMappings, ShellTransition as PerfettoShellTransition,} from '@protos/protos/perfetto/trace/android/shell_transition_pb';
import {LayersSnapshotProto as PerfettoLayersSnapshotProto} from '@protos/protos/perfetto/trace/android/surfaceflinger_layers_pb';
import {HwcCompositionType as PerfettoHwcCompositionType} from '@protos/protos/perfetto/trace/android/surfaceflinger_layers_pb';
import {TransactionTraceEntry as PerfettoTransactionTraceEntry, TransactionTraceFile as PerfettoTransactionTraceFile,} from '@protos/protos/perfetto/trace/android/surfaceflinger_transactions_pb';
import {LayerState as PerfettoLayerState} from '@protos/protos/perfetto/trace/android/surfaceflinger_transactions_pb';
import {ViewCapture as PerfettoViewCapture} from '@protos/protos/perfetto/trace/android/viewcapture_pb';
import {WindowManagerTraceEntry as PerfettoWindowManagerTraceEntry} from '@protos/protos/perfetto/trace/android/windowmanager_pb';
import {WinscopeExtensionsImpl} from '@protos/protos/perfetto/trace/android/winscope_extensions_impl_pb';
import {WinscopeExtensions} from '@protos/protos/perfetto/trace/android/winscope_extensions_pb';
import {ClockSnapshot as PerfettoClockSnapshot} from '@protos/protos/perfetto/trace/clock_snapshot_pb';
import {InternedData as PerfettoInternedData} from '@protos/protos/perfetto/trace/interned_data/interned_data_pb';
import {InternedString as PerfettoInternedString} from '@protos/protos/perfetto/trace/profiling/profile_common_pb';
import {TracePacket as PerfettoTracePacket} from '@protos/protos/perfetto/trace/trace_packet_pb';
import {Trace as PerfettoTrace} from '@protos/protos/perfetto/trace/trace_pb';
import {ProtoLogFileProto as ProtoLogFileProtoUdc, ProtoLogMessage as ProtoLogMessageUdc,} from '@protos/protos/protolog/udc/protolog_pb';
import {LayersTraceFileProto as LayersTraceFileProtoUdc, LayersTraceProto as LayersTraceProtoUdc,} from '@protos/protos/surfaceflinger/udc/layerstrace_pb';
import {Target as TargetUdc, TransitionTraceProto as TransitionTraceProtoUdc, Transition as TransitionUdc,} from '@protos/protos/transitions/udc/windowmanagertransitiontrace_pb';
import {HandlerMapping as ShellHandlerMappingUdc, Transition as ShellTransitionProtoUdc, WmShellTransitionTraceProto as WmShellTransitionTraceProtoUdc,} from '@protos/protos/transitions/udc/wm_shell_transition_trace_pb';
import {ExportedData as ExportedDataUdc, WindowData as WindowDataUdc,} from '@protos/protos/viewcapture/udc/view_capture_pb';
import {FrameData as FrameDataUdc, ViewNode as ViewNodeUdc,} from '@protos/protos/viewcapture/udc/view_capture_pb';
import {WindowManagerTraceFileProto as WindowManagerTraceFileProtoUdc, WindowManagerTraceProto as WindowManagerTraceProtoUdc,} from '@protos/protos/windowmanager/udc/windowmanagertrace_pb';
import {BinaryReader} from 'google-protobuf';
import {DescriptorProto, EnumDescriptorProto, FieldDescriptorProto, FileDescriptorSet,} from 'google-protobuf/google/protobuf/descriptor_pb';

export async function getPerfettoTraceDescriptors(): Promise<FileDescriptorSet> {
  return FileDescriptorSet.deserializeBinary(perfettoTraceDescriptorsBin);
}

export function byteStringAsUint8Array(data: string | Uint8Array): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  return new TextEncoder().encode(data);
}

export {
  PerfettoTracePacket,
  PerfettoClockSnapshot,
  PerfettoTrace,
  WinscopeExtensionsImpl,
  InputMethodServiceTraceProtoUdc,
  InputMethodServiceTraceFileProtoUdc,
  WinscopeExtensions,
  PerfettoInputMethodServiceTraceProto,
  InputMethodClientsTraceProtoUdc,
  InputMethodClientsTraceFileProtoUdc,
  PerfettoInputMethodClientsTraceProto,
  PerfettoTransactionTraceEntry,
  PerfettoTransactionTraceFile,
  PerfettoProtoLogViewerConfig,
  PerfettoInternedString,
  PerfettoInternedData,
  PerfettoLayersSnapshotProto,
  LayersTraceFileProtoUdc,
  LayersTraceProtoUdc,
  PerfettoShellHandlerMapping,
  PerfettoShellHandlerMappings,
  PerfettoShellTransition,
  ShellHandlerMappingUdc,
  ShellTransitionProtoUdc,
  WmShellTransitionTraceProtoUdc,
  PerfettoProtoLogMessage,
  ProtoLogFileProtoUdc,
  ProtoLogMessageUdc,
  PerfettoHwcCompositionType,
  PerfettoProtoLogLevel,
  PerfettoQueryArgs,
  PerfettoRegisterSqlPackageArgs,
  PerfettoResetTraceProcessorArgs,
  PerfettoTraceProcessorRpc,
  PerfettoTraceProcessorRpcStream,
  PerfettoLayerState,
  PerfettoWindowManagerServiceDumpProto,
  PerfettoWindowManagerTraceEntry,
  WindowManagerTraceFileProtoUdc,
  WindowManagerTraceProtoUdc,
  ExportedDataUdc,
  WindowDataUdc,
  FrameDataUdc,
  ViewNodeUdc,
  PerfettoViewCapture,
  InputMethodManagerServiceTraceProtoUdc,
  InputMethodManagerServiceTraceFileProtoUdc,
  PerfettoInputMethodManagerServiceTraceProto,
  EditorInfoProtoUdc,
  InputConnectionCallProtoUdc,
  InputMethodServiceProtoUdc,
  SoftInputWindowProtoUdc,
  TransitionUdc,
  TargetUdc,
  TransitionTraceProtoUdc,
  FileDescriptorSet,
  FieldDescriptorProto,
  DescriptorProto,
  EnumDescriptorProto,
  BinaryReader,
};
