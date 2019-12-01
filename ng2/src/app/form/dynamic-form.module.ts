import { BrowserModule } from '@angular/platform-browser'
import { ReactiveFormsModule } from '@angular/forms'
import { NgModule } from '@angular/core'

import { DynamicFormComponent } from './dynamic-form.component'
import { DynamicFormInputComponent } from './dynamic-form-input.component'

@NgModule({
  imports: [BrowserModule, ReactiveFormsModule],
  declarations: [DynamicFormComponent, DynamicFormInputComponent],
  exports: [DynamicFormComponent, DynamicFormInputComponent]
})
export class DynamicFormModule {
  constructor() {
  }
}