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

import {perfetto} from 'protos/perfetto/trace/static';
import {TAMPERED_PROTOS_LATEST} from './perfetto/tampered_protos_latest';
import {PropertiesProviderFactory} from './properties_provider_factory';

describe('WmPropertiesProviderFactory', () => {
  let factory: PropertiesProviderFactory;

  beforeEach(() => {
    factory = new PropertiesProviderFactory(TAMPERED_PROTOS_LATEST);
  });

  describe('Task', () => {
    it('applies name override - task id', () => {
      const entry = perfetto.protos.WindowManagerServiceDumpProto.create({
        rootWindowContainer: {
          windowContainer: {
            children: [
              {
                task: {
                  id: 12345,
                  windowContainer: {
                    identifier: {hashCode: 0x1a1a, title: 'Task'},
                  },
                },
              },
            ],
          },
        },
      });
      checkNameOverride(entry, '1a1a 12345');
    });

    it('applies name override - task id and task name', () => {
      const entry = perfetto.protos.WindowManagerServiceDumpProto.create({
        rootWindowContainer: {
          windowContainer: {
            children: [
              {
                task: {
                  id: 12345,
                  taskName: 'Test',
                  windowContainer: {
                    identifier: {hashCode: 0x1a1a, title: 'Task'},
                  },
                },
              },
            ],
          },
        },
      });
      checkNameOverride(entry, '1a1a 12345(Test)');
    });

    function checkNameOverride(
      entry: perfetto.protos.WindowManagerServiceDumpProto,
      expectedName: string,
    ) {
      const provider = factory.makeContainerProperties(entry);
      expect(provider.length).toBe(2);
      expect(provider[1].getEagerProperties().name).toBe(expectedName);
    }
  });
});
