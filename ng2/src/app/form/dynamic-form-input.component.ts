import { Component, Input } from '@angular/core'
import { FormGroup } from '@angular/forms'

import { InputBase } from './input-base'

@Component({
  selector: 'kmx-dynamic-input',
  templateUrl: './dynamic-form-input.component.html'
})
export class DynamicFormInputComponent {
  @Input() input: InputBase<any>
  @Input() form: FormGroup
  @Input() submitted:boolean

  // convenience getter for easy access to form fields
  get c() { return this.form.controls[this.input.name] }
}