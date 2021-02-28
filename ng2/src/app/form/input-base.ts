
export type InputType = 'text' | 'number' | 'email' | 'checkbox' | 'radio'
export type ControlType = 'selection' | 'option' | 'text' | 'bool'
export interface InputOptions<K> {
  value?: string | number | boolean
  options?: { key: string, value: string | number }[]
  label?: string //Human name
  description?: string

  // GUI specific
  append?: string
  prepend?: string
  placeholder?: string
  order?: number
  type: InputType


  name: Extract<keyof K, string> // name of property
  min?: number //min value for number
  max?: number //max value for number
  minlength?: number // string vale min length
  maxlength?: number// string vale max length
  required?: boolean //values is required
}
export class InputBase<K> implements InputOptions<K>{
  value: string | number | boolean
  name: Extract<keyof K, string>
  label: string
  append: string
  prepend: string
  required: boolean
  order: number
  placeholder: string
  type: InputType
  minlength: number
  maxlength: number
  min: number
  max: number
  options?: { key: string, value: string | number }[]

  constructor(public controlType: ControlType, options: InputOptions<K>) {
    this.value = options.value
    this.name = options.name
    this.label = options.label || ''
    this.required = !!options.required
    this.order = options.order === undefined ? 1 : options.order
    this.type = options.type
    this.minlength = options.minlength || 0
    this.maxlength = options.maxlength || Number.MAX_SAFE_INTEGER
    this.prepend = options.prepend
    this.append = options.append
    this.min = options.min
    this.max = options.max
    this.placeholder = options.placeholder
    this.options = options.options
  }
}