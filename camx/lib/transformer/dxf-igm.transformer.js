import { ModelTransformer } from './model.transformer';
import { IGM, IGMDriver } from '../model/igm';
import DxfParser from 'dxf-parser';
import { KMXUtil } from '../util/kmxutil';
import { EllipseCurve, ArcCurve, SplineCurve, QuadraticBezierCurve } from '../model/vector';
const INSUNITS = {
    // https://www.autodesk.com/techpubs/autocad/acad2000/dxf/header_section_group_codes_dxf_02.htm
    0: 1,
    1: 25.4,
    2: 304.8,
    3: 1609344,
    4: 1,
    5: 10,
    6: 1000,
    7: 1000000,
    8: 0.0000254,
    9: 0.0254,
    10: 914.4,
    11: 1.0e-7,
    12: 1.0e-6,
    13: 0.001,
    14: 100,
    15: 10000,
    16: 100000,
    17: 1000000000000,
    18: 1,
    19: 1,
    20: 1,
};
export class Dxf2IgmTransformer extends ModelTransformer {
    constructor() {
        super();
    }
    execute(source, targetObserver) {
        let fileText;
        if (source instanceof ArrayBuffer) {
            fileText = KMXUtil.ab2str(source);
        }
        else {
            fileText = source;
        }
        const model = new IGM();
        const driver = new IGMDriver(model);
        const parser = new DxfParser();
        try {
            const dxf = parser.parseSync(fileText);
            for (const entity of dxf.entities) {
                const shapes = this.doEntity(entity, dxf);
                for (const shape of shapes) {
                    driver.addToLayerObject(entity.layer, this.scale(shape, dxf));
                }
            }
            console.log(dxf);
            targetObserver.next(model);
        }
        catch (err) {
            return console.error(err.stack);
        }
    }
    isArc(entity) {
        return entity.type === 'CIRCLE' || entity.type === 'ARC';
    }
    isLine(entity) {
        return entity.type === 'LWPOLYLINE' || entity.type === 'LINE' || entity.type === 'POLYLINE';
    }
    isDimension(entity) {
        return entity.type === 'DIMENSION';
    }
    isSpline(entity) {
        return entity.type === 'SPLINE';
    }
    isEllipse(entity) {
        return entity.type === 'ELLIPSE';
    }
    doEntity(entity, data) {
        const shapes = [];
        if (this.isArc(entity)) {
            shapes.push(this.doArc(entity, data));
        }
        else if (this.isLine(entity)) {
            shapes.push(this.doLine(entity, data));
            //} else if(entity.type === 'TEXT') {
            //mesh = this.doText(entity, data);
            //} else if(entity.type === 'SOLID') {
            //mesh = this.doSolid(entity, data);
            //} else if(entity.type === 'POINT') {
            //mesh = this.doPoint(entity, data);
            //} else if(entity.type === 'INSERT') {
            //mesh = this.doBlock(entity, data);
        }
        else if (this.isSpline(entity)) {
            shapes.push(this.doSpline(entity, data));
            //} else if(entity.type === 'MTEXT') {
            //mesh = this.doMtext(entity, data);
        }
        else if (this.isEllipse(entity)) {
            shapes.push(this.doEllipse(entity, data));
        }
        else if (this.isDimension(entity)) {
            /* tslint:disable:no-bitwise */
            const dimTypeEnum = entity.dimensionType & 7;
            if (dimTypeEnum === 0) {
                for (const childEntity of this.doDimension(entity, data)) {
                    shapes.push(childEntity);
                }
            }
            else {
                console.log('Unsupported Dimension type: ' + dimTypeEnum);
            }
        }
        else {
            console.log('Unsupported Entity Type: ' + entity.type);
        }
        return shapes;
    }
    scale(shape, dxf) {
        let unit = dxf.header.$INSUNITS;
        if (unit === undefined) {
            //unit = 1 // autocad defaults to Inches(1) if INSUNITS is missing    
            unit = 0; //but we use unitless here
        }
        IGMDriver.scale(shape, INSUNITS[unit]);
        return shape;
    }
    doArc(entity, dxf) {
        let startAngle, endAngle;
        if (entity.type === 'CIRCLE') {
            startAngle = entity.startAngle || 0;
            endAngle = startAngle + 2 * Math.PI;
        }
        else {
            startAngle = entity.startAngle;
            endAngle = entity.endAngle;
        }
        //ArcCurve is the same as EllipseCurve but radius is the same in both axes
        const curve = new ArcCurve(0, 0, entity.radius, startAngle, endAngle, false);
        const points = curve.getPoints(32);
        const object = IGMDriver.newIgmObject();
        for (const v of points) {
            object.vectors.push(IGMDriver.newGCodeVector(v.x, v.y, 0 /*v.z*/));
        }
        if (entity.center) {
            IGMDriver.translate(object, IGMDriver.newGCodeVector(entity.center.x, entity.center.y, entity.center.z));
        }
        return object;
    }
    doEllipse(entity, dxf) {
        //ar color = getColor(entity, data);
        const xrad = Math.sqrt(Math.pow(entity.majorAxisEndPoint.x, 2) + Math.pow(entity.majorAxisEndPoint.y, 2));
        const yrad = xrad * entity.axisRatio;
        const rotation = Math.atan2(entity.majorAxisEndPoint.y, entity.majorAxisEndPoint.x);
        const curve = new EllipseCurve(entity.center.x, entity.center.y, xrad, yrad, entity.startAngle, entity.endAngle, false, // Always counterclockwise
        rotation);
        const object = IGMDriver.newIgmObject();
        for (const v of curve.getPoints(50)) {
            object.vectors.push(IGMDriver.newGCodeVector(v.x, v.y, entity.center.z));
        }
        return object;
    }
    doLine(entity, dxf) {
        const object = IGMDriver.newIgmObject();
        let i = 0;
        for (const v of entity.vertices) {
            //const v = entity.vertices[i]
            if (v.bulge) {
                const bulge = v.bulge;
                const startPoint = v;
                const endPoint = i + 1 < entity.vertices.length ? entity.vertices[i + 1] : object.vectors[0];
                //https://github.com/leandromundim/LaserWeb3/blob/4e883d5e305e0ffd3ce59fea953aa76ed9c6d730/public/lib/dxf/three-dxf.js
                const bulgeGeometry = new BulgeGeometry(startPoint, endPoint, bulge);
                object.vectors.push.apply(object.vectors, bulgeGeometry.vertices);
            }
            else {
                object.vectors.push(IGMDriver.newGCodeVector(v.x, v.y, v.z));
            }
            i++;
        }
        //Close shapes
        if (entity.type != 'LINE' && entity.shape) {
            const startPoint = object.vectors[0];
            object.vectors.push(IGMDriver.newGCodeVector(startPoint.x, startPoint.y, startPoint.z));
        }
        return object;
    }
    doSpline(entity, dxf) {
        //var color = getColor(entity, data);
        const points = entity.controlPoints;
        let interpolatedPoints = [];
        if (entity.degreeOfSplineCurve == 2) {
            for (let i = 0; i + 2 < points.length; i = i + 2) {
                const curve = new QuadraticBezierCurve(points[i], points[i + 1], points[i + 2]);
                interpolatedPoints.push.apply(interpolatedPoints, curve.getPoints(50));
            }
        }
        else {
            const curve = new SplineCurve(points);
            interpolatedPoints = curve.getPoints(100);
        }
        const splineObject = IGMDriver.newIgmObject();
        splineObject.vectors = interpolatedPoints.map(v => IGMDriver.newGCodeVector(v.x, v.y, 0));
        return splineObject;
    }
    doDimension(entity, dxf) {
        const block = dxf.blocks[entity.block];
        if (!block || !block.entities) {
            return null;
        }
        const group = [];
        // if(entity.anchorPoint) {
        //     group.position.x = entity.anchorPoint.x
        //     group.position.y = entity.anchorPoint.y
        //     group.position.z = entity.anchorPoint.z
        //}
        for (const blockEntity of block.entities) {
            const children = this.doEntity(blockEntity, dxf);
            for (const childEntity of children) {
                group.push(childEntity);
            }
        }
        return group;
    }
}
/**
 * Calculates points for a curve between two points
 * @param startPoint - the starting point of the curve
 * @param endPoint - the ending point of the curve
 * @param bulge - a value indicating how much to curve
 * @param segments - number of segments between the two given points
 */
class BulgeGeometry {
    constructor(startPoint, endPoint, bulge, segments) {
        this.vertices = [];
        let p0;
        let p1;
        startPoint = p0 = startPoint || { x: 0, y: 0 };
        endPoint = p1 = endPoint || IGMDriver.newGCodeVector(1, 0);
        bulge = bulge || 1;
        const distanceTo = (v1, v2) => {
            const dx = v1.x - v2.x;
            const dy = v1.y - v2.y;
            return Math.sqrt(dx * dx + dy * dy);
        };
        const angle = 4 * Math.atan(bulge);
        const radius = distanceTo(p0, p1) / 2 / Math.sin(angle / 2);
        const center = this.polar(startPoint, radius, this.angle2(p0, p1) + (Math.PI / 2 - angle / 2));
        segments = segments || Math.max(Math.abs(Math.ceil(angle / (Math.PI / 18))), 6); // By default want a segment roughly every 10 degrees
        const startAngle = this.angle2(center, p0);
        const thetaAngle = angle / segments;
        this.vertices.push(IGMDriver.newGCodeVector(p0.x, p0.y, 0));
        for (let i = 1; i <= segments - 1; i++) {
            const vertex = this.polar(center, Math.abs(radius), startAngle + thetaAngle * i);
            this.vertices.push(IGMDriver.newGCodeVector(vertex.x, vertex.y, 0));
        }
    }
    /**
     * Returns the angle in radians of the vector (p1,p2). In other words, imagine
     * putting the base of the vector at coordinates (0,0) and finding the angle
     * from vector (1,0) to (p1,p2).
     * @param  {Object} p1 start point of the vector
     * @param  {Object} p2 end point of the vector
     * @return {Number} the angle
     */
    angle2(p1, p2) {
        const v1 = IGMDriver.newGCodeVector(p1.x, p1.y);
        const v2 = IGMDriver.newGCodeVector(p2.x, p2.y);
        this.sub(v2, v1); // sets v2 to be our chord
        this.normalize(v2); // normalize because cos(theta) =
        if (v2.y < 0) {
            return -Math.acos(v2.x);
        }
        return Math.acos(v2.x);
    }
    normalize(v) {
        return this.divideScalar(v, this.length(v) || 1);
    }
    length(v) {
        return Math.sqrt(v.x * v.x + v.y * v.y);
    }
    divideScalar(v, scalar) {
        return this.multiplyScalar(v, 1 / scalar);
    }
    multiplyScalar(v, scalar) {
        v.x *= scalar;
        v.y *= scalar;
        return v;
    }
    sub(v, w) {
        v.x -= w.x;
        v.y -= w.y;
        return v;
    }
    polar(point, distance, angle) {
        return {
            x: point.x + distance * Math.cos(angle),
            y: point.y + distance * Math.sin(angle)
        };
    }
}
//# sourceMappingURL=dxf-igm.transformer.js.map