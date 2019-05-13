import { Component, ViewChild, SkipSelf, Inject } from '@angular/core'
import { SocketService } from '../backend/socket.service'
import { KmxStatus } from '../hal/kflop'
import { ThreeViewComponent } from './view.component'
import { StaticTransformer } from '../model/transformers'
import { SettingsService, Machine } from '../settings/settings.service'
import { GCodeEditorComponent } from './gcode-editor.component'
import * as THREE from 'three'

@Component({
  selector: 'gcode-screen',
  template: `
    <div class="row  fill">
      <div class="hidden-xs col-md-3">
        <kmx-dro></kmx-dro>
        <kmx-log title="Error log" consoleId="error"></kmx-log>
        <kmx-log title="Console" consoleId="console"></kmx-log>
      </div>
      <div class="col-xs-9 col-md-6">
        <!-- WebGL rendering area -->
        <three-viewer class="threerenderer fill"></three-viewer>
      </div>
      <div class="col-xs-3 col-md-3">
        <control-buttons></control-buttons>
        <div>Current line:{{kmxStatus?.currentLine +1}}</div>
        <gcode-editor></gcode-editor>
        <hr>
        <user-defined-buttons></user-defined-buttons>
      </div>
    </div>  
  `,
  styles: [
    `
    .threerenderer {
      background-color: #EEEEEE;
      height: 600px;
      display: block;
    }
    `,
    '.fill { min-height: 100%;}'
  ]
})
export class GCodeScreenComponent {
  @ViewChild(ThreeViewComponent)
  threeComp: ThreeViewComponent
  @ViewChild(GCodeEditorComponent)
  editorComponent: GCodeEditorComponent
  kmxStatus: KmxStatus

  constructor(socketService: SocketService,
    private settingsService: SettingsService,
    private staticTransformer: StaticTransformer) {
    socketService.status.subscribe(status => {
      this.kmxStatus = status
    })
  }
  ngAfterViewInit() {
    this.staticTransformer.threeSubject.subscribe(data => this.threeComp.model = data)
    this.settingsService.subject.subscribe((machine) => this.renderMachineObject(machine))
  }

  private machineBounds: THREE.Object3D = null
  private machineBackground: THREE.Object3D = null
  private machineGrid: THREE.Object3D = null

  renderMachineObject(machine: Machine) {

    if (this.machineGrid != null) {
      this.threeComp.removeAuxObject(this.machineGrid)
    }
    if (this.machineBounds != null) {
      this.threeComp.removeAuxObject(this.machineBounds)
    }
    if (this.machineBackground != null) {
      this.threeComp.removeAuxObject(this.machineBackground)
    }
    //In 3d viev everything is mm and not inches
    //however currently all stored values are in inches
    const x = +machine.dimX * 25.4
    const y = +machine.dimY * 25.4
    const z = +machine.dimZ * 25.4

    this.machineBounds = this.createMachineBounds(x, y, z)
    this.machineBackground = this.renderBackground(x, y, z)
    this.machineGrid = this.renderGrid(x, y, z)
    this.threeComp.addAuxObject(this.machineBounds)
    this.threeComp.addAuxObject(this.machineBackground)
    this.threeComp.addAuxObject(this.machineGrid)
    
    this.threeComp.requestTick()

  }
  private createMachineBounds(x, y, z) {

    const boxGeom = new THREE.BoxGeometry(x, y, z)
    boxGeom.translate(x / 2, y / 2, z / 2)
    const material = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1, opacity: 0.5 })
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(boxGeom as any, undefined),
      material)
    return edges
  }
  
  private renderGrid(x, y, z):THREE.Object3D{
    const sizeX = x
    const sizeY = y
    const step = 10

    const geometry = new THREE.Geometry()
    const material = new THREE.LineBasicMaterial( { color: 0x999999, opacity: 0.7, linewidth:1 } )

    for ( let i = -sizeY; i <= sizeY; i += step ) {

        geometry.vertices.push( new THREE.Vector3( - sizeX, i,0 ) )
        geometry.vertices.push( new THREE.Vector3(   sizeX, i,0 ) )

    }
    for ( let i = -sizeX; i <= sizeX; i += step ) {

        geometry.vertices.push( new THREE.Vector3( i, -sizeY,0 ) )
        geometry.vertices.push( new THREE.Vector3( i,   sizeY , 0) )

    }

    geometry.translate(x / 2, y / 2, 0)
    const line = new THREE.LineSegments( geometry, material)
    return line
  }

  private renderBackground(x, y, z) {

    const texture = new THREE.TextureLoader().load('/settings/textures/bghoneym.png')


    // assuming you want the texture to repeat in both directions:
    //texture.wrapS = THREE.RepeatWrapping; 
    //texture.wrapT = THREE.RepeatWrapping;

    // how many times to repeat in each direction; the default is (1,1),
    //   which is probably why your example wasn't working
    //texture.repeat.set( 4, 4 ); 

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.3
    })
    const geometry = new THREE.PlaneGeometry(x, y)
    geometry.translate(x / 2, y / 2, 0)
    const mesh = new THREE.Mesh(geometry, material)
    return mesh

  }

}