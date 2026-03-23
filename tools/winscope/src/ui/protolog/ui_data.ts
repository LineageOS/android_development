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

import {Timestamp} from '@common/time/time';
import {TraceEntry} from '@trace_api/trace';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {ColumnSpec, LogEntry, LogField, LogFieldValue, LogHeader, UiDataLog,} from '@ui/shared/log/ui_data_log';

export class UiData implements UiDataLog {
  constructor(
    public headers: LogHeader[],
    public entries: ProtologEntry[],
    public currentIndex: undefined | number,
    public selectedIndex: undefined | number,
    public scrollToIndex: undefined | number,
  ) {}

  isFetchingData = false;
  checkScrollViewportCount = 0;

  static createEmpty(): UiData {
    return new UiData([], [], undefined, undefined, undefined);
  }
}

export class ProtologEntry implements LogEntry {
  readonly getPropertiesTree = undefined;

  constructor(
    public traceEntry: TraceEntry<HierarchyTreeNode>,
    public fields: LogField[],
  ) {}

  formatForClipboard(timeOnly: boolean): string {
    const timestamp = this.traceEntry.getTimestamp();

    const fieldValues = this.fields.map((field) => {
      const value = field.value;
      let stringValue: string;

      if (value === null || value === undefined) {
        stringValue = ' ';
      } else if (Array.isArray(value)) {
        stringValue = value
          .map((item) => {
            if (typeof item === 'string') {
              return item;
            }
            return item.propertyValue;
          })
          .join(', ');
      } else if (value instanceof Timestamp) {
        stringValue = value.format(timeOnly);
      } else {
        stringValue = value.toString();
      }

      return stringValue.replace(/\n/g, '\t');
    });

    const allColumns = [timestamp, ...fieldValues];

    return allColumns.join('\t');
  }
}

export class LocationField extends LogField {
  constructor(spec: ColumnSpec, value: LogFieldValue, tooltip?: string) {
    super(spec, value, undefined, undefined, undefined, tooltip);
  }

  override getFilterValueMatch(): string {
    const value = this.format();
    const end = value.indexOf(':');
    return value.substring(0, end === -1 ? undefined : end);
  }
}
