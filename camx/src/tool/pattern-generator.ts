import { ModelGenerator } from './model-generator'

import { GeneratorInput } from './generator-input'

import { IGMDriver, IGM, GCodeVector } from '../model'
import { igm2SVG } from '../transformer/igm-svg.transformer'
export interface PatternGeneratorInput {
  rows: number
  columns: number
  rowSpacing: number
  colSpacing: number

}

export class PatternGenerator implements ModelGenerator<PatternGeneratorInput> {
  constructor() {

  }

  requiredInput() {
    const inputs: Array<GeneratorInput<PatternGeneratorInput>> = [
      {
        controlType: 'text',
        type: 'number',
        name: 'rows',
        label: 'Rows',
        value: 2,
        required: true,
        min: 1,
        order: 4
      },
      {
        controlType: 'text',
        type: 'number',
        name: 'columns',
        label: 'Columns',
        value: 4,
        required: true,
        min: 1,
        order: 3
      },
      {
        controlType: 'text',
        type: 'number',
        name: 'rowSpacing',
        label: 'Row spacing',
        value: 2,
        required: true,
        min: 1,
        order: 1
      },
      {
        controlType: 'text',
        type: 'number',
        name: 'colSpacing',
        label: 'Column spacing',
        value: 2,
        required: true,
        min: 1,
        order: 2
      }
    ]
    return inputs
  }
  private rect(width, height) {
    const vectors: GCodeVector[] = []
    vectors.push(IGMDriver.newGCodeVector(0, 0))
    vectors.push(IGMDriver.newGCodeVector(width, 0))
    vectors.push(IGMDriver.newGCodeVector(width, height))
    vectors.push(IGMDriver.newGCodeVector(0, height))
    vectors.push(IGMDriver.newGCodeVector(0, 0))
    return IGMDriver.newLine(vectors)
  }


  async generateSVG(values: PatternGeneratorInput) {
    return igm2SVG(await this.generate(values))
  }


  async generate(values: PatternGeneratorInput) {
    /*
G90
G21
(M100 P1200 Q100)
(F200)
M100 P2000 Q100
F120
M5 (laser off)
G0 X0 Y0 Z3
M3 (laser on)
G1 X53 Y0
G1 X53 Y38
G1 X0 Y38
G1 X0 Y0
M5 (laser off)
G0 X4.75 Y13.25
M3 (laser on)
G1 X48.25 Y13.25
G1 X48.25 Y24.75
G1 X4.75 Y24.75
G1 X4.75 Y13.25
M5 (laser off)
G0 X0 Y0 Z0
M2
    // */

    const igm = new IGM()
    const driver = new IGMDriver(igm)
    const shape = this.rect(53, 38)
    const shape2 = this.rect(43.5, 11.5)
    driver.translate(shape2, IGMDriver.newGCodeVector(4.75, 13.25))

    // const shape = this.rect(38,53)
    // const shape2 = this.rect(11.5,43.5)
    // shape2.translate(new GCodeVector(13.25,4.75))


    driver.updateBounds([shape, shape2])
    const width = shape.bounds.width()
    const height = shape.bounds.height()

    for (let row = 0; row < values.rows; row++) {
      for (let col = 0; col < values.columns; col++) {
        const translate = IGMDriver.newGCodeVector(col * (width + values.colSpacing), row * (height + values.rowSpacing))
        driver.addToLayerObject('one', driver.translate(driver.clone(shape), translate))
        driver.addToLayerObject('one', driver.translate(driver.clone(shape2), translate))
      }
    }
    return igm
  }

}