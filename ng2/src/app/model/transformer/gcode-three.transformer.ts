
import { GCodeCurve3 } from '../vector'
import { GCodeVector } from '../igm'
import { GCodeTransformer, State } from './gcode.transformer'
import * as THREE from 'three'
import { Group, Geometry } from 'three'

//Copyright (c) 2014 par.hansson@gmail.com
interface ExtendedGCodeVector extends GCodeVector {
  e:number// 0
  extruding:boolean// = false
}
class ThreeShapeData {
  material: THREE.LineBasicMaterial
}
export class Gcode2ThreeTransformer extends GCodeTransformer<THREE.Geometry, THREE.Group>{
  // Create the final Object3d to add to the scene
  // interpolateColor = new THREE.Color(0x080808);
  // positionColor = new THREE.Color(0xAAAAFF);
  // lineMaterial = new THREE.LineBasicMaterial({
  //   opacity: 0.6,
  //   transparent: true,
  //   linewidth: 1,
  //   vertexColors: THREE.FaceColors
  // });



  private interpolateShapeData: ThreeShapeData = {

    material: new THREE.LineBasicMaterial({
      opacity: 0.6,
      transparent: true,
      linewidth: 1,
      color: 0x080808
    })
  }
  private moveShapeData: ThreeShapeData = {
    // material: new THREE.LineBasicMaterial({
    //   opacity: 0.6,
    //   transparent: true,
    //   linewidth: 1,
    //   color: 0xAAAAFF
    // })
    material: new THREE.LineDashedMaterial({ 
      gapSize: 1, 
      dashSize: 2,
      opacity: 0.6,
      transparent: true,
      linewidth: 1,
      color: 0xAA0000, 
    })

  }

  constructor(disableWorker?: boolean) {
    super(disableWorker)
  }

  protected createOutput() {
    const output = new THREE.Group()
    output.name = 'GCODE'
    return output
  }

  protected startShape() {
    const data = this.getShapeData()
    const lineGeometry = new THREE.Geometry()
    const shape = new THREE.Line(lineGeometry, data.material)
    shape.userData = { startLine: this.state.lineNo }
    this.output.add(shape)
    //console.log("new line");
    return lineGeometry
  }

  protected endShape() {
    // if(this.state.currentShape){
    //   this.state.currentShape.userData.endLine = this.state.lineNo
    // }
    const shapes = this.output.children
    if (shapes.length > 0) {
      const shape = shapes[shapes.length - 1]
      shape.userData.endLine = this.state.lineNo;
      //Needed if line dashed material
      (shape as any as THREE.Line).computeLineDistances()
    }
  }

  private getShapeData() {
    switch (this.state.moveGroup.code) {
      case ('G0'):
        return this.moveShapeData
      case ('G1'):
        return this.interpolateShapeData
      case ('G2'):
        return this.interpolateShapeData
      case ('G3'):
        return this.interpolateShapeData
    }
  }

  protected addLinearPoint(newPosition: GCodeVector, geometry: THREE.Geometry) {
    geometry.vertices.push(new THREE.Vector3(newPosition.x, newPosition.y, newPosition.z))
    //let color = getShapeData()
    //geometry.colors.push(color);
    return newPosition
  }
  protected addCurve(curve: GCodeCurve3, geometry: THREE.Geometry) {
    const vectors = curve.getPoints(50)
    for (const point of vectors) {
      geometry.vertices.push(new THREE.Vector3(point.x, point.y, point.z))
    }
    //let color = getShapeData()
    // new THREE.Vector3().fromAttribute
    // for (var i = 0; i < vectors.length; i++) {
    //   geometry.colors.push(color);
    // }
  }

  //use for 3dprinter files
  //Need a way to rename axis to use E axis as extrude parameter
  private createLinePrinter(args, position: ExtendedGCodeVector, newPosition: ExtendedGCodeVector, geometry: THREE.Geometry) {

    newPosition.e = args.E !== undefined ? args.E : position.e,
      //TODO doesn't work as expected due to changing feedrate in the middle of line.
      newPosition.extruding = (newPosition.e - position.e) > 0
    if (newPosition.extruding) {
      const color = new THREE.Color(newPosition.extruding ? 0xBBFFFF : 0xFF00FF)
      geometry.vertices.push(new THREE.Vector3(position.x, position.y, position.z))
      geometry.vertices.push(new THREE.Vector3(newPosition.x, newPosition.y, newPosition.z))
      geometry.colors.push(color)
      geometry.colors.push(color)
    }
    return newPosition
  }
}
