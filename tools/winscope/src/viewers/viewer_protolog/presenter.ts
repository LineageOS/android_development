/*
 * Copyright (C) 2022 The Android Open Source Project
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
import {Store} from 'common/store/store';
import {ProtologColumnType} from 'trace/protolog/protolog_column_type';
import {Trace} from 'trace_api/trace';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';
import {
  AbstractLogViewerPresenter,
  NotifyLogViewCallbackType,
} from 'viewers/common/abstract_log_viewer_presenter';
import {LogSelectFilter, LogTextFilter} from 'viewers/common/log_filters';
import {LogPresenter} from 'viewers/common/log_presenter';
import {TextFilter} from 'viewers/common/text_filter';
import {LogEntry, LogField, LogHeader} from 'viewers/common/ui_data_log';
import {ProtologEntry, UiData} from './ui_data';

export class Presenter extends AbstractLogViewerPresenter<
  UiData,
  HierarchyTreeNode
> {
  private static readonly COLUMNS = {
    logLevel: {
      name: 'Log Level',
      cssClass: 'log-level',
      columnType: ProtologColumnType.LEVEL,
    },
    tag: {
      name: 'Tag',
      cssClass: 'tag',
      columnType: ProtologColumnType.TAG,
    },
    sourceFile: {
      name: 'Source files',
      cssClass: 'source-file',
      canCopy: true,
      columnType: ProtologColumnType.LOCATION,
    },
    text: {
      name: 'Search text',
      cssClass: 'text',
      columnType: ProtologColumnType.MESSAGE,
    },
  };
  private static readonly NO_LOCATION = '<NO_LOC>';
  protected override logPresenter = new LogPresenter<LogEntry>();

  constructor(
    trace: Trace<HierarchyTreeNode>,
    notifyViewCallback: NotifyLogViewCallbackType<UiData>,
    private storage: Store,
  ) {
    super(trace, notifyViewCallback, UiData.createEmpty());
  }

  protected override makeHeaders(): LogHeader[] {
    return [
      new LogHeader(Presenter.COLUMNS.logLevel, new LogSelectFilter([])),
      new LogHeader(
        Presenter.COLUMNS.tag,
        new LogSelectFilter([], false, '150'),
      ),
      new LogHeader(
        Presenter.COLUMNS.sourceFile,
        new LogSelectFilter([], true, '300'),
      ),
      new LogHeader(
        Presenter.COLUMNS.text,
        new LogTextFilter(new TextFilter()),
      ),
    ];
  }

  protected override async makeUiDataEntries(): Promise<ProtologEntry[]> {
    const messages: ProtologEntry[] = [];
    const messageNodes = await this.trace.getAllEntryValues();

    for (
      let traceIndex = 0;
      traceIndex < this.trace.lengthEntries;
      ++traceIndex
    ) {
      const entry = this.trace.getEntry(traceIndex);
      const messageNode = assertDefined(messageNodes[traceIndex]);
      const fields: LogField[] = [
        {
          spec: Presenter.COLUMNS.logLevel,
          value:
            messageNode.getEagerPropertyByName('level')?.formattedValue() ??
            Presenter.VALUE_NA,
        },
        {
          spec: Presenter.COLUMNS.tag,
          value:
            messageNode.getEagerPropertyByName('tag')?.formattedValue() ??
            Presenter.VALUE_NA,
        },
        {
          spec: Presenter.COLUMNS.sourceFile,
          value:
            messageNode.getEagerPropertyByName('location')?.formattedValue() ??
            Presenter.NO_LOCATION,
        },
        {
          spec: Presenter.COLUMNS.text,
          value:
            messageNode.getEagerPropertyByName('message')?.formattedValue() ??
            Presenter.VALUE_NA,
        },
      ];
      messages.push(new ProtologEntry(entry, fields));
    }

    return messages;
  }

  protected override async updateFiltersInHeaders(headers: LogHeader[]) {
    Promise.all(
      headers
        .filter((header) => header.filter instanceof LogSelectFilter)
        .map((header) => this.updateFilterByCustomQuery(header)),
    );
  }
}
