import { Injectable } from '@angular/core'
import { Observer, Subject } from 'rxjs'
import {
  ModelTransformer,
  Igm2GcodeTransformer,
  Gcode2ThreeTransformer,
  Gcode2IgmTransformer,
  Pdf2SvgTransformer,
  Svg2IgmTransformer,
  Dxf2IgmTransformer,
  KMXUtil,
  IGM,
  GCodeSource
} from 'camx'
import { ModelSettingsService } from './model.settings.service'
import { LogService } from '../log/log.service'
import * as THREE from 'three'

export type Payload = ArrayBuffer | SVGElement | IGM | string[] | string


//wrapper due to rxjs removal i camx. 
//Should be refactored and removed
class ModelTransformerWrapper<Source, Target> implements ModelTransformer<Source, Target>{

  constructor(private delegate: ModelTransformer<Source, Target>) {

  }
  execute(input: Source, targetObserver: Observer<Target>) {
    this.transform(input).then(output => targetObserver.next(output), err => targetObserver.error(err))
  }
  transform(source: Source): Promise<Target> {
    return this.delegate.transform(source)
  }
}

@Injectable()
export class StaticTransformer {
  gcodeSubject = new Subject<GCodeSource>()
  threeSubject = new Subject<THREE.Group>()
  svgSubject = new Subject<SVGElement>()
  igmSubject = new Subject<IGM>()
  pdf2svgTransformer: ModelTransformerWrapper<ArrayBuffer, SVGElement>
  img2gcodeTransformer: ModelTransformerWrapper<IGM, GCodeSource>
  svg2IgmTransformer: ModelTransformerWrapper<SVGElement, IGM>

  gcode2IgmTransformer: ModelTransformerWrapper<GCodeSource, IGM>
  dxf2IgmTransformer: ModelTransformerWrapper<ArrayBuffer | string, IGM>

  constructor(private logService: LogService, private modelSettings: ModelSettingsService) {
    this.pdf2svgTransformer = new ModelTransformerWrapper(new Pdf2SvgTransformer(modelSettings.settings))
    this.img2gcodeTransformer = new ModelTransformerWrapper(new Igm2GcodeTransformer(modelSettings.settings.igm))
    this.svg2IgmTransformer = new ModelTransformerWrapper(new Svg2IgmTransformer(modelSettings.settings.svg))
    this.dxf2IgmTransformer = new ModelTransformerWrapper(new Dxf2IgmTransformer(modelSettings.settings.dxf))
    this.gcode2IgmTransformer = new ModelTransformerWrapper(new Gcode2IgmTransformer(true))

    this.igmSubject.subscribe(
      igm => this.img2gcodeTransformer.execute(igm, this.gcodeSubject),
      err => console.error(err))

    this.svgSubject.subscribe(
      data => this.svg2IgmTransformer.execute(data, this.igmSubject),
      err => console.error(err))

    this.gcodeSubject.subscribe(
      gcode => new ModelTransformerWrapper(new Gcode2ThreeTransformer(true)).execute(gcode, this.threeSubject),
      err => console.error(err))
  }
  isSVG(payload: Payload, contentType: string): payload is (SVGElement | ArrayBuffer | string) {
    return contentType === 'image/svg+xml'

  }
  isDXF(payload: Payload, contentType: string): payload is (ArrayBuffer | string) {
    return contentType.toLowerCase().endsWith('.dxf')
  }

  isPDF(payload: Payload, contentType: string): payload is ArrayBuffer {
    return ['application/postscript', 'application/pdf'].indexOf(contentType) > -1 && payload instanceof ArrayBuffer
  }
  isGCode(payload: Payload): payload is ArrayBuffer | string[] | string {
    return true // payload instanceof ArrayBuffer
  }
  transform(contentType: string, payload: Payload) {
    console.log(contentType)
    if (payload instanceof IGM) {

      this.igmSubject.next(payload)

    } else if (this.isSVG(payload, contentType)) {

      const svgElement = this.asSVGElement(payload)
      this.svgSubject.next(svgElement)
      /*
          let html = (svgElement as any as HTMLElement).outerHTML    
          var blob = new Blob([html], { type: 'image/svg+xml' });
          window.open(window.URL.createObjectURL(blob));
      */
    } else if (this.isDXF(payload, contentType)) {

      this.dxf2IgmTransformer.execute(payload, this.igmSubject)

    } else if (this.isPDF(payload, contentType)) {

      this.pdf2svgTransformer.execute(payload, this.svgSubject)

    } else if (this.isGCode(payload)) {

      const gcode = this.asGCodeSource(payload)
      const testDoGcodeIGM = false
      if (testDoGcodeIGM) {
        this.gcode2IgmTransformer.execute(gcode, this.igmSubject)
      } else {
        this.gcodeSubject.next(gcode)
      }
    } else {
      throw new Error('Unsupported payload')
    }

  }

  private asSVGElement(source: string | SVGElement | ArrayBuffer): SVGElement {
    let doc: SVGElement = null

    if (source instanceof SVGElement) {
      doc = source
    } else {
      let svgstring: string = null
      if (typeof (source) === 'string') {
        svgstring = source as string
      } else if (source instanceof ArrayBuffer) {
        svgstring = KMXUtil.ab2str(source)
      } else {
        console.error('Unsupported source', source)
      }

      if ((window as any).DOMParser) {
        // clean off any preceding whitespace not sure if this is really needed
        //svgstring = svgstring.replace(/^[\n\r \t]/gm, '');
        doc = new DOMParser().parseFromString(svgstring, 'image/svg+xml').documentElement as any as SVGElement
      } else {
        console.error('DOMParser not supported. Update your browser')
      }
    }
    if (doc.localName !== 'svg') {
      this.logService.log('error', 'Failed to parse SVG document: ' + doc.textContent)
      doc = null
    }
    return doc
  }
  asGCodeSource(input: string | string[] | ArrayBuffer) {
    if (input instanceof ArrayBuffer) {
      return new GCodeSource(KMXUtil.ab2str(input))
    } else {
      return new GCodeSource(input)
    }
  }


}
