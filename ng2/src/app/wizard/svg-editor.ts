
// http://svgdiscovery.com

interface DragState {
  TransformRequestObj: any
  TransList: any
  DragTarget: SVGGraphicsElement
  Dragging: boolean
  OffsetX: number
  OffsetY: number
}

class Selection {
  
  private stroke: string
  private strokeWidth: string
  constructor(public element: SVGGraphicsElement){
    this.stroke = element.getAttribute('stroke'),
    this.strokeWidth= element.getAttribute('stroke-width')
  }
  highlight(){
    this.element.setAttribute('stroke', 'red')
    this.element.setAttribute('stroke-width', '3px')

  }
  reset(){
    this.element.setAttribute('stroke', this.stroke)
    this.element.setAttribute('stroke-width', this.strokeWidth)

  }
}

export class SvgEditor {

  svgDoc: SVGSVGElement
  selection: Selection[] = []

  private dragState: DragState = {
    TransformRequestObj: null,
    TransList: null,
    //let selectedTarget: SVGGraphicsElement = null
    DragTarget: null,
    Dragging: false,
    OffsetX: 0,
    OffsetY: 0

  }

  constructor() {

  }

  rotate() {

    for (const selected of this.selection) {
      const path = selected.element
      const bb = path.getBBox()
      //--the 'native' center of this element--
      const NativeCx = bb.x + .5 * bb.width
      const NativeCy = bb.y + .5 * bb.height

      //---start a transform 'request' object---
      const transformRequestObj = this.svgDoc.createSVGTransform()
      //---bind element's current transforms to a animateable transform list
      const animTransformList = path.transform
      //---get baseVal to access/place object transfoms
      const transformList = animTransformList.baseVal

      //---apply object transforms as matrix---

      //---translate coordinate system (0,0) to element's center----
      transformRequestObj.setTranslate(NativeCx, NativeCy)
      transformList.appendItem(transformRequestObj)
      transformList.consolidate()

      //---scale .8 at center----
      //transformRequestObj.setScale(.8, .8)

      //---rotate 90 degrees at center----
      transformRequestObj.setRotate(90,0,0)
      transformList.appendItem(transformRequestObj)
      transformList.consolidate()

      //---translate coordinate system back----
      transformRequestObj.setTranslate(-NativeCx, -NativeCy)
      transformList.appendItem(transformRequestObj)
      transformList.consolidate()
    }
  }

  augment(doc: SVGElement) {
    this.svgDoc = doc as SVGSVGElement
    //onmousedown="startDrag(evt)" onmousemove="svgCursor(evt);drag(evt)" onmouseup="endDrag()"
    this.svgDoc.addEventListener('mousedown', this.startDrag, true)
    this.svgDoc.addEventListener('mousemove', this.drag, true)
    this.svgDoc.addEventListener('mouseup', this.endDrag, true)
    this.svgDoc.addEventListener('click', this.select, true)
    //this.svgDoc.addEventListener('mouseleave', this.endDrag, true)
    //http://svgdiscovery.com
    this.dragState.Dragging = false
    //http://www.petercollingridge.co.uk/interactive-svg-components/draggable-svg-element

  }

  private select = (evt: MouseEvent & { target: { ownerSVGElement: any } }) => {

    if (!this.dragState.Dragging) //---prevents dragging conflicts on other draggable elements---
    {
      if (evt.target.ownerSVGElement != null) {
        const element = evt.target as SVGGraphicsElement

        if (evt.metaKey) {
          //todo deselect i already selected
        } else {
            for (const selected of this.selection) {
              selected.reset()
            }
            this.selection.splice(0)
        }
        if(this.selection.find(s => s.element === element) === undefined){
          const newSelection = new Selection(element)
          this.selection.push(newSelection)
          newSelection.highlight()
        }

        
      }
    }
  }

  //---mouse down over element---
  private startDrag = (evt: MouseEvent & { target: { ownerSVGElement: any } }) => {
    console.log('startdrag')
    if (!this.dragState.Dragging) //---prevents dragging conflicts on other draggable elements---
    {
      //console.log(evt.target)
      if (evt.target.ownerSVGElement != null) {
        this.dragState.DragTarget = evt.target as SVGGraphicsElement
        //console.log(this.dragState.DragTarget)
        this.dragState.DragTarget.setAttribute('style', 'cursor:move')
        //---reference point to its respective viewport--
        const pnt = this.dragState.DragTarget.ownerSVGElement.createSVGPoint()
        pnt.x = evt.clientX
        pnt.y = evt.clientY
        //---elements transformed and/or in different(svg) viewports---
        const sCTM = this.dragState.DragTarget.getScreenCTM()
        const Pnt = pnt.matrixTransform(sCTM.inverse())

        this.dragState.TransformRequestObj = this.dragState.DragTarget.ownerSVGElement.createSVGTransform()
        //---attach new or existing transform to element, init its transform list---
        const myTransListAnim = this.dragState.DragTarget.transform
        this.dragState.TransList = myTransListAnim.baseVal

        this.dragState.OffsetX = Pnt.x
        this.dragState.OffsetY = Pnt.y

        this.dragState.Dragging = true
      }
    }
  }
  //---mouse move---
  private drag = (evt: MouseEvent) => {
    if (this.dragState.Dragging) {
      console.log('drags')
      const pnt = this.dragState.DragTarget.ownerSVGElement.createSVGPoint()
      pnt.x = evt.clientX
      pnt.y = evt.clientY
      //---elements in different(svg) viewports, and/or transformed ---
      const sCTM = this.dragState.DragTarget.getScreenCTM()
      const Pnt = pnt.matrixTransform(sCTM.inverse())
      Pnt.x -= this.dragState.OffsetX
      Pnt.y -= this.dragState.OffsetY

      this.dragState.TransformRequestObj.setTranslate(Pnt.x, Pnt.y)
      this.dragState.TransList.appendItem(this.dragState.TransformRequestObj)
      this.dragState.TransList.consolidate()
    }
  }
  //--mouse up---
  private endDrag = () => {
    console.log('enddrag')
    this.dragState.Dragging = false
    if (this.dragState.DragTarget) {
      this.dragState.DragTarget.setAttribute('style', 'cursor:default')
    }

  }

}