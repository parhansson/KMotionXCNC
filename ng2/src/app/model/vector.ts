
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

export class GCodeVector {

  constructor(public x?: number, public y?: number, public z?: number, public a?: number, public b?: number, public c?: number) {
    this.x = x || 0
    this.y = y || 0
    this.z = z || 0
    this.a = a || 0
    this.b = b || 0
    this.c = c || 0

  }

  scale(scale: number) {

    this.x = this.x * scale;
    this.y = this.y * scale;
    this.z = this.z * scale;
    return this;
  }

  add(v: GCodeVector) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;

    return this;
  }

  equals(v: GCodeVector) {

    return ((v.x === this.x) && (v.y === this.y) && (v.z === this.z));

  }

  distanceSquared(v: GCodeVector) {

    var dx = this.x - v.x;
    var dy = this.y - v.y;
    var dz = this.z - v.z;

    return dx * dx + dy * dy + dz * dz;

  }
}
export class EllipseCurve3 {
  height: number
  sZ: number
  aastartDeg:number
  aaendDeg:number
  constructor(private aX:number, 
    private aY:number, 
    private xRadius:number, 
    private yRadius:number,
    private aStartAngle:number,
    private aEndAngle:number,
    private aClockwise:boolean,
    private aRotation:number
  ) {
    //Not used only for humans
    this.aastartDeg = aStartAngle * (180/Math.PI)
    this.aaendDeg = aEndAngle * (180/Math.PI)
    
  };

  getPoint(t: number, h: number){
    const twoPi = Math.PI * 2;
    let deltaAngle = this.aEndAngle - this.aStartAngle;
    const samePoints = Math.abs( deltaAngle ) < Number.EPSILON;

    // ensures that deltaAngle is 0 .. 2 PI
    while ( deltaAngle < 0 ) deltaAngle += twoPi;
    while ( deltaAngle > twoPi ) deltaAngle -= twoPi;

    if ( deltaAngle < Number.EPSILON ) {

      if ( samePoints ) {

        deltaAngle = 0;

      } else {

        deltaAngle = twoPi;

      }

    }

    if ( this.aClockwise === true && ! samePoints ) {

      if ( deltaAngle === twoPi ) {

        deltaAngle = - twoPi;

      } else {

        deltaAngle = deltaAngle - twoPi;

      }

    }

    let angle = this.aStartAngle + t * deltaAngle;
    let x = this.aX + this.xRadius * Math.cos( angle );
    let y = this.aY + this.yRadius * Math.sin( angle );

    if ( this.aRotation !== 0 ) {

      let cos = Math.cos( this.aRotation );
      let sin = Math.sin( this.aRotation );

      let tx = x - this.aX;
      let ty = y - this.aY;

      // Rotate the point about the center of the ellipse.
      x = tx * cos - ty * sin + this.aX;
      y = tx * sin + ty * cos + this.aY;

    }

    return new GCodeVector(x,y,this.sZ + h);
  }

  getPoints(divisions: number) {

    if (!divisions) divisions = 5;

    let d: number, pts: GCodeVector[] = [];

    let h = 0;
    let hdelta = this.height / (divisions + 1);

    for (d = 0; d <= divisions; d++) {
      pts.push(this.getPoint(d / divisions, h));
      h += hdelta;
    }
    //console.info("ARC height sz ez delta",this.height, this.sZ, h-hdelta, hdelta);
    return pts;

  };

}

export class GCodeCurve3 extends EllipseCurve3{
  constructor(startPoint: GCodeVector, endPoint: GCodeVector, args: MoveArcArguments, clockWise) {

    let I = args.I || 0
    let J = args.J || 0
    let K = args.K || 0
    let R = args.R || 0
    let centerX
    let centerY
    // centerZ is only used in other planes
    //let centerZ = startPoint.z + K; //TODO Helical not correct implemented yet, i guess...
    let startAngle;
    let endAngle;
    let radius

    const fullCirce = (Math.abs(startPoint.x - endPoint.x) < Number.EPSILON && Math.abs(startPoint.y - endPoint.y) < Number.EPSILON)
    if (fullCirce) {
      console.log('full circle',startPoint, endPoint);
    }
    const twoPi = Math.PI*2
    
    if(R != 0){
      // R has precedence over IJK, need to check what klfop does
      if (fullCirce) {
        console.error('Full circle not allowed with R');
      }
      radius = R 
      let h = Math.hypot(startPoint.x - endPoint.x,startPoint.y - endPoint.y) / 2
      const hSq = h*h
      const xSq = radius*radius
      const x = Math.sqrt(xSq)
      const ySq = xSq-hSq
      const y = Math.sqrt(ySq)
      centerX = startPoint.y+x
      centerY = startPoint.x+y
      let angle =  Math.atan2(startPoint.y - endPoint.y, startPoint.x - endPoint.x)
      centerX = centerX + radius * Math.cos( angle );
      centerY = centerY + radius * Math.sin( angle );

      startAngle = Math.atan2(startPoint.y - centerY, startPoint.x - centerX);
      endAngle = Math.atan2(endPoint.y - centerY, endPoint.x - centerX);
    } else {
      //IJK
      radius = Math.hypot(I, J)  //when I and J is relative
      centerX = startPoint.x + I;
      centerY = startPoint.y + J;
      startAngle = Math.atan2(startPoint.y - centerY, startPoint.x - centerX);
      //radius += 5
      if (fullCirce) {
        endAngle = startAngle + Math.PI * 2;
      } else {
        endAngle = Math.atan2(endPoint.y - centerY, endPoint.x - centerX);
      }
    }

    //console.info("Curve ax, ay, radius, startangle, endangle",aX, aY, radius,aStartAngle,  aEndAngle);

    super(
      centerX, centerY,                  // ax, aY
      radius, radius,           // xRadius, yRadius
      startAngle, endAngle,  // aStartAngle, aEndAngle
      clockWise,                     // aClockwise,
      0                               //rotation
    );
    this.sZ = startPoint.z;
    this.height = endPoint.z - startPoint.z;
    console.log(startPoint, endPoint, this);
  }



}