
export class SvgEditor {

  deselect: EventListener
  move: EventListener
  selectedElement: Element = null
  currentX = 0
  currentY = 0
  currentMatrix = [1, 0, 0, 1, 0, 0]

  constructor() {
    this.deselect = this.deselectElement.bind(this)
    this.move = this.moveElement.bind(this)
  }


  public selectElement = (evt) => {

    this.selectedElement = evt.target
    this.currentX = evt.clientX
    this.currentY = evt.clientY
    const transformAttr = this.selectedElement.getAttributeNS(null, 'transform')
    if (transformAttr != null) {
      const parsedMatrix = transformAttr.slice(7, -1).split(',')
      for (let i = 0; i < this.currentMatrix.length; i++) {
        this.currentMatrix[i] = parseFloat(parsedMatrix[i])
      }
    }


    this.selectedElement.addEventListener('mousemove', this.move, true)
    this.selectedElement.addEventListener('mouseout', this.deselect, true)
    this.selectedElement.addEventListener('mouseup', this.deselect, true)

  }

  public moveElement = (evt) => {
    console.log(evt)
    const dx = evt.clientX - this.currentX
    const dy = evt.clientY - this.currentY
    this.currentMatrix[4] += dx
    this.currentMatrix[5] += dy
    const newMatrix = 'matrix(' + this.currentMatrix.join(', ') + ')'

    this.selectedElement.setAttributeNS(null, 'transform', newMatrix)
    this.currentX = evt.clientX
    this.currentY = evt.clientY
  }

  public deselectElement = (evt) => {
    if (this.selectedElement != null) {
      this.selectedElement.removeEventListener('mousemove', this.move, true)
      this.selectedElement.removeEventListener('mouseout', this.deselect, true)
      this.selectedElement.removeEventListener('onmouseup', this.deselect, true)
      this.selectedElement = null
    }
  }
  augment(doc: SVGElement) {
    //http://www.petercollingridge.co.uk/interactive-svg-components/draggable-svg-element
    this.visit(doc)
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

          console.log('added eventlistener to ', tag)
          tag.setAttributeNS(null, 'pointer-events', 'all')
          tag.addEventListener('mousedown', this.selectElement, true)

        }

        // recursive call
        this.visit(tag)
      }
    }
  }
}