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

import {
  assertBigIntOrUndefined,
  assertDefined,
  assertStringOrUndefined,
} from 'common/assert';
import {AbstractParser} from 'parsers/perfetto/abstract_parser';
import {FakeProtoTransformer} from 'parsers/perfetto/fake_proto_transformer';
import {queryEntry} from 'parsers/perfetto/utils';
import {RectsComputation} from 'parsers/window_manager/computations/rects_computation';
import {HierarchyTreeBuilderWm} from 'parsers/window_manager/hierarchy_tree_builder_wm';
import {PropertiesProviderFactory} from 'parsers/window_manager/properties_provider_factory';
import {perfetto} from 'protos/perfetto/trace/static';
import {
  CustomQueryParserResultTypeMap,
  CustomQueryType,
  VisitableParserCustomQuery,
} from 'trace_api/custom_query';
import {EntriesRange} from 'trace_api/index_types';
import {TraceType} from 'trace_api/trace_type';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';
import {PropertiesProvider} from 'tree_node/properties_provider';
import {TAMPERED_PROTOS_LATEST} from './tampered_protos_latest';

/**
 * Parser for WindowManager Perfetto traces.
 */
export class ParserWindowManager extends AbstractParser<HierarchyTreeNode> {
  private readonly protoTransformer = new FakeProtoTransformer(
    assertDefined(TAMPERED_PROTOS_LATEST.entryField.tamperedMessageType),
  );
  private readonly factory = new PropertiesProviderFactory(
    TAMPERED_PROTOS_LATEST,
  );

  override getTraceType(): TraceType {
    return TraceType.WINDOW_MANAGER;
  }

  override async getEntry(index: number): Promise<HierarchyTreeNode> {
    let entryProto = await queryEntry(
      this.traceProcessor,
      this.getTableName(),
      this.entryIndexToRowIdMap,
      index,
    );
    entryProto = this.protoTransformer.transform(entryProto);
    return this.makeHierarchyTree(entryProto);
  }

  protected override getTableName(): string {
    return 'android_windowmanager';
  }

  protected override getStdLibModuleName(): string {
    return 'android.winscope.windowmanager';
  }

  override customQuery<Q extends CustomQueryType>(
    type: Q,
    entriesRange: EntriesRange,
  ): Promise<CustomQueryParserResultTypeMap[Q]> {
    return new VisitableParserCustomQuery(type)
      .visit(CustomQueryType.WM_WINDOWS_TOKEN_AND_TITLE, async () => {
        const sql = `SELECT DISTINCT token, title FROM android_windowmanager_windowcontainer;`;
        const queryResult = await this.traceProcessor.query(sql);
        const result: CustomQueryParserResultTypeMap[CustomQueryType.WM_WINDOWS_TOKEN_AND_TITLE] =
          [];
        for (const it = queryResult.iter({}); it.valid(); it.next()) {
          const token = assertBigIntOrUndefined(it.get('token') ?? undefined);
          const title = assertStringOrUndefined(it.get('title') ?? undefined);
          if (token !== undefined && title !== undefined) {
            result.push({token: Number(token), title});
          }
        }
        return result;
      })
      .getResult();
  }

  private makeHierarchyTree(
    entryProto: perfetto.protos.IWindowManagerTraceEntry,
  ): HierarchyTreeNode {
    const containers: PropertiesProvider[] =
      this.factory.makeContainerProperties(
        assertDefined(entryProto.windowManagerService),
      );

    const entry = this.factory.makeEntryProperties(
      assertDefined(entryProto.windowManagerService),
    );

    return new HierarchyTreeBuilderWm()
      .setRoot(entry)
      .setChildren(containers)
      .setComputations([new RectsComputation()])
      .build();
  }
}
