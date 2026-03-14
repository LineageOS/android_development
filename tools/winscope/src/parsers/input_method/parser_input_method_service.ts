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
import {AbstractParser} from '@parsers/perfetto/abstract_parser';
import {queryArgsForEntry} from '@parsers/perfetto/query_helpers';
import {TraceType} from '@trace_api/trace_type';
import {PERFETTO_TRACE_PACKET_ROOT} from '@trace/proto_utils/tampered_message_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';

import {HierarchyTreeFactory} from './hierarchy_tree_factory';
import {makeOperations} from './operations_factory';

export class ParserInputMethodService extends AbstractParser<HierarchyTreeNode> {
  private static readonly ENTRY_FIELD = assertDefined(
    assertDefined(
      PERFETTO_TRACE_PACKET_ROOT.lookupType(
        'perfetto.protos.TracePacket',
      )?.fields['winscopeExtensions']?.resolve(),
    ).fields['.perfetto.protos.WinscopeExtensionsImpl.inputmethodService'],
  );
  private static readonly SERVICE_FIELD = assertDefined(
    ParserInputMethodService.ENTRY_FIELD.resolve(),
  ).fields['inputMethodService'];
  private static readonly HIERARCHY_TREE_FACTORY = new HierarchyTreeFactory(
    ParserInputMethodService.ENTRY_FIELD,
    ParserInputMethodService.SERVICE_FIELD,
    makeOperations(
      ParserInputMethodService.ENTRY_FIELD,
      ParserInputMethodService.SERVICE_FIELD,
      ['windowVisible', 'decorViewVisible', 'inputEditorInfo'],
    ),
  );

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
    return ParserInputMethodService.HIERARCHY_TREE_FACTORY.makeHierarchyTree(
      argsData,
    );
  }

  protected override getStdLibModuleName(): string | undefined {
    return 'android.winscope.inputmethod';
  }

  protected override getTableName(): string {
    return 'android_inputmethod_service';
  }
}
