export interface MoveArcArguments {
    I?: number;
    J?: number;
    K?: number;
    R?: number;
}
export interface MoveAngularArguments {
    A?: number;
    B?: number;
    C?: number;
}
export interface MoveArguments extends MoveAngularArguments, MoveArcArguments {
    X?: number;
    Y?: number;
    Z?: number;
}
export interface Vector2 {
    x: number;
    y: number;
}
export interface Vector3 {
    x: number;
    y: number;
    z: number;
}
export declare abstract class Curve3 {
    /**
     *
     * @param t point in percent of arc length
     */
    abstract getPoint(t: number): Vector3;
    getPoints(divisions?: number): Vector3[];
}
/**
 * EllipseCurve derived from THREE
 */
export declare class EllipseCurve extends Curve3 {
    private readonly aX;
    private readonly aY;
    private readonly xRadius;
    private readonly yRadius;
    private readonly aStartAngle;
    private readonly aEndAngle;
    private readonly aClockwise;
    private readonly aRotation;
    private readonly deltaAngle;
    constructor(aX: number, aY: number, xRadius: number, yRadius: number, aStartAngle: number, aEndAngle: number, aClockwise: boolean, aRotation?: number);
    getPoint(t: number): Vector3;
}
export declare class ArcCurve extends EllipseCurve {
    constructor(aX: number, aY: number, aRadius: number, aStartAngle: number, aEndAngle: number, aClockwise: boolean);
}
export declare class SplineCurve extends Curve3 {
    private points;
    constructor(points?: Vector2[]);
    getPoint(t: number): {
        x: number;
        y: number;
        z: number;
    };
}
export declare class QuadraticBezierCurve extends Curve3 {
    private v0;
    private v1;
    private v2;
    constructor(v0?: Vector2, v1?: Vector2, v2?: Vector2);
    getPoint(t: number): {
        x: number;
        y: number;
        z: number;
    };
}
export declare class CubicBezierCurve extends Curve3 {
    private v0;
    private v1;
    private v2;
    private v3;
    constructor(v0?: Vector2, v1?: Vector2, v2?: Vector2, v3?: Vector2);
    getPoint(t: number): {
        x: number;
        y: number;
        z: number;
    };
}
/**
 * Bezier Curves formulas obtained from
 * http://en.wikipedia.org/wiki/Bézier_curve
 * Also found in THREE
 */
export declare function CatmullRom(t: number, p0: number, p1: number, p2: number, p3: number): number;
export declare function QuadraticBezier(t: number, p0: number, p1: number, p2: number): number;
export declare function CubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number;
