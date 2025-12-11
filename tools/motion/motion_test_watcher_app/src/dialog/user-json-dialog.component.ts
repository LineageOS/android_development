import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';

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
  jsonInput: string = '';
  nameInput: string = '';

  constructor(
    public dialogRef: MatDialogRef<UserJsonDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) { }

  onCancel(): void {
    this.dialogRef.close();
  }

  onVisualize(): void {
    this.dialogRef.close({ json: this.jsonInput, name: this.nameInput });
  }
}
