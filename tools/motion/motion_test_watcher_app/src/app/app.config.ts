import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';
import { ACCESS_TOKEN, SERVICE_PORT } from '../service/goldens.service';
import { ProgressTracker } from '../util/progress';
import { Preferences } from '../util/preferences';
import {
  APP_BASE_HREF,
  LocationStrategy,
  PathLocationStrategy,
  PlatformLocation,
} from '@angular/common';
import { Inject, Injectable, Optional } from '@angular/core';
import { UrlSerializer } from '@angular/router';

function getToken(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  let token = urlParams.get('token');

  if (token === null) {
    token = localStorage.getItem("token");
  } else {
    localStorage.setItem("token", token);
  }
  return token;
}

function getPort(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  let port = urlParams.get('port');

  if (port === null) {
    port = localStorage.getItem("port");
  } else {
    localStorage.setItem("port", port ?? "");
  }
  return port;
}

@Injectable()
export class PreserveQueryParamsPathLocationStrategy extends PathLocationStrategy {
  private get search(): string {
    return this.platformLocation?.search ?? '';
  }

  constructor(
    private platformLocation: PlatformLocation,
    private urlSerializer: UrlSerializer,
    @Optional() @Inject(APP_BASE_HREF) _baseHref?: string
  ) {
    super(platformLocation, _baseHref);
  }

  override prepareExternalUrl(internal: string): string {
    const path = super.prepareExternalUrl(internal);
    const urlTree = this.urlSerializer.parse(path);

    const nextQueryParams = urlTree.queryParams;
    const existingURLSearchParams = new URLSearchParams(this.search);
    // const existingQueryParams = Object.fromEntries(
    //   existingURLSearchParams.entries(),
    // );
    urlTree.queryParams = { ...existingURLSearchParams, ...nextQueryParams };

    return urlTree.toString();
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    provideAnimations(),
    provideAnimationsAsync(),
    ProgressTracker,
    Preferences,
    { provide: ACCESS_TOKEN, useFactory: getToken },
    { provide: SERVICE_PORT, useFactory: getPort },
    {
      provide: LocationStrategy,
      useClass: PreserveQueryParamsPathLocationStrategy,
    },
  ],
};
