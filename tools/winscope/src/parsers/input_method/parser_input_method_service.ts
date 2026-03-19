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
import {AbstractParser} from '@parsers/perfetto/abstract_parser';
import {queryArgsForEntry} from '@parsers/perfetto/query_helpers';
import {TraceFile} from '@trace_api/trace_file';
import {TraceType} from '@trace_api/trace_type';
import {TraceProcessor} from '@trace_processor/trace_processor';
import {Registry} from '@trace/proto_utils/tampered_message_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';

import {HierarchyTreeFactory} from './hierarchy_tree_factory';
import {makeOperations} from './operations_factory';

export class ParserInputMethodService extends AbstractParser<HierarchyTreeNode> {
  private readonly entryField = assertDefined(
    assertDefined(
      Registry.getInstance()
        .getType('perfetto.protos.TracePacket')
        ?.fields['winscopeExtensions']?.resolve(),
    ).fields['.perfetto.protos.WinscopeExtensionsImpl.inputmethodService'],
  );
  private readonly serviceField = assertDefined(this.entryField.resolve())
    .fields['inputMethodService'];
  private readonly hierarchyTreeFactory = new HierarchyTreeFactory(
    this.entryField,
    this.serviceField,
    makeOperations(this.entryField, this.serviceField, [
      'windowVisible',
      'decorViewVisible',
      'inputEditorInfo',
    ]),
  );

  static async createInstance(
    traceFile: TraceFile,
    traceProcessor: TraceProcessor,
    timestampConverter: ParserTimestampConverter,
    traceGeometryData: TraceGeometryData,
  ): Promise<Array<AbstractParser<HierarchyTreeNode>>> {
    return [
      new ParserInputMethodService(
        traceFile,
        traceProcessor,
        timestampConverter,
        traceGeometryData,
      ),
    ];
  }

  override getTraceType(): TraceType {
    return TraceType.INPUT_METHOD_SERVICE;
  }

  override async getEntry(index: number): Promise<HierarchyTreeNode> {
    const argsData = await queryArgsForEntry(
      this.traceProcessor,
      this.getTableName(),
      this.entryIndexToRowIdMap,
      index,
    );
    return this.hierarchyTreeFactory.makeHierarchyTree(argsData);
  }

  protected override getStdLibModuleName(): string | undefined {
    return 'android.winscope.inputmethod';
  }

  protected override getTableName(): string {
    return 'android_inputmethod_service';
  }
}
