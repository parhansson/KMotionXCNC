"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Dxf2IgmTransformer = void 0;
const igm_1 = require("../model/igm");
const dxf_parser_1 = __importDefault(require("dxf-parser"));
const kmxutil_1 = require("../util/kmxutil");
const vector_1 = require("../model/vector");
const INSUNITS = {
    // https://www.autodesk.com/techpubs/autocad/acad2000/dxf/header_section_group_codes_dxf_02.htm
    0: 1, // Unitless,
    1: 25.4, // Inches
    2: 304.8, // Feet
    3: 1609344, // Miles
    4: 1, // Millimeters
    5: 10, // Centimeters
    6: 1000, // Meters
    7: 1000000, // Kilometers
    8: 0.0000254, // Microinches 
    9: 0.0254, // Mils
    10: 914.4, // Yards
    11: 1.0e-7, // Angstroms
    12: 1.0e-6, // Nanometers
    13: 0.001, // Microns
    14: 100, // Decimeters
    15: 10000, // Decameters
    16: 100000, // Hectometers
    17: 1000000000000, // Gigameters
    18: 1, // Astronomical units
    19: 1, // Light years
    20: 1, // Parsecs
};
class Dxf2IgmTransformer {
    constructor(settings) {
        this.settings = settings;
    }
    transform(source) {
        return __awaiter(this, void 0, void 0, function* () {
            let fileText;
            if (source instanceof ArrayBuffer) {
                fileText = kmxutil_1.KMXUtil.ab2str(source);
            }
            else {
                fileText = source;
            }
            const model = new igm_1.IGM();
            this.driver = new igm_1.IGMDriver(model);
            const parser = new dxf_parser_1.default();
            try {
                const dxf = parser.parseSync(fileText);
                for (const entity of dxf.entities || []) {
                    const shapes = this.doEntity(entity, dxf);
                    for (const shape of shapes) {
                        this.driver.addToLayerObject(entity.layer, this.scale(shape, dxf));
                    }
                }
                console.log(dxf);
                return Promise.resolve(model);
            }
            catch (err) {
                console.error(err.stack);
                return Promise.reject(err);
            }
        });
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
        else if (this.isDimension(entity) && this.settings.includeDimension) {
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
        var _a;
        let unit = (_a = dxf.header) === null || _a === void 0 ? void 0 : _a.$INSUNITS;
        if (unit === undefined) {
            //unit = 1 // autocad defaults to Inches(1) if INSUNITS is missing    
            unit = 0; //but we use unitless here
        }
        this.driver.scale(shape, INSUNITS[unit]);
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
        const center = entity.center ? entity.center : { x: 0, y: 0 };
        const object = igm_1.IGMDriver.newArc(center.x, center.y, entity.radius, startAngle, endAngle, false);
        object.comment = `DXF Entity ${entity.type}`;
        return object;
    }
    doEllipse(entity, dxf) {
        //ar color = getColor(entity, data);
        const majorAxisEndPoint = entity.majorAxisEndPoint;
        const xrad = Math.sqrt(Math.pow(majorAxisEndPoint.x, 2) + Math.pow(majorAxisEndPoint.y, 2));
        const yrad = xrad * entity.axisRatio;
        const rotation = Math.atan2(majorAxisEndPoint.y, majorAxisEndPoint.x);
        const center = entity.center;
        const curve = new vector_1.EllipseCurve(center.x, center.y, xrad, yrad, entity.startAngle, entity.endAngle, false, // Always counterclockwise
        rotation);
        const vectors = [];
        for (const v of curve.getPoints(50)) {
            vectors.push(igm_1.IGMDriver.newGCodeVector(v.x, v.y, center.z));
        }
        const object = igm_1.IGMDriver.newLine(vectors);
        object.comment = `DXF Entity ${entity.type} `;
        return object;
    }
    doLine(entity, dxf) {
        const vectors = [];
        let i = 0;
        let hasBulgeLines = false;
        for (const v of entity.vertices) {
            //const v = entity.vertices[i]
            if (v.bulge) {
                hasBulgeLines = true;
                const bulge = v.bulge;
                const startPoint = v;
                const endPoint = i + 1 < entity.vertices.length ? entity.vertices[i + 1] : vectors[0];
                //https://github.com/leandromundim/LaserWeb3/blob/4e883d5e305e0ffd3ce59fea953aa76ed9c6d730/public/lib/dxf/three-dxf.js
                const bulgeGeometry = new BulgeGeometry(startPoint, endPoint, bulge);
                vectors.push.apply(vectors, bulgeGeometry.vertices);
            }
            else {
                vectors.push(igm_1.IGMDriver.newGCodeVector(v.x, v.y, v.z));
            }
            i++;
        }
        //Close shapes
        if (entity.type != 'LINE' && entity.shape) {
            const startPoint = vectors[0];
            vectors.push(igm_1.IGMDriver.newGCodeVector(startPoint.x, startPoint.y, startPoint.z));
        }
        const object = igm_1.IGMDriver.newLine(vectors);
        object.comment = `DXF Entity ${entity.type} ${hasBulgeLines ? 'Bulges' : ''}`;
        return object;
    }
    doSpline(entity, dxf) {
        //var color = getColor(entity, data);
        const points = entity.controlPoints;
        let interpolatedPoints = [];
        if (entity.degreeOfSplineCurve == 2) {
            for (let i = 0; i + 2 < points.length; i = i + 2) {
                const curve = new vector_1.QuadraticBezierCurve(points[i], points[i + 1], points[i + 2]);
                interpolatedPoints.push.apply(interpolatedPoints, curve.getPoints(50));
            }
        }
        else {
            const curve = new vector_1.SplineCurve(points);
            interpolatedPoints = curve.getPoints(100);
        }
        const splineObject = igm_1.IGMDriver.newLine(interpolatedPoints.map(v => igm_1.IGMDriver.newGCodeVector(v.x, v.y, 0)));
        splineObject.comment = `DXF Entity ${entity.type} `;
        return splineObject;
    }
    doDimension(entity, dxf) {
        const block = dxf.blocks[entity.block];
        if (!block || !block.entities) {
            return [];
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
exports.Dxf2IgmTransformer = Dxf2IgmTransformer;
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
        endPoint = p1 = endPoint || igm_1.IGMDriver.newGCodeVector(1, 0);
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
        this.vertices.push(igm_1.IGMDriver.newGCodeVector(p0.x, p0.y, 0));
        for (let i = 1; i <= segments - 1; i++) {
            const vertex = this.polar(center, Math.abs(radius), startAngle + thetaAngle * i);
            this.vertices.push(igm_1.IGMDriver.newGCodeVector(vertex.x, vertex.y, 0));
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
        const v1 = igm_1.IGMDriver.newGCodeVector(p1.x, p1.y);
        const v2 = igm_1.IGMDriver.newGCodeVector(p2.x, p2.y);
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
