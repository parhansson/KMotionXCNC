
interface Selection {
  X: number,
  Y: number,
  Matrix: number[]

}
export class SvgEditor {

  svgDoc:SVGElement
  selectedElement: Element = null
  private current: Selection

  constructor() {

  }


  private selectElement: EventListener = (evt: MouseEvent) => {

    this.selectedElement = evt.target as Element
    
    this.current = {
      Matrix: [1, 0, 0, 1, 0, 0],
      X: evt.clientX,
      Y: evt.clientY
    }
    const transformAttr = this.selectedElement.getAttributeNS(null, 'transform')
    if (transformAttr != null) {
      this.current.Matrix = transformAttr.slice(7, -1).split(',').map(v => parseFloat(v))
    }
    
    this.selectedElement.addEventListener('mousemove', this.moveElement, true)
    this.selectedElement.addEventListener('mouseout', this.deselectElement, true)
    this.selectedElement.addEventListener('mouseup', this.deselectElement, true)
    
    //Moves element on top
    this.svgDoc.appendChild(this.selectedElement)
  }

  private moveElement: EventListener = (evt: MouseEvent) => {
    //console.log(evt)
    const dx = evt.clientX - this.current.X
    const dy = evt.clientY - this.current.Y
    this.current.Matrix[4] += dx
    this.current.Matrix[5] += dy
    const newMatrix = 'matrix(' + this.current.Matrix.join(', ') + ')'

    this.selectedElement.setAttributeNS(null, 'transform', newMatrix)
    this.current.X = evt.clientX
    this.current.Y = evt.clientY
  }

  private deselectElement:EventListener = (evt: MouseEvent) => {
    if (this.selectedElement != null) {
      this.selectedElement.removeEventListener('mousemove', this.moveElement, true)
      this.selectedElement.removeEventListener('mouseout', this.deselectElement, true)
      this.selectedElement.removeEventListener('onmouseup', this.deselectElement, true)
      this.selectedElement = null
    }
  }
  augment(doc: SVGElement) {
    this.svgDoc = doc
    //http://www.petercollingridge.co.uk/interactive-svg-components/draggable-svg-element
    this.visit(this.svgDoc)
  }

  visit(currentElement: SVGElement) {
    /*
    if (!this.elementFilter(domNode)) {
      return;
    }
    */
    //domNode.childNodes will not return text nodes
    for (let i = 0; i < currentElement.childNodes.length; i++) {
      const tag = currentElement.childNodes.item(i) as SVGElement
      if (tag.childNodes) {

        // exclude textnodes, might check for tag.nodeName ===  "#text" or tag.nodeType === 3 instead
        // but that would include to check several types
        if (tag.localName) {
          // we are looping here through
          // all nodes with child nodes
          // others are irrelevant

          //console.log('added eventlistener to ', tag)
          tag.setAttributeNS(null, 'pointer-events', 'all')
          tag.addEventListener('mousedown', this.selectElement, true)

        }

        // recursive call
        this.visit(tag)
      }
    }
  }
}