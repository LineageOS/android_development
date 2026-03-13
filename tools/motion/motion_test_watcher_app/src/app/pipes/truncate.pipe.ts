import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'truncate',
  standalone: true,
})
export class TruncatePipe implements PipeTransform {
  transform(
    value: string | null | undefined,
    limit: number = 25,
    middle: boolean = false
  ): string {
    if (!value) {
      return '';
    }

    if (value.length <= limit) {
      return value;
    }

    if (middle) {
      const charsToShow = limit - 3;
      const frontChars = Math.ceil(charsToShow / 2);
      const backChars = Math.floor(charsToShow / 2);

      return (
        value.substring(0, frontChars) +
        '...' +
        value.substring(value.length - backChars)
      );
    }

    return value.substring(0, limit) + '...';
  }
}
