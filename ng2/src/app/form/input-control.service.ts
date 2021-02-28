import { Injectable } from '@angular/core'
import { FormControl, FormGroup, Validators, ValidatorFn } from '@angular/forms'

import { InputBase } from './input-base'

@Injectable()
export class InputControlService {
  constructor() { }

  toFormGroup(inputs: InputBase<any>[]) {
    const group: any = {}
    inputs.sort((a, b) => a.order - b.order)
    inputs.forEach(input => {
      const validators: ValidatorFn[] = []
      if (input.required && input.controlType === 'bool') { validators.push(Validators.requiredTrue) }
      if (input.required && input.controlType !== 'bool') { validators.push(Validators.required) }
      if (input.minlength > 0) { validators.push(Validators.minLength(input.minlength)) }
      if (input.maxlength) { validators.push(Validators.maxLength(input.maxlength)) }
      if (input.type === 'email') { validators.push(Validators.email) }

      group[input.name] = new FormControl(input.value === 0 ? input.value : input.value || '', validators)
    })
    return new FormGroup(group)
  }
}