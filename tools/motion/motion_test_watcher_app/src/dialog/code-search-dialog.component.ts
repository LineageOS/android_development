import { Component } from '@angular/core';
import { MatDialogRef, MatDialogContent, MatDialogTitle, MatDialogActions } from '@angular/material/dialog';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';

@Component({
  selector: 'app-code-search-dialog',
  templateUrl: './code-search-dialog.component.html',
  standalone: true,
  imports: [
     MatInput,
     MatFormField,
     FormsModule,
     MatButton,
     MatDialogContent,
     MatDialogTitle,
     MatDialogActions,
     MatLabel
  ]
})
export class CodeSearchDialogComponent {
  url: string = '';

  constructor(public dialogRef: MatDialogRef<CodeSearchDialogComponent>) {}

  onCancel(): void {
    this.dialogRef.close();
  }

  getGoldens(): void {
    this.dialogRef.close(this.url);
  }
}
