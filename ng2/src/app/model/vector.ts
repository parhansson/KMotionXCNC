import { GCodeVector, IGMDriver } from './igm'
export interface MoveArcArguments {
  I?: number
  J?: number
  K?: number
  R?: number
}
export interface MoveAngularArguments {
  A?: number
  B?: number
  C?: number
}
export interface MoveArguments extends MoveAngularArguments, MoveArcArguments {
  X?: number
  Y?: number
  Z?: number


}

/**
 * EllipseCurve is from THREE but also accounts for height (z)
 */
export class EllipseCurve {
  private readonly deltaZ: number
  private readonly deltaAngle: number
  constructor(private readonly aX: number,
    private readonly aY: number,
    private readonly xRadius: number,
    private readonly yRadius: number,
    private readonly aStartAngle: number,
    private readonly aEndAngle: number,
    private readonly aClockwise: boolean,
    private readonly aRotation: number,
    private readonly startZ: number,
    private readonly endZ: number
    ) {
    //store deltaZ for later
    this.deltaZ = endZ - startZ
    
    //calculate and store deltaAngle for later
    const twoPi = Math.PI * 2
    let deltaAngle = this.aEndAngle - this.aStartAngle
    const samePoints = Math.abs(deltaAngle) < Number.EPSILON

    // ensures that deltaAngle is 0 .. 2 PI
    while (deltaAngle < 0) { deltaAngle += twoPi }
    while (deltaAngle > twoPi) { deltaAngle -= twoPi }

    if (deltaAngle < Number.EPSILON) {

      if (samePoints) {
        deltaAngle = 0
      } else {
        deltaAngle = twoPi

      }

    }

    if (this.aClockwise === true && !samePoints) {

      if (deltaAngle === twoPi) {
        deltaAngle = - twoPi
      } else {
        deltaAngle = deltaAngle - twoPi
      }

    }
    this.deltaAngle = deltaAngle
  }
  /**
   * 
   * @param t point in percent of arc length
   */
  private getPoint(t: number) {

    const angle = this.aStartAngle + t * this.deltaAngle
    let x = this.aX + this.xRadius * Math.cos(angle)
    let y = this.aY + this.yRadius * Math.sin(angle)

    if (this.aRotation !== 0) {

      const cos = Math.cos(this.aRotation)
      const sin = Math.sin(this.aRotation)

      const tx = x - this.aX
      const ty = y - this.aY

      // Rotate the point about the center of the ellipse.
      x = tx * cos - ty * sin + this.aX
      y = tx * sin + ty * cos + this.aY

    }

    return IGMDriver.newGCodeVector(x, y, this.startZ + t * this.deltaZ)
  }

  getPoints(divisions?: number) {

    divisions = divisions || 10 //default to 10

    const pts: GCodeVector[] = []

    for (let d = 0; d <= divisions; d++) {
      pts.push(this.getPoint(d / divisions))
    }
    //console.info("ARC height sz ez delta",this.height, this.sZ, h-hdelta, hdelta);
    return pts

  }

}

export class GCodeCurve3 extends EllipseCurve {
  private readonly plane: 'G17' | 'G18' | 'G19'
  constructor(startPoint: GCodeVector, endPoint: GCodeVector, args: MoveArcArguments, clockWise:boolean, plane: 'G17' | 'G18' | 'G19') {
    
    const I = args.I || 0
    const J = args.J || 0
    const K = args.K || 0
    const R = args.R || 0
    let centerX
    let centerY
    // centerZ is only used in other planes
    //let centerZ = startPoint.z + K; //TODO Helical not correct implemented yet, i guess...
    let startAngle
    let endAngle
    let radius

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

    super(
      centerX, centerY,                  // ax, aY
      radius, radius,           // xRadius, yRadius
      startAngle, endAngle,  // aStartAngle, aEndAngle
      clockWise,                     // aClockwise,
      0,                               //rotation
      startPoint.z,
      endPoint.z
    )
    this.plane = plane
    //console.log(startPoint, endPoint, this)
  }

  getPoints(divisions: number) {
    //console.log('GCodeCurve3.getPoints')
    const points = super.getPoints(divisions)
    
    //handle plane G17-G20
    // G17 is XY plane, G18 is XZ plane and G19 is YZ on circular interpolation; G03 or G02.
    //In G17 your circle goes around the Z axis, in G18 around the Y axis and G19 around the X axis.
    //TODO add function in IGMDriver for this
    for(const p of points){

      const x = p.x
      const y = p.y
      const z = p.z
      if(this.plane === 'G18'){
        p.y = z
        p.z = y
      } else if(this.plane === 'G19'){
        p.x = z
        p.z = x
      }

    }
    return points
  }


}