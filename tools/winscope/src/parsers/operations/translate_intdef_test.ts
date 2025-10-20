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

import {assertDefined} from 'common/assert';
import root from 'protos/test/intdef_translation/json';
import {PropertyTreeBuilder} from 'test/unit/property_tree_builder';
import {TamperedMessageType} from 'trace/proto_utils/tampered_message_type';
import {PropertyTreeNode} from 'tree_node/property_tree_node';
import {TranslateIntDef} from './translate_intdef';

describe('TranslateIntDef', () => {
  let propertyRoot: PropertyTreeNode;
  let operation: TranslateIntDef;
  let rootType: TamperedMessageType;

  beforeAll(() => {
    rootType = TamperedMessageType.tamper(root.lookupType('RootMessage'));
  });

  it('translates intdef from stored mapping', () => {
    propertyRoot = new PropertyTreeBuilder()
      .setIsRoot(true)
      .setRootId('test')
      .setName('node')
      .setChildren([{name: 'layoutParamsFlags', value: 1}])
      .build();

    applyTranslation();
    checkValue('layoutParamsFlags', 'FLAG_ALLOW_LOCK_WHILE_SCREEN_ON');
  });

  it('translates intdef from field mapping', () => {
    propertyRoot = new PropertyTreeBuilder()
      .setIsRoot(true)
      .setRootId('test')
      .setName('node')
      .setChildren([
        {name: 'inputConfig', value: 1},
        {name: 'testAndroidTypedef', value: 1},
        {name: 'testAndroidCommonTypedef', value: 1},
      ])
      .build();

    applyTranslation();

    // Applies android.content.pm.ActivityInfo.ScreenOrientation translation
    // from proto .android.typedef specification
    checkValue('testAndroidTypedef', 'SCREEN_ORIENTATION_PORTRAIT');

    // Applies android.view.WindowManager.TransitionFlags translation from
    // proto .android_common.typedef specification
    checkValue(
      'testAndroidCommonTypedef',
      'TRANSIT_FLAG_KEYGUARD_GOING_AWAY_TO_SHADE',
    );

    // Applies android.view.WindowInsets.Side.InsetsSide translation from
    // proto .perfetto.protos.typedef specification over the hardcoded mapping
    // in TranslateIntdef#intDefColumn
    checkValue('inputConfig', 'LEFT');
  });

  it('translates BigInt', () => {
    propertyRoot = new PropertyTreeBuilder()
      .setIsRoot(true)
      .setRootId('test')
      .setName('node')
      .setChildren([{name: 'layoutParamsFlags', value: 1n}])
      .build();

    applyTranslation();
    checkValue('layoutParamsFlags', 'FLAG_ALLOW_LOCK_WHILE_SCREEN_ON');
  });

  it('formats leftover flags', () => {
    propertyRoot = new PropertyTreeBuilder()
      .setIsRoot(true)
      .setRootId('test')
      .setName('node')
      .setChildren([{name: 'inputConfig', value: 20}])
      .build();

    applyTranslation();
    checkValue('inputConfig', 'RIGHT | UNKNOWN (0x10)');
  });

  it('formats flags if no translation found', () => {
    propertyRoot = new PropertyTreeBuilder()
      .setIsRoot(true)
      .setRootId('test')
      .setName('node')
      .setChildren([
        {name: 'layoutParamsFlags', value: 0},
        {name: 'inputConfig', value: 16},
      ])
      .build();

    applyTranslation();
    checkValue('layoutParamsFlags', '0x0');
    checkValue('inputConfig', 'UNKNOWN (0x10)');
  });

  it('formats flags as ALL if all flags set and field name provided', () => {
    propertyRoot = new PropertyTreeBuilder()
      .setIsRoot(true)
      .setRootId('test')
      .setName('node')
      .setChildren([{name: 'inputConfig', value: 15}])
      .build();

    applyTranslation(['inputConfig']);
    checkValue('inputConfig', 'ALL');
  });

  it('does not format flags as ALL if field name not provided', () => {
    propertyRoot = new PropertyTreeBuilder()
      .setIsRoot(true)
      .setRootId('test')
      .setName('node')
      .setChildren([{name: 'inputConfig', value: 15}])
      .build();

    applyTranslation();
    checkValue('inputConfig', 'BOTTOM | RIGHT | TOP | LEFT');
  });

  function applyTranslation(translateAsAll: string[] = []) {
    const field = rootType.fields['inputWindowInfo'];
    operation = new TranslateIntDef(field, translateAsAll);
    operation.apply(propertyRoot);
  }

  function checkValue(property: string, value: string) {
    expect(
      assertDefined(propertyRoot.getChildByName(property)).formattedValue(),
    ).toEqual(value);
  }
});
