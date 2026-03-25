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

import {AbstractHierarchyViewerComponentTest} from '@app/shared/testing/abstract_hierarchy_viewer_component_test';
import {DOMTestHelper} from '@common/testing/dom_test_helpers';
import {UiData} from '@ui/window_manager/ui_data';

import {ViewerWindowManagerComponent} from './viewer_window_manager_component';

class ViewerWindowManagerComponentTest extends AbstractHierarchyViewerComponentTest<
  UiData,
  ViewerWindowManagerComponent
> {
  protected override readonly testRects = true;
  protected override readonly canPropagateProperties = true;
  protected override readonly supportsPlayback = true;
  protected override readonly hierarchyTitle = 'HIERARCHY';
  protected override readonly propertiesTitle = 'PROPERTIES';
  protected override readonly rectsTitle = 'WINDOWS';
  protected override readonly propertiesSelector = '.properties';

  protected override async setUpTestEnvironment(): Promise<
    [DOMTestHelper<ViewerWindowManagerComponent>, ViewerWindowManagerComponent]
  > {
    return this.initializeTestEnvironment(ViewerWindowManagerComponent);
  }

  protected override getUiDataForPlaybackTests(): UiData {
    return new UiData();
  }
}

describe('ViewerWindowManagerComponent', () => {
  new ViewerWindowManagerComponentTest().execute();
});
