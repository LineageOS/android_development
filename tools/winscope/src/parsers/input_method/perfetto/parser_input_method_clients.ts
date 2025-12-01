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

import {AbstractParser} from 'parsers/perfetto/abstract_parser';
import {TraceType} from 'trace_api/trace_type';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';
import {TAMPERED_WINSCOPE_EXTENSIONS} from 'trace/proto_utils/tampered_message_type';
import {assertDefined} from 'common/assert';
import {HierarchyTreeFactory} from './hierarchy_tree_factory';
import {queryArgsForEntry} from 'parsers/perfetto/query_helpers';
import {makeOperations} from './operations_factory';

export class ParserInputMethodClients extends AbstractParser<HierarchyTreeNode> {
  private static readonly ENTRY_FIELD = assertDefined(
    TAMPERED_WINSCOPE_EXTENSIONS.fields[
      '.perfetto.protos.WinscopeExtensionsImpl.inputmethodClients'
    ],
  );
  private static readonly CLIENT_FIELD = assertDefined(
    ParserInputMethodClients.ENTRY_FIELD.tamperedMessageType,
  ).fields['client'];
  private static readonly HIERARCHY_TREE_FACTORY = new HierarchyTreeFactory(
    ParserInputMethodClients.ENTRY_FIELD,
    ParserInputMethodClients.CLIENT_FIELD,
    makeOperations(
      ParserInputMethodClients.ENTRY_FIELD,
      ParserInputMethodClients.CLIENT_FIELD,
      ['viewRootImpl', 'inputMethodManager', 'editorInfo'],
    ),
  );

  override getTraceType(): TraceType {
    return TraceType.INPUT_METHOD_CLIENTS;
  }

  override async getEntry(index: number): Promise<HierarchyTreeNode> {
    const argsData = await queryArgsForEntry(
      this.traceProcessor,
      this.getTableName(),
      this.entryIndexToRowIdMap,
      index,
    );
    return ParserInputMethodClients.HIERARCHY_TREE_FACTORY.makeHierarchyTree(
      argsData,
    );
  }

  protected override getStdLibModuleName(): string | undefined {
    return 'android.winscope.inputmethod';
  }

  protected override getTableName(): string {
    return 'android_inputmethod_clients';
  }
}
