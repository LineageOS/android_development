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

import {Timestamp} from '@common/time/time';

import {AbsoluteEntryIndex, FramesRange, RelativeEntryIndex,} from './index_types';

/**
 * Enum representing the different types of custom queries available.
 */
export enum CustomQueryType {
  /**
   * Custom query for SF layer id and name
   */
  SF_LAYERS_ID_AND_NAME,
  /**
   * Custom query for view capture metadata
   */
  VIEW_CAPTURE_METADATA,
  /**
   * Custom query for vsyncid
   */
  VSYNCID,
  /**
   * Custom query for WM windows token and title
   */
  WM_WINDOWS_TOKEN_AND_TITLE,
  /**
   * Custom query for log table filter values
   */
  LOG_TABLE_FILTER_VALUES,
}

/**
 * Represents a single entry within a custom query result.
 * @template U The type of the value contained in the entry.
 */
interface CustomQueryTraceEntry<U> {
  getValue(): U;
  getFramesRange(): FramesRange | undefined;
  getIndex(): AbsoluteEntryIndex;
  getTimestamp(): Timestamp;
}

/**
 * A utility for processing the raw results from custom query parsers
 * into their final result types.
 */
export const PROCESS_CUSTOM_QUERY_PARSER_RESULT = {
  /**
   * Processes the parser result for SF_LAYERS_ID_AND_NAME.
   * @param parserResult The raw result from the parser.
   * @return The processed result.
   */
  [CustomQueryType.SF_LAYERS_ID_AND_NAME](
    parserResult: CustomQueryParserResultTypeMap[CustomQueryType.SF_LAYERS_ID_AND_NAME],
  ): CustomQueryResultTypeMap[CustomQueryType.SF_LAYERS_ID_AND_NAME] {
    return parserResult;
  },

  /**
   * Processes the parser result for VIEW_CAPTURE_METADATA.
   * @param parserResult The raw result from the parser.
   * @return The processed result.
   */
  [CustomQueryType.VIEW_CAPTURE_METADATA](
    parserResult: CustomQueryParserResultTypeMap[CustomQueryType.VIEW_CAPTURE_METADATA],
  ): CustomQueryResultTypeMap[CustomQueryType.VIEW_CAPTURE_METADATA] {
    return parserResult;
  },

  /**
   * Processes the parser result for VSYNCID, wrapping each vsyncId in a
   * `CustomQueryTraceEntry`.
   * @param parserResult The raw vsyncId array from the parser.
   * @param makeTraceEntry A function to create a `CustomQueryTraceEntry` from a vsyncId and index.
   * @return An array of `CustomQueryTraceEntry<bigint>`.
   */
  [CustomQueryType.VSYNCID](
    parserResult: CustomQueryParserResultTypeMap[CustomQueryType.VSYNCID],
    makeTraceEntry: (
      index: RelativeEntryIndex,
      vsyncId: bigint,
    ) => CustomQueryTraceEntry<bigint>,
  ): CustomQueryResultTypeMap[CustomQueryType.VSYNCID] {
    return parserResult.map((vsyncId, index) => {
      return makeTraceEntry(index, vsyncId);
    });
  },

  /**
   * Processes the parser result for WM_WINDOWS_TOKEN_AND_TITLE.
   * @param parserResult The raw result from the parser.
   * @return The processed result.
   */
  [CustomQueryType.WM_WINDOWS_TOKEN_AND_TITLE](
    parserResult: CustomQueryParserResultTypeMap[CustomQueryType.WM_WINDOWS_TOKEN_AND_TITLE],
  ): CustomQueryResultTypeMap[CustomQueryType.WM_WINDOWS_TOKEN_AND_TITLE] {
    return parserResult;
  },

  /**
   * Processes the parser result for LOG_TABLE_FILTER_VALUES.
   * @param parserResult The raw result from the parser.
   * @return The processed result.
   */
  [CustomQueryType.LOG_TABLE_FILTER_VALUES](
    parserResult: CustomQueryParserResultTypeMap[CustomQueryType.LOG_TABLE_FILTER_VALUES],
  ): CustomQueryResultTypeMap[CustomQueryType.LOG_TABLE_FILTER_VALUES] {
    return parserResult;
  },
};

/**
 * Maps each `CustomQueryType` to the type of parameters it requires.
 * `never` indicates no parameters are needed.
 */
export declare interface CustomQueryParamTypeMap {
  /**
   * No parameters required for this query
   */
  [CustomQueryType.SF_LAYERS_ID_AND_NAME]: never;
  /**
   * No parameters required for this query
   */
  [CustomQueryType.VIEW_CAPTURE_METADATA]: never;
  /**
   * No parameters required for this query
   */
  [CustomQueryType.VSYNCID]: never;
  /**
   * No parameters required for this query
   */
  [CustomQueryType.WM_WINDOWS_TOKEN_AND_TITLE]: never;
  /**
   * Parameter for this query is a number
   */
  [CustomQueryType.LOG_TABLE_FILTER_VALUES]: number;
}

/**
 * Maps each `CustomQueryType` to the raw result type returned by the parser.
 */
export declare interface CustomQueryParserResultTypeMap {
  /**
   * Result type for this query is an array of objects with id and name
   */
  [CustomQueryType.SF_LAYERS_ID_AND_NAME]: Array<{id: number; name: string}>;
  /**
   * Result type for this query is an object with package name and window name
   */
  [CustomQueryType.VIEW_CAPTURE_METADATA]: {
    packageName: string;
    windowName: string;
  };
  /**
   * Result type for this query is an array of bigints
   */
  [CustomQueryType.VSYNCID]: bigint[];
  /**
   * Result type for this query is an array of objects with token and title
   */
  [CustomQueryType.WM_WINDOWS_TOKEN_AND_TITLE]: Array<{
    token: number;
    title: string;
  }>;
  /**
   * Result type for this query is an array of strings
   */
  [CustomQueryType.LOG_TABLE_FILTER_VALUES]: string[];
}

/**
 * Maps each `CustomQueryType` to the final processed result type,
 * potentially after being handled by `PROCESS_CUSTOM_QUERY_PARSER_RESULT`.
 * @template T A generic type parameter, often used for context.
 */
export declare interface CustomQueryResultTypeMap {
  /**
   * Result type for this query is an array of objects with id and name
   */
  [CustomQueryType.SF_LAYERS_ID_AND_NAME]: Array<{id: number; name: string}>;
  /**
   * Result type for this query is an object with package name and window name
   */
  [CustomQueryType.VIEW_CAPTURE_METADATA]: {
    packageName: string;
    windowName: string;
  };
  /**
   * Result type for this query is an array of custom query trace entries
   */
  [CustomQueryType.VSYNCID]: Array<CustomQueryTraceEntry<bigint>>;
  /**
   * Result type for this query is an array of objects with token and title
   */
  [CustomQueryType.WM_WINDOWS_TOKEN_AND_TITLE]: Array<{
    token: number;
    title: string;
  }>;
  /**
   * Result type for this query is an array of strings
   */
  [CustomQueryType.LOG_TABLE_FILTER_VALUES]: string[];
}

/**
 * A class that allows building a custom query result using a visit pattern.
 * It holds a specific `CustomQueryType` and can store the result of a parser.
 * @template Q The specific `CustomQueryType` this instance represents.
 */
export class VisitableParserCustomQuery<Q extends CustomQueryType> {
  private readonly type: CustomQueryType;
  private result: Promise<CustomQueryParserResultTypeMap[Q]> | undefined;

  /**
   * Creates an instance of VisitableParserCustomQuery.
   * @param type The type of custom query this instance represents.
   */
  constructor(type: Q) {
    this.type = type;
  }

  /**
   * Visits a specific custom query type. If the provided `type` matches
   * the instance's type, the `visitor` function is executed, and its result
   * is stored. Otherwise, the instance is returned unchanged.
   * @template R The type of custom query being visited.
   * @param type The `CustomQueryType` to visit.
   * @param visitor A function that returns a Promise resolving to the parser result for type `R`.
   * @return This `VisitableParserCustomQuery` instance.
   */
  visit<R extends CustomQueryType>(
    type: R,
    visitor: () => Promise<CustomQueryParserResultTypeMap[R]>,
  ): VisitableParserCustomQuery<Q> {
    if (type !== this.type) {
      return this;
    }
    this.result = visitor() as Promise<CustomQueryParserResultTypeMap[Q]>;
    return this;
  }

  /**
   * Gets the result of the custom query. Throws an error if `visit` was
   * not called for the correct query type.
   * @return A Promise that resolves to the parser result.
   * @throws Error if no result is available (i.e., the query type was not visited).
   */
  getResult(): Promise<CustomQueryParserResultTypeMap[Q]> {
    if (this.result === undefined) {
      throw new Error(
        `No result available. Looks like custom query (type: ${this.type}) is not implemented!`,
      );
    }
    return this.result;
  }
}
