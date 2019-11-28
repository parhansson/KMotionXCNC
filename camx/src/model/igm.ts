import { IGMModelSettings } from './model.settings'
import { Vector3, Vector2, ArcCurve } from './vector'

export interface GCodeVector {
  x: number
  y: number
  z: number
  a: number
  b: number
  c: number
}
export interface Limit {
  start: GCodeVector
  end: GCodeVector
}
export interface Geometry {
  limit?: Limit
}
export interface ARC extends Geometry {
  type: 'ARC'
  x: number //center of arc
  y: number //center of arc
  radius: number
  startAngle: number //in radians
  endAngle: number //in radians
  clockwise: boolean

}
export interface LINE extends Geometry {
  type: 'LINE'
  vectors: GCodeVector[]

}

export interface IgmObject {
  bounds: BoundRect
  comment?: string
  geometry: ARC | LINE
  //TODO replace bounds with min and max. this will include all axes
  // bounds: {
  // min: GCodeVector
  // max: GCodeVector
  // }
}
export interface LineObject extends IgmObject {
  geometry: LINE
}
export interface ArcObject extends IgmObject {
  geometry: ARC
}
export interface Layer {
  objects: IgmObject[]
  visible: boolean

}
export interface LayerMap {
  [id: string]: Layer
}
export interface LayerStatus {
  [id: string]: boolean
}
// Intermediate Gcode Model
export class IGM {
  //TODO Changing IGM to interface will break instanceof when transforming

  readonly layers: LayerMap = {} // sort by stroke color
  //readonly layerKeys: any[] = [] // layerKey is a mapping to add unnamed layers, layer will get a generated name
  readonly textLayer: any[] = [] // textpaths
  readonly unsupported: any[] = []  // Unsupported nodes
  readonly rawLine: string[] = []
  readonly layerStatus: LayerStatus = {}
  constructor(public metric: boolean = true) {

  }


}





/**
 * All operations on an IGM should be done via IGMDriver operations
 */
export class IGMDriver {

  static newLine(vectors?: GCodeVector[]): LineObject {
    return this.newIgmObject({
      type: 'LINE',
      vectors: vectors || []
    }) as LineObject
  }

  static newArc(
    x: number, //center of arc
    y: number, //center of arc
    radius: number,
    startAngle: number,
    endAngle: number,
    clockwise: boolean,

  ): ArcObject {
    return this.newIgmObject({
      type: 'ARC',
      x,
      y,
      radius,
      startAngle,
      endAngle,
      clockwise
    }) as ArcObject
  }
  private static newIgmObject(geometry?: ARC | LINE): IgmObject {
    const object = {
      geometry,
      bounds: null,
      //replace bounds with min and max. this will include all axes
      // min: GCodeVector
      // max: GCodeVector
    }
    return object
  }
  static newGCodeVector3(v: Vector3) {
    return {
      x: v.x || 0,
      y: v.y || 0,
      z: v.z || 0,
      a: 0,
      b: 0,
      c: 0
    }
  }
  static newGCodeVector(x?: number, y?: number, z?: number, a?: number, b?: number, c?: number): GCodeVector {
    return {
      x: x || 0,
      y: y || 0,
      z: z || 0,
      a: a || 0,
      b: b || 0,
      c: c || 0
    }

  }

  constructor(private igm: IGM) {

  }

  public reverse(shape: IgmObject) {
    const geometry = shape.geometry
    if (geometry.type === 'ARC') {
      geometry.clockwise = !geometry.clockwise
      const startAngle = geometry.startAngle
      geometry.startAngle = geometry.endAngle
      geometry.endAngle = startAngle
    } else if (geometry.type === 'LINE') {
      geometry.vectors.reverse()
    }
    this.updateLimit(geometry)

  }
  private updateLimit(geometry: ARC | LINE) {
    if (geometry.type === 'ARC') {
      this.updateArcLimit(geometry)
    }
    if (geometry.type === 'LINE') {
      this.updateLineLimit(geometry)
    }
  }
  private updateLineLimit(geometry: LINE) {
    geometry.limit = {
      start: geometry.vectors[0],
      end: geometry.vectors[geometry.vectors.length - 1]
    }
  }
  private updateArcLimit(geometry: ARC) {
    const curve = new ArcCurve(
      geometry.x,
      geometry.y,
      geometry.radius,
      geometry.startAngle,
      geometry.endAngle,
      geometry.clockwise)
    const start = curve.getPoint(0)
    const end = curve.getPoint(1)
    geometry.limit = {
      start: IGMDriver.newGCodeVector3(start),
      end: IGMDriver.newGCodeVector3(end)
    }

  }

  public start(shape: IgmObject) {
    //this.updateLimit(shape.geometry)
    return shape.geometry.limit.start
  }
  public end(shape: IgmObject) {
    //this.updateLimit(shape.geometry)
    return shape.geometry.limit.end
  }

  public addRaw(raw: string) {
    this.igm.rawLine.push(raw)
  }
  public addUnsupported(obj: any) {
    this.igm.unsupported.push(obj)
  }
  public addToLayerObject(layerKey: string, obj: IgmObject | IgmObject[]) {
    if (layerKey === undefined) {
      layerKey = 'undefined'
    }
    if (layerKey === null) {
      layerKey = 'null'
    }

    //TODO check for renaming layers
    this.igm.layers[layerKey] = this.igm.layers[layerKey] || { visible: true, objects: [] }
    const layerObjects = this.igm.layers[layerKey].objects
    const newObjects = obj instanceof Array ? obj : [obj]
    for (const shape of newObjects) {
      this.updateLimit(shape.geometry)
      layerObjects.push(shape)

    }
    this.updateBounds(newObjects)

  }
  get allVisibleObjects(): IgmObject[] {
    let all: IgmObject[] = []

    for (const layerName in this.igm.layers) {
      // important check that this is objects own property 
      // not from prototype prop inherited
      if (this.igm.layers.hasOwnProperty(layerName)) {
        const layer = this.igm.layers[layerName]
        if (layer.visible !== false) {
          console.log('layerName', layerName)
          const vectors = layer.objects
          all = all.concat(vectors)
        }
      }
    }
    return all

  }

  get allObjectsFlat(): IgmObject[] {
    let all: IgmObject[] = []

    for (const layerName in this.igm.layers) {
      // important check that this is objects own property 
      // not from prototype prop inherited
      if (this.igm.layers.hasOwnProperty(layerName)) {
        console.log('layerName', layerName)
        const layer = this.igm.layers[layerName]
        const vectors = layer.objects
        all = all.concat(vectors)
      }
    }
    return all

  }

  public setLayerStatus(status: LayerStatus) {
    for (const layerName in status) {
      // important check that this is objects own property 
      // not from prototype prop inherited
      if (status.hasOwnProperty(layerName)) {
        const layer = this.igm.layers[layerName]
        if (layer) {
          layer.visible = status[layerName]
        }
      }
    }
  }

  public applyModifications(settings: IGMModelSettings, onlyVisible?: boolean) {

    const shapes = onlyVisible ? this.allVisibleObjects : this.allObjectsFlat

    console.info('Nr of Shapes: ', shapes.length)


    const time = <T>(name: string, f: () => T) => {
      console.time(name)
      const result = f()
      console.timeEnd(name)
      return result
    }

    if (settings.removeSingularites) {
      const removed = time('Remove single points', () => this.removeSingularites(shapes))
      console.info('Single points removed: ', removed)
    }

    if (settings.scale !== 1) {
      console.log('Scaling model', settings.scale)
      time('Scaling', () => this.scale(shapes, settings.scale))
    }

    //Bounds are needed by removeDuplicates (wich is removed)
    time('Update bounds', () => this.updateBounds(shapes))

    if (settings.calculateShortestPath || settings.joinAdjacent) {
      time('Order nearest', () => this.orderNearestNeighbour(shapes, true))
    }
    if (settings.joinAdjacent) {
      const joined = time('Join adjacent', () => this.joinAdjacent(shapes, settings.fractionalDigits))
      console.info('Joined adjacents: ', joined)
      this.updateBounds(shapes)
    }

    const maxBounds = this.getMaxBounds(shapes)

    if (settings.removeOutline) {
      //Some files has an outline. remove it if requested
      console.info('Removing outline')
      this.removeOutline(shapes, maxBounds)
    }

    if (settings.translateToOrigo) {
      time('Abut origo', () => {
        const translateVec = IGMDriver.newGCodeVector(-maxBounds.x, -maxBounds.y, 0)
        this.translate(shapes, translateVec)
      })

    }
    //Add support for offsetting models on import
    //if(settings.offset){
    //const offesetVec = IGMDriver.newGCodeVector(0, -60, 0)
    //IGMDriver.translate(shapes, offesetVec)
    //}

    console.info('Nr of Shapes after: ', shapes.length)

    return shapes

  }

  private vectorScale(thisV: GCodeVector, scale: number) {

    thisV.x = thisV.x * scale
    thisV.y = thisV.y * scale
    thisV.z = thisV.z * scale
    return thisV
  }

  private vectorAdd(thisV: GCodeVector, v: GCodeVector) {
    thisV.x += v.x
    thisV.y += v.y
    thisV.z += v.z

    return thisV
  }

  private vectorEquals(thisV: GCodeVector, v: GCodeVector) {

    return ((v.x === thisV.x) && (v.y === thisV.y) && (v.z === thisV.z))

  }

  private distanceSquared(thisV: GCodeVector, v: GCodeVector) {

    const dx = thisV.x - v.x
    const dy = thisV.y - v.y
    const dz = thisV.z - v.z

    return dx * dx + dy * dy + dz * dz

  }
  private distanceTo(thisV: GCodeVector, v: GCodeVector) {
    return Math.sqrt(this.distanceSquared(thisV, v))
  }


  private doOperation(shape: IgmObject, type: 'scale' | 'translate', operation: (vec: GCodeVector) => void) {

    if (shape.geometry.type == 'ARC') {
      const arc = shape.geometry
      if (type === 'scale') {
        //This works for scaling, but will break radii when moving
        const scaleHack = IGMDriver.newGCodeVector(arc.x, arc.y, arc.radius)
        operation(scaleHack)
        arc.x = scaleHack.x
        arc.y = scaleHack.y
        arc.radius = scaleHack.z

      } else {
        const translation = IGMDriver.newGCodeVector(arc.x, arc.y, 0)
        operation(translation)
        arc.x = translation.x
        arc.y = translation.y
        //arc.radius = scaleHack.z
      }

    } else if (shape.geometry.type == 'LINE') {
      shape.geometry.vectors.forEach(vec => operation(vec))
    }
    this.updateLimit(shape.geometry)
    //TODO add operations for other geometries

    return shape
  }
  public translate(input: IgmObject | IgmObject[], translateVec: GCodeVector): IgmObject | IgmObject[] {
    const shapes = input instanceof Array ? input : [input]
    for (const shape of shapes) {
      this.doOperation(shape, 'translate', (vec) => this.vectorAdd(vec, translateVec))
    }
    return input
  }

  public scale(input: IgmObject | IgmObject[], ratio: number): IgmObject | IgmObject[] {
    if (ratio === 1) {
      return input
    }

    const shapes = input instanceof Array ? input : [input]
    for (const shape of shapes) {
      this.doOperation(shape, 'scale', (vec) => this.vectorScale(vec, ratio))
    }
    return input
  }

  public clone(shape: IgmObject): LineObject | ArcObject {
    const cloneVec = (vec: GCodeVector) => IGMDriver.newGCodeVector(vec.x, vec.y, vec.z, vec.a, vec.b, vec.c)
    if (shape.geometry.type == 'LINE') {
      const copyVec: GCodeVector[] = []
      for (const vec of shape.geometry.vectors) {
        copyVec.push(cloneVec(vec))
      }
      return IGMDriver.newLine(copyVec)

    } else if (shape.geometry.type == 'ARC') {
      const g = shape.geometry
      return IGMDriver.newArc(g.x, g.y, g.radius, g.startAngle, g.endAngle, g.clockwise)
    }

  }

  updateBounds(shapes: IgmObject[]) {
    shapes.forEach(shape => {
      const bounds = new BoundRect()
      const vectors = this.explode(shape)
      vectors.forEach(vec => bounds.include(vec))
      shape.bounds = bounds

    })
    let idx = shapes.length
    while (idx--) {
      const shape = shapes[idx]
    }
  }

  private explode(shape: IgmObject): Vector3[] {
    const geometry = shape.geometry
    if (geometry.type === 'LINE') {
      return geometry.vectors
    }
    if (geometry.type === 'ARC') {
      //need to explode arc into vectors
      //32 vectors should be enough to approximate bounds
      return new ArcCurve(geometry.x,
        geometry.y,
        geometry.radius,
        geometry.startAngle,
        geometry.endAngle,
        geometry.clockwise).getPoints(32)
    }
    return []
  }

  public getMaxBounds(shapes: IgmObject[]) {
    this.updateBounds(shapes)
    const maxBounds = new BoundRect()
    let idx = shapes.length
    while (idx--) {
      const shape = shapes[idx]
      maxBounds.include(shape.bounds.vec1())
      maxBounds.include(shape.bounds.vec2())
    }
    return maxBounds
  }


  private removeSingularites(shapes: IgmObject[]) {
    let removed = 0
    let idx = shapes.length
    while (idx--) {
      const shape = shapes[idx]
      if (shape.geometry.type === 'LINE') {
        if (shape.geometry.vectors.length == 1) {
          removed++
          shapes.splice(idx, 1)
        }
      }
    }
    return removed
  }
  private removeOutline(paths: IgmObject[], maxBounds: BoundRect) {
    //TODO Find object with the same size as maxbounds.
    //currently this just asumes the largest object is first
    paths.pop()
  }

  /**
   * Joining adjacent shapes. This implementation depends on orderNearestNeighbour first
   * However orderNearestNeighbour might check if reverse path is nearest and reverses
   * @param shapes 
   * @param fractionalDigits 
   */
  private joinAdjacent(shapes: IgmObject[], fractionalDigits: number) {
    let joined = 0
    if (shapes.length < 2) {
      return joined
    }
    let idx = 0
    let last = shapes[idx++]
    while (idx < shapes.length) {
      const next = shapes[idx]
      if (next.geometry) {
        idx++
        continue
      }
      const lastEnd = this.end(last)
      const nextStart = this.start(next)

      //console.info(lastEnd, nextStart);
      //TODO check reverse path as well and reverse that
      if (last.geometry.type === 'LINE' && next.geometry.type === 'LINE') {
        if (this.pointEquals(lastEnd, nextStart, fractionalDigits)) {
          Array.prototype.push.apply(last.geometry.vectors, next.geometry.vectors)
          //
          this.updateLimit(last.geometry)
          this.updateBounds([last])
          shapes.splice(idx, 1)
          joined++
        } else {
          last = next
          idx++
        }

      }
    }
    return joined
  }
  private pointEquals(v1: Vector2, v2: Vector2, fractionalDigits: number) {
    //TODO use distanceSquared and compare with toleranceSquared instead
    return (
      v1.x.toFixed(fractionalDigits) === v2.x.toFixed(fractionalDigits) &&
      v1.y.toFixed(fractionalDigits) === v2.y.toFixed(fractionalDigits)
    )
  }

  private orderNearestNeighbour(shapes: IgmObject[], reversePaths: boolean) {

    //These are the steps of the algorithm:
    //
    //  start on an arbitrary vertex as current vertex.
    //  find out the shortest edge connecting current vertex and an unvisited vertex V.
    //  set current vertex to V.
    //  mark V as visited.
    //  if all the vertices in domain are visited, then terminate.
    //  Go to step 2.
    const orderedPaths: IgmObject[] = []
    let next = this.nearest(IGMDriver.newGCodeVector(0, 0, 0), shapes, reversePaths)
    if (next) { // next is undefined if paths is an empty array
      orderedPaths.push(next)
      while (shapes.length > 0) {
        next = this.nearest(this.end(next), shapes, reversePaths)
        orderedPaths.push(next)
      }
      shapes.push.apply(shapes, orderedPaths)
    }
  }
  private nearest(point: GCodeVector, shapes: IgmObject[], reversePaths: boolean): IgmObject {

    let dist = Infinity
    let index = -1
    let reverseIndex = -1
    for (let shapeIdx = 0, shapeCount = shapes.length; shapeIdx < shapeCount; shapeIdx++) {
      const shape = shapes[shapeIdx]
      const shapeStart = this.start(shape)
      let distance
      const startDS = this.distanceTo(shapeStart, point)
      let foundreverse = false
      if (reversePaths) {
        //check endpoint as well and reverse path if endpoint is closer
        const shapeEnd = this.end(shape)
        const endDS = this.distanceTo(shapeEnd, point)
        if (startDS <= endDS) {
          distance = startDS
        } else {
          distance = endDS
          //only reverse if shape actually used
          foundreverse = true
        }
      } else {
        distance = startDS
      }
      if (distance < dist) {
        dist = distance
        index = shapeIdx
        if (foundreverse) {
          reverseIndex = shapeIdx
        }
      }

      //experiment with tolerance check. If dist < tolerance break loop since finding a closer path probably won't matter
      // if(!shape.node.text){ //some text shapes generates 
      //   if(dist < 0.1){
      //     break
      //   }
      // } else  {
      //   console.log(shape.node.text)
      // }
    }

    const nearest = shapes.splice(index, 1)[0]
    //only reverse if shape actually used
    if (index > -1 && index === reverseIndex) {
      this.reverse(nearest)
    }
    return nearest
  }

}

export class GCodeSource {
  lines: string[]
  text: string
  constructor(gcode: string[] | string) {
    if (Array.isArray(gcode)) {
      this.lines = gcode
      this.text = gcode.join('\n')
    } else {
      this.text = gcode
      this.lines = gcode.split('\n')
    }

  }

}



export class BoundRect {
  x = Infinity
  y = Infinity
  x2 = -Infinity
  y2 = -Infinity

  constructor() { }

  scale(ratio: number) {
    this.x = this.x * ratio
    this.y = this.y * ratio
    this.x2 = this.x2 * ratio
    this.y2 = this.y2 * ratio
    return this
  }

  vec1() {
    return IGMDriver.newGCodeVector(this.x, this.y, 0)
  }
  vec2() {
    return IGMDriver.newGCodeVector(this.x2, this.y2, 0)
  }

  include(vec: Vector2) {
    const x = vec.x
    const y = vec.y

    if (x < this.x) {
      this.x = x
    }

    if (y < this.y) {
      this.y = y
    }

    if (x > this.x2) {
      this.x2 = x
    }
    if (y > this.y2) {
      this.y2 = y
    }
  }

  area() {
    return this.height() * this.width()
  }

  height() {
    const height = this.y2 - this.y
    return height
  }

  width() {
    const width = this.x2 - this.x
    return width
  }

}




