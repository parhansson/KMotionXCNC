
import { Curve3, EllipseCurve, Vector3, MoveArcArguments, MoveAngularArguments, MoveArguments, ArcCurve } from '../model/vector'
import { GCodeParser } from '../parser/gcode-parser'
import { Block, Word, WordParameters, ControlWord } from '../gcode'
import { GCodeSource, IGMDriver, GCodeVector } from '../model/igm'
import { ModelTransformer } from './model.transformer'

//Copyright (c) 2014 par.hansson@gmail.com
//Modal G codes 
// Group 1	{G0, G1, G2, G3, G80, G81, G82, G83, G84, G85, G86, G87, G88, G89} - motion
// Group 2	{G17, G18, G19} - plane selection
// Group 3	{G90, G91} - distance mode
// Group 5	{G93, G94} - spindle speed mode
// Group 6	{G20, G21} - units
// Group 7	{G40, G41, G42} - cutter diameter compensation
// Group 8	{G43, G49} - tool length offset
// Group 10	{G98, G99} - return mode in canned cycles
// Group 12	{G54, G55, G56, G57, G58, G59, G59.1, G59.2, G59.3} coordinate system selection
//Modal M codes 
// Group 2	{M26, M27} - axis clamping
// Group 4	{M0, M1, M2, M30, M60} - stopping
// Group 6	{M6} - tool change
// Group 7	{M3, M4, M5} - spindle turning
// Group 8	{M7, M8, M9} - coolant
// Group 9	{M48, M49} - feed and speed override bypass

export class ModalGroup {
  constructor(initialState: string, private groupCodes?: string[]) {
    this.code = initialState
  }
  changed: boolean
  code: string
  setActiveCode(newCode: string) {
    //TODO throw error if state literal is not allowed in this group
    //also check line number (block) if two or more states are set in the same block
    // this is not allowed
    if (this.groupCodes.indexOf(newCode) < 0) {
      console.error(`Unknown modal group code ${newCode} allowed are ${this.groupCodes.join(', ')}`)
    }
    this.changed = this.code !== newCode
    this.code = newCode
  }
}
//Kan användas vid generering av gcode i igm-gcode tranformern för att validera koden när den skapas
//och hålla koll på positionen för att undvika att shapen gör en G1 rad på samma ställe som nyligen G0
export class GCodeState {
  moveGroup = new ModalGroup('G0', ['G0', 'G1', 'G2', 'G3', 'G80', 'G81', 'G82', 'G83', 'G84', 'G85', 'G86', 'G87', 'G88', 'G89'])
  planeGroup = new ModalGroup('G17', ['G17', 'G18', 'G19'])
  //distance mode defaults to absolute
  distanceGroup = new ModalGroup('G90', ['G90', 'G91'])
  //spindle speed mode
  spindleSpeedGroup = new ModalGroup(null, ['G93', 'G94'])
  //units defaults to mm
  unitsGroup = new ModalGroup('G21', ['G20', 'G21'])
  position = IGMDriver.newGCodeVector()

}
export class State<ShapeType> extends GCodeState {
  //Motion group

  scale = 1.0
  absolute = true
  currentShape: ShapeType = null
  lineNo = -1
  onBlock(block: Block) {
    this.lineNo = block.line
    this.moveGroup.changed = false
    this.unitsGroup.changed = false
    //etc
  }
  handleWord(cmd: Word) {
    const handler = this.wordHandlers[cmd.value] || this.wordHandlers[cmd.literal] || this.wordHandlers.UNKNOWN
    handler(cmd)
  }
  private wordHandlers = {
    M: (cmd: Word) => {
    },
    F: (cmd: Word) => {
    },
    G0: (cmd: Word) => {
      this.moveGroup.setActiveCode(cmd.value)
    },
    G1: (cmd: Word) => {
      this.moveGroup.setActiveCode(cmd.value)
    },
    G2: (cmd: Word) => {
      this.moveGroup.setActiveCode(cmd.value)
    },
    G3: (cmd: Word) => {
      this.moveGroup.setActiveCode(cmd.value)
    },
    S: (cmd: Word) => {
    },
    G17: (cmd: Word) => {
      this.planeGroup.setActiveCode(cmd.value)
    },
    G18: (cmd: Word) => {
      this.planeGroup.setActiveCode(cmd.value)
    },
    G19: (cmd: Word) => {
      this.planeGroup.setActiveCode(cmd.value)

    },
    G20: (cmd: Word) => {
      this.unitsGroup.setActiveCode(cmd.value)
      this.scale = 25.4 //Inches
    },
    G21: (cmd: Word) => {
      this.unitsGroup.setActiveCode(cmd.value)
      this.scale = 1.0 //mm
    },
    G90: (cmd: Word) => {
      //absolute
      this.distanceGroup.setActiveCode(cmd.value)
      this.absolute = true
    },
    G91: (cmd: Word) => {
      //relative
      this.distanceGroup.setActiveCode(cmd.value)
      this.absolute = false
    },
    UNKNOWN: (cmd: Word) => {
      console.info('Unsupported command:', cmd.value, cmd, this.lineNo)
    }
  }
}

export abstract class GCodeTransformer<ShapeType, OutputType> implements ModelTransformer<GCodeSource, OutputType>{
  // Create the final Object3d to add to the scene
  output: OutputType
  protected state: State<ShapeType>

  constructor(protected disableWorker?: boolean) {

  }

  protected abstract createOutput(): OutputType
  protected abstract startShape(): ShapeType
  protected abstract endShape(): void
  protected abstract addLinearPoint(newPosition: GCodeVector, shape: ShapeType): void
  protected abstract addCurve(curve: Curve3, shape: ShapeType): void


  async transform(gcode: GCodeSource): Promise<OutputType> {
    this.output = this.createOutput()
    //this.group.name = 'GCODE';
    this.state = new State<ShapeType>()
    //this transformer should Subject<Block> instead of GCodeSource
    return new Promise((resolve, reject) => {
      GCodeParser.parse(
        (block) => {
          this.onBlock(block)
        }, gcode.lines)
        .then(() => {
          this.onEndProgram()
          resolve(this.output)
        }, err => reject(err))
    })


    /*
        if (disableWorker) {
          // parse without worker. Application will freeze during parsing
          KMXUtil.injectScript("js/import/gcode2three/gcode-parser.js", window.GCodeParser] !== undefined)
            .then(
            function() {
              new GCodeParser(parserDataHandler, parserDataHandler).parse(gcode.lines);
              parserDataHandler('done');
            },
            function(reason) {
              transformedDefer.reject(reason);
            });
        } else {
          //Parse with worker in background
          KMXUtil.getSingletonWorker("js/import/gcode2three/gcode-worker.js",
            function workerEventHandler(event) {
              parserDataHandler(event.data);
            })
            .then(
            function(parserWorker) {
              console.time("parsingAndTransfer");
              parserWorker.postMessage({ command: 'parse', gcode: gcode.lines });
            },
            function(reason) {
              transformedDefer.reject(reason);
            });
          //console.profile();
        }
    */

  }

  private onBlock(block: Block) {
    //A Block is one line of gcode
    //a Word is a code (G0, G1, M1 etc)
    //WordParameters are parameters to Words (X93 Y87 P4 etc)
    //one block does not need to contain the actual word
    // hence this is valid gcode
    // G1 X10 Y10
    // X5 Y5
    // Move on second row is made in G1 mode
    this.state.onBlock(block)
    for (const part of block.parts) {
      if (part instanceof Word) {
        this.state.handleWord(part)
      } else if (part instanceof WordParameters) {
        const params: MoveArguments = {}
        for (const word of part.value) {
          params[word.literal] = word.address
        }
        this.onWordParameter(params)
        //console.log(word.value)
      }
    }

  }
  private onEndProgram() {
    this.endShape()
  }
  private onStartShape() {
    //TODO end current shape if present
    return this.startShape()
  }
  private onEndShape() {
    //TODO track and warn if current shape is ended
    this.endShape()
  }

  protected onWordParameter(args: MoveArguments) {


    const newPosition = this.getNewPosition(args)
    if (newPosition == null) {
      return
    }

    if (this.state.moveGroup.changed
      || this.state.currentShape == null
      //hack to create new shape on arcs
      || this.state.moveGroup.code === 'G2'
      || this.state.moveGroup.code === 'G3') {
      //End shape
      this.onEndShape()
      //start new Shape
      this.state.currentShape = this.onStartShape()
      if (this.state.moveGroup.code === 'G0' || this.state.moveGroup.code === 'G1') {
        // add startpoint on linear shapes
        this.addLinearPoint(this.state.position, this.state.currentShape)
      }
    }

    //TODO if args X Y and Z is undefined then there is no vector in this Parameter object

    switch (this.state.moveGroup.code) {
      case ('G0'):
        this.addLinearPoint(newPosition, this.state.currentShape)
        break
      case ('G1'):
        this.addLinearPoint(newPosition, this.state.currentShape)
        break
      case ('G2'):
        this.createCurve(args, this.state.position, newPosition, true, this.state.currentShape)
        break
      case ('G3'):
        this.createCurve(args, this.state.position, newPosition, false, this.state.currentShape)
        break
    }

    this.state.position = newPosition
  }

  private createCurve(args: MoveArcArguments, position: GCodeVector, newPosition: GCodeVector, clockWise: boolean, currentShape: ShapeType) {
    const scale = this.state.scale
    args.I *= scale
    args.J *= scale
    args.K *= scale
    args.R *= scale
    const curve = new GCodeCurve3(
      position,
      newPosition,
      args,
      clockWise,
      this.state.planeGroup.code as 'G17' || 'G18' || 'G19')
    this.addCurve(curve, currentShape)
  }
  private getNewPosition(args: MoveArguments) {
    if (!this.containsMoveData(args)) {
      return null
    }
    const position = this.state.position
    const scale = this.state.scale
    const absolute = this.state.absolute
    const newPosition = IGMDriver.newGCodeVector()
    if (absolute) {
      newPosition.x = args.X !== undefined ? args.X * scale : position.x
      newPosition.y = args.Y !== undefined ? args.Y * scale : position.y
      newPosition.z = args.Z !== undefined ? args.Z * scale : position.z
      newPosition.a = args.A !== undefined ? args.A * scale : position.a
      newPosition.b = args.B !== undefined ? args.B * scale : position.b
      newPosition.c = args.C !== undefined ? args.C * scale : position.c
      //if args.X is undefined then args.X * scale === Nan hence position.x is used
      // newPosition.x = (args.X * scale) || position.x
      // newPosition.y = (args.Y * scale) || position.y
      // newPosition.z = (args.Z * scale) || position.z
      // newPosition.a = (args.A * scale) || position.a
      // newPosition.b = (args.B * scale) || position.b
      // newPosition.c = (args.C * scale) || position.c
    } else {
      newPosition.x = args.X !== undefined ? args.X * scale + position.x : position.x
      newPosition.y = args.Y !== undefined ? args.Y * scale + position.y : position.y
      newPosition.z = args.Z !== undefined ? args.Z * scale + position.z : position.z
      newPosition.a = args.A !== undefined ? args.A * scale + position.a : position.a
      newPosition.b = args.B !== undefined ? args.B * scale + position.b : position.b
      newPosition.c = args.C !== undefined ? args.C * scale + position.c : position.c
    }
    return newPosition
  }
  private containsMoveData(args: MoveArguments) {
    return args.X !== undefined || args.Y !== undefined || args.Z !== undefined
      || args.A !== undefined || args.B !== undefined || args.C !== undefined
      || args.I !== undefined || args.J !== undefined || args.K !== undefined
      || args.R !== undefined
  }
}

export class GCodeCurve3 extends Curve3 {
  private readonly plane: 'G17' | 'G18' | 'G19'
  private readonly deltaZ: number
  private delegate: EllipseCurve

  constructor(private startPoint: GCodeVector, endPoint: GCodeVector, args: MoveArcArguments, clockWise: boolean, plane: 'G17' | 'G18' | 'G19') {
    super()
    const I = args.I || 0
    const J = args.J || 0
    const K = args.K || 0
    const R = args.R || 0
    let centerX: number
    let centerY: number
    // centerZ is only used in other planes
    //let centerZ = startPoint.z + K; //TODO Helical not correct implemented yet, i guess...
    let startAngle: number
    let endAngle: number
    let radius: number

    const fullCirce = (Math.abs(startPoint.x - endPoint.x) < Number.EPSILON && Math.abs(startPoint.y - endPoint.y) < Number.EPSILON)
    if (fullCirce) {
      //console.log('full circle', startPoint, endPoint)
    }
    const twoPi = Math.PI * 2

    if (R != 0) {
      // R has precedence over IJK, need to check what klfop does
      if (fullCirce) {
        console.error('Full circle not allowed with R')
      }
      radius = R
      const h = Math.hypot(startPoint.x - endPoint.x, startPoint.y - endPoint.y) / 2
      const hSq = h * h
      const xSq = radius * radius
      const x = Math.sqrt(xSq)
      const ySq = xSq - hSq
      const y = Math.sqrt(ySq)
      centerX = startPoint.y + x
      centerY = startPoint.x + y
      const angle = Math.atan2(startPoint.y - endPoint.y, startPoint.x - endPoint.x)
      centerX = centerX + radius * Math.cos(angle)
      centerY = centerY + radius * Math.sin(angle)

      startAngle = Math.atan2(startPoint.y - centerY, startPoint.x - centerX)
      endAngle = Math.atan2(endPoint.y - centerY, endPoint.x - centerX)
    } else {
      //IJK
      radius = Math.hypot(I, J)  //when I and J is relative
      centerX = startPoint.x + I
      centerY = startPoint.y + J
      startAngle = Math.atan2(startPoint.y - centerY, startPoint.x - centerX)
      //radius += 5
      if (fullCirce) {
        endAngle = startAngle + twoPi
      } else {
        endAngle = Math.atan2(endPoint.y - centerY, endPoint.x - centerX)
      }
    }
    //console.info("Curve ax, ay, radius, startangle, endangle",aX, aY, radius,aStartAngle,  aEndAngle);

    this.delegate = new ArcCurve(
      centerX,
      centerY,
      radius,
      startAngle,
      endAngle,
      clockWise
    )
    //store deltaZ for later
    this.deltaZ = endPoint.z - startPoint.z
    this.plane = plane
    //console.log(startPoint, endPoint, this)
  }
  getPoint(t: number): Vector3 {
    return this.delegate.getPoint(t)
  }
  getPoints(divisions: number): Vector3[] {
    //console.log('GCodeCurve3.getPoints')
    const points = super.getPoints(divisions)


    //handle plane G17-G20
    // G17 is XY plane, G18 is XZ plane and G19 is YZ on circular interpolation; G03 or G02.
    //In G17 your circle goes around the Z axis, in G18 around the Y axis and G19 around the X axis.
    //TODO add function in IGMDriver for this

    return points.map((p, d) => {
      const t = d++ / divisions
      const x = p.x
      const y = p.y
      const z = this.startPoint.z + t * this.deltaZ

      if (this.plane === 'G18') {
        return { x, y: z, z: y }
      } else if (this.plane === 'G19') {
        return { x: z, y, z: x }
      } else {
        return { x, y, z }
      }

    })
  }


}