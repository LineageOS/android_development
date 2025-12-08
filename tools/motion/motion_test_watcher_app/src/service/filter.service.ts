import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SelectOption } from '../filter/filter.component';

@Injectable({
  providedIn: 'root'
})
export class FilterService {
  private motionDataEmitter = new BehaviorSubject<SelectOption[]>([]);
  motionData$: Observable<SelectOption[]> = this.motionDataEmitter.asObservable();

  private _selectedOptionsSource = new BehaviorSubject<SelectOption[]>([]);
  selectedOptions$: Observable<SelectOption[]> = this._selectedOptionsSource.asObservable();

  constructor() { }
  sendSelectOption(data: SelectOption[]): void {
    this.motionDataEmitter.next(data);
  }

  sendSelectedOptions(options: SelectOption[]): void {
    this._selectedOptionsSource.next(options);
  }
}
