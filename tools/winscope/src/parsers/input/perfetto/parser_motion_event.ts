/*
 * Copyright (C) 2024 The Android Open Source Project
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

import {assertDefined} from 'common/assert';
import {AbstractInputEventParser} from 'parsers/input/perfetto/abstract_input_event_parser';
import {TranslateIntDef} from 'parsers/operations/translate_intdef';
import {FakeProtoTransformer} from 'parsers/perfetto/fake_proto_transformer';
import {InputEventType} from 'trace/input/input_event_type';
import {TraceType} from 'trace_api/trace_type';
import {SetFormatters} from 'viewers/operations/set_formatters';

export class ParserMotionEvent extends AbstractInputEventParser {
  private static readonly MOTION_EVENT_FIELD =
    AbstractInputEventParser.WRAPPER_PROTO.fields['dispatcherMotionEvent'];

  protected override readonly transformer = new FakeProtoTransformer(
    assertDefined(ParserMotionEvent.MOTION_EVENT_FIELD.tamperedMessageType),
  );
  protected override readonly eventOps = [
    new SetFormatters(ParserMotionEvent.MOTION_EVENT_FIELD),
    new TranslateIntDef(ParserMotionEvent.MOTION_EVENT_FIELD),
  ];
  protected override readonly hierarchyTreeRootId = 'AndroidMotionEvent';
  protected override readonly eventType = InputEventType.MOTION;
  protected override readonly eventTableColumns =
    AbstractInputEventParser.COMMON_EVENT_COLUMNS;

  override getTraceType(): TraceType {
    return TraceType.INPUT_MOTION_EVENT;
  }

  protected override getTableName(): string {
    return AbstractInputEventParser.MOTION_EVENT_TABLE;
  }
}
