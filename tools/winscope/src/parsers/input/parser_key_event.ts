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

import {assertDefined} from '@common/assert';
import {ParserTimestampConverter} from '@common/time/timestamp_converter';
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {SetFormatters} from '@parsers/operations/set_formatters';
import {TranslateIntDef} from '@parsers/operations/translate_intdef';
import {AbstractParser} from '@parsers/perfetto/abstract_parser';
import {TraceFile} from '@trace_api/trace_file';
import {TraceType} from '@trace_api/trace_type';
import {TraceProcessor} from '@trace_processor/trace_processor';
import {InputEventType} from '@trace/input/input_event_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';

import {AbstractInputEventParser} from './abstract_input_event_parser';

export class ParserKeyEvent extends AbstractInputEventParser {
  private readonly keyEventField =
    this.wrapperProto.fields['dispatcherKeyEvent'];

  static async createInstance(
    traceFile: TraceFile,
    traceProcessor: TraceProcessor,
    timestampConverter: ParserTimestampConverter,
    traceGeometryData: TraceGeometryData,
  ): Promise<Array<AbstractParser<HierarchyTreeNode>>> {
    return [
      new ParserKeyEvent(
        traceFile,
        traceProcessor,
        timestampConverter,
        traceGeometryData,
      ),
    ];
  }

  protected override readonly eventMessageType = assertDefined(
    this.keyEventField.resolve(),
  );
  protected override readonly eventOps = [
    new SetFormatters(this.keyEventField),
    new TranslateIntDef(this.keyEventField),
  ];
  protected override readonly hierarchyTreeRootId = 'AndroidKeyEvent';
  protected override readonly eventType = InputEventType.KEY;
  protected override readonly eventTableColumns =
    AbstractInputEventParser.COMMON_EVENT_COLUMNS.concat(['key_code']);

  override getTraceType(): TraceType {
    return TraceType.INPUT_KEY_EVENT;
  }

  protected override getTableName(): string {
    return AbstractInputEventParser.KEY_EVENT_TABLE;
  }
}
