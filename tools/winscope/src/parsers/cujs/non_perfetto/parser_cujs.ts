/*
 * Copyright (C) 2023 The Android Open Source Project
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
import {isBlank, utf8Decode, utf8Encode} from '@common/string_helpers';
import {Timestamp} from '@common/time/time';
import {HierarchyTreeBuilderLog} from '@parsers/helpers/hierarchy_tree_builder_log';
import {PropertyTreeBuilderFromProto} from '@parsers/helpers/property_tree_builder_from_proto';
import {AbstractParser} from '@parsers/non_perfetto/abstract_parser';
import {SetFormatters} from '@parsers/operations/set_formatters';
import {CoarseVersion} from '@trace_api/coarse_version';
import {TraceType} from '@trace_api/trace_type';
import {CUJ_TYPE_FORMATTER} from '@trace/formatters';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {PropertiesProviderBuilder} from '@tree_node/properties_provider_builder';
import {PropertyTreeNode} from '@tree_node/property_tree_node';

import {AddCujProperties} from './add_cuj_properties';
import {Cuj} from './cuj';
import {EventTag} from './event_tag';

export class ParserCujs extends AbstractParser<Cuj, HierarchyTreeNode> {
  static readonly TRACE_TYPE = TraceType.CUJS;
  private static readonly MAGIC_NUMBER_STRING = 'EventLog';
  private static readonly MAGIC_NUMBER: number[] = Array.from(
    utf8Encode(ParserCujs.MAGIC_NUMBER_STRING),
  );
  private static readonly ADD_CUJ_PROPERTIES = new AddCujProperties();
  private static readonly SET_FORMATTERS = new SetFormatters(
    undefined,
    new Map([['cujType', CUJ_TYPE_FORMATTER]]),
  );

  override getTraceType(): TraceType {
    return TraceType.CUJS;
  }

  override getMagicNumber(): number[] {
    return ParserCujs.MAGIC_NUMBER;
  }

  override getRealToMonotonicTimeOffsetNs(): bigint | undefined {
    return undefined;
  }

  override getRealToBootTimeOffsetNs(): bigint | undefined {
    return undefined;
  }

  override getCoarseVersion(): CoarseVersion {
    return CoarseVersion.LEGACY;
  }

  protected override decodeTrace(buffer: Uint8Array): readonly Cuj[] {
    const decodedLogs = this.decodeByteArray(buffer);
    const events = this.parseLogs(decodedLogs);
    events.sort((a: Event, b: Event) => {
      return a.eventTimestamp < b.eventTimestamp ? -1 : 1;
    });
    return this.makeCujsFromEvents(events);
  }

  protected override getTimestamp(entry: Cuj): Timestamp {
    return entry.startTimestamp;
  }

  protected override async processDecodedEntry(
    index: number,
  ): Promise<HierarchyTreeNode> {
    const entry = this.decodedEntries[index];
    const provider = new PropertiesProviderBuilder()
      .setEagerProperties(this.makeCujPropertyTree(entry))
      .setEagerOperations([ParserCujs.SET_FORMATTERS])
      .build();
    return new HierarchyTreeBuilderLog()
      .setRoot(provider)
      .setChildren([])
      .build();
  }

  private decodeByteArray(bytes: Uint8Array): string[] {
    const allLogsString = utf8Decode(bytes);
    const splitLogs = allLogsString.split('\n');

    const firstIndexOfEventLogTrace = splitLogs.findIndex((substring) => {
      return (
        !substring.includes(ParserCujs.MAGIC_NUMBER_STRING) &&
        !substring.includes('beginning of events') &&
        !isBlank(substring)
      );
    });

    const lastIndexOfEventLogTrace = splitLogs.findIndex((substring, index) => {
      return index > firstIndexOfEventLogTrace && isBlank(substring);
    });

    if (lastIndexOfEventLogTrace === -1) {
      return splitLogs.slice(firstIndexOfEventLogTrace);
    }
    return splitLogs.slice(firstIndexOfEventLogTrace, lastIndexOfEventLogTrace);
  }

  private parseLogs(input: string[]): Event[] {
    const events: Event[] = [];
    input.forEach((log) => {
      const [metaData, eventData] = log
        .split(':', 2)
        .map((string) => string.trim());
      const [rawTimestamp, uid, pid, tid, , tag] = metaData
        .split(' ')
        .filter((substring) => substring.length > 0);
      if (
        tag !== EventTag.JANK_CUJ_BEGIN_TAG &&
        tag !== EventTag.JANK_CUJ_END_TAG &&
        tag !== EventTag.JANK_CUJ_CANCEL_TAG
      ) {
        return;
      }
      const timestampNs = BigInt(rawTimestamp.replace('.', ''));
      const event = {
        eventTimestamp: timestampNs,
        pid: Number(pid),
        uid: Number(uid),
        tid: Number(tid),
        tag,
        eventData,
      };
      events.push(event);
    });
    return events;
  }

  private makeCujsFromEvents(events: Event[]): Cuj[] {
    const eventNodes = events.map((event) => {
      return new PropertyTreeBuilderFromProto()
        .setData(event)
        .setRootId('EventLogTrace')
        .setRootName('event')
        .build();
    });
    eventNodes.forEach((event) => ParserCujs.ADD_CUJ_PROPERTIES.apply(event));

    const startEvents = this.filterEventsByTag(
      eventNodes,
      EventTag.JANK_CUJ_BEGIN_TAG,
    );
    const endEvents = this.filterEventsByTag(
      eventNodes,
      EventTag.JANK_CUJ_END_TAG,
    );
    const canceledEvents = this.filterEventsByTag(
      eventNodes,
      EventTag.JANK_CUJ_CANCEL_TAG,
    );

    const cujs: Cuj[] = [];
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
      cujs.push(cuj);
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

  private makeCujTimestampObject(timestamp: PropertyTreeNode): Timestamp {
    return this.timestampConverter.makeTimestampFromRealNs(
      assertDefined(timestamp.getChildByName('unixNanos')?.getValue<bigint>()),
    );
  }

  private makeCujPropertyTree(cuj: Cuj): PropertyTreeNode {
    return new PropertyTreeBuilderFromProto()
      .setData(cuj)
      .setRootId('CujTrace')
      .setRootName('cuj')
      .build();
  }
}

interface Event {
  eventTimestamp: bigint;
  pid: number;
  uid: number;
  tid: number;
  tag: EventTag;
  eventData: string;
}
