export interface GeneratorInput<K> {

  value?: string | number | boolean
  options?: Array<{ key: string, value: string | number }>
  label?: string //Human name
  description?: string

  // GUI specific
  append?: string
  prepend?: string
  placeholder?: string
  order?: number
  controlType: 'selection' | 'option' | 'text' | 'bool'
  type: 'text' | 'number' | 'email' | 'checkbox' | 'radio'


  name: Extract<keyof K, string> // name of property // name of property
  min?: number //min value for number
  max?: number //max value for number
  minlength?: number // string vale min length
  maxlength?: number// string vale max length
  required?: boolean //values is required

}