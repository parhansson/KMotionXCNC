
//http://svg-whiz.com/svg/DragAndDropGroup.svg
/*
http://svg-whiz.com/svg/DragAndDrop.svg
<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" onload="Init(evt)" onmousedown="Grab(evt)" onmousemove="Drag(evt)" onmouseup="Drop(evt)">

   <title>Drag And Drop</title>

   <desc>
      A nice little demo of drag-and-drop functionality in SVG,
      written by Doug Schepers on February 16, 2004.
      Use or misuse this code however you wish.
   </desc>

   <rect id="BackDrop" x="-10%" y="-10%" width="110%" height="110%" fill="none" pointer-events="all"/>

   <circle id="BlueCircle" cx="25" cy="25" r="20" style="fill:blue; "/>
   
   <text id="DraggableText" x="20" y="200" style="fill:red; font-size:18px; font-weight:bold;">Draggable Text</text>

   <g id="Folder">
      
   <rect id="GreenRectangle" x="50" y="70" width="100" height="100" style="fill:green; " pointer-events="all" transform="translate(105,4)"/><rect id="FolderRectangle" x="300" y="100" width="200" height="150" style="fill:tan; stroke:brown; stroke-width:3;" pointer-events="all" transform="translate(29,-42)"/><circle id="OrangeCircle" cx="225" cy="25" r="20" style="fill:orange; " pointer-events="all" transform="translate(-113,95)"/><circle id="RedCircle" cx="125" cy="25" r="20" style="fill:red; " pointer-events="all" transform="translate(271,102)"/></g>

</svg>
*/
export class SvgEditor2 {


  svgDoc: SVGSVGElement = null
  svgRoot: SVGSVGElement = null
  TrueCoords = { x: 0, y: 0 }
  GrabPoint = { x: 0, y: 0 }
  BackDrop: Element = null
  DragTarget: SVGGraphicsElement = null

  constructor(doc: SVGSVGElement/*evt*/) {


    //svgDoc = evt.target.ownerDocument
    //svgRoot = svgDoc.documentElement
    this.svgDoc = doc
    this.svgRoot = doc


    // these svg points hold x and y values...
    //    very handy, but they do not display on the screen (just so you know)
    this.TrueCoords = this.svgRoot.createSVGPoint()
    this.GrabPoint = this.svgRoot.createSVGPoint()

    // this will serve as the canvas over which items are dragged.
    //    having the drag events occur on the mousemove over a backdrop
    //    (instead of the dragged element) prevents the dragged element
    //    from being inadvertantly dropped when the mouse is moved rapidly
    this.BackDrop = this.svgRoot.getElementById('BackDrop')

    this.svgDoc.addEventListener('mousedown', this.Grab, true)
    this.svgDoc.addEventListener('mousemove', this.Drag, true)
    this.svgDoc.addEventListener('mouseup', this.Drop, true)
    this.svgDoc.addEventListener('mouseleave', this.Leave, true)
    //this.svgDoc.addEventListener('click', this.select, true)
  }
  private Leave = (evt: MouseEvent & { target: SVGGraphicsElement & { ownerSVGElement: any } }) => {
    if(this.svgRoot == evt.target){
      this.Drop(evt)
    }
  }
  private Grab = (evt: MouseEvent & { target: SVGGraphicsElement & { ownerSVGElement: any } }) => {
    // find out which element we moused down on
    const targetElement = evt.target

    // you cannot drag the background itself, so ignore any attempts to mouse down on it
    if (this.BackDrop != targetElement) {
      //set the item moused down on as the element to be dragged
      this.DragTarget = targetElement

      // move this element to the "top" of the display, so it is (almost)
      //    always over other elements (exception: in this case, elements that are
      //    "in the folder" (children of the folder group) with only maintain
      //    hierarchy within that group
      this.DragTarget.parentNode.appendChild(this.DragTarget)

      // turn off all pointer events to the dragged element, this does 2 things:
      //    1) allows us to drag text elements without selecting the text
      //    2) allows us to find out where the dragged element is dropped (see Drop)
      this.DragTarget.setAttributeNS(null, 'pointer-events', 'none')

      // we need to find the current position and translation of the grabbed element,
      //    so that we only apply the differential between the current location
      //    and the new location
      const transMatrix = this.DragTarget.getCTM()
      this.GrabPoint.x = this.TrueCoords.x - Number(transMatrix.e)
      this.GrabPoint.y = this.TrueCoords.y - Number(transMatrix.f)

    }
  }


  private Drag = (evt: MouseEvent) => {
    // account for zooming and panning
    this.GetTrueCoords(evt)

    // if we don't currently have an element in tow, don't do anything
    if (this.DragTarget) {
      // account for the offset between the element's origin and the
      //    exact place we grabbed it... this way, the drag will look more natural
      const newX = this.TrueCoords.x - this.GrabPoint.x
      const newY = this.TrueCoords.y - this.GrabPoint.y

      // apply a new tranform translation to the dragged element, to display
      //    it in its new location
      this.DragTarget.setAttributeNS(null, 'transform', 'translate(' + newX + ',' + newY + ')')
    }
  }


  private Drop = (evt: MouseEvent & { target: SVGElement }) => {
    // if we aren't currently dragging an element, don't do anything
    if (this.DragTarget) {
      // since the element currently being dragged has its pointer-events turned off,
      //    we are afforded the opportunity to find out the element it's being dropped on
      const targetElement: SVGElement = evt.target

      // turn the pointer-events back on, so we can grab this item later
      this.DragTarget.setAttributeNS(null, 'pointer-events', 'all')
      if ('Folder' == (targetElement.parentNode as SVGElement).id) {
        // if the dragged element is dropped on an element that is a child
        //    of the folder group, it is inserted as a child of that group
        targetElement.parentNode.appendChild(this.DragTarget)
        console.log(this.DragTarget.id + ' has been dropped into a folder, and has been inserted as a child of the containing group.')
      }
      else {
        // for this example, you cannot drag an item out of the folder once it's in there;
        //    however, you could just as easily do so here
        console.log(this.DragTarget.id + ' has been dropped on top of ' + targetElement.id)
      }

      // set the global variable to null, so nothing will be dragged until we
      //    grab the next element
      this.DragTarget = null
    }
  }


  private GetTrueCoords(evt: MouseEvent) {
    // find the current zoom level and pan setting, and adjust the reported
    //    mouse position accordingly
    const newScale = this.svgRoot.currentScale
    const translation = this.svgRoot.currentTranslate
    this.TrueCoords.x = (evt.clientX - translation.x) / newScale
    this.TrueCoords.y = (evt.clientY - translation.y) / newScale
  }

}