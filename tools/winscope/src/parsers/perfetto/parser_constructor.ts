/*
 * Copyright (C) 2026 The Android Open Source Project
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

import {ParserTimestampConverter} from '@common/time/timestamp_converter';
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {TraceFile} from '@trace_api/trace_file';
import {TraceProcessor} from '@trace_processor/trace_processor';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';

import {AbstractParser} from './abstract_parser';

/**
 * Function type for creating parsers.
 * Used by {@link PerfettoParserFactory} to instantiate parsers capable of
 * parsing a specific {@link TraceFile}.
 */
export type ParserConstructor = (
  traceFile: TraceFile,
  traceProcessor: TraceProcessor,
  timestampConverter: ParserTimestampConverter,
  traceGeometryData: TraceGeometryData,
) => Promise<Array<AbstractParser<HierarchyTreeNode>>>;
