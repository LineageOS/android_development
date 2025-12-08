import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { Error } from '../model/error';

@Injectable({
  providedIn: 'root',
})
export class ErrorService {
  private errorSubject = new Subject<Error>();

  error$ = this.errorSubject.asObservable();

  handleError(message: Error) {
    this.errorSubject.next(message);
  }
}