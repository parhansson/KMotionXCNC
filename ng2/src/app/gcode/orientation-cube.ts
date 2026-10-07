import * as THREE from 'three'
import {baseUrl} from '../../main'
export class OrientationCube {
  CANVAS_WIDTH = 400
  CANVAS_HEIGHT = 400
  CAM_DISTANCE = 200
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera

  constructor(private syncCamera: THREE.Camera, private domElement: HTMLElement) {

    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true })
    this.scene = new THREE.Scene()
    // camera
    this.camera = new THREE.PerspectiveCamera(50, this.CANVAS_WIDTH / this.CANVAS_HEIGHT, 1, 1000)
    this.camera.up = syncCamera.up // important!

    // renderer
    this.renderer.setSize(this.CANVAS_WIDTH, this.CANVAS_HEIGHT)
    this.renderer.domElement.style.cssText =
      'width: 150px;height: 150px;' +
      //'background-color: transparent;'+ 
      'margin: 10px;' +
      'padding: 0px;' +
      'position: absolute;' +
      'right: 0px;' +
      'top: -20px;' +
      'z-index: 100;'
    //'border: 1px solid black; /* or none; */';
    domElement.appendChild(this.renderer.domElement)
    this.createCube(this.scene)
  }
  
  render(newPosition: THREE.Vector3) {
    this.camera.position.copy(this.syncCamera.position)
    this.camera.position.sub(newPosition)
    this.camera.position.setLength(this.CAM_DISTANCE)
    this.camera.lookAt(this.scene.position)
    //console.log(this.camera.position)
    this.renderer.render(this.scene, this.camera)
  }

  createCube(scene: THREE.Scene) { // create an array with six textures for a cool cube
    new THREE.TextureLoader().load(baseUrl + '/settings/textures/textures.png', (texture: THREE.Texture) => {
      //let material = new THREE.MeshPhongMaterial( { map: THREE.ImageUtils.loadTexture('images/box-atlas.png') } );
      const material = new THREE.MeshBasicMaterial({
        map: texture
      })

      const size = 50
      const geometry = new THREE.BoxGeometry(size, size, size, 1, 1, 1)
      geometry.faceVertexUvs[0] = []
      const textPercent = 0.125
      let LU = -textPercent
      let RU = 0
      let i = 0
      for (let t = 0; t < 6; t++) {
        LU += textPercent; RU += textPercent
        const pos = [new THREE.Vector2(LU, 1), new THREE.Vector2(LU, 0), new THREE.Vector2(RU, 0), new THREE.Vector2(RU, 1)]
        LU += textPercent; RU += textPercent
        const neg = [new THREE.Vector2(LU, 1), new THREE.Vector2(LU, 0), new THREE.Vector2(RU, 0), new THREE.Vector2(RU, 1)]
        geometry.faceVertexUvs[0][i++] = [pos[0], pos[1], pos[3]]
        geometry.faceVertexUvs[0][i++] = [pos[1], pos[2], pos[3]]
        geometry.faceVertexUvs[0][i++] = [neg[0], neg[1], neg[3]]
        geometry.faceVertexUvs[0][i++] = [neg[1], neg[2], neg[3]]
      }
      const mesh = new THREE.Mesh(geometry, material)
      //console.log(mesh.toJSON());
      scene.add(mesh)

    })

    // add axes
    const radius = 80
    scene.add(new THREE.AxesHelper(radius))

    /* 
    let segments = 32; 
    let material = new THREE.LineBasicMaterial({
        opacity: 0.6,
        transparent: true,
        linewidth: 1,
        color: 0x0000ff
      });
      
    let radians = THREE.Math.degToRad( 90 ); //90 * Math.PI / 180   
    let segments = 64,
    c1 = new THREE.CircleGeometry( radius, segments ),
    c2 = new THREE.CircleGeometry( radius, segments ),
    c3 = new THREE.CircleGeometry( radius, segments );
    c2.rotateY(radians);
    c3.rotateX(radians);
    // Remove center vertex
    c1.vertices.shift();
    c2.vertices.shift();
    c3.vertices.shift();
    scene.add( new THREE.Line( c1, material ) );
    scene.add( new THREE.Line( c2, material ) );
    scene.add( new THREE.Line( c3, material ) );
    */
  }
}