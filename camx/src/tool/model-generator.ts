import { GeneratorInput } from './generator-input'
import { IGM } from '../model'

export interface ModelGenerator<K> {
  requiredInput(): Array<GeneratorInput<K>>

  generate(values: K): Promise<IGM>
  generateSVG(values: K): Promise<string>
}