declare type ElementFilter = (element: SVGElement) => boolean;
declare type Matrix = [number, number, number, number, number, number];
declare type Point = [number, number];
declare type Subpath = Point[];
declare type PathDValue = string | number;
export declare class SvgNode {
    path: Subpath[];
    xformToWorld: Matrix;
    xform: Matrix;
    id: string;
    display: string;
    visibility: string;
    fill: string;
    stroke: string;
    color: string;
    opacity: number;
    fillOpacity: number;
    strokeOpacity: number;
    unsupported: boolean;
    defs: boolean;
    href: string;
    text: string;
    fontSize: number;
    fontFamily: string;
    fontStyle: string;
    children: SvgNode[];
    constructor();
    clone(): SvgNode;
    inherit(): SvgNode;
}
declare abstract class SVGElementWalker<T> {
    protected elementFilter: ElementFilter;
    constructor(elementFilter: ElementFilter);
    accept(parentElement: SVGElement, parentData: T): Promise<void>;
    protected abstract onElement(element: SVGElement, parentData: T): Promise<T>;
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
export declare class SvgParser extends SVGElementWalker<SvgNode> {
    private renderText;
    private fontService;
    private DEG_TO_RAD;
    private RAD_TO_DEG;
    private globalNodes;
    private style;
    private tolerance;
    private tolerance_squared;
    constructor(elementFilter: ElementFilter, renderText: boolean);
    parse(rootElement: SVGElement): Promise<SvgNode>;
    protected onElement(element: SVGElement, parentNode: SvgNode): Promise<SvgNode>;
    SVGAttributeMapping: {
        'id': (node: SvgNode, val: string, element?: SVGElement) => void;
        'transform': (node: SvgNode, val: string) => void;
        'style': (node: SvgNode, val: string) => void;
        'opacity': (node: SvgNode, val: string) => void;
        'display': (node: SvgNode, val: string) => void;
        'visibility': (node: SvgNode, val: string) => void;
        'fill': (node: SvgNode, val: string) => void;
        'stroke': (node: SvgNode, val: string) => void;
        'color': (node: SvgNode, val: string) => void;
        'fill-opacity': (node: SvgNode, val: string) => void;
        'stroke-opacity': (node: SvgNode, val: string) => void;
        'font-size': (node: SvgNode, val: string) => void;
        'font-family': (node: SvgNode, val: string) => void;
        'font-style': (node: SvgNode, val: string) => void;
        '__parseColor': (val: string, currentColor: string) => string;
    };
    SVGTagMapping: {
        svg: (tag: SVGElement, node: SvgNode) => Promise<void>;
        g: (tag: SVGElement, node: SvgNode) => Promise<void>;
        polygon: (tag: SVGElement, node: SvgNode) => Promise<void>;
        polyline: (tag: SVGElement, node: SvgNode) => Promise<void>;
        __getPolyPath: (tag: SVGElement) => Promise<(string | number)[]>;
        rect: (tag: SVGElement, node: SvgNode) => Promise<void>;
        line: (tag: SVGElement, node: SvgNode) => Promise<void>;
        circle: (tag: SVGElement, node: SvgNode) => Promise<void>;
        ellipse: (tag: SVGElement, node: SvgNode) => Promise<void>;
        path: (tag: SVGElement, node: SvgNode) => Promise<void>;
        image: (tag: SVGElement, node: SvgNode) => Promise<void>;
        defs: (tag: SVGElement, node: SvgNode) => Promise<void>;
        clipPath: (tag: SVGElement, node: SvgNode) => void;
        use: (tag: SVGElement, node: SvgNode) => Promise<void>;
        style: (tag: SVGElement, node: SvgNode) => Promise<void>;
        text: (tag: SVGTextElement, node: SvgNode) => Promise<void>;
        textPath: (tag: SVGTextPathElement, node: SvgNode) => Promise<void>;
        tspan: (tag: SVGTSpanElement, node: SvgNode) => Promise<void>;
    };
    _textContent(tag: SVGTextContentElement, node: SvgNode): Promise<void>;
    addPath(dObject: string | PathDValue[], node: SvgNode): void;
    addCubicBezier(subpath: Point[], x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number, level: number, tolerance2: number): void;
    addQuadraticBezier(subpath: Point[], x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, level: number, tolerance2: number): void;
    addArc(subpath: Point[], x1: number, y1: number, rx: number, ry: number, phi: number, large_arc: number, sweep: number, x2: number, y2: number, tolerance2: number): void;
    parseUnit(val: string): number;
    matrixMult(mA: Matrix, mB: Matrix): Matrix;
    matrixApply(mat: Matrix, vec: Point): Point;
    matrixGetScale(mat: Matrix): number;
    vertexDistanceSquared(v1: Point, v2: Point): number;
    vertexMiddle(v1: Point, v2: Point): Point;
    strip(val: string): string;
}
export {};
