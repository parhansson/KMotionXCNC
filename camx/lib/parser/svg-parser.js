var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { FontLoaderService } from '../util';
export class SvgNode {
    constructor() {
        this.xformToWorld = [1, 0, 0, 1, 0, 0]; //2d Transformation vector
        this.xform = [1, 0, 0, 1, 0, 0]; //2d Transformation vector
        this.defs = false;
        this.text = null;
        this.fontSize = 1;
        this.path = [];
        this.children = [];
    }
    clone() {
        const node = new SvgNode();
        node.path = [];
        node.xform = [1, 0, 0, 1, 0, 0];
        node.opacity = this.opacity;
        node.display = this.display;
        node.visibility = this.visibility;
        node.fill = this.fill;
        node.stroke = this.stroke;
        node.color = this.color;
        node.fillOpacity = this.fillOpacity;
        node.strokeOpacity = this.strokeOpacity;
        node.fontSize = this.fontSize;
        node.fontFamily = this.fontFamily;
        node.fontStyle = this.fontStyle;
        node.defs = this.defs;
        node.unsupported = this.unsupported;
        node.text = null; //cannot inherit text
        return node;
    }
    inherit() {
        const node = this.clone();
        this.children.push(node);
        return node;
    }
}
class SVGElementWalker {
    constructor(elementFilter) {
        this.elementFilter = elementFilter;
    }
    accept(parentElement, parentData) {
        return __awaiter(this, void 0, void 0, function* () {
            //domNode.childNodes will not return text node
            for (let i = 0; i < parentElement.children.length; i++) {
                const element = parentElement.children.item(i);
                if (!this.elementFilter(element)) {
                    continue;
                }
                const resultData = yield this.onElement(element, parentData);
                // recursive call
                yield this.accept(element, resultData);
            }
        });
    }
}
/**
 * SVG parser for the Lasersaur.
 * Converts SVG DOM to a flat collection of paths.
 *
 * Copyright (c) 2011 Nortd Labs
 * Open Source by the terms of the Gnu Public License (GPL3) or higher.
 *
 * Code inspired by cake.js, canvg.js, svg2obj.py, and Squirtle.
 * Thank you for open sourcing your work!
 *
 * Usage:
 *  var boundarys = SVGReader.parse(svgstring, config)
 *
 * Features:
 *   <svg> width and height, viewBox clipping.
 *   paths, rectangles, ellipses, circles, lines, polylines and polygons
 *   nested transforms
 *   transform lists (transform="rotate(30) translate(2,2) scale(4)")
 *   non-pixel units (cm, mm, in, pt, pc)
 *   'style' attribute and presentation attributes
 *   curves, arcs, cirles, ellipses tesellated according to tolerance
 *
 * Intentinally not Supported:
 *   markers
 *   masking
 *   em, ex, % units
 *   text (needs to be converted to paths)
 *   raster images
 *   style sheets
 *
 * ToDo:
 *   check for out of bounds geometry
 *   Only basic text rendering is currently supported
 *   Load different fonts
 *   complete defs an use
 */
export class SvgParser extends SVGElementWalker {
    constructor(elementFilter, renderText) {
        super(elementFilter);
        this.renderText = renderText;
        this.fontService = new FontLoaderService();
        this.DEG_TO_RAD = Math.PI / 180;
        this.RAD_TO_DEG = 180 / Math.PI;
        this.globalNodes = {};
        // output path flattened (world coords)
        // hash of path by color
        // each path is a list of subpaths
        // each subpath is a list of verteces
        this.style = {};
        // style at current parsing position
        this.tolerance = 0.1;
        /////////////////////////////
        // recognized svg attributes
        this.SVGAttributeMapping = {
            'id': (node, val, element) => {
                node.id = val;
                this.globalNodes['#' + val] = node;
            },
            'transform': (node, val) => {
                // http://www.w3.org/TR/SVG11/coords.html#EstablishingANewUserSpace
                const xforms = [];
                const segs = val.match(/[a-z]+\s*\([^)]*\)/ig);
                for (const seg of segs) {
                    const kv = seg.split('(');
                    const xformKind = this.strip(kv[0]);
                    const paramsTemp = this.strip(kv[1]).slice(0, -1);
                    const params = paramsTemp.split(/[\s,]+/).map(parseFloat);
                    // double check params
                    for (const param of params) {
                        if (isNaN(param)) {
                            console.warn('warning', 'transform skipped; contains non-numbers');
                            continue; // skip this transform
                        }
                    }
                    // translate
                    if (xformKind == 'translate') {
                        if (params.length == 1) {
                            xforms.push([1, 0, 0, 1, params[0], params[0]]);
                        }
                        else if (params.length == 2) {
                            xforms.push([1, 0, 0, 1, params[0], params[1]]);
                        }
                        else {
                            console.warn('warning', 'translate skipped; invalid num of params');
                        }
                        // rotate
                    }
                    else if (xformKind == 'rotate') {
                        if (params.length == 3) {
                            const angle = params[0] * this.DEG_TO_RAD;
                            xforms.push([1, 0, 0, 1, params[1], params[2]]);
                            xforms.push([Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0]);
                            xforms.push([1, 0, 0, 1, -params[1], -params[2]]);
                        }
                        else if (params.length == 1) {
                            const angle = params[0] * this.DEG_TO_RAD;
                            xforms.push([Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0]);
                        }
                        else {
                            console.warn('warning', 'rotate skipped; invalid num of params');
                        }
                        //scale
                    }
                    else if (xformKind == 'scale') {
                        if (params.length == 1) {
                            xforms.push([params[0], 0, 0, params[0], 0, 0]);
                        }
                        else if (params.length == 2) {
                            xforms.push([params[0], 0, 0, params[1], 0, 0]);
                        }
                        else {
                            console.warn('warning', 'scale skipped; invalid num of params');
                        }
                        // matrix
                    }
                    else if (xformKind == 'matrix') {
                        if (params.length == 6) {
                            xforms.push(params);
                        }
                        // skewX
                    }
                    else if (xformKind == 'skewX') {
                        if (params.length == 1) {
                            const angle = params[0] * this.DEG_TO_RAD;
                            xforms.push([1, 0, Math.tan(angle), 1, 0, 0]);
                        }
                        else {
                            console.warn('warning', 'skewX skipped; invalid num of params');
                        }
                        // skewY
                    }
                    else if (xformKind == 'skewY') {
                        if (params.length == 1) {
                            const angle = params[0] * this.DEG_TO_RAD;
                            xforms.push([1, Math.tan(angle), 0, 1, 0, 0]);
                        }
                        else {
                            console.warn('warning', 'skewY skipped; invalid num of params');
                        }
                    }
                }
                //calculate combined transformation matrix
                let xform_combined = [1, 0, 0, 1, 0, 0];
                for (const xform of xforms) {
                    xform_combined = this.matrixMult(xform_combined, xform);
                }
                // assign
                node.xform = xform_combined;
            },
            'style': (node, val) => {
                // style attribute
                // http://www.w3.org/TR/SVG11/styling.html#StyleAttribute
                // example: <rect x="200" y="100" width="600" height="300"
                //          style="fill: red; stroke: blue; stroke-width: 3"/>
                // relay to parse style attributes the same as Presentation Attributes
                const segs = val.split(';');
                for (const seg of segs) {
                    const kv = seg.split(':');
                    const k = this.strip(kv[0]);
                    if (this.SVGAttributeMapping[k]) {
                        const v = this.strip(kv[1]);
                        this.SVGAttributeMapping[k](node, v);
                    }
                }
            },
            ///////////////////////////
            // Presentations Attributes
            // http://www.w3.org/TR/SVG11/styling.html#UsingPresentationAttributes
            // example: <rect x="200" y="100" width="600" height="300"
            //          fill="red" stroke="blue" stroke-width="3"/>
            'opacity': (node, val) => {
                node.opacity = parseFloat(val);
            },
            'display': (node, val) => {
                node.display = val;
            },
            'visibility': (node, val) => {
                node.visibility = val;
            },
            'fill': (node, val) => {
                node.fill = this.SVGAttributeMapping.__parseColor(val, node.color);
            },
            'stroke': (node, val) => {
                node.stroke = this.SVGAttributeMapping.__parseColor(val, node.color);
            },
            'color': (node, val) => {
                if (val == 'inherit') {
                    return;
                }
                node.color = this.SVGAttributeMapping.__parseColor(val, node.color);
            },
            'fill-opacity': (node, val) => {
                node.fillOpacity = Math.min(1, Math.max(0, parseFloat(val)));
            },
            'stroke-opacity': (node, val) => {
                node.strokeOpacity = Math.min(1, Math.max(0, parseFloat(val)));
            },
            'font-size': (node, val) => {
                node.fontSize = this.parseUnit(val) || 1;
            },
            'font-family': (node, val) => {
                if (val === 'undefined') {
                    node.fontFamily = undefined;
                }
                else {
                    node.fontFamily = val;
                }
            },
            'font-style': (node, val) => {
                node.fontStyle = val;
            },
            // Presentations Attributes
            ///////////////////////////
            '__parseColor': (val, currentColor) => {
                if (val.charAt(0) == '#') {
                    if (val.length == 4) {
                        val = val.replace(/([^#])/g, '$1$1');
                    }
                    const a = val.slice(1).match(/../g).map(function (i) { return parseInt(i, 16); });
                    return a.join('');
                }
                else if (val.search(/^rgb\(/) != -1) {
                    const a = val.slice(4, -1).split(',');
                    for (let i = 0; i < a.length; i++) {
                        const c = this.strip(a[i]);
                        if (c.charAt(c.length - 1) == '%') {
                            a[i] = '' + Math.round(parseFloat(c.slice(0, -1)) * 2.55);
                        }
                        else {
                            a[i] = '' + parseInt(c, 10);
                        }
                    }
                    return a.join('');
                }
                else if (val.search(/^rgba\(/) != -1) {
                    const a = val.slice(5, -1).split(',');
                    for (let i = 0; i < 3; i++) {
                        const c = this.strip(a[i]);
                        if (c.charAt(c.length - 1) == '%') {
                            a[i] = '' + Math.round(parseFloat(c.slice(0, -1)) * 2.55);
                        }
                        else {
                            a[i] = '' + parseInt(c, 10);
                        }
                    }
                    const c = this.strip(a[3]);
                    if (c.charAt(c.length - 1) == '%') {
                        a[3] = '' + Math.round(parseFloat(c.slice(0, -1)) * 0.01);
                    }
                    else {
                        a[3] = '' + Math.max(0, Math.min(1, parseFloat(c)));
                    }
                    return a.join('');
                }
                else if (val.search(/^url\(/) != -1) {
                    console.error('error', 'defs are not supported at the moment');
                }
                else if (val == 'currentColor') {
                    return currentColor;
                }
                else if (val == 'none') {
                    return 'none';
                }
                else if (val == 'freeze') { // SMIL is evil, but so are we
                    return null;
                }
                else if (val == 'remove') {
                    return null;
                }
                else { // unknown value, maybe it's an ICC color
                    return val;
                }
            }
        };
        // recognized svg attributes
        /////////////////////////////
        ///////////////////////////
        // recognized svg elements
        this.SVGTagMapping = {
            svg: (tag, node) => __awaiter(this, void 0, void 0, function* () {
                // has style attributes
                node.fill = 'black';
                node.stroke = 'none';
                // // parse document dimensions
                // node.width = 0
                // node.height = 0
                // var w = tag.getAttribute('width')
                // var h = tag.getAttribute('height')
                // if (!w) w = h
                // else if (!h) h = w
                // if (w) {
                //   var wpx = parser.parseUnit(w, cn, 'x')
                //   var hpx = parser.parseUnit(h, cn, 'y')
                // }
            }),
            g: (tag, node) => __awaiter(this, void 0, void 0, function* () {
                // http://www.w3.org/TR/SVG11/struct.html#Groups
                // has transform and style attributes
            }),
            polygon: (tag, node) => __awaiter(this, void 0, void 0, function* () {
                // http://www.w3.org/TR/SVG11/shapes.html#PolygonElement
                // has transform and style attributes
                const d = yield this.SVGTagMapping.__getPolyPath(tag);
                d.push('z');
                this.addPath(d, node);
            }),
            polyline: (tag, node) => __awaiter(this, void 0, void 0, function* () {
                // http://www.w3.org/TR/SVG11/shapes.html#PolylineElement
                // has transform and style attributes
                const d = yield this.SVGTagMapping.__getPolyPath(tag);
                this.addPath(d, node);
            }),
            __getPolyPath: (tag) => __awaiter(this, void 0, void 0, function* () {
                // has transform and style attributes
                const subpath = [];
                const vertnums = this.strip(tag.getAttribute('points').toString()).split(/[\s,]+/).map(parseFloat);
                if (vertnums.length % 2 == 0) {
                    const d = ['M'];
                    d.push(vertnums[0]);
                    d.push(vertnums[1]);
                    for (let i = 2; i < vertnums.length; i += 2) {
                        d.push(vertnums[i]);
                        d.push(vertnums[i + 1]);
                    }
                    return d;
                }
                else {
                    console.error('error', 'in __getPolyPath: odd number of verteces');
                }
            }),
            rect: (tag, node) => __awaiter(this, void 0, void 0, function* () {
                // http://www.w3.org/TR/SVG11/shapes.html#RectElement
                // has transform and style attributes
                const w = this.parseUnit(tag.getAttribute('width')) || 0;
                const h = this.parseUnit(tag.getAttribute('height')) || 0;
                const x = this.parseUnit(tag.getAttribute('x')) || 0;
                const y = this.parseUnit(tag.getAttribute('y')) || 0;
                let rx = this.parseUnit(tag.getAttribute('rx'));
                let ry = this.parseUnit(tag.getAttribute('ry'));
                if (rx == null || ry == null) { // no rounded corners
                    const d = ['M', x, y, 'h', w, 'v', h, 'h', -w, 'z'];
                    this.addPath(d, node);
                }
                else { // rounded corners
                    if ('ry' == null) {
                        ry = rx;
                    }
                    if (rx < 0.0) {
                        rx *= -1;
                    }
                    if (ry < 0.0) {
                        ry *= -1;
                    }
                    const d = ['M', x + rx, y,
                        'h', w - 2 * rx,
                        'c', rx, 0.0, rx, ry, rx, ry,
                        'v', h - ry,
                        'c', '0.0', ry, -rx, ry, -rx, ry,
                        'h', -w + 2 * rx,
                        'c', -rx, '0.0', -rx, -ry, -rx, -ry,
                        'v', -h + ry,
                        'c', '0.0', '0.0', '0.0', -ry, rx, -ry,
                        'z'];
                    this.addPath(d, node);
                }
            }),
            line: (tag, node) => __awaiter(this, void 0, void 0, function* () {
                // http://www.w3.org/TR/SVG11/shapes.html#LineElement
                // has transform and style attributes
                const x1 = this.parseUnit(tag.getAttribute('x1')) || 0;
                const y1 = this.parseUnit(tag.getAttribute('y1')) || 0;
                const x2 = this.parseUnit(tag.getAttribute('x2')) || 0;
                const y2 = this.parseUnit(tag.getAttribute('y2')) || 0;
                const d = ['M', x1, y1, 'L', x2, y2];
                this.addPath(d, node);
            }),
            circle: (tag, node) => __awaiter(this, void 0, void 0, function* () {
                // http://www.w3.org/TR/SVG11/shapes.html#CircleElement
                // has transform and style attributes
                const r = this.parseUnit(tag.getAttribute('r'));
                const cx = this.parseUnit(tag.getAttribute('cx')) || 0;
                const cy = this.parseUnit(tag.getAttribute('cy')) || 0;
                if (r > 0.0) {
                    const d = ['M', cx - r, cy,
                        'A', r, r, 0, 0, 0, cx, cy + r,
                        'A', r, r, 0, 0, 0, cx + r, cy,
                        'A', r, r, 0, 0, 0, cx, cy - r,
                        'A', r, r, 0, 0, 0, cx - r, cy,
                        'Z'];
                    this.addPath(d, node);
                }
            }),
            ellipse: (tag, node) => __awaiter(this, void 0, void 0, function* () {
                // has transform and style attributes
                const rx = this.parseUnit(tag.getAttribute('rx'));
                const ry = this.parseUnit(tag.getAttribute('ry'));
                const cx = this.parseUnit(tag.getAttribute('cx')) || 0;
                const cy = this.parseUnit(tag.getAttribute('cy')) || 0;
                if (rx > 0.0 && ry > 0.0) {
                    const d = ['M', cx - rx, cy,
                        'A', rx, ry, 0, 0, 0, cx, cy + ry,
                        'A', rx, ry, 0, 0, 0, cx + rx, cy,
                        'A', rx, ry, 0, 0, 0, cx, cy - ry,
                        'A', rx, ry, 0, 0, 0, cx - rx, cy,
                        'Z'];
                    this.addPath(d, node);
                }
            }),
            path: (tag, node) => __awaiter(this, void 0, void 0, function* () {
                // http://www.w3.org/TR/SVG11/paths.html
                // has transform and style attributes
                const d = tag.getAttribute('d');
                this.addPath(d, node);
            }),
            image: (tag, node) => __awaiter(this, void 0, void 0, function* () {
                // not supported
                // has transform and style attributes
                const ns = 'http://www.w3.org/1999/xlink';
                const href = tag.getAttributeNS(ns, 'href');
                node.href = href;
            }),
            defs: (tag, node) => __awaiter(this, void 0, void 0, function* () {
                node.defs = true;
                // not supported
                // http://www.w3.org/TR/SVG11/struct.html#Head
                // has transform and style attributes
            }),
            clipPath: (tag, node) => {
                node.unsupported = true;
                // not supported
                // has transform and style attributes
            },
            use: (tag, node) => __awaiter(this, void 0, void 0, function* () {
                const ns = 'http://www.w3.org/1999/xlink';
                const href = tag.getAttributeNS(ns, 'href');
                node.href = href;
                const v = this.globalNodes[node.href];
                //node.unsupported = true;
                console.log(node, v);
                // not supported
                // has transform and style attributes
            }),
            style: (tag, node) => __awaiter(this, void 0, void 0, function* () {
                //node.unsupported = true;
                const container = document.createElement('div');
                document.body.appendChild(container);
                const shadow = container.attachShadow({ mode: 'closed' });
                //const doc = document.implementation.createHTMLDocument(''),
                const styleElement = document.createElement('style');
                styleElement.textContent = tag.textContent;
                // the style will only be parsed once it is added to a document
                shadow.appendChild(styleElement);
                //document.append(doc)
                console.log('Shadow styles', shadow.styleSheets);
                const styleSheet = shadow.styleSheets.item(0);
                //tslint:disable-next-line:prefer-for-of
                for (let ruleIndex = 0; ruleIndex < styleSheet.cssRules.length; ruleIndex++) {
                    //for(const ruleIndex in styleSheet.cssRules){
                    const rule = styleSheet.cssRules.item(ruleIndex);
                    const style = rule.style;
                    const fontFamily = style.fontFamily;
                    //tslint:disable-next-line:no-string-literal
                    const src = style['src'];
                    const fontBlob = src.substring(5, src.length - 2);
                    yield this.fontService.preloadFont(fontBlob, fontFamily);
                }
                document.body.removeChild(container);
                //blob:
                // not supported: embedded style sheets
                // http://www.w3.org/TR/SVG11/styling.html#StyleElement
                // instead presentation attributes and the 'style' attribute
                // var style = tag.getAttribute("style")
                // if (style) {
                //   var segs = style.split(";")
                //   for (var i=0; i<segs.length; i++) {
                //     var kv = segs[i].split(":")
                //     var k = kv[0].strip()
                //     if (this.SVGAttributeMapping[k]) {
                //       var v = kv[1].strip()
                //       this.SVGAttributeMapping[k].call(v, defs, st)
                //     }
                //   }
                // }
            }),
            text: (tag, node) => __awaiter(this, void 0, void 0, function* () {
                yield this._textContent(tag, node);
                // working on support
                // http://www.w3.org/TR/SVG11/struct.html#Head
                // has transform and style attributes
            }),
            textPath: (tag, node) => __awaiter(this, void 0, void 0, function* () {
                yield this._textContent(tag, node);
                // working on support
                // http://www.w3.org/TR/SVG11/struct.html#Head
                // has transform and style attributes
            }),
            tspan: (tag, node) => __awaiter(this, void 0, void 0, function* () {
                yield this._textContent(tag, node);
                // working on support
                // http://www.w3.org/TR/SVG11/struct.html#Head
                // has transform and style attributes
            })
        };
        this.tolerance_squared = Math.pow(this.tolerance, 2);
    }
    parse(rootElement) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = new SvgNode();
            //result.stroke = [255, 0, 0];
            result.xformToWorld = [1, 0, 0, 1, 0, 0];
            yield this.accept(rootElement, result);
            return result;
        });
    }
    onElement(element, parentNode) {
        return __awaiter(this, void 0, void 0, function* () {
            //let node: SvgNode
            // exclude textnodes, might check for tag.nodeName ===  "#text" or tag.nodeType === 3 instead
            // but that would include to check several types
            //if (element.localName) {
            // we are looping here through
            // all nodes with child nodes
            // others are irrelevant
            if (element.nodeName === '#text') {
                console.log(element);
            }
            // 1.) setup a new node
            // and inherit from parent
            const currentNode = parentNode.inherit();
            // var ns = 'http://www.w3.org/1999/xlink';
            // let href = element.getAttributeNS(ns, 'href')
            // if(href){
            //   let useElement = this.globalNodes[href]
            //   if (useElement.attributes) {
            //     for (let j = 0; j < useElement.attributes.length; j++) {
            //       let attr = useElement.attributes[j]
            //       if (attr.nodeName && attr.nodeValue && this.SVGAttributeMapping[attr.nodeName]) {
            //         console.log(attr.nodeName, attr.nodeValue)
            //         this.SVGAttributeMapping[attr.nodeName](this, currentNode, attr.nodeValue, useElement)
            //       }
            //     }
            //   }
            //   //TODO call accept on useElement
            // }
            // 2.) parse own attributes and overwrite
            if (element.attributes) {
                const attrlen = element.attributes.length;
                for (let j = 0; j < attrlen; j++) {
                    const attr = element.attributes[j];
                    if (attr.nodeName && attr.nodeValue && this.SVGAttributeMapping[attr.nodeName]) {
                        //console.log(attr.nodeName, attr.nodeValue)
                        this.SVGAttributeMapping[attr.nodeName](currentNode, attr.nodeValue, element);
                    }
                    else {
                        // const unsupported = ['d', 'x', 'y','clip-path','xml:space', 'clip-rule', 'transform']
                        // if(!attr.nodeName.startsWith('stroke') && unsupported.indexOf(attr.nodeName) < 0 ){
                        //   console.log(`Not supported attribute ${attr.nodeName}="${attr.nodeValue}"`)
                        // }
                    }
                }
            }
            // 3.) accumulate transformations
            currentNode.xformToWorld = this.matrixMult(parentNode.xformToWorld, currentNode.xform);
            // 4.) parse tag
            // with current attributes and transformation
            // changed from tagName to localName to handle svg files with namespace prefix svg:svg, svg:path etc;
            if (this.SVGTagMapping[element.localName]) {
                //if (node.stroke[0] == 255 && node.stroke[1] == 0 && node.stroke[2] == 0) {
                yield this.SVGTagMapping[element.localName](element, currentNode);
                //}
            }
            else {
                // const unsupported = ['def']
                // if(unsupported.indexOf(element.localName) < 0 ){
                //   console.log(`Not supported element ${element.localName}`)
                // }
            }
            // 5.) compile boundarys
            // before adding all path data convert to world coordinates
            for (const subpath of currentNode.path) {
                for (const point of subpath) {
                    //TODO clip on clipPath here. this will be extremely difficult
                    const transformed = this.matrixApply(currentNode.xformToWorld, point);
                    point[0] = transformed[0]; //new Vec2(tmp[0], tmp[1]);
                    point[1] = transformed[1];
                }
            }
            if (currentNode.href) {
                //createAnchor('bulle',node.href);
                //console.log(node.href.length, node.href);
            }
            return currentNode;
        });
    }
    _textContent(tag, node) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.renderText && node.fontFamily) {
                let font;
                if (this.fontService.hasFont(node.fontFamily)) {
                    font = yield this.fontService.getFont(node.fontFamily);
                }
                else {
                    console.log('Fallback to Arial');
                    font = yield this.fontService.getFont('/settings/arialuni.ttf');
                }
                if (font) {
                    if (tag.textContent !== null) {
                        const decodedText = tag.textContent;
                        const x = this.parseUnit(tag.getAttribute('x')) || 0;
                        const y = this.parseUnit(tag.getAttribute('y')) || 0;
                        const path = font.getPath(decodedText, x, y, node.fontSize);
                        //Monkey patch for text-anchor and baseline attribute
                        //should be done when parsing attributes and then transform is already made
                        //check Font.getAdvanceWidth as complement to boundingbox
                        const textAnchorAttr = tag.attributes.getNamedItem('text-anchor');
                        const baselineAttr = tag.attributes.getNamedItem('dominant-baseline');
                        if (textAnchorAttr || baselineAttr) {
                            const bounds = path.getBoundingBox();
                            let alignX = 0;
                            if (textAnchorAttr.nodeValue === 'middle') {
                                alignX = (bounds.x2 - bounds.x1) / 2;
                            }
                            if (textAnchorAttr.nodeValue === 'end') {
                                alignX = (bounds.x2 - bounds.x1);
                            }
                            let alignY = 0;
                            //TODO middle or center?? need to check this
                            if (baselineAttr.nodeValue === 'middle' || baselineAttr.nodeValue === 'center') {
                                alignY = (bounds.y2 - bounds.y1) / 2;
                            }
                            if (baselineAttr.nodeValue === 'hanging') {
                                alignY = (bounds.y2 - bounds.y1);
                            }
                            node.xformToWorld = this.matrixMult(node.xformToWorld, [1, 0, 0, 1, -alignX, alignY]);
                        }
                        const dPath = path.toPathData(undefined);
                        if (dPath.length > 0) {
                            this.addPath(dPath, node);
                        }
                    }
                }
                node.text = tag.textContent;
            }
            else {
                //Empty tspan element is often present in generated svg
                //Logging just seems to put out unnecessary logs
                //text elements might not have text but children that do, so don't log
                //if(tag.textContent !== 'text' && tag.textContent !== null){
                //console.log('skiptext', node, tag)
                //}
            }
        });
    }
    // recognized svg elements
    ///////////////////////////
    //////////////////////////////////////////////////////////////////////////
    // handle path data
    // this is where all the geometry gets converted for the boundarys output
    addPath(dObject, node) {
        // http://www.w3.org/TR/SVG11/paths.html#PathData
        let tolerance2 = this.tolerance_squared;
        const totalMaxScale = this.matrixGetScale(node.xformToWorld);
        if (totalMaxScale != 0) {
            // adjust for possible transforms
            tolerance2 /= Math.pow(totalMaxScale, 2);
            // console.info('notice', "tolerance2: " + tolerance2.toString());
        }
        let d = [];
        //let d: DPath
        if (typeof dObject === 'string') {
            // parse path string
            const mArr = dObject.match(/([A-Za-z]|-?[0-9]+\.?[0-9]*(?:e-?[0-9]*)?)/g);
            for (const val of mArr) {
                const num = parseFloat(val);
                if (isNaN(num)) {
                    d.push(val);
                }
                else {
                    d.push(num);
                }
            }
        }
        else {
            d = dObject;
        }
        //console.info('notice', "d: " + d.toString());
        function nextIsNum() {
            return (d.length > 0) && (typeof (d[0]) === 'number');
        }
        function getNext() {
            if (d.length > 0) {
                return d.shift(); // pop first item
            }
            else {
                console.error('error', 'in addPath: not enough parameters');
                return null;
            }
        }
        let x = 0;
        let y = 0;
        let cmdPrev = '';
        let xPrevCp;
        let yPrevCp;
        let subpath = [];
        while (d.length > 0) {
            const cmd = getNext();
            switch (cmd) {
                case 'M': // moveto absolute
                    // start new subpath
                    if (subpath.length > 0) {
                        node.path.push(subpath);
                        subpath = [];
                    }
                    let implicitVerts1 = 0;
                    while (nextIsNum()) {
                        x = getNext();
                        y = getNext();
                        subpath.push([x, y]);
                        implicitVerts1 += 1;
                    }
                    break;
                case 'm': //moveto relative
                    // start new subpath
                    if (subpath.length > 0) {
                        node.path.push(subpath);
                        subpath = [];
                    }
                    if (cmdPrev == '') {
                        // first treated absolute
                        x = getNext();
                        y = getNext();
                        subpath.push([x, y]);
                    }
                    let implicitVerts2 = 0;
                    while (nextIsNum()) {
                        // subsequent treated realtive
                        x += getNext();
                        y += getNext();
                        subpath.push([x, y]);
                        implicitVerts2 += 1;
                    }
                    break;
                case 'Z': // closepath
                case 'z': // closepath
                    // loop and finalize subpath
                    if (subpath.length > 0) {
                        //we can not reference first subpath subpath.push(subpath[0]) without cloning values
                        //due to transformations, which will be applied multiple times
                        subpath.push([subpath[0][0], subpath[0][1]]);
                        node.path.push(subpath);
                        x = subpath[subpath.length - 1][0];
                        y = subpath[subpath.length - 1][1];
                        subpath = [];
                    }
                    //I think there is an error here
                    break;
                case 'L': // lineto absolute
                    while (nextIsNum()) {
                        x = getNext();
                        y = getNext();
                        subpath.push([x, y]);
                    }
                    break;
                case 'l': // lineto relative
                    while (nextIsNum()) {
                        x += getNext();
                        y += getNext();
                        subpath.push([x, y]);
                    }
                    break;
                case 'H': // lineto horizontal absolute
                    while (nextIsNum()) {
                        x = getNext();
                        subpath.push([x, y]);
                    }
                    break;
                case 'h': // lineto horizontal relative
                    while (nextIsNum()) {
                        x += getNext();
                        subpath.push([x, y]);
                    }
                    break;
                case 'V': // lineto vertical absolute
                    while (nextIsNum()) {
                        y = getNext();
                        subpath.push([x, y]);
                    }
                    break;
                case 'v': // lineto vertical realtive
                    while (nextIsNum()) {
                        y += getNext();
                        subpath.push([x, y]);
                    }
                    break;
                case 'C': // curveto cubic absolute
                    while (nextIsNum()) {
                        const x2 = getNext();
                        const y2 = getNext();
                        const x3 = getNext();
                        const y3 = getNext();
                        const x4 = getNext();
                        const y4 = getNext();
                        subpath.push([x, y]);
                        this.addCubicBezier(subpath, x, y, x2, y2, x3, y3, x4, y4, 0, tolerance2);
                        subpath.push([x4, y4]);
                        x = x4;
                        y = y4;
                        xPrevCp = x3;
                        yPrevCp = y3;
                    }
                    break;
                case 'c': // curveto cubic relative
                    while (nextIsNum()) {
                        const x2 = x + getNext();
                        const y2 = y + getNext();
                        const x3 = x + getNext();
                        const y3 = y + getNext();
                        const x4 = x + getNext();
                        const y4 = y + getNext();
                        subpath.push([x, y]);
                        this.addCubicBezier(subpath, x, y, x2, y2, x3, y3, x4, y4, 0, tolerance2);
                        subpath.push([x4, y4]);
                        x = x4;
                        y = y4;
                        xPrevCp = x3;
                        yPrevCp = y3;
                    }
                    break;
                case 'S': // curveto cubic absolute shorthand
                    while (nextIsNum()) {
                        let x2;
                        let y2;
                        if (cmdPrev.match(/[CcSs]/)) {
                            x2 = x - (xPrevCp - x);
                            y2 = y - (yPrevCp - y);
                        }
                        else {
                            x2 = x;
                            y2 = y;
                        }
                        const x3 = getNext();
                        const y3 = getNext();
                        const x4 = getNext();
                        const y4 = getNext();
                        subpath.push([x, y]);
                        this.addCubicBezier(subpath, x, y, x2, y2, x3, y3, x4, y4, 0, tolerance2);
                        subpath.push([x4, y4]);
                        x = x4;
                        y = y4;
                        xPrevCp = x3;
                        yPrevCp = y3;
                    }
                    break;
                case 's': // curveto cubic relative shorthand
                    while (nextIsNum()) {
                        let x2;
                        let y2;
                        if (cmdPrev.match(/[CcSs]/)) {
                            x2 = x - (xPrevCp - x);
                            y2 = y - (yPrevCp - y);
                        }
                        else {
                            x2 = x;
                            y2 = y;
                        }
                        const x3 = x + getNext();
                        const y3 = y + getNext();
                        const x4 = x + getNext();
                        const y4 = y + getNext();
                        subpath.push([x, y]);
                        this.addCubicBezier(subpath, x, y, x2, y2, x3, y3, x4, y4, 0, tolerance2);
                        subpath.push([x4, y4]);
                        x = x4;
                        y = y4;
                        xPrevCp = x3;
                        yPrevCp = y3;
                    }
                    break;
                case 'Q': // curveto quadratic absolute
                    while (nextIsNum()) {
                        const x2 = getNext();
                        const y2 = getNext();
                        const x3 = getNext();
                        const y3 = getNext();
                        subpath.push([x, y]);
                        this.addQuadraticBezier(subpath, x, y, x2, y2, x3, y3, 0, tolerance2);
                        subpath.push([x3, y3]);
                        x = x3;
                        y = y3;
                    }
                    break;
                case 'q': // curveto quadratic relative
                    while (nextIsNum()) {
                        const x2 = x + getNext();
                        const y2 = y + getNext();
                        const x3 = x + getNext();
                        const y3 = y + getNext();
                        subpath.push([x, y]);
                        this.addQuadraticBezier(subpath, x, y, x2, y2, x3, y3, 0, tolerance2);
                        subpath.push([x3, y3]);
                        x = x3;
                        y = y3;
                    }
                    break;
                case 'T': // curveto quadratic absolute shorthand
                    while (nextIsNum()) {
                        let x2;
                        let y2;
                        if (cmdPrev.match(/[QqTt]/)) {
                            x2 = x - (xPrevCp - x);
                            y2 = y - (yPrevCp - y);
                        }
                        else {
                            x2 = x;
                            y2 = y;
                        }
                        const x3 = getNext();
                        const y3 = getNext();
                        subpath.push([x, y]);
                        this.addQuadraticBezier(subpath, x, y, x2, y2, x3, y3, 0, tolerance2);
                        subpath.push([x3, y3]);
                        x = x3;
                        y = y3;
                        xPrevCp = x2;
                        yPrevCp = y2;
                    }
                    break;
                case 't': // curveto quadratic relative shorthand
                    while (nextIsNum()) {
                        let x2;
                        let y2;
                        if (cmdPrev.match(/[QqTt]/)) {
                            x2 = x - (xPrevCp - x);
                            y2 = y - (yPrevCp - y);
                        }
                        else {
                            x2 = x;
                            y2 = y;
                        }
                        const x3 = x + getNext();
                        const y3 = y + getNext();
                        subpath.push([x, y]);
                        this.addQuadraticBezier(subpath, x, y, x2, y2, x3, y3, 0, tolerance2);
                        subpath.push([x3, y3]);
                        x = x3;
                        y = y3;
                        xPrevCp = x2;
                        yPrevCp = y2;
                    }
                    break;
                case 'A': // eliptical arc absolute
                    while (nextIsNum()) {
                        const rx = getNext();
                        const ry = getNext();
                        const xrot = getNext();
                        const large = getNext();
                        const sweep = getNext();
                        const x2 = getNext();
                        const y2 = getNext();
                        this.addArc(subpath, x, y, rx, ry, xrot, large, sweep, x2, y2, tolerance2);
                        x = x2;
                        y = y2;
                    }
                    break;
                case 'a': // elliptical arc relative
                    while (nextIsNum()) {
                        const rx = getNext();
                        const ry = getNext();
                        const xrot = getNext();
                        const large = getNext();
                        const sweep = getNext();
                        const x2 = x + getNext();
                        const y2 = y + getNext();
                        this.addArc(subpath, x, y, rx, ry, xrot, large, sweep, x2, y2, tolerance2);
                        x = x2;
                        y = y2;
                    }
                    break;
            }
            cmdPrev = cmd;
        }
        // finalize subpath
        if (subpath.length > 0) {
            node.path.push(subpath);
            subpath = [];
        }
    }
    addCubicBezier(subpath, x1, y1, x2, y2, x3, y3, x4, y4, level, tolerance2) {
        // for details see:
        // http://www.antigrain.com/research/adaptive_bezier/index.html
        // based on DeCasteljau Algorithm
        // The reason we use a subdivision algo over an incremental one
        // is we want to have control over the deviation to the curve.
        // This mean we subdivide more and have more curve points in
        // curvy areas and less in flatter areas of the curve.
        if (level > 18) {
            // protect from deep recursion cases
            // max 2**18 = 262144 segments
            return;
        }
        // Calculate all the mid-points of the line segments
        const x12 = (x1 + x2) / 2.0;
        const y12 = (y1 + y2) / 2.0;
        const x23 = (x2 + x3) / 2.0;
        const y23 = (y2 + y3) / 2.0;
        const x34 = (x3 + x4) / 2.0;
        const y34 = (y3 + y4) / 2.0;
        const x123 = (x12 + x23) / 2.0;
        const y123 = (y12 + y23) / 2.0;
        const x234 = (x23 + x34) / 2.0;
        const y234 = (y23 + y34) / 2.0;
        const x1234 = (x123 + x234) / 2.0;
        const y1234 = (y123 + y234) / 2.0;
        // Try to approximate the full cubic curve by a single straight line
        const dx = x4 - x1;
        const dy = y4 - y1;
        const d2 = Math.abs(((x2 - x4) * dy - (y2 - y4) * dx));
        const d3 = Math.abs(((x3 - x4) * dy - (y3 - y4) * dx));
        if (Math.pow(d2 + d3, 2) < 5.0 * tolerance2 * (dx * dx + dy * dy)) {
            // added factor of 5.0 to match circle resolution
            subpath.push([x1234, y1234]);
            return;
        }
        // Continue subdivision
        this.addCubicBezier(subpath, x1, y1, x12, y12, x123, y123, x1234, y1234, level + 1, tolerance2);
        this.addCubicBezier(subpath, x1234, y1234, x234, y234, x34, y34, x4, y4, level + 1, tolerance2);
    }
    addQuadraticBezier(subpath, x1, y1, x2, y2, x3, y3, level, tolerance2) {
        if (level > 18) {
            // protect from deep recursion cases
            // max 2**18 = 262144 segments
            return;
        }
        // Calculate all the mid-points of the line segments
        const x12 = (x1 + x2) / 2.0;
        const y12 = (y1 + y2) / 2.0;
        const x23 = (x2 + x3) / 2.0;
        const y23 = (y2 + y3) / 2.0;
        const x123 = (x12 + x23) / 2.0;
        const y123 = (y12 + y23) / 2.0;
        const dx = x3 - x1;
        const dy = y3 - y1;
        const d = Math.abs(((x2 - x3) * dy - (y2 - y3) * dx));
        if (d * d <= 5.0 * tolerance2 * (dx * dx + dy * dy)) {
            // added factor of 5.0 to match circle resolution
            subpath.push([x123, y123]);
            return;
        }
        // Continue subdivision
        this.addQuadraticBezier(subpath, x1, y1, x12, y12, x123, y123, level + 1, tolerance2);
        this.addQuadraticBezier(subpath, x123, y123, x23, y23, x3, y3, level + 1, tolerance2);
    }
    addArc(subpath, x1, y1, rx, ry, phi, large_arc, sweep, x2, y2, tolerance2) {
        // Implemented based on the SVG implementation notes
        // plus some recursive sugar for incrementally refining the
        // arc resolution until the requested tolerance is met.
        // http://www.w3.org/TR/SVG/implnote.html#ArcImplementationNotes
        const cp = Math.cos(phi);
        const sp = Math.sin(phi);
        const dx = 0.5 * (x1 - x2);
        const dy = 0.5 * (y1 - y2);
        const x_ = cp * dx + sp * dy;
        const y_ = -sp * dx + cp * dy;
        let r2 = (Math.pow(rx * ry, 2) - Math.pow(rx * y_, 2) - Math.pow(ry * x_, 2)) /
            (Math.pow(rx * y_, 2) + Math.pow(ry * x_, 2));
        if (r2 < 0) {
            r2 = 0;
        }
        let r = Math.sqrt(r2);
        if (large_arc == sweep) {
            r = -r;
        }
        const cx_ = r * rx * y_ / ry;
        const cy_ = -r * ry * x_ / rx;
        const cx = cp * cx_ - sp * cy_ + 0.5 * (x1 + x2);
        const cy = sp * cx_ + cp * cy_ + 0.5 * (y1 + y2);
        function angle(u, v) {
            const a = Math.acos((u[0] * v[0] + u[1] * v[1]) /
                Math.sqrt((Math.pow(u[0], 2) + Math.pow(u[1], 2)) *
                    (Math.pow(v[0], 2) + Math.pow(v[1], 2))));
            let sgn = -1;
            if (u[0] * v[1] > u[1] * v[0]) {
                sgn = 1;
            }
            return sgn * a;
        }
        const psi = angle([1, 0], [(x_ - cx_) / rx, (y_ - cy_) / ry]);
        let delta = angle([(x_ - cx_) / rx, (y_ - cy_) / ry], [(-x_ - cx_) / rx, (-y_ - cy_) / ry]);
        if (sweep && delta < 0) {
            delta += Math.PI * 2;
        }
        if (!sweep && delta > 0) {
            delta -= Math.PI * 2;
        }
        function getVertex(pct) {
            const theta = psi + delta * pct;
            const ct = Math.cos(theta);
            const st = Math.sin(theta);
            return [cp * rx * ct - sp * ry * st + cx, sp * rx * ct + cp * ry * st + cy];
        }
        // let the recursive fun begin
        //
        function recursiveArc(parser, t1, t2, c1, c5, level, tolerance2) {
            if (level > 18) {
                // protect from deep recursion cases
                // max 2**18 = 262144 segments
                return;
            }
            const tRange = t2 - t1;
            const tHalf = t1 + 0.5 * tRange;
            const c2 = getVertex(t1 + 0.25 * tRange);
            const c3 = getVertex(tHalf);
            const c4 = getVertex(t1 + 0.75 * tRange);
            if (parser.vertexDistanceSquared(c2, parser.vertexMiddle(c1, c3)) > tolerance2) {
                recursiveArc(parser, t1, tHalf, c1, c3, level + 1, tolerance2);
            }
            subpath.push(c3);
            if (parser.vertexDistanceSquared(c4, parser.vertexMiddle(c3, c5)) > tolerance2) {
                recursiveArc(parser, tHalf, t2, c3, c5, level + 1, tolerance2);
            }
        }
        const t1Init = 0.0;
        const t2Init = 1.0;
        const c1Init = getVertex(t1Init);
        const c5Init = getVertex(t2Init);
        subpath.push(c1Init);
        recursiveArc(this, t1Init, t2Init, c1Init, c5Init, 0, tolerance2);
        subpath.push(c5Init);
    }
    // handle path data
    //////////////////////////////////////////////////////////////////////////
    parseUnit(val) {
        if (val == null) {
            return null;
        }
        else {
            // assume 90dpi
            let multiplier = 1.0;
            if (val.search(/cm$/i) != -1) {
                multiplier = 35.433070869;
            }
            else if (val.search(/mm$/i) != -1) {
                multiplier = 3.5433070869;
            }
            else if (val.search(/pt$/i) != -1) {
                multiplier = 1.25;
            }
            else if (val.search(/pc$/i) != -1) {
                multiplier = 15.0;
            }
            else if (val.search(/in$/i) != -1) {
                multiplier = 90.0;
            }
            return multiplier * parseFloat(this.strip(val));
        }
    }
    matrixMult(mA, mB) {
        return [mA[0] * mB[0] + mA[2] * mB[1],
            mA[1] * mB[0] + mA[3] * mB[1],
            mA[0] * mB[2] + mA[2] * mB[3],
            mA[1] * mB[2] + mA[3] * mB[3],
            mA[0] * mB[4] + mA[2] * mB[5] + mA[4],
            mA[1] * mB[4] + mA[3] * mB[5] + mA[5]];
    }
    matrixApply(mat, vec) {
        return [mat[0] * vec[0] + mat[2] * vec[1] + mat[4],
            mat[1] * vec[0] + mat[3] * vec[1] + mat[5]];
    }
    matrixGetScale(mat) {
        // extract absolute scale from matrix
        const sx = Math.sqrt(mat[0] * mat[0] + mat[1] * mat[1]);
        const sy = Math.sqrt(mat[2] * mat[2] + mat[3] * mat[3]);
        // return dominant axis
        if (sx > sy) {
            return sx;
        }
        else {
            return sy;
        }
    }
    vertexDistanceSquared(v1, v2) {
        return Math.pow(v2[0] - v1[0], 2) + Math.pow(v2[1] - v1[1], 2);
    }
    vertexMiddle(v1, v2) {
        return [(v2[0] + v1[0]) / 2.0, (v2[1] + v1[1]) / 2.0];
    }
    strip(val) {
        return val.replace(/^\s+|\s+$/g, '');
    }
}
//# sourceMappingURL=svg-parser.js.map