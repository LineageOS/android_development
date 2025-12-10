/*
 * Copyright 2024 Google LLC
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

import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Inject, Injectable, InjectionToken } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { GerritLinkPair, MotionGolden, MotionGoldenData, PresubmitTest, DataSource } from '../model/golden';
import { TestResult } from '../model/enums';
import { RecordedMotion } from '../model/recorded-motion';
import { Timeline } from '../model/timeline';
import { VideoSource } from '../model/video-source';
import { checkNotNull } from '../util/preconditions';
import { recordedFeatureFactory } from '../model/feature';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ErrorService } from './error.service';
import { Error as AppError } from '../model/error';
import { ApiResponse, BatchUpdateResult, UpdateResult } from '../model/api-response';

export const ACCESS_TOKEN = new InjectionToken<string>('token');
export const SERVICE_PORT = new InjectionToken<string>('port');

@Injectable({ providedIn: 'root' })
export class GoldensService {
  private serverRoot: string;
  private defaultHeaders: { [header: string]: string };

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private errorService: ErrorService,
    @Inject(ACCESS_TOKEN) config: string,
    @Inject(SERVICE_PORT) port: string
  ) {
    this.serverRoot = `http://localhost:${port}`;
    this.defaultHeaders = {
      'Golden-Access-Token': config,
    };
  }

  loadRecordedMotion(golden: MotionGolden): Observable<RecordedMotion> {
    const videoUrl = checkNotNull(golden.videoUrl);
    return this.getActualGoldenData(golden).pipe(
      map((data) => {
        const timeline = new Timeline(data.frame_ids);
        const videoSource = new VideoSource(videoUrl, timeline);
        const features = data.features.map((it) => recordedFeatureFactory(it));

        return new RecordedMotion(videoSource, timeline, features);
      })
    );
  }

  getPresubmitTestArtifacts(invocation_id: string): Observable<PresubmitTest[]> {
    return this.http
      .post<ApiResponse<PresubmitTest[]>>(
        `${this.serverRoot}/service/presubmit/tests`,
        { invocation_id },
        { headers: this.getHeaders() }
      )
      .pipe(
        map(response => this.unwrapResponse(response, [])),
        catchError(this.handleError<PresubmitTest[]>('getPresubmitTestArtifacts', []))
      );
  }

  getPresubmitTestArtifactsForTestName(resource_id: string): Observable<MotionGolden | null> {
    return this.http
      .post<ApiResponse<MotionGolden>>(
        `${this.serverRoot}/service/presubmit/artifact`,
        { resource_id },
        { headers: this.getHeaders() }
      )
      .pipe(
        map(response => this.unwrapResponse(response, null)),
        catchError(this.handleError<MotionGolden | null>('getPresubmitTestArtifactsForTestName', null))
      );
  }

  getActualGoldenData(golden: MotionGolden): Observable<MotionGoldenData> {
    return this.http
      .get<MotionGoldenData>(`${golden.actualUrl}`, {
        headers: this.defaultHeaders,
      })
      .pipe(
        catchError(this.handleError<MotionGoldenData>('getActualGoldenData'))
      );
  }

  getExpectedGoldenData(golden: MotionGolden): Observable<MotionGoldenData> {
    return this.http
      .get<MotionGoldenData>(`${golden.expectedUrl}`, {
        headers: this.defaultHeaders,
      })
      .pipe(
        catchError(this.handleError<MotionGoldenData>('getExpectedGoldenData'))
      );
  }

  refreshGoldens(clear: boolean): Observable<MotionGolden[]> {
    return this.http
      .post<ApiResponse<MotionGolden[]>>(
        `${this.serverRoot}/service/goldens/refresh`,
        { clear },
        { headers: this.getHeaders() }
      )
      .pipe(
        map(response => this.unwrapResponse(response, [])),
        catchError(this.handleError<MotionGolden[]>('refreshGoldens', []))
      );
  }

  switchMode(mode: string): Observable<MotionGolden[] | PresubmitTest[]> {
    return this.http
      .post<ApiResponse<MotionGolden[] | PresubmitTest[]>>(
        `${this.serverRoot}/service/config/mode`,
        { mode },
        { headers: this.getHeaders() }
      )
      .pipe(
        map(response => this.unwrapResponse(response, [])),
        catchError(this.handleError<MotionGolden[] | PresubmitTest[]>('switchMode', []))
      );
  }

  updateGolden(golden: MotionGolden): Observable<UpdateResult | null> {
    return this.http
      .put<ApiResponse<UpdateResult>>(
        `${this.serverRoot}/service/goldens/update?id=${golden.id}`,
        {},
        { headers: this.defaultHeaders }
      )
      .pipe(
        map(response => this.unwrapResponse(response, null)),
        catchError(this.handleError<UpdateResult | null>('updateGolden', null))
      );
  }

  updateSelectedGoldens(selectedGoldenIds: string[]): Observable<BatchUpdateResult | null> {
    return this.http
      .put<ApiResponse<BatchUpdateResult>>(
        `${this.serverRoot}/service/goldens/batch-update`,
        { selectedGoldenIds },
        { headers: this.defaultHeaders }
      )
      .pipe(
        map(response => this.unwrapResponse(response, null)),
        catchError(this.handleError<BatchUpdateResult | null>('updateSelectedGoldens', null))
      );
  }

  getTestModes(): Observable<string[]> {
    return this.http
      .get<ApiResponse<string[]>>(
        `${this.serverRoot}/service/config/modes`,
        { headers: this.getHeaders() }
      )
      .pipe(
        map(response => this.unwrapResponse(response, [])),
        catchError(this.handleError<string[]>('getTestModes', []))
      );
  }

  fetchGerritGoldens(linkPairs: GerritLinkPair[]): Observable<MotionGolden[]> {
    return this.http.post<ApiResponse<MotionGolden[]>>(
      `${this.serverRoot}/service/gerrit/goldens`,
      { linkPairs },
      { headers: this.getHeaders() }
    ).pipe(
      map(response => this.unwrapResponse(response, [])),
      catchError(this.handleError<MotionGolden[]>('fetchGerritGoldens', []))
    );
  }

  getGerritData(leftLink: string, rightLink: string): Observable<MotionGolden[]> {
    return this.fetchGerritGoldens([{ linkLeft: leftLink, linkRight: rightLink }]);
  }

  fetchCodeSearchGoldens(url: string): Observable<MotionGolden[]> {
    return this.http.post<ApiResponse<MotionGolden[]>>(
      `${this.serverRoot}/service/codesearch/goldens`,
      { url },
      { headers: this.getHeaders() }
    ).pipe(
    ).pipe(
      map(response => {
        const items = this.unwrapResponse(response, []);
        return items.map((item: any) => {
          const data: MotionGoldenData = {
            frame_ids: item.frame_ids,
            features: item.features
          };
          return {
            id: item.goldenName,
            label: item.goldenName,
            testMethodName: item.goldenName,
            testClassName: 'CodeSearch',
            testTime: new Date().toISOString(),
            result: TestResult.Passed,
            dataSource: DataSource.CODESEARCH,
            actualData: data,
            expectedData: data,
            actualUrl: '',
            expectedUrl: '',
            goldenRepoPath: '',
            videoUrl: undefined,
            goldenName: item.goldenName
          } as MotionGolden;
        });
      }),
      catchError(this.handleError<MotionGolden[]>('fetchCodeSearchGoldens', []))
    );
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      ...this.defaultHeaders,
      'Content-Type': 'application/json',
    });
  }

  private unwrapResponse<T>(response: ApiResponse<T>, fallback: T): T {
    if (response.success && response.data !== undefined) {
      return response.data;
    }
    if (response.error) {
      throw new Error(response.error);
    }
    return fallback;
  }

  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(`${operation} failed:`, error);
      if (error.status === 0) {
        this.showNoServerError();
      } else {
        const apiError: AppError = {
          displayDuration: 5000,
          statusCode: error.status,
          message: error.message || error.error?.message || 'Unknown error'
        };
        this.errorService.handleError(apiError);
      }
      return of(result as T);
    };
  }

  private showNoServerError() {
    const serverError: AppError = {
      statusCode: 0,
      message: 'Server is not connected. Run the server and try again.'
    };
    this.errorService.handleError(serverError);
  }
}
