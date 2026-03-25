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

import {TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {DOMTestHelper} from '@common/testing/dom_test_helpers';
import {CollapsibleSectionType} from '@ui/shared/collapsible_sections/collapsible_section_type';
import {CollapsibleSections} from '@ui/shared/collapsible_sections/collapsible_sections';

import {CollapsedSectionsComponent} from './collapsed_sections_component';

describe('CollapsedSectionsComponent', () => {
  let component: CollapsedSectionsComponent;
  let dom: DOMTestHelper<CollapsedSectionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CollapsedSectionsComponent, MatButtonModule, MatIconModule],
    }).compileComponents();
    const fixture = TestBed.createComponent(CollapsedSectionsComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);
    const sections = new CollapsibleSections([
      {
        type: CollapsibleSectionType.RECTS,
        label: 'rects',
        isCollapsed: false,
      },
      {
        type: CollapsibleSectionType.HIERARCHY,
        label: 'hierarchy',
        isCollapsed: true,
      },
      {
        type: CollapsibleSectionType.PROPERTIES,
        label: 'properties',
        isCollapsed: false,
      },
    ]);
    dom.setComponentInput('sections', sections);
    dom.detectChanges();
  });

  it('can be created', () => {
    expect(component).toBeTruthy();
  });

  it('displays only collapsed sections', () => {
    let sections = dom.findAll('.collapsed-section');
    expect(sections.length).toBe(1);
    sections[0].checkText('HIERARCHY');
    expect(sections[0].find('.mat-icon')).toBeDefined();

    component
      .sections()
      .onCollapseStateChange(CollapsibleSectionType.RECTS, true);
    dom.detectChanges();
    sections = dom.findAll('.collapsed-section');
    expect(sections.length).toBe(2);
    sections[0].checkText('RECTS');
    expect(sections[0].find('.mat-icon')).toBeDefined();
    sections[1].checkText('HIERARCHY');
    expect(sections[1].find('.mat-icon')).toBeDefined();
  });

  it('emits sectionChange event', () => {
    const spy = spyOn(component.sectionChange, 'emit');
    dom.findAndClick('.collapsed-section');
    expect(spy).toHaveBeenCalledOnceWith(CollapsibleSectionType.HIERARCHY);
  });
});
