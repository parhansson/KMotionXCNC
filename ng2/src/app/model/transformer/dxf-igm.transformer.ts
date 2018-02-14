import { Observer } from 'rxjs/Rx'
import { ModelSettingsService, ModelSettings } from '../model.settings.service'
import { ModelTransformer } from './model.transformer'
import { IGM, IgmObject } from '../igm'
import { GCodeVector } from '../vector'
import * as THREE from 'three'
//import { DxfParser } from 'dxf-parser'

import { KMXUtil } from '../../util'

const INSUNITS = {
  // https://www.autodesk.com/techpubs/autocad/acad2000/dxf/header_section_group_codes_dxf_02.htm
  0: 1,     // Unitless,
  1: 25.4,  // Inches
  2: 304.8, // Feet
  3: 1609344, // Miles
  4: 1, // Millimeters
  5: 10, // Centimeters
  6: 1000, // Meters
  7: 1000000, // Kilometers
  8: 0.0000254, // Microinches 
  9: 0.0254, // Mils
  10: 914.4, // Yards
  11: 1.0e-7, // Angstroms
  12: 1.0e-6, // Nanometers
  13: 0.001, // Microns
  14: 100, // Decimeters
  15: 10000, // Decameters
  16: 100000, // Hectometers
  17: 1000000000000, // Gigameters
  18: 1, // Astronomical units
  19: 1, // Light years
  20: 1, // Parsecs

}

export class Dxf2IgmTransformer extends ModelTransformer<ArrayBuffer | string, IGM> {
  constructor() {
    super()

  }
  execute(source: ArrayBuffer | string, targetObserver: Observer<IGM>) {
    let fileText;
    if (source instanceof ArrayBuffer) {
      fileText = KMXUtil.ab2str(source);
    } else {
      fileText = source
    }
    let model = new IGM();
    let parser = new DxfParser();
    try {
      const dxf = parser.parseSync(fileText);
      for (let entity of dxf.entities) {
        let shape: IgmObject
        if (entity.type === 'LWPOLYLINE'
          || entity.type === 'LINE'
          || entity.type === 'POLYLINE') {
          shape = this.doLine(entity)
        } else if (entity.type === 'SPLINE') {
          shape = this.doSpline(entity)
        } else if (entity.type === 'CIRCLE' || entity.type === 'ARC') {
          shape = this.doArc(entity)
        } else if (entity.type === 'ELLIPSE') {
          shape = this.doEllipse(entity)
        }
        if (shape) {
          model.addToLayerObject(entity.layer, this.scale(shape, dxf))
        }
      }
      console.log(dxf);
      targetObserver.next(model)
    } catch (err) {
      return console.error(err.stack);
    }
  }

  scale(shape: IgmObject, dxf): IgmObject {
    let unit = dxf.header.$INSUNITS
    if (unit === undefined) {
      unit = 1 // autocad defaults to Inches(1) if INSUNITS is missing    
    }
    shape.scale(INSUNITS[unit])
    return shape;
  }

  doArc(entity): IgmObject {
    let geometry: THREE.CircleGeometry, circle: THREE.Line;

    geometry = new THREE.CircleGeometry(entity.radius, 128, entity.startAngle, entity.angleLength);
    geometry.vertices.shift();
    let object = new IgmObject();
    for (let v of geometry.vertices) {
      object.vectors.push(new GCodeVector(v.x, v.y, v.z))
    }
    //TODO if circle close path
    object.translate(new GCodeVector(entity.center.x, entity.center.y, entity.center.z))
    return object;
  }

  doEllipse(entity): IgmObject {
    //ar color = getColor(entity, data);

    const xrad = Math.sqrt(Math.pow(entity.majorAxisEndPoint.x, 2) + Math.pow(entity.majorAxisEndPoint.y, 2));
    const yrad = xrad * entity.axisRatio;
    const rotation = Math.atan2(entity.majorAxisEndPoint.y, entity.majorAxisEndPoint.x);

    const curve = new THREE.EllipseCurve(
      entity.center.x, entity.center.y,
      xrad, yrad,
      entity.startAngle, entity.endAngle,
      false, // Always counterclockwise
      rotation
    );
    const object = new IgmObject();
    for (const v of curve.getPoints(50)) {
      object.vectors.push(new GCodeVector(v.x, v.y, entity.center.z))
    }
    return object;
  }

  doLine(entity): IgmObject {
    let object = new IgmObject();
    let i = 0
    for (const v of entity.vertices) {
      //const v = entity.vertices[i]

      if (v.bulge) {
        const bulge = v.bulge;
        const startPoint = v;
        const endPoint = i + 1 < entity.vertices.length ? entity.vertices[i + 1] : object.vectors[0];
        //https://github.com/leandromundim/LaserWeb3/blob/4e883d5e305e0ffd3ce59fea953aa76ed9c6d730/public/lib/dxf/three-dxf.js
        const bulgeGeometry = new BulgeGeometry(startPoint, endPoint, bulge);
        object.vectors.push.apply(object.vectors, bulgeGeometry.vertices.map(v => new GCodeVector(v.x, v.y, v.z)))

      } else {
        object.vectors.push(new GCodeVector(v.x, v.y, v.z))
      }
      i++
    }
    //Close shapes
    if (entity.shape) {
      let startPoint = object.vectors[0]
      object.vectors.push(new GCodeVector(startPoint.x, startPoint.y, startPoint.z));
    }
    return object
  }
  doSpline(entity) {
    //var color = getColor(entity, data);

    const points = entity.controlPoints.map((vec) => new THREE.Vector2(vec.x, vec.y))

    let interpolatedPoints: THREE.Vector2[] = [];
    if (entity.degreeOfSplineCurve == 2) {
      for (let i = 0; i + 2 < points.length; i = i + 2) {
        const curve = new THREE.QuadraticBezierCurve(points[i], points[i + 1], points[i + 2]);
        interpolatedPoints.push.apply(interpolatedPoints, curve.getPoints(50));
      }
    } else {
      const curve = new THREE.SplineCurve(points);
      interpolatedPoints = curve.getPoints(100);
    }

    let splineObject = new IgmObject();
    splineObject.vectors = interpolatedPoints.map(v => new GCodeVector(v.x, v.y, 0))
    return splineObject;
  }
}




/**
 * Calculates points for a curve between two points
 * @param startPoint - the starting point of the curve
 * @param endPoint - the ending point of the curve
 * @param bulge - a value indicating how much to curve
 * @param segments - number of segments between the two given points
 */
class BulgeGeometry extends THREE.Geometry {
  //THREE.BulgeGeometry.prototype = Object.create(THREE.Geometry.prototype);
  constructor(private startPoint, private endPoint, private bulge, private segments?) {
    super()
    let p0, p1;

    //THREE.Geometry.call(this);

    this.startPoint = p0 = startPoint ? new THREE.Vector2(startPoint.x, startPoint.y) : new THREE.Vector2(0, 0);
    this.endPoint = p1 = endPoint ? new THREE.Vector2(endPoint.x, endPoint.y) : new THREE.Vector2(1, 0);
    this.bulge = bulge = bulge || 1;

    const angle = 4 * Math.atan(bulge);
    const radius = p0.distanceTo(p1) / 2 / Math.sin(angle / 2);
    const center = this.polar(startPoint, radius, this.angle2(p0, p1) + (Math.PI / 2 - angle / 2));

    this.segments = segments = segments || Math.max(Math.abs(Math.ceil(angle / (Math.PI / 18))), 6); // By default want a segment roughly every 10 degrees
    const startAngle = this.angle2(center, p0);
    const thetaAngle = angle / segments;


    this.vertices.push(new THREE.Vector3(p0.x, p0.y, 0));

    for (let i = 1; i <= segments - 1; i++) {

      const vertex = this.polar(center, Math.abs(radius), startAngle + thetaAngle * i);

      this.vertices.push(new THREE.Vector3(vertex.x, vertex.y, 0));

    }


  }
  /**
   * Returns the angle in radians of the vector (p1,p2). In other words, imagine
   * putting the base of the vector at coordinates (0,0) and finding the angle
   * from vector (1,0) to (p1,p2).
   * @param  {Object} p1 start point of the vector
   * @param  {Object} p2 end point of the vector
   * @return {Number} the angle
   */
  private angle2(p1, p2) {
    var v1 = new THREE.Vector2(p1.x, p1.y);
    var v2 = new THREE.Vector2(p2.x, p2.y);
    v2.sub(v1); // sets v2 to be our chord
    v2.normalize(); // normalize because cos(theta) =
    // if(v2.y < 0) return Math.PI + (Math.PI - Math.acos(v2.x));
    if (v2.y < 0) return -Math.acos(v2.x);
    return Math.acos(v2.x);
  };


  private polar(point, distance, angle) {
    const result = {
      x: point.x + distance * Math.cos(angle),
      y: point.y + distance * Math.sin(angle)
    }
    return result;
  }
}
