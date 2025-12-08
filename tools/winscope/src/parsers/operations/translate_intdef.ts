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

import intDefMapping from 'common/intDefMapping.json';
import {
  FixedStringFormatter,
  FLAG_SEPARATOR,
  formatAsHex,
} from 'trace/formatters';
import {TamperedProtoField} from 'trace/proto_utils/tampered_message_type';
import {Operation} from 'tree_node/operation';
import {PropertyTreeNode} from 'tree_node/property_tree_node';

export class TranslateIntDef implements Operation<PropertyTreeNode> {
  constructor(
    private readonly rootField: TamperedProtoField,
    private translateAsAll: string[] = [],
  ) {}

  apply(value: PropertyTreeNode, parentField = this.rootField): void {
    const protoType = parentField.tamperedMessageType;

    if (protoType === undefined) {
      return;
    }

    let field = parentField;
    if (field.name !== value.name) {
      field = protoType.fields[value.name] ?? parentField;
    }

    if (value.getAllChildren().length > 0) {
      value.getAllChildren().forEach((value) => {
        this.apply(value, field);
      });
    } else {
      const propertyValue = Number(value.getValue());
      if (!Number.isNaN(propertyValue) && propertyValue !== -1) {
        const translation = this.translateIntDefToStringIfNeeded(
          propertyValue,
          field,
        );
        if (typeof translation === 'string') {
          value.setFormatter(new FixedStringFormatter(translation));
        }
      }
    }
  }

  private translateIntDefToStringIfNeeded(
    value: number,
    field: TamperedProtoField,
  ): string | number {
    const typeDefSpec = this.getTypeDefSpecFromField(field);

    const translateAsAll = this.translateAsAll.includes(field.name);

    if (typeDefSpec) {
      return this.getIntFlagsAsStrings(value, typeDefSpec, translateAsAll);
    } else {
      const propertyPath = `${field.parent?.name}.${field.name}`;
      if (this.intDefColumn[propertyPath]) {
        return this.getIntFlagsAsStrings(
          value,
          this.intDefColumn[propertyPath],
          translateAsAll,
        );
      }
    }

    return value;
  }

  private getTypeDefSpecFromField(
    field: TamperedProtoField,
  ): string | undefined {
    return (
      field.options?.['(.perfetto.protos.typedef)'] ??
      field.options?.['(.android.typedef)'] ??
      field.options?.['(.android_common.typedef)'] ??
      undefined
    );
  }

  private getIntFlagsAsStrings(
    intFlags: number,
    annotationType: string,
    translateAsAll: boolean,
  ): string {
    const flags: string[] = [];
    const mapping =
      intDefMapping[annotationType as keyof typeof intDefMapping]?.values ?? {};

    const knownFlagValues = Object.keys(mapping)
      .reverse()
      .map((x) => Math.floor(Number(x)));

    if (knownFlagValues.length === 0) {
      console.warn('No mapping for type', annotationType);
      return intFlags + '';
    }

    // Will only contain bits that have not been associated with a flag.
    const parsedIntFlags = Math.floor(Number(intFlags));
    let leftOver = parsedIntFlags;

    for (const flagValue of knownFlagValues) {
      if (
        (leftOver & flagValue && (intFlags & flagValue) === flagValue) ||
        (parsedIntFlags === 0 && flagValue === 0)
      ) {
        flags.push(mapping[flagValue as keyof typeof mapping]);
        leftOver = leftOver & ~flagValue;
      }
    }

    if (flags.length === 0) {
      return leftOver ? this.formatUnknownFlag(leftOver) : formatAsHex(0, true);
    }

    if (leftOver) {
      // If 0 is a valid flag value that isn't in the intDefMapping it will be ignored
      flags.push(this.formatUnknownFlag(leftOver));
    }

    if (
      !leftOver &&
      flags.length === knownFlagValues.length &&
      translateAsAll
    ) {
      return 'ALL';
    }

    return flags.join(FLAG_SEPARATOR);
  }

  private formatUnknownFlag(value: number): string {
    return `UNKNOWN (${formatAsHex(value, true)})`;
  }

  private readonly intDefColumn: {[key: string]: string} = {
    'ConfigurationProto.orientation':
      'android.content.pm.ActivityInfo.ScreenOrientation',
    'InputWindowInfoProto.inputConfig':
      'android.view.InputWindowHandle.InputConfigFlags',
    'InputWindowInfoProto.layoutParamsFlags':
      'android.view.WindowManager.LayoutParams.Flags',
    'InsetsSourceConsumerProto.typeNumber':
      'android.view.WindowInsets.Type.InsetsType',
    'InsetsSourceControlProto.typeNumber':
      'android.view.WindowInsets.Type.InsetsType',
    'RemoteInsetsControlTargetProto.requestedVisibleTypes':
      'android.view.WindowInsets.Type.InsetsType',
    'ShellTransition.flags': 'android.view.WindowManager.TransitionFlags',
    'Target.flags': 'android.window.TransitionInfo.ChangeFlags',
    'WindowContainerProto.orientation':
      'android.content.pm.ActivityInfo.ScreenOrientation',
    'WindowStateProto.requestedVisibleTypes':
      'android.view.WindowInsets.Type.InsetsType',
  };
}
