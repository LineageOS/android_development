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

import {SetFormatters} from '@parsers/operations/set_formatters';
import {TraceType} from '@trace_api/trace_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {PropertySource} from '@tree_node/property_tree_node';
import {HierarchyTreeBuilder} from '@tree_node/testing/hierarchy_tree_builder';
import {AbstractPresenterInputMethodTest} from '@ui/input_method/abstract_presenter_input_method_test';

import {PresenterInputMethodClients} from './presenter_input_method_clients';

class PresenterInputMethodClientsTest extends AbstractPresenterInputMethodTest {
  protected override readonly PresenterInputMethod =
    PresenterInputMethodClients;
  protected override readonly imeTraceType = TraceType.INPUT_METHOD_CLIENTS;
  protected override readonly numberOfNestedChildren = 2;

  override getSelectedNode(): HierarchyTreeNode {
    return new HierarchyTreeBuilder()
      .setRootNodeFormatter(new SetFormatters())
      .setId('InputMethodClientsTraceProto')
      .setName('entry')
      .setProperties({where: 'location', elapsedNanos: 0})
      .addChildProperty({
        name: 'test default property',
        value: 0,
        source: PropertySource.DEFAULT,
      })
      .build();
  }
}

describe('PresenterInputMethodClients', () => {
  new PresenterInputMethodClientsTest().execute();
});
