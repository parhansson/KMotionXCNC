import { ArcCurve } from './vector';
// Intermediate Gcode Model
export class IGM {
    constructor(metric = true) {
        this.metric = metric;
        //TODO Changing IGM to interface will break instanceof when transforming
        this.layers = {}; // sort by stroke color
        //readonly layerKeys: any[] = [] // layerKey is a mapping to add unnamed layers, layer will get a generated name
        this.textLayer = []; // textpaths
        this.unsupported = []; // Unsupported nodes
        this.rawLine = [];
        this.layerStatus = {};
    }
}
/**
 * All operations on an IGM should be done via IGMDriver operations
 */
export class IGMDriver {
    constructor(igm) {
        this.igm = igm;
    }
    static newLine(vectors) {
        return this.newIgmObject({
            type: 'LINE',
            vectors: vectors || []
        });
    }
    static newArc(x, //center of arc
    y, //center of arc
    radius, startAngle, endAngle, clockwise) {
        return this.newIgmObject({
            type: 'ARC',
            x,
            y,
            radius,
            startAngle,
            endAngle,
            clockwise
        });
    }
    static newIgmObject(geometry) {
        const object = {
            geometry,
            bounds: null,
        };
        return object;
    }
    static newGCodeVector3(v) {
        return {
            x: v.x || 0,
            y: v.y || 0,
            z: v.z || 0,
            a: 0,
            b: 0,
            c: 0
        };
    }
    static newGCodeVector(x, y, z, a, b, c) {
        return {
            x: x || 0,
            y: y || 0,
            z: z || 0,
            a: a || 0,
            b: b || 0,
            c: c || 0
        };
    }
    reverse(shape) {
        const geometry = shape.geometry;
        if (geometry.type === 'ARC') {
            geometry.clockwise = !geometry.clockwise;
            const startAngle = geometry.startAngle;
            geometry.startAngle = geometry.endAngle;
            geometry.endAngle = startAngle;
        }
        else if (geometry.type === 'LINE') {
            geometry.vectors.reverse();
        }
        this.updateLimit(geometry);
    }
    updateLimit(geometry) {
        if (geometry.type === 'ARC') {
            this.updateArcLimit(geometry);
        }
        if (geometry.type === 'LINE') {
            this.updateLineLimit(geometry);
        }
    }
    updateLineLimit(geometry) {
        geometry.limit = {
            start: geometry.vectors[0],
            end: geometry.vectors[geometry.vectors.length - 1]
        };
    }
    updateArcLimit(geometry) {
        const curve = new ArcCurve(geometry.x, geometry.y, geometry.radius, geometry.startAngle, geometry.endAngle, geometry.clockwise);
        const start = curve.getPoint(0);
        const end = curve.getPoint(1);
        geometry.limit = {
            start: IGMDriver.newGCodeVector3(start),
            end: IGMDriver.newGCodeVector3(end)
        };
    }
    start(shape) {
        //this.updateLimit(shape.geometry)
        return shape.geometry.limit.start;
    }
    end(shape) {
        //this.updateLimit(shape.geometry)
        return shape.geometry.limit.end;
    }
    addRaw(raw) {
        this.igm.rawLine.push(raw);
    }
    addUnsupported(obj) {
        this.igm.unsupported.push(obj);
    }
    addToLayerObject(layerKey, obj) {
        if (layerKey === undefined) {
            layerKey = 'undefined';
        }
        if (layerKey === null) {
            layerKey = 'null';
        }
        //TODO check for renaming layers
        this.igm.layers[layerKey] = this.igm.layers[layerKey] || { visible: true, objects: [] };
        const layerObjects = this.igm.layers[layerKey].objects;
        const newObjects = obj instanceof Array ? obj : [obj];
        for (const shape of newObjects) {
            this.updateLimit(shape.geometry);
            layerObjects.push(shape);
        }
        this.updateBounds(newObjects);
    }
    get allVisibleObjects() {
        let all = [];
        for (const layerName in this.igm.layers) {
            // important check that this is objects own property 
            // not from prototype prop inherited
            if (this.igm.layers.hasOwnProperty(layerName)) {
                const layer = this.igm.layers[layerName];
                if (layer.visible !== false) {
                    console.log('layerName', layerName);
                    const vectors = layer.objects;
                    all = all.concat(vectors);
                }
            }
        }
        return all;
    }
    get allObjectsFlat() {
        let all = [];
        for (const layerName in this.igm.layers) {
            // important check that this is objects own property 
            // not from prototype prop inherited
            if (this.igm.layers.hasOwnProperty(layerName)) {
                console.log('layerName', layerName);
                const layer = this.igm.layers[layerName];
                const vectors = layer.objects;
                all = all.concat(vectors);
            }
        }
        return all;
    }
    setLayerStatus(status) {
        for (const layerName in status) {
            // important check that this is objects own property 
            // not from prototype prop inherited
            if (status.hasOwnProperty(layerName)) {
                const layer = this.igm.layers[layerName];
                if (layer) {
                    layer.visible = status[layerName];
                }
            }
        }
    }
    applyModifications(settings, onlyVisible) {
        const shapes = onlyVisible ? this.allVisibleObjects : this.allObjectsFlat;
        console.info('Nr of Shapes: ', shapes.length);
        const time = (name, f) => {
            console.time(name);
            const result = f();
            console.timeEnd(name);
            return result;
        };
        if (settings.removeSingularites) {
            const removed = time('Remove single points', () => this.removeSingularites(shapes));
            console.info('Single points removed: ', removed);
        }
        if (settings.scale !== 1) {
            console.log('Scaling model', settings.scale);
            time('Scaling', () => this.scale(shapes, settings.scale));
        }
        //Bounds are needed by removeDuplicates (wich is removed)
        time('Update bounds', () => this.updateBounds(shapes));
        if (settings.calculateShortestPath || settings.joinAdjacent) {
            time('Order nearest', () => this.orderNearestNeighbour(shapes, true));
        }
        if (settings.joinAdjacent) {
            const joined = time('Join adjacent', () => this.joinAdjacent(shapes, settings.fractionalDigits));
            console.info('Joined adjacents: ', joined);
            this.updateBounds(shapes);
        }
        const maxBounds = this.getMaxBounds(shapes);
        if (settings.removeOutline) {
            //Some files has an outline. remove it if requested
            console.info('Removing outline');
            this.removeOutline(shapes, maxBounds);
        }
        if (settings.translateToOrigo) {
            time('Abut origo', () => {
                const translateVec = IGMDriver.newGCodeVector(-maxBounds.x, -maxBounds.y, 0);
                this.translate(shapes, translateVec);
            });
        }
        //Add support for offsetting models on import
        //if(settings.offset){
        //const offesetVec = IGMDriver.newGCodeVector(0, -60, 0)
        //IGMDriver.translate(shapes, offesetVec)
        //}
        console.info('Nr of Shapes after: ', shapes.length);
        return shapes;
    }
    vectorScale(thisV, scale) {
        thisV.x = thisV.x * scale;
        thisV.y = thisV.y * scale;
        thisV.z = thisV.z * scale;
        return thisV;
    }
    vectorAdd(thisV, v) {
        thisV.x += v.x;
        thisV.y += v.y;
        thisV.z += v.z;
        return thisV;
    }
    vectorEquals(thisV, v) {
        return ((v.x === thisV.x) && (v.y === thisV.y) && (v.z === thisV.z));
    }
    distanceSquared(thisV, v) {
        const dx = thisV.x - v.x;
        const dy = thisV.y - v.y;
        const dz = thisV.z - v.z;
        return dx * dx + dy * dy + dz * dz;
    }
    distanceTo(thisV, v) {
        return Math.sqrt(this.distanceSquared(thisV, v));
    }
    doOperation(shape, type, operation) {
        if (shape.geometry.type == 'ARC') {
            const arc = shape.geometry;
            if (type === 'scale') {
                //This works for scaling, but will break radii when moving
                const scaleHack = IGMDriver.newGCodeVector(arc.x, arc.y, arc.radius);
                operation(scaleHack);
                arc.x = scaleHack.x;
                arc.y = scaleHack.y;
                arc.radius = scaleHack.z;
            }
            else {
                const translation = IGMDriver.newGCodeVector(arc.x, arc.y, 0);
                operation(translation);
                arc.x = translation.x;
                arc.y = translation.y;
                //arc.radius = scaleHack.z
            }
        }
        else if (shape.geometry.type == 'LINE') {
            shape.geometry.vectors.forEach(vec => operation(vec));
        }
        this.updateLimit(shape.geometry);
        //TODO add operations for other geometries
        return shape;
    }
    translate(input, translateVec) {
        const shapes = input instanceof Array ? input : [input];
        for (const shape of shapes) {
            this.doOperation(shape, 'translate', (vec) => this.vectorAdd(vec, translateVec));
        }
        return input;
    }
    scale(input, ratio) {
        if (ratio === 1) {
            return input;
        }
        const shapes = input instanceof Array ? input : [input];
        for (const shape of shapes) {
            this.doOperation(shape, 'scale', (vec) => this.vectorScale(vec, ratio));
        }
        return input;
    }
    clone(shape) {
        const cloneVec = (vec) => IGMDriver.newGCodeVector(vec.x, vec.y, vec.z, vec.a, vec.b, vec.c);
        if (shape.geometry.type == 'LINE') {
            const copyVec = [];
            for (const vec of shape.geometry.vectors) {
                copyVec.push(cloneVec(vec));
            }
            return IGMDriver.newLine(copyVec);
        }
        else if (shape.geometry.type == 'ARC') {
            const g = shape.geometry;
            return IGMDriver.newArc(g.x, g.y, g.radius, g.startAngle, g.endAngle, g.clockwise);
        }
    }
    updateBounds(shapes) {
        shapes.forEach(shape => {
            const bounds = new BoundRect();
            const vectors = this.explode(shape);
            vectors.forEach(vec => bounds.include(vec));
            shape.bounds = bounds;
        });
        let idx = shapes.length;
        while (idx--) {
            const shape = shapes[idx];
        }
    }
    explode(shape) {
        const geometry = shape.geometry;
        if (geometry.type === 'LINE') {
            return geometry.vectors;
        }
        if (geometry.type === 'ARC') {
            //need to explode arc into vectors
            //32 vectors should be enough to approximate bounds
            return new ArcCurve(geometry.x, geometry.y, geometry.radius, geometry.startAngle, geometry.endAngle, geometry.clockwise).getPoints(32);
        }
        return [];
    }
    getMaxBounds(shapes) {
        this.updateBounds(shapes);
        const maxBounds = new BoundRect();
        let idx = shapes.length;
        while (idx--) {
            const shape = shapes[idx];
            maxBounds.include(shape.bounds.vec1());
            maxBounds.include(shape.bounds.vec2());
        }
        return maxBounds;
    }
    removeSingularites(shapes) {
        let removed = 0;
        let idx = shapes.length;
        while (idx--) {
            const shape = shapes[idx];
            if (shape.geometry.type === 'LINE') {
                if (shape.geometry.vectors.length == 1) {
                    removed++;
                    shapes.splice(idx, 1);
                }
            }
        }
        return removed;
    }
    removeOutline(paths, maxBounds) {
        //TODO Find object with the same size as maxbounds.
        //currently this just asumes the largest object is first
        paths.pop();
    }
    /**
     * Joining adjacent shapes. This implementation depends on orderNearestNeighbour first
     * However orderNearestNeighbour might check if reverse path is nearest and reverses
     * @param shapes
     * @param fractionalDigits
     */
    joinAdjacent(shapes, fractionalDigits) {
        let joined = 0;
        if (shapes.length < 2) {
            return joined;
        }
        let idx = 0;
        let last = shapes[idx++];
        while (idx < shapes.length) {
            const next = shapes[idx];
            if (next.geometry) {
                idx++;
                continue;
            }
            const lastEnd = this.end(last);
            const nextStart = this.start(next);
            //console.info(lastEnd, nextStart);
            //TODO check reverse path as well and reverse that
            if (last.geometry.type === 'LINE' && next.geometry.type === 'LINE') {
                if (this.pointEquals(lastEnd, nextStart, fractionalDigits)) {
                    Array.prototype.push.apply(last.geometry.vectors, next.geometry.vectors);
                    //
                    this.updateLimit(last.geometry);
                    this.updateBounds([last]);
                    shapes.splice(idx, 1);
                    joined++;
                }
                else {
                    last = next;
                    idx++;
                }
            }
        }
        return joined;
    }
    pointEquals(v1, v2, fractionalDigits) {
        //TODO use distanceSquared and compare with toleranceSquared instead
        return (v1.x.toFixed(fractionalDigits) === v2.x.toFixed(fractionalDigits) &&
            v1.y.toFixed(fractionalDigits) === v2.y.toFixed(fractionalDigits));
    }
    orderNearestNeighbour(shapes, reversePaths) {
        //These are the steps of the algorithm:
        //
        //  start on an arbitrary vertex as current vertex.
        //  find out the shortest edge connecting current vertex and an unvisited vertex V.
        //  set current vertex to V.
        //  mark V as visited.
        //  if all the vertices in domain are visited, then terminate.
        //  Go to step 2.
        const orderedPaths = [];
        let next = this.nearest(IGMDriver.newGCodeVector(0, 0, 0), shapes, reversePaths);
        if (next) { // next is undefined if paths is an empty array
            orderedPaths.push(next);
            while (shapes.length > 0) {
                next = this.nearest(this.end(next), shapes, reversePaths);
                orderedPaths.push(next);
            }
            shapes.push.apply(shapes, orderedPaths);
        }
    }
    nearest(point, shapes, reversePaths) {
        let dist = Infinity;
        let index = -1;
        let reverseIndex = -1;
        for (let shapeIdx = 0, shapeCount = shapes.length; shapeIdx < shapeCount; shapeIdx++) {
            const shape = shapes[shapeIdx];
            const shapeStart = this.start(shape);
            let distance;
            const startDS = this.distanceTo(shapeStart, point);
            let foundreverse = false;
            if (reversePaths) {
                //check endpoint as well and reverse path if endpoint is closer
                const shapeEnd = this.end(shape);
                const endDS = this.distanceTo(shapeEnd, point);
                if (startDS <= endDS) {
                    distance = startDS;
                }
                else {
                    distance = endDS;
                    //only reverse if shape actually used
                    foundreverse = true;
                }
            }
            else {
                distance = startDS;
            }
            if (distance < dist) {
                dist = distance;
                index = shapeIdx;
                if (foundreverse) {
                    reverseIndex = shapeIdx;
                }
            }
            //experiment with tolerance check. If dist < tolerance break loop since finding a closer path probably won't matter
            // if(!shape.node.text){ //some text shapes generates 
            //   if(dist < 0.1){
            //     break
            //   }
            // } else  {
            //   console.log(shape.node.text)
            // }
        }
        const nearest = shapes.splice(index, 1)[0];
        //only reverse if shape actually used
        if (index > -1 && index === reverseIndex) {
            this.reverse(nearest);
        }
        return nearest;
    }
}
export class GCodeSource {
    constructor(gcode) {
        if (Array.isArray(gcode)) {
            this.lines = gcode;
            this.text = gcode.join('\n');
        }
        else {
            this.text = gcode;
            this.lines = gcode.split('\n');
        }
    }
}
export class BoundRect {
    constructor() {
        this.x = Infinity;
        this.y = Infinity;
        this.x2 = -Infinity;
        this.y2 = -Infinity;
    }
    scale(ratio) {
        this.x = this.x * ratio;
        this.y = this.y * ratio;
        this.x2 = this.x2 * ratio;
        this.y2 = this.y2 * ratio;
        return this;
    }
    vec1() {
        return IGMDriver.newGCodeVector(this.x, this.y, 0);
    }
    vec2() {
        return IGMDriver.newGCodeVector(this.x2, this.y2, 0);
    }
    include(vec) {
        const x = vec.x;
        const y = vec.y;
        if (x < this.x) {
            this.x = x;
        }
        if (y < this.y) {
            this.y = y;
        }
        if (x > this.x2) {
            this.x2 = x;
        }
        if (y > this.y2) {
            this.y2 = y;
        }
    }
    area() {
        return this.height() * this.width();
    }
    height() {
        const height = this.y2 - this.y;
        return height;
    }
    width() {
        const width = this.x2 - this.x;
        return width;
    }
}
//# sourceMappingURL=igm.js.map