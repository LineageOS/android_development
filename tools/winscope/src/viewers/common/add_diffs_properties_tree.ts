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

import {FLAG_SEPARATOR} from 'trace/formatters';
import {
  DiffValuePart,
  UiPropertyTreeNode,
} from 'viewers/common/ui_property_tree_node';
import {AddDiffs} from './add_diffs';
import {DiffType} from './diff_type';

export class AddDiffsPropertiesTree extends AddDiffs<UiPropertyTreeNode> {
  protected override addDiffsToNewRoot = false;

  protected override processOldNode(oldNode: UiPropertyTreeNode): void {
    //do nothing
  }

  protected override processModifiedNodes(
    newNode: UiPropertyTreeNode,
    oldNode: UiPropertyTreeNode,
  ): void {
    newNode.setDiff(DiffType.MODIFIED);
    const oldValue = oldNode.formattedValue();
    const newValue = newNode.formattedValue();
    if (
      oldValue.includes(FLAG_SEPARATOR) ||
      newValue.includes(FLAG_SEPARATOR)
    ) {
      const parts = this.processModifiedFlags(oldValue, newValue);
      newNode.setDiffValueParts(parts);
      return;
    }
    newNode.setOldValue(oldValue !== '' ? oldValue : 'null');
  }

  private processModifiedFlags(
    oldValue: string,
    newValue: string,
  ): DiffValuePart[] {
    const oldFlags = this.getFlags(oldValue);
    const newFlags = this.getFlags(newValue);

    const parts: DiffValuePart[] = [];

    let j = 0;
    for (const newFlag of newFlags) {
      const oldFlag = oldFlags[j];
      if (oldFlag === newFlag) {
        parts.push({isOld: false, isNew: false, value: newFlag});
        j++;
      } else {
        const indexOfNewFlagInOldFlags = oldFlags.indexOf(newFlag, j);

        if (indexOfNewFlagInOldFlags === -1) {
          parts.push({isOld: false, isNew: true, value: newFlag});
        } else {
          for (let i = j; i < indexOfNewFlagInOldFlags; i++) {
            parts.push({isOld: true, isNew: false, value: oldFlags[i]});
          }
          parts.push({isOld: false, isNew: false, value: newFlag});
          j = indexOfNewFlagInOldFlags + 1;
        }
      }
    }
    for (let i = j; i < oldFlags.length; i++) {
      parts.push({isOld: true, isNew: false, value: oldFlags[i]});
    }

    return parts;
  }

  private getFlags(value: string): string[] {
    const rawValueStart = value.lastIndexOf(' (');
    if (rawValueStart !== -1) {
      // flags in format "f1 | f2 (<raw_value>)"
      value = value.slice(0, rawValueStart);
    }
    return value.split(FLAG_SEPARATOR);
  }
}
