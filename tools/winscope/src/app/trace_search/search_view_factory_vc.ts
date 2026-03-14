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

import {TraceType} from '@trace_api/trace_type';

import {AbstractSearchViewFactory} from './abstract_search_view_factory';
import {SearchView} from './search_view';

/**
 * A factory for creating search views for View Capture traces.
 */
export class SearchViewFactoryVc extends AbstractSearchViewFactory {
  override readonly traceType = TraceType.VIEW_CAPTURE;
  private static readonly VIEW: SearchView = {
    name: 'viewcapture_search',
    dataType: 'ViewCapture',
    docsUrl: AbstractSearchViewFactory.BASE_DOCS_URL + 'viewcapture-sql-view',
    columns: [
      {
        name: 'state_id',
        desc: 'Unique id of view capture state',
      },
      {name: 'ts', desc: 'Timestamp of state'},
      {
        name: 'package_name',
        desc: 'Package name',
      },
      {
        name: 'window_name',
        desc: 'Window name',
      },
      {
        name: 'class_name',
        desc: 'View class name',
      },
      {
        name: 'property',
        desc: 'Property name accounting for repeated fields',
      },
      {
        name: 'flat_property',
        desc: 'Property name not accounting for repeated fields',
      },
      {name: 'value', desc: 'Property value in string format'},
      {
        name: 'previous_value',
        desc: 'Property value from previous entry in string format',
      },
    ],
    examples: [
      {
        query: `SELECT * FROM viewcapture_search
WHERE class_name LIKE '%SearchContainerView'
  AND flat_property='translation_y'
  AND value!=previous_value`,
        desc: 'returns all states where SearchContainerView moved in the y-direction',
      },
    ],
  };

  static getPossibleSearchViews(): SearchView[] {
    return [SearchViewFactoryVc.VIEW];
  }

  override async createSearchViews(): Promise<string[]> {
    const viewArgsTable = await this.createSqlTableWithDefaults(
      '__intrinsic_viewcapture_view',
    );

    const sqlCreateTableStateChanges = `
            CREATE PERFETTO TABLE vc_state_changes AS
              SELECT
                STATE.id as state_id,
                (SELECT X.id
                  FROM __intrinsic_viewcapture X
                WHERE X.ts < STATE.ts
                ORDER BY X.ts DESC
                LIMIT 1
                ) AS previous_state_id
              FROM __intrinsic_viewcapture STATE;
          `;
    await this.traceProcessor.query(sqlCreateTableStateChanges);

    const sqlCreateNodeWithProperties = `
            CREATE PERFETTO VIEW vc_node_with_properties AS
              SELECT
                STATE.id AS state_id,
                STATE.ts,
                STATE.package_name,
                STATE.window_name,
                NODE.node_id,
                NODE.class_name,
                PROPERTY.key AS property,
                PROPERTY.flat_key AS flat_property,
                PROPERTY.display_value AS value
              FROM __intrinsic_viewcapture STATE
              INNER JOIN __intrinsic_viewcapture_view NODE
                ON NODE.snapshot_id = STATE.id
              INNER JOIN ${viewArgsTable} PROPERTY
                ON PROPERTY.base64_proto_id = NODE.base64_proto_id;
          `;
    await this.traceProcessor.query(sqlCreateNodeWithProperties);

    const sqlCreateViewSearch = `
            CREATE PERFETTO VIEW ${SearchViewFactoryVc.VIEW.name}(
              state_id INT,
              ts INT,
              package_name STRING,
              window_name STRING,
              class_name STRING,
              property STRING,
              flat_property STRING,
              value STRING,
              previous_value STRING
            ) AS
            SELECT
              CURRENT.state_id,
              CURRENT.ts,
              CURRENT.package_name,
              CURRENT.window_name,
              CURRENT.class_name,
              CURRENT.property,
              CURRENT.flat_property,
              CURRENT.value,
              PREVIOUS.value AS previous_value
            FROM vc_state_changes CHANGE
            INNER JOIN vc_node_with_properties CURRENT
              ON CURRENT.state_id = CHANGE.state_id
            INNER JOIN vc_node_with_properties PREVIOUS
              ON PREVIOUS.state_id = CHANGE.previous_state_id
              AND PREVIOUS.node_id = CURRENT.node_id
              AND PREVIOUS.property = CURRENT.property
            ORDER BY CURRENT.ts;
          `;
    await this.traceProcessor.query(sqlCreateViewSearch);

    return [SearchViewFactoryVc.VIEW.name];
  }
}
