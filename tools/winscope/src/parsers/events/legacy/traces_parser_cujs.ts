/*
 * Copyright (C) 2023 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {assertDefined} from 'common/assert';
import {Timestamp} from 'common/time/time';
import {ParserTimestampConverter} from 'common/time/timestamp_converter';
import {EventTag} from 'parsers/events/legacy/event_tag';
import {AddCujProperties} from 'parsers/events/legacy/operations/add_cuj_properties';
import {HierarchyTreeBuilderLog} from 'parsers/hierarchy_tree_builder_log';
import {PropertyTreeBuilderFromProto} from 'parsers/property_tree_builder_from_proto';
import {AbstractTracesParser} from 'parsers/traces/abstract_traces_parser';
import {CUJ_TYPE_FORMATTER} from 'trace/formatters';
import {CoarseVersion} from 'trace_api/coarse_version';
import {Trace} from 'trace_api/trace';
import {TraceType} from 'trace_api/trace_type';
import {Traces} from 'trace_api/traces';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';
import {PropertiesProviderBuilder} from 'tree_node/properties_provider_builder';
import {PropertyTreeNode} from 'tree_node/property_tree_node';
import {SetFormatters} from 'viewers/operations/set_formatters';

export class TracesParserCujs extends AbstractTracesParser<HierarchyTreeNode> {
  private static readonly ADD_CUJ_PROPERTIES = new AddCujProperties();
  private static readonly SET_FORMATTERS = new SetFormatters(
    undefined,
    new Map([['cujType', CUJ_TYPE_FORMATTER]]),
  );
  private readonly eventLogTrace: Trace<PropertyTreeNode> | undefined;
  private readonly descriptors: string[];
  private decodedEntries: HierarchyTreeNode[] | undefined;

  constructor(traces: Traces, timestampConverter: ParserTimestampConverter) {
    super(timestampConverter);

    const eventlogTrace = traces.getTrace(TraceType.EVENT_LOG);
    if (eventlogTrace !== undefined) {
      this.eventLogTrace = eventlogTrace;
      this.descriptors = this.eventLogTrace.getDescriptors();
    } else {
      this.descriptors = [];
    }
  }

  override getCoarseVersion(): CoarseVersion {
    return CoarseVersion.LEGACY;
  }

  override async parse() {
    if (this.eventLogTrace === undefined) {
      throw new Error('EventLog trace not defined');
    }

    const eventsPromises = this.eventLogTrace.mapEntry((entry) =>
      entry.getValue(),
    );
    const events = await Promise.all(eventsPromises);
    const cujEvents = events.filter((event) => {
      const tag = assertDefined(event.getChildByName('tag')).getValue();
      return (
        tag === EventTag.JANK_CUJ_BEGIN_TAG ||
        tag === EventTag.JANK_CUJ_END_TAG ||
        tag === EventTag.JANK_CUJ_CANCEL_TAG
      );
    });
    this.decodedEntries = this.makeCujsFromEvents(cujEvents);
    await this.createTimestamps();
  }

  override async createTimestamps() {
    this.timestamps = [];
    for (let index = 0; index < this.getLengthEntries(); index++) {
      const entry = await this.getEntry(index);
      const timestamp = assertDefined(
        entry?.getEagerPropertyByName('startTimestamp')?.getValue<Timestamp>(),
      );
      this.timestamps.push(timestamp);
    }
  }

  getLengthEntries(): number {
    return assertDefined(this.decodedEntries).length;
  }

  getEntry(index: number): Promise<HierarchyTreeNode> {
    const entry = assertDefined(this.decodedEntries)[index];
    return Promise.resolve(entry);
  }

  override getDescriptors(): string[] {
    return this.descriptors;
  }

  getTraceType(): TraceType {
    return TraceType.CUJS;
  }

  override getRealToMonotonicTimeOffsetNs(): bigint | undefined {
    return undefined;
  }

  override getRealToBootTimeOffsetNs(): bigint | undefined {
    return undefined;
  }

  private makeCujTimestampObject(timestamp: PropertyTreeNode): Timestamp {
    return this.timestampConverter.makeTimestampFromRealNs(
      assertDefined(timestamp.getChildByName('unixNanos')?.getValue<bigint>()),
    );
  }

  private makeCujsFromEvents(events: PropertyTreeNode[]): HierarchyTreeNode[] {
    events.forEach((event) => TracesParserCujs.ADD_CUJ_PROPERTIES.apply(event));

    const startEvents = this.filterEventsByTag(
      events,
      EventTag.JANK_CUJ_BEGIN_TAG,
    );
    const endEvents = this.filterEventsByTag(events, EventTag.JANK_CUJ_END_TAG);
    const canceledEvents = this.filterEventsByTag(
      events,
      EventTag.JANK_CUJ_CANCEL_TAG,
    );

    const cujs: HierarchyTreeNode[] = [];
    for (const startEvent of startEvents) {
      const cujType = assertDefined(
        startEvent.getChildByName('cujType')?.getValue<number>(),
      );
      const startTimestamp = assertDefined(
        startEvent.getChildByName('cujTimestamp'),
      );

      const matchingEndEvent = this.findMatchingEvent(
        endEvents,
        cujType,
        startTimestamp,
      );
      const matchingCancelEvent = this.findMatchingEvent(
        canceledEvents,
        cujType,
        startTimestamp,
      );

      if (!matchingEndEvent && !matchingCancelEvent) {
        continue;
      }

      const closingEvent = this.getClosingEvent(
        matchingEndEvent,
        matchingCancelEvent,
      );

      const closingEventTimestamp = assertDefined(
        closingEvent.getChildByName('cujTimestamp'),
      );
      const canceled =
        assertDefined(
          closingEvent.getChildByName('tag')?.getValue<EventTag>(),
        ) === EventTag.JANK_CUJ_CANCEL_TAG;

      const cuj: Cuj = {
        cujType,
        startTimestamp: this.makeCujTimestampObject(startTimestamp),
        endTimestamp: this.makeCujTimestampObject(closingEventTimestamp),
        canceled,
      };

      const provider = new PropertiesProviderBuilder()
        .setEagerProperties(this.makeCujPropertyTree(cuj))
        .setEagerOperations([TracesParserCujs.SET_FORMATTERS])
        .build();
      const cujTree = new HierarchyTreeBuilderLog()
        .setRoot(provider)
        .setChildren([])
        .build();

      cujs.push(cujTree);
    }
    return cujs;
  }

  private filterEventsByTag(
    events: PropertyTreeNode[],
    targetTag: EventTag,
  ): PropertyTreeNode[] {
    return events.filter((event) => {
      const tag = assertDefined(
        event.getChildByName('tag')?.getValue<EventTag>(),
      );
      return tag === targetTag;
    });
  }

  private findMatchingEvent(
    events: PropertyTreeNode[],
    targetCujType: number,
    startTimestamp: PropertyTreeNode,
  ): PropertyTreeNode | undefined {
    return events.find((event) => {
      const cujType = assertDefined(
        event.getChildByName('cujType'),
      ).getValue<number>();
      const timestamp = assertDefined(event.getChildByName('cujTimestamp'));
      return (
        targetCujType === cujType &&
        this.cujTimestampIsGreaterThan(timestamp, startTimestamp)
      );
    });
  }

  private cujTimestampIsGreaterThan(
    a: PropertyTreeNode,
    b: PropertyTreeNode,
  ): boolean {
    const aUnixNanos: bigint = assertDefined(
      a.getChildByName('unixNanos')?.getValue<bigint>(),
    );
    const bUnixNanos: bigint = assertDefined(
      b.getChildByName('unixNanos')?.getValue<bigint>(),
    );
    return aUnixNanos > bUnixNanos;
  }

  private getClosingEvent(
    endEvent: PropertyTreeNode | undefined,
    cancelEvent: PropertyTreeNode | undefined,
  ): PropertyTreeNode {
    const endTimestamp = endEvent?.getChildByName('cujTimestamp');
    const cancelTimestamp = cancelEvent?.getChildByName('cujTimestamp');

    let closingEvent: PropertyTreeNode | undefined;
    if (!endTimestamp) {
      closingEvent = cancelEvent;
    } else if (!cancelTimestamp) {
      closingEvent = endEvent;
    } else {
      const canceledBeforeEnd = this.cujTimestampIsGreaterThan(
        endTimestamp,
        cancelTimestamp,
      );
      closingEvent = canceledBeforeEnd ? cancelEvent : endEvent;
    }

    if (!closingEvent) {
      throw new Error('Should have found one matching closing event for CUJ');
    }

    return closingEvent;
  }

  private makeCujPropertyTree(cuj: Cuj): PropertyTreeNode {
    return new PropertyTreeBuilderFromProto()
      .setData(cuj)
      .setRootId('CujTrace')
      .setRootName('cuj')
      .build();
  }
}

interface Cuj {
  cujType: number;
  startTimestamp: Timestamp;
  endTimestamp: Timestamp;
  canceled: boolean;
}
