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
import { Observable, of, throwError } from 'rxjs';
import { catchError, filter, map, tap } from 'rxjs/operators';

import { GerritLinkPair, MotionGolden, MotionGoldenData, PresubmitTest } from '../model/golden';
import { RecordedMotion } from '../model/recorded-motion';
import { Timeline } from '../model/timeline';
import { VideoSource } from '../model/video-source';
import { checkNotNull } from '../util/preconditions';
import { Feature, recordedFeatureFactory } from '../model/feature';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ErrorService } from './error.service';
import { Error } from '../model/error';

export const ACCESS_TOKEN = new InjectionToken<string>('token');
export const SERVICE_PORT = new InjectionToken<string>('port');

@Injectable({ providedIn: 'root' })
export class GoldensService {
  private serverRoot: string;
  private defaultHeaders: { [heder: string]: string };

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
      .post<PresubmitTest[]>(
        `${this.serverRoot}/service/presubmit_artifact/list`,
        { invocation_id },
        {
          headers: {
            ...this.defaultHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
      .pipe(
        tap((artifacts) => console.log(`fetched ${artifacts.length} for invocationID : ${invocation_id}`)),
        catchError(this.handleError<PresubmitTest[]>('e'))
      );
  }

  getPresubmitTestArtifactsForTestName(resource_id: string): Observable<MotionGolden> {
    return this.http
      .post<MotionGolden>(
        `${this.serverRoot}/service/fetch_artifact`,
        { resource_id },
        {
          headers: {
            ...this.defaultHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
      .pipe(
        tap((artifact) => console.log(`fetched ${artifact} for testName : ${resource_id}`)),
        catchError(this.handleError<MotionGolden>('e'))
      );
  }

  getActualGoldenData(golden: MotionGolden): Observable<MotionGoldenData> {
    return this.http
      .get<MotionGoldenData>(`${golden.actualUrl}`, {
        headers: this.defaultHeaders,
      })
      .pipe(
        tap((x) => console.log(`listed loaded golden data`)),
        catchError(this.handleError<MotionGoldenData>('e'))
      );
  }

  getExpectedGoldenData(golden: MotionGolden): Observable<MotionGoldenData> {
    return this.http
      .get<MotionGoldenData>(`${golden.expectedUrl}`, {
        headers: this.defaultHeaders,
      })
      .pipe(
        tap((x) => console.log('listed expected golden data')),
        catchError(this.handleError<MotionGoldenData>('e'))
      );
  }

  refreshGoldens(clear: boolean): Observable<MotionGolden[]> {
    return this.http
      .post<MotionGolden[]>(
        `${this.serverRoot}/service/refresh`,
        { clear },
        {
          headers: {
            ...this.defaultHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
      .pipe(
        tap((_) => console.log(`refreshed goldens (clear)`)),
        catchError(this.handleError<MotionGolden[]>('e'))
      );
  }

  switchMode(mode: string): Observable<MotionGolden[] | PresubmitTest[]> {
    return this.http
      .post<MotionGolden[] | PresubmitTest[]>(
        `${this.serverRoot}/service/mode`,
        { mode },
        {
          headers: {
            ...this.defaultHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
      .pipe(
        tap((artifacts) => console.log(`fetched ${artifacts.length} goldens for testMode : ${mode}`)),
        catchError(this.handleError<MotionGolden[] | PresubmitTest[]>('e'))
      );
  }

  updateGolden(golden: MotionGolden): Observable<Record<string, string>> {
    return this.http
      .put<
        Record<string, string>
      >(`${this.serverRoot}/service/update?id=${golden.id}`, {}, { headers: this.defaultHeaders })
      .pipe(
        tap((results: Record<string, string>) => { }),
        catchError(this.handleErrorForUpdatingGolden<Record<string, string>>('updateGolden')),
      );
  }

  updateSelectedGoldens(selectedGoldenIds: string[]): Observable<any> {
    return this.http
      .put<
        Record<string, string>
      >(`${this.serverRoot}/service/updateSelectedGoldensIds`, { selectedGoldenIds }, { headers: this.defaultHeaders })
      .pipe(
        tap((rawResults: Record<string, string>) => {
          console.log(
            `Service: Batch update request sent for the IDs:`,
            selectedGoldenIds,
          );
          console.log(
            `Service: Raw batch update results received:`,
            rawResults,
          );
        }),
        catchError(
          this.handleErrorForUpdatingGolden<Record<string, string>>('updateSelectedGoldens'),
        ),
      );
  }

  getTestModes(): Observable<string[]> {
    return this.http
      .get<string[]>(
        `${this.serverRoot}/service/testModes/list`,
        {
          headers: {
            ...this.defaultHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
      .pipe(
        tap((x) => console.log(`Got response as ${x.toString()}`)),
        catchError(this.handleError<string[]>('e'))
      );
  }

  getMultipleJsonsFromGerritLinks(linkPairs : GerritLinkPair[]) : Observable<MotionGolden[]> {
    return this.http.post<MotionGolden[]>(`${this.serverRoot}/getMultipleGoldensFromGerrit`,
      { linkPairs },
      {
      headers: {
            ...this.defaultHeaders,
            'Content-Type': 'application/json',
          },
      }
    ).pipe(
      tap((x) => console.log(`Got response as ${x}`)),
      catchError(this.handleError<MotionGolden[]>('e'))
    )
  }

  getGerritData(leftLink: string, rightLink: string) {
    let params = new HttpParams()
    params = params.set('leftLink', leftLink)
    params = params.set('rightLink', rightLink)
    console.log(`GERRIT: Setting params as ${params.toString()}`)
    return this.http
      .get<string[]>(`${this.serverRoot}/getGerrit`, {
        headers: this.defaultHeaders,
        params: params
      })
      .pipe(
        tap((x) => console.log(`Got response as ${x.toString()}`)),
        catchError(this.handleError<string[]>('e'))
      );
  }

  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(error);
      if (error.status == 0) {
        this.showNoServerError();
      } else {
        const apiError: Error = {
          displayDuration: 5000,
          statusCode: error.status,
          message: error.error?.message
        }
        this.errorService.handleError(apiError);
      }
      // Let the app keep running by returning an empty result.
      return of(result as T);
    };
  }

  private handleErrorForUpdatingGolden<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(error);
      if (error.status == 0) {
        this.showNoServerError();
      }
      const response = error.error;
      return of(response as T);
    };
  }

  private showNoServerError() {
    const serverError: Error = {
      statusCode: 0,
      message: 'Server is not connected. Run the server and try again.'
    }
    this.errorService.handleError(serverError);
  }
}
