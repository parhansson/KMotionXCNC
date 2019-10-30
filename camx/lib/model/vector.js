export class Curve3 {
    // Get sequence of points using getPoint( t )
    getPoints(divisions = 10) {
        const points = [];
        for (let d = 0; d <= divisions; d++) {
            points.push(this.getPoint(d / divisions));
        }
        return points;
    }
}
/**
 * EllipseCurve derived from THREE
 */
export class EllipseCurve extends Curve3 {
    constructor(aX, aY, xRadius, yRadius, aStartAngle, aEndAngle, aClockwise, aRotation = 0) {
        super();
        this.aX = aX;
        this.aY = aY;
        this.xRadius = xRadius;
        this.yRadius = yRadius;
        this.aStartAngle = aStartAngle;
        this.aEndAngle = aEndAngle;
        this.aClockwise = aClockwise;
        this.aRotation = aRotation;
        //calculate and store deltaAngle for later
        const twoPi = Math.PI * 2;
        let deltaAngle = this.aEndAngle - this.aStartAngle;
        const samePoints = Math.abs(deltaAngle) < Number.EPSILON;
        // ensures that deltaAngle is 0 .. 2 PI
        while (deltaAngle < 0) {
            deltaAngle += twoPi;
        }
        while (deltaAngle > twoPi) {
            deltaAngle -= twoPi;
        }
        if (deltaAngle < Number.EPSILON) {
            if (samePoints) {
                deltaAngle = 0;
            }
            else {
                deltaAngle = twoPi;
            }
        }
        if (this.aClockwise === true && !samePoints) {
            if (deltaAngle === twoPi) {
                deltaAngle = -twoPi;
            }
            else {
                deltaAngle = deltaAngle - twoPi;
            }
        }
        this.deltaAngle = deltaAngle;
    }
    getPoint(t) {
        const angle = this.aStartAngle + t * this.deltaAngle;
        let x = this.aX + this.xRadius * Math.cos(angle);
        let y = this.aY + this.yRadius * Math.sin(angle);
        if (this.aRotation !== 0) {
            const cos = Math.cos(this.aRotation);
            const sin = Math.sin(this.aRotation);
            const tx = x - this.aX;
            const ty = y - this.aY;
            // Rotate the point about the center of the ellipse.
            x = tx * cos - ty * sin + this.aX;
            y = tx * sin + ty * cos + this.aY;
        }
        return { x, y, z: 0 };
    }
}
export class ArcCurve extends EllipseCurve {
    constructor(aX, aY, aRadius, aStartAngle, aEndAngle, aClockwise) {
        super(aX, aY, aRadius, aRadius, aStartAngle, aEndAngle, aClockwise);
    }
}
export class SplineCurve extends Curve3 {
    constructor(points = []) {
        super();
        this.points = points;
    }
    getPoint(t) {
        const points = this.points;
        const p = (points.length - 1) * t;
        const intPoint = Math.floor(p);
        const weight = p - intPoint;
        const p0 = points[intPoint === 0 ? intPoint : intPoint - 1];
        const p1 = points[intPoint];
        const p2 = points[intPoint > points.length - 2 ? points.length - 1 : intPoint + 1];
        const p3 = points[intPoint > points.length - 3 ? points.length - 1 : intPoint + 2];
        return {
            x: CatmullRom(weight, p0.x, p1.x, p2.x, p3.x),
            y: CatmullRom(weight, p0.y, p1.y, p2.y, p3.y),
            z: 0
        };
    }
}
export class QuadraticBezierCurve extends Curve3 {
    constructor(v0 = { x: 0, y: 0 }, v1 = { x: 0, y: 0 }, v2 = { x: 0, y: 0 }) {
        super();
        this.v0 = v0;
        this.v1 = v1;
        this.v2 = v2;
    }
    getPoint(t) {
        return {
            x: QuadraticBezier(t, this.v0.x, this.v1.x, this.v2.x),
            y: QuadraticBezier(t, this.v0.y, this.v1.y, this.v2.y),
            z: 0
        };
    }
}
export class CubicBezierCurve extends Curve3 {
    constructor(v0 = { x: 0, y: 0 }, v1 = { x: 0, y: 0 }, v2 = { x: 0, y: 0 }, v3 = { x: 0, y: 0 }) {
        super();
        this.v0 = v0;
        this.v1 = v1;
        this.v2 = v2;
        this.v3 = v3;
    }
    getPoint(t) {
        return {
            x: CubicBezier(t, this.v0.x, this.v1.x, this.v2.x, this.v3.x),
            y: CubicBezier(t, this.v0.y, this.v1.y, this.v2.y, this.v3.y),
            z: 0
        };
    }
}
/**
 * Bezier Curves formulas obtained from
 * http://en.wikipedia.org/wiki/Bézier_curve
 * Also found in THREE
 */
export function CatmullRom(t, p0, p1, p2, p3) {
    const v0 = (p2 - p0) * 0.5;
    const v1 = (p3 - p1) * 0.5;
    const t2 = t * t;
    const t3 = t * t2;
    return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;
}
export function QuadraticBezier(t, p0, p1, p2) {
    const QuadraticBezierP0 = (t, p) => {
        const k = 1 - t;
        return k * k * p;
    };
    const QuadraticBezierP1 = (t, p) => 2 * (1 - t) * t * p;
    const QuadraticBezierP2 = (t, p) => t * t * p;
    return QuadraticBezierP0(t, p0) +
        QuadraticBezierP1(t, p1) +
        QuadraticBezierP2(t, p2);
}
export function CubicBezier(t, p0, p1, p2, p3) {
    const CubicBezierP0 = (t, p) => {
        const k = 1 - t;
        return k * k * k * p;
    };
    const CubicBezierP1 = (t, p) => {
        const k = 1 - t;
        return 3 * k * k * t * p;
    };
    const CubicBezierP2 = (t, p) => 3 * (1 - t) * t * t * p;
    const CubicBezierP3 = (t, p) => t * t * t * p;
    return CubicBezierP0(t, p0) +
        CubicBezierP1(t, p1) +
        CubicBezierP2(t, p2) +
        CubicBezierP3(t, p3);
}
//# sourceMappingURL=vector.js.map