import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { MotionGolden } from '../model/golden';
import { GoldensService } from './goldens.service';
import { GoldenStatus } from '../model/enums';

@Injectable({ providedIn: 'root' })
export class GoldenActionService {
  constructor(
    private goldenService: GoldensService,
    private snackBar: MatSnackBar
  ) {}

  updateGolden(golden: MotionGolden): Observable<boolean> {
    golden.status = GoldenStatus.Updating;
    return this.goldenService.updateGolden(golden).pipe(
      map((result) => {
        if (result && result.status === 'PASSED_UPDATE') {
          golden.status = GoldenStatus.PassedUpdate;
          golden.error = undefined;
          this.snackBar.open('Golden updated successfully!', 'Close', {
            duration: 3000,
            panelClass: 'success-snackbar',
          });
          return true;
        } else {
          golden.status = GoldenStatus.FailedUpdate;
          golden.error = result?.message || 'Update failed';
          this.snackBar.open(
            `Retry failed. Error: ${golden.error}`,
            'Close',
            {
              duration: 5000,
              panelClass: 'error-snackbar',
            }
          );
          return false;
        }
      }),
      catchError((err) => {
        console.error(err);
        golden.status = GoldenStatus.FailedUpdate;
        this.snackBar.open(
          'Error updating golden. See console for details.',
          'Close',
          {
            duration: 5000,
            panelClass: 'error-snackbar',
          }
        );
        return of(false);
      })
    );
  }

  updateSelectedGoldens(goldens: MotionGolden[]): Observable<boolean> {
    if (goldens.length === 0) {
      this.snackBar.open('Please select at least one option!', 'Dismiss', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'top',
        panelClass: ['snackbar-error-message'],
      });
      return of(false);
    }

    const idsToUpdate = goldens.map((g) => g.id);
    goldens.forEach((g) => (g.status = GoldenStatus.Updating));

    return this.goldenService.updateSelectedGoldens(idsToUpdate).pipe(
      map((batchResult) => {
        if (!batchResult) {
          throw new Error('No result received');
        }

        const { results, passedCount, failedCount } = batchResult;

        // Update local state
        results.forEach((res) => {
          const golden = goldens.find((g) => g.id === res.id);
          if (golden) {
            if (res.status === 'PASSED_UPDATE') {
              golden.status = GoldenStatus.PassedUpdate;
              golden.error = undefined;
            } else {
              golden.status = GoldenStatus.FailedUpdate;
              golden.error = res.message;
            }
          }
        });

        const totalCount = passedCount + failedCount;
        if (failedCount > 0) {
          let message = `${passedCount} golden(s) updated successfully.`;
          message += ` ${failedCount} golden(s) failed to update.`;
          this.snackBar.open(message, 'Close', {
            duration: 8000,
            panelClass: 'warning-snackbar',
          });
        } else {
          this.snackBar.open(
            `${totalCount} golden(s) updated successfully!`,
            'Close',
            {
              duration: 3000,
              panelClass: 'success-snackbar',
            }
          );
        }
        return true;
      }),
      catchError((err) => {
        console.error('Error updating goldens:', err);
        goldens.forEach((g) => {
            // Only reset if still updating
            if (g.status === GoldenStatus.Updating) {
                g.status = GoldenStatus.Idle;
            }
        });
        this.snackBar.open(
          'Error updating golden. See console for details.',
          'Close',
          {
            duration: 5000,
            panelClass: 'error-snackbar',
          }
        );
        return of(false);
      })
    );
  }
}
