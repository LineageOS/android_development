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

import {assertDefined} from '@common/assert';
import {Store} from '@common/store/store';
import {Trace} from '@trace_api/trace';
import {ProtologColumnType} from '@trace/protolog/protolog_column_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {AbstractLogViewerPresenter, NotifyLogViewCallbackType,} from '@ui/shared/log/abstract_log_viewer_presenter';
import {LogSelectFilter, LogTextFilter} from '@ui/shared/log/log_filters';
import {LogPresenter} from '@ui/shared/log/log_presenter';
import {LogEntry, LogField, LogHeader} from '@ui/shared/log/ui_data_log';
import {TextFilter} from '@ui/shared/user_input/text_filter';

import {LocationField, ProtologEntry, UiData} from './ui_data';

export class Presenter extends AbstractLogViewerPresenter<
  UiData,
  HierarchyTreeNode
> {
  private static readonly COLUMNS = {
    logLevel: {
      name: 'Log Level',
      cssClass: 'log-level',
      canFilterBySingleOption: true,
      columnType: ProtologColumnType.LEVEL,
    },
    tag: {
      name: 'Tag',
      cssClass: 'tag',
      canFilterBySingleOption: true,
      columnType: ProtologColumnType.TAG,
    },
    sourceFile: {
      name: 'Source files',
      cssClass: 'source-file',
      canCopy: true,
      canFilterBySingleOption: true,
      columnType: ProtologColumnType.LOCATION,
    },
    text: {
      name: 'Search text',
      cssClass: 'text',
      columnType: ProtologColumnType.MESSAGE,
    },
  };
  private static readonly NO_LOCATION = '<NO_LOC>';
  private static readonly NO_LOCATION_TOOLTIP_MESSAGE =
    'Location information (file and line) is unavailable. This is because ProtoLog entries are only preprocessed to include source locations when logged from Java files with a configured protologtool genrule. Kotlin files are not currently supported for this preprocessing.';
  protected override logPresenter = new LogPresenter<LogEntry>();

  constructor(
    trace: Trace<HierarchyTreeNode>,
    notifyViewCallback: NotifyLogViewCallbackType<UiData>,
    private storage: Store,
  ) {
    super(trace, notifyViewCallback, UiData.createEmpty());
    const levelOrder = ['VERBOSE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'WTF'];
    this.filterOptionSorters[Presenter.COLUMNS.logLevel.name] = (
      a: string,
      b: string,
    ) => {
      const indexA = levelOrder.indexOf(a);
      const indexB = levelOrder.indexOf(b);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    };
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

      const level =
        messageNode.getEagerPropertyByName('level')?.formattedValue() ??
        Presenter.VALUE_NA;
      const tag =
        messageNode.getEagerPropertyByName('tag')?.formattedValue() ??
        Presenter.VALUE_NA;
      const location =
        messageNode.getEagerPropertyByName('location')?.formattedValue() ??
        Presenter.NO_LOCATION;
      const message =
        messageNode.getEagerPropertyByName('message')?.formattedValue() ??
        Presenter.VALUE_NA;

      const fields: LogField[] = [
        new LogField(Presenter.COLUMNS.logLevel, level),
        new LogField(Presenter.COLUMNS.tag, tag),
        new LocationField(
          Presenter.COLUMNS.sourceFile,
          location,
          location === Presenter.NO_LOCATION
            ? Presenter.NO_LOCATION_TOOLTIP_MESSAGE
            : undefined,
        ),
        new LogField(Presenter.COLUMNS.text, message),
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
