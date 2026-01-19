import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { MotionGoldenData } from '../model/golden';
import { parseJSONDataToMotionGolden } from '../util/util';

export interface UserJsonData {
  json: string;
  name: string;
}

@Component({
  selector: 'app-user-json-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    MatButtonModule
  ],
  templateUrl: './user-json-dialog.component.html',
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
  `]
})
export class UserJsonDialogComponent {
  jsonInputLeft: string = '';
  jsonInputRight: string = '';
  nameInput: string = '';
  errorMessage: string | null = null;

  constructor(
    public dialogRef: MatDialogRef<UserJsonDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) { }

  onCancel(): void {
    this.dialogRef.close();
  }

  onInputChange() {
    this.errorMessage = null;
  }

  onVisualize(): void {
    let jsonDataLeft: MotionGoldenData | null = null;
    let jsonDataRight: MotionGoldenData | null = null;

    try {
      if (this.jsonInputLeft) {
        jsonDataLeft = parseJSONDataToMotionGolden(this.jsonInputLeft);
      }
    } catch (e) {
      this.errorMessage = `Error parsing Left JSON: ${e}. `;
    }

    try {
      if (this.jsonInputRight) {
        jsonDataRight = parseJSONDataToMotionGolden(this.jsonInputRight);
      }
    } catch (e) {
      this.errorMessage = (this.errorMessage ?? "") + `Error parsing Right JSON: ${e}`;
    }

    if (this.errorMessage) {
      console.error(`UserJsonDialogComponent: ${this.errorMessage}`);
      return;
    }

    this.dialogRef.close({
      jsonLeft: jsonDataLeft,
      jsonRight: jsonDataRight,
      name: this.nameInput
    });
  }
}
