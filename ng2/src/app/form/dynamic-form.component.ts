import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core'
import { FormGroup } from '@angular/forms'

import { InputBase } from './input-base'
import { InputControlService } from './input-control.service'

@Component({
  selector: 'kmx-dynamic-form',
  templateUrl: './dynamic-form.component.html',
  providers: [InputControlService]
})
export class DynamicFormComponent implements OnInit {

  @Input() inputs: Array<InputBase<any>> = []
  @Input() headerLabel: string = ''
  @Input() hideSubmit: boolean = false
  @Output() apply = new EventEmitter<any>()
  @Output() update = new EventEmitter<any>()
  form: FormGroup
  submitted = false

  constructor(private qcs: InputControlService) { }

  ngOnInit() {
    this.form = this.qcs.toFormGroup(this.inputs)
    this.form.valueChanges.subscribe(formValues => this.update.emit(this.fixTypes(formValues)))
  }

  onSubmit() {
    this.submitted = true

    // stop here if form is invalid
    if (this.form.invalid) {
      return
    }

    const result = this.fixTypes(this.form.value)
    this.apply.emit(result)
  }

  onReset() {
    this.submitted = false
    this.form.reset()
  }
  private fixTypes(formValues) {
    //Quick fix to format numbers as numbers since they are strings in forms
    //TODO check type and only format when type is number
    //also format check as boolean 
    const result = {}
    // tslint:disable-next-line:forin
    for (const key in formValues) {
      const value = formValues[key]
      const input = this.inputs.filter(i => i.name === key)[0]
      if (input.type === 'number') {
        result[key] = isNaN(+value) ? value : +value
      } else if (input.controlType === 'bool') {
        result[key] = !!value
      } else {
        result[key] = value
      }
    }
    return result
  }
}