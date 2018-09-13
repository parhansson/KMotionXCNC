
import { Component, ElementRef, HostListener, AfterViewInit } from '@angular/core'
import { OrientationCube } from './orientation-cube'
import { RaycastDetector } from './raycast-detector'

import * as THREE from 'three'
import 'three/three-trackballcontrols' //aliased in webpack config and loaded with import-loader

@Component({
  selector: 'three-viewer',
  // template: `
  //     <div (window:resize)="onResize2($event)">
  //     </div>    
  //   `
  template: ''
})
export class ThreeViewComponent implements AfterViewInit {
  private renderer: THREE.WebGLRenderer
  private camera: THREE.PerspectiveCamera
  private controls: THREE.TrackballControls
  private scene: THREE.Scene
  private element: HTMLElement
  private mouseDown = false
  private ticking = false
  private orientation: OrientationCube
  private modelDetector: RaycastDetector
  private machineDetector: RaycastDetector
  private modelGroup = new THREE.Group()
  private auxiliaryGroup = new THREE.Group()
  private currentModelObject: THREE.Object3D = null

  constructor(elRef: ElementRef) {
    this.element = elRef.nativeElement
  }

  ngAfterViewInit() {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ /*canvas: this.element.firstChild,*/ antialias: true, clearColor: 0x000000, alpha: true })

    this.element.appendChild(this.renderer.domElement)

    this.renderer.clear()

    
    // Camera...
    const fov = 45,
    aspect = this.width() / this.height(), //this will return NaN right now
    near = 1,
    far = 10000
    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far)
    //camera.rotationAutoUpdate = true;
    this.camera.position.x = 150
    this.camera.position.y = 100
    this.camera.position.z = 500
    const center = new THREE.Vector3(150, 100, 0)
    this.camera.lookAt(center)

    //Scene
    this.scene = new THREE.Scene()
    //camera.up = new THREE.Vector3( 0, 0, 0 );
    this.scene.add(this.camera)
    this.scene.add(this.auxiliaryGroup)
    this.scene.add(this.modelGroup)

    this.controls = new THREE.TrackballControls(this.camera, this.element)
    //controls.noPan = false;
    this.controls.minDistance = 10
    this.controls.maxDistance = 10000
    this.controls.dynamicDampingFactor = 0.15
    this.controls.target0 = center
    this.controls.reset()

    this.orientation = new OrientationCube(this.camera, this.element)

    //Logic
    const cursor = new THREE.Mesh(new THREE.SphereGeometry(1), new THREE.MeshBasicMaterial({ color: 0xff0000 }))
    this.scene.add(cursor)
    this.modelDetector = new RaycastDetector(cursor, this.camera, this.modelGroup)
    this.machineDetector = new RaycastDetector(cursor, this.camera, this.auxiliaryGroup);
    // Lights...
    [[0, 0, 1, 0xFFFFCC],
    [0, 1, 0, 0xFFCCFF],
    [1, 0, 0, 0xCCFFFF],
    [0, 0, -1, 0xCCCCFF],
    [0, -1, 0, 0xCCFFCC],
    [-1, 0, 0, 0xFFCCCC]].forEach((position) => {
      const light = new THREE.DirectionalLight(position[3])
      light.position.set(position[0], position[1], position[2]).normalize()
      this.scene.add(light)
    })

    this.onResize(null)
    //render 
    this.requestTick()

    window.addEventListener('resize', this.onResize.bind(this))
    this.controls.addEventListener('start', this.onControlsEvent.bind(this))
    this.controls.addEventListener('change', this.onControlsEvent.bind(this))
    this.controls.addEventListener('end', this.onControlsEvent.bind(this))

    /*
element.on( 'mouseenter', function(){
  //requestTick();
});
element.on( 'mouseleave', function(){
  //ticking = false;
});      
*/

  }

  set model(model: THREE.Object3D) {
    if (this.currentModelObject !== null) {
      this.modelGroup.remove(this.currentModelObject)
    }
    this.currentModelObject = model
    this.modelGroup.add(this.currentModelObject)
    this.requestTick()
  }

  addAuxObject(object: THREE.Object3D) {
    this.auxiliaryGroup.add(object)
  }
  removeAuxObject(object: THREE.Object3D) {
    this.auxiliaryGroup.remove(object)
  }

  @HostListener('mouseup', ['false'])
  @HostListener('mousedown', ['true'])
  onMouseButton(mouseDown: boolean) {
    this.mouseDown = mouseDown
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event) {
    event.preventDefault()
    const mouseVector = this.getMouseVector(event)
    const intersectionChanged = this.modelDetector.detect(mouseVector) || this.machineDetector.detect(mouseVector)

    if (intersectionChanged) {
      //object detected
      this.requestTick()
    }
    if (this.mouseDown) {
      //orbiting view with mouse or touch pad
      this.requestTick()
    }
  }

  requestTick() {
    //debounce multiple requests
    if (!this.ticking) {
      requestAnimationFrame(this.animate.bind(this))
    }
    this.ticking = true
  }


  onControlsEvent(event: THREE.Event) {
    this.requestTick()
  }

  //Due to bug? in three scene does not dispatch events.
  //It is the added object that dispatches the even. TODO Bug report.
  //scene.addEventListener('added', onSceneEvent);
  //scene.addEventListener('removed', onSceneEvent);
  //function onSceneEvent(event){
  //  requestTick();
  //}

  width() {
    return this.element.offsetWidth
  }
  height() {
    return this.element.offsetHeight
  }

  animate() {
    // reset the tick so we can capture the next event
    this.ticking = false
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
    this.orientation.render(this.controls.target)
    //console.log('animate');
  }

  onResize(event) {
    const height = this.height()//elem.height();
    const width = this.width()
    this.renderer.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.controls.screen.width = width //window.innerWidth;
    this.controls.screen.height = height// window.innerHeight;
    //this.requestTick()
  }

  private getMouseVector(event) {
    const height = this.height()
    const width = this.width()
    // calculate mouse position in normalized device coordinates
    // (-1 to +1) for both components
    const elementXPosition = (event.offsetX != null) ? event.offsetX : event.originalEvent.layerX
    const elementYPosition = (event.offsetY != null) ? event.offsetY : event.originalEvent.layerY
    const mouse = new THREE.Vector2()
    mouse.x = (elementXPosition / width) * 2 - 1
    mouse.y = - (elementYPosition / height) * 2 + 1
    //console.info('mouse.x mouse.y %',mouse.x ,mouse.y);
    //console.info('mouse.x mouse.y',elementXPosition ,elementYPosition);
    /*
    var mouse3d = new THREE.Vector3(0,0,0);
    mouse3d.x = mouse.x;
    mouse3d.y = mouse.y;
    mouse3d.z = 0.5; 
    mouse3d.unproject(camera);
    */
    return mouse
  }

}










