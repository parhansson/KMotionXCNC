import * as THREE from 'three'

// Find mouse intersection objects!
export class RaycastDetector {
  private currentObject: any //THREE.Object3D;
  private previousPoint = new THREE.Vector3(0, 0, 0)
  private raycaster = new THREE.Raycaster()


  constructor(private markerObject: THREE.Mesh, private camera: THREE.Camera, private parentObject: THREE.Group) {
    this.raycaster.linePrecision = 0.5
    markerObject.visible = false
  }

  detect(mouseVector) {
    //save previous intersected object
    const prevIntersect = this.currentObject
    this.previousPoint.copy(this.markerObject.position)

    //reset linewidth
    if (this.currentObject !== undefined) {
      this.currentObject.material.linewidth = 1
    }

    // find intersections
    this.raycaster.setFromCamera(mouseVector, this.camera)
    const intersects = this.raycaster.intersectObjects(this.parentObject.children, true)

    if (intersects.length > 0) {
      this.markerObject.visible = true

      this.currentObject = intersects[0].object
      this.currentObject.material.linewidth = 5

      //ensure intersected object is not marker sphere
      if (this.markerObject !== this.currentObject) {
        if (Object.getOwnPropertyNames(this.currentObject.userData).length > 0) {
          console.log(this.currentObject.userData)
        }
        //console.info(intersects[ 0 ].point);
        this.markerObject.position.copy(intersects[0].point)
      }

    } else {
      this.markerObject.visible = false
      this.currentObject = undefined
    }

    if (prevIntersect !== this.currentObject) {
      //intersected object changed
      return true
    }
    if (!this.previousPoint.equals(this.markerObject.position)) {
      //intersected position changed
      return true
    }
    return false
  }
}