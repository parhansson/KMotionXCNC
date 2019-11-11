export declare class SvgEditor2 {
    svgDoc: SVGSVGElement;
    svgRoot: SVGSVGElement;
    TrueCoords: {
        x: number;
        y: number;
    };
    GrabPoint: {
        x: number;
        y: number;
    };
    BackDrop: Element;
    DragTarget: SVGGraphicsElement;
    constructor(doc: SVGSVGElement);
    private Leave;
    private Grab;
    private Drag;
    private Drop;
    private GetTrueCoords;
}
