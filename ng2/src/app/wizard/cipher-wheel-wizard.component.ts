import { Component, Inject, Input, Output, ViewChild, ElementRef } from '@angular/core'
import { SvgPreviewComponent } from './svg-preview.component'


@Component({
  selector: 'cipher-wheel-wizard',
  template: `
<div>
  <div class="form-group">
      <label>Letters on dial</label>
      <div class="input-group">
        <input class="form-control" [(ngModel)]="letters" placeholder="Enter text">
      </div>
  </div>
  <div class="form-group">
      <label>Diameter</label>
      <div class="input-group">
        <input class="form-control" [(ngModel)]="size" type="number" min=1 max=1000 placeholder="Diameter">
        <div class="input-group-append">
          <div class="input-group-text">mm</div>
        </div>
      </div>
  </div>
  <button (click)="renderDial()">Dial</button>
  <button (click)="renderKey()">Key</button>
    <svg-preview></svg-preview>
</div>
  `
})
export class ChipherWheelWizardComponent {

  @ViewChild(SvgPreviewComponent, {static: false})
  private previewContainer: SvgPreviewComponent

  letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ'
  size: number = 400

  constructor() {

  }


  renderDial() {
    const svg = this.toSVG(this.size/2, this.letters, true)
    this.previewContainer.render(svg)
  }
  renderKey() {
    const svg = this.toSVG(this.size/2, this.letters, false)
    this.previewContainer.render(svg)
  }

  polarToCartesian(centerX, centerY, radius, angleInDegrees) {
    const angleInRadians = (angleInDegrees-90) * Math.PI / 180.0
  
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    }
  }
  
  describeArc(x, y, radius:number, startAngle, endAngle, lineto = false){
  
      const start = this.polarToCartesian(x, y, radius, endAngle)
      const end = this.polarToCartesian(x, y, radius, startAngle)
  
      const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  
      const d = [
          (lineto?'L':'M'), start.x, start.y, 
          'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y
      ].join(' ')
  
      return d    
  }


  toSVG(radius: number, letters:string, dialRing:boolean) {
    let svg = ''
    const res = 1
    const w = radius*2
    const h = radius*2
    const dpi = 72 //output DPI
    const dpiScale = dpi / 25.4 // assuming input model in mm not in inches
    svg += '<?xml version="1.0" standalone="no"?>\r\n'
    svg += '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\r\n'
    svg += '<svg width="' + w / res + 'mm" height="' + h / res + 'mm" viewBox="0 0 ' + w * dpiScale + ' ' + h * dpiScale + '" xmlns="http://www.w3.org/2000/svg" version="1.1">\r\n'
    
    
    const slices = letters.length
    const sliceangle = 360/slices
    const center ={ x: w/2, y: h/2}
    if(dialRing){

      for (let i = 0; i < slices;i++) {
        const startangle = i*sliceangle
        const endangle = (i+1)*sliceangle
        const arc = this.describeArc(center.x,center.y,radius,startangle, endangle)
        const centerringpoint = this.polarToCartesian(center.x,center.y,radius-50,startangle)
        
        svg += `<path d="${arc} L${centerringpoint.x} ${centerringpoint.y}" fill="none" stroke="#446688" stroke-width="0.2" />`
        const textangle = startangle + sliceangle/2
        const textpoint = this.polarToCartesian(center.x,center.y,radius-15,textangle)
        const letter = letters.charAt(i)
        svg += `<text dominant-baseline="middle" text-anchor="middle" font-size="20" font-family="Arial" x="0" y="0" transform="translate(${textpoint.x},${textpoint.y}) rotate(${textangle})">${letter}</text>`
        
        const numberpoint = this.polarToCartesian(center.x,center.y,radius-35,textangle)
        const number = (i+10)%slices + 1
        svg += `<text dominant-baseline="middle" text-anchor="middle" font-size="14" font-family="Arial" x="0" y="0" transform="translate(${numberpoint.x},${numberpoint.y}) rotate(${textangle})">${number}</text>`
      }
    } else {
      const outerdialarc = this.describeArc(center.x,center.y,radius, sliceangle, 360)
      const innerdialarc = this.describeArc(center.x,center.y,radius-50, 360,sliceangle, true)
      
      svg += `<path d="${outerdialarc} ${innerdialarc} Z" fill="none" stroke="black" stroke-width="0.3" />`

    }

    
    //center mark
    svg += `<circle cx="${center.x}" cy="${center.y}" r="4" stroke="black" stroke-width="0.3" fill="red" />`
    //cut out
    svg += `<circle cx="${center.x}" cy="${center.y}" r="${radius}" stroke="black" stroke-width="0.3" fill="none" />`
    svg += ('</svg>\r\n')
    return svg
  }
}