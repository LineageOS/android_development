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
 * A factory for creating search views for Window Manager traces.
 */
export class SearchViewFactoryWm extends AbstractSearchViewFactory {
  override readonly traceType = TraceType.WINDOW_MANAGER;
  private static readonly URL =
    AbstractSearchViewFactory.BASE_DOCS_URL + 'windowmanager-sql-view';
  private static readonly VIEW: SearchView = {
    name: 'wm_search',
    dataType: 'WindowManager container',
    docsUrl: SearchViewFactoryWm.URL,
    columns: [
      {
        name: 'state_id',
        desc: 'Unique id of entry to which container belongs',
      },
      {name: 'ts', desc: 'Timestamp of entry to which container belongs'},
      {name: 'title', desc: 'Container title'},
      {name: 'token', desc: 'Container token'},
      {name: 'parent_token', desc: 'Parent container token'},
      {name: 'is_visible', desc: 'Container visibility'},
      {
        name: 'previous_is_visible',
        desc: 'Container visibility from previous entry',
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
        query: `SELECT DISTINCT ts, title, token FROM wm_search
WHERE title like '%LauncherActivity%'
AND is_visible=1`,
        desc: 'returns timestamp for all states where the LauncherActivity window is visible',
      },
    ],
  };

  static getPossibleSearchViews(): SearchView[] {
    return [SearchViewFactoryWm.VIEW];
  }

  override async createSearchViews(): Promise<string[]> {
    const containerArgsTable = await this.createSqlTableWithDefaults(
      '__intrinsic_windowmanager_windowcontainer',
    );

    const sqlCreateTableStateChanges = `
            CREATE PERFETTO TABLE wm_state_changes AS
              SELECT
                STATE.id as state_id,
                (SELECT X.id
                  FROM android_windowmanager X
                WHERE X.ts < STATE.ts
                ORDER BY X.ts DESC
                LIMIT 1
                ) as previous_state_id
              FROM android_windowmanager STATE;
          `;
    await this.traceProcessor.query(sqlCreateTableStateChanges);

    const sqlCreateViewContainerWithProperties = `
            CREATE PERFETTO VIEW wm_container_with_properties AS
              SELECT
                STATE.id as state_id,
                STATE.ts,
                CONTAINER.title,
                CONTAINER.token,
                CONTAINER.parent_token,
                CONTAINER.is_visible,
                PROPERTY.key as property,
                PROPERTY.flat_key as flat_property,
                PROPERTY.display_value as value
              FROM android_windowmanager STATE
              INNER JOIN __intrinsic_windowmanager_windowcontainer CONTAINER
                ON CONTAINER.snapshot_id = STATE.id
              INNER JOIN ${containerArgsTable} PROPERTY
                ON PROPERTY.base64_proto_id = CONTAINER.base64_proto_id;
          `;
    await this.traceProcessor.query(sqlCreateViewContainerWithProperties);

    const sqlCreateViewWmSearch = `
            CREATE PERFETTO VIEW ${SearchViewFactoryWm.VIEW.name}(
              state_id INT,
              ts INT,
              title STRING,
              token INT,
              parent_token INT,
              is_visible INT,
              previous_is_visible INT,
              property STRING,
              flat_property STRING,
              value STRING,
              previous_value STRING
            ) AS
            SELECT
              CURRENT.state_id,
              CURRENT.ts,
              CURRENT.title,
              CURRENT.token,
              CURRENT.parent_token,
              CURRENT.is_visible,
              PREVIOUS.is_visible as previous_is_visible,
              CURRENT.property,
              CURRENT.flat_property,
              CURRENT.value,
              PREVIOUS.value as previous_value
            FROM wm_state_changes CHANGE
            INNER JOIN wm_container_with_properties CURRENT
              ON CURRENT.state_id = CHANGE.state_id
            INNER JOIN wm_container_with_properties PREVIOUS
              ON PREVIOUS.state_id = CHANGE.previous_state_id
                AND PREVIOUS.token = CURRENT.token
                AND PREVIOUS.property = CURRENT.property
            ORDER BY CURRENT.ts;
          `;
    await this.traceProcessor.query(sqlCreateViewWmSearch);

    return [SearchViewFactoryWm.VIEW.name];
  }
}
