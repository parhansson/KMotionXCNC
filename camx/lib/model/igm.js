// Intermediate Gcode Model
export class IGM {
    constructor(metric = true) {
        this.metric = metric;
        //TODO Changing IGM to interface will break instanceof when transforming
        this.layers = {}; // sort by stroke color
        this.layerKeys = []; // layerKey is a mapping to add unnamed layers, layer will get a generated name
        this.textLayer = []; // textpaths
        this.unsupported = []; // Unsupported nodes
        this.rawLine = [];
    }
}
/**
 * All operations on an IGM should be done via IGMDriver operations
 */
export class IGMDriver {
    constructor(igm) {
        this.igm = igm;
    }
    addRaw(raw) {
        this.igm.rawLine.push(raw);
    }
    addUnsupported(obj) {
        this.igm.unsupported.push(obj);
    }
    addToLayerObject(layerKey, obj, layerName) {
        if (layerName === undefined) {
            layerName = this.igm.layerKeys[layerKey];
            if (layerName === undefined) {
                let layerNumber = 0; //this.layerKeys.length;
                do {
                    layerNumber++;
                    layerName = 'layer' + layerNumber;
                } while (this.igm.layers[layerName] !== undefined);
            }
        }
        //TODO check for renaming layers
        this.igm.layerKeys[layerKey] = layerName;
        this.igm.layers[layerName] = this.igm.layers[layerName] || [];
        if (obj instanceof Array) {
            Array.prototype.push.apply(this.igm.layers[layerName], obj);
        }
        else {
            this.igm.layers[layerName].push(obj);
        }
    }
    get allObjectsFlat() {
        let all = [];
        for (const prop in this.igm.layers) {
            // important check that this is objects own property 
            // not from prototype prop inherited
            if (this.igm.layers.hasOwnProperty(prop)) {
                console.log('layerName', prop);
                const vectors = this.igm.layers[prop];
                all = all.concat(vectors);
            }
        }
        return all;
    }
    applyModifications(settings) {
        const shapes = this.allObjectsFlat;
        console.info('Nr of Shapes: ', shapes.length);
        if (settings.removeSingularites) {
            console.time('Removed single points');
            const removed = this.removeSingularites(shapes);
            console.info('Removed single points: ', removed);
            console.timeEnd('Removed single points');
        }
        console.log('Scaling model', settings.scale);
        console.time('Scaling');
        IGMDriver.scale(shapes, settings.scale);
        console.timeEnd('Scaling');
        //Bounds are needed by removeDuplicates
        console.time('Update bounds');
        IGMDriver.updateBounds(shapes);
        console.timeEnd('Update bounds');
        // cut the inside parts first
        if (settings.removeDuplicates) {
            //This function will change the order of the paths
            console.time('Remove duplcates');
            const removed = this.removeDuplicates(shapes);
            console.info('Removed duplicates: ', removed);
            console.timeEnd('Remove duplcates');
        }
        console.time('Order nearest');
        this.orderNearestNeighbour(shapes, true);
        console.timeEnd('Order nearest');
        console.time('Join adjacent');
        const joined = this.joinAdjacent(shapes, settings.fractionalDigits);
        console.info('Joined adjacents: ', joined);
        console.timeEnd('Join adjacent');
        IGMDriver.updateBounds(shapes);
        const maxBounds = this.getMaxBounds(shapes);
        if (settings.removeOutline) {
            //Some files has an outline. remove it if requested
            this.removeOutline(shapes, maxBounds);
        }
        if (settings.translateToOrigo) {
            const translateVec = IGMDriver.newGCodeVector(-maxBounds.x, -maxBounds.y, 0);
            IGMDriver.translate(shapes, translateVec);
        }
        //Add support for offsetting models on import
        //if(settings.offset){
        //const offesetVec = IGMDriver.newGCodeVector(0, -60, 0)
        //IGMDriver.translate(shapes, offesetVec)
        //}
        console.info('Nr of Shapes after: ', shapes.length);
        return shapes;
    }
    static newIgmObject() {
        return {
            cmd: '',
            type: '',
            vectors: [],
            args: [],
            bounds: null,
            //replace bounds with min and max. this will include all axes
            // min: GCodeVector
            // max: GCodeVector
            node: null
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
    static vectorScale(thisV, scale) {
        thisV.x = thisV.x * scale;
        thisV.y = thisV.y * scale;
        thisV.z = thisV.z * scale;
        return thisV;
    }
    static vectorAdd(thisV, v) {
        thisV.x += v.x;
        thisV.y += v.y;
        thisV.z += v.z;
        return thisV;
    }
    static vectorEquals(thisV, v) {
        return ((v.x === thisV.x) && (v.y === thisV.y) && (v.z === thisV.z));
    }
    static distanceSquared(thisV, v) {
        const dx = thisV.x - v.x;
        const dy = thisV.y - v.y;
        const dz = thisV.z - v.z;
        return dx * dx + dy * dy + dz * dz;
    }
    static distanceTo(thisV, v) {
        return Math.cbrt(IGMDriver.distanceSquared(thisV, v));
    }
    static doOperation(shape, operation) {
        let shapes;
        if (shape instanceof Array) {
            shapes = shape;
        }
        else {
            shapes = [shape];
        }
        let shapeIdx = shapes.length;
        while (shapeIdx--) {
            const curShape = shapes[shapeIdx];
            let vecIdx = curShape.vectors.length;
            while (vecIdx--) {
                const vec = curShape.vectors[vecIdx];
                operation(vec);
            }
        }
        return shape;
    }
    static translate(shape, translateVec) {
        return this.doOperation(shape, (vec) => IGMDriver.vectorAdd(vec, translateVec));
    }
    static scale(shape, ratio) {
        if (ratio === 1) {
            return shape;
        }
        return this.doOperation(shape, (vec) => IGMDriver.vectorScale(vec, ratio));
    }
    static clone(shape) {
        const copy = IGMDriver.newIgmObject();
        for (const vec of shape.vectors) {
            copy.vectors.push(IGMDriver.newGCodeVector(vec.x, vec.y, vec.z, vec.a, vec.b, vec.c));
        }
        return copy;
    }
    static start(shape) {
        return shape.vectors[0];
    }
    static end(shape) {
        return shape.vectors[shape.vectors.length - 1];
    }
    static first(arr) {
        return arr[0];
    }
    static last(arr) {
        return arr[arr.length - 1];
    }
    static updateBounds(shapes) {
        let idx = shapes.length;
        while (idx--) {
            const bounds = new BoundRect();
            const shape = shapes[idx];
            const vectors = shape.vectors;
            if (vectors === undefined) {
                console.info('what', idx);
            }
            let subidx = vectors.length;
            while (subidx--) {
                const vec = vectors[subidx];
                bounds.include(vec);
            }
            shape.bounds = bounds;
        }
    }
    getMaxBounds(paths) {
        const maxBounds = new BoundRect();
        let idx = paths.length;
        while (idx--) {
            const igmObj = paths[idx];
            const vectors = igmObj.vectors;
            maxBounds.include(igmObj.bounds.vec1());
            maxBounds.include(igmObj.bounds.vec2());
        }
        return maxBounds;
    }
    /**
     * I know I know, This does not work
     */
    removeDuplicates(paths) {
        let removed = 0;
        paths.sort(function (a, b) {
            //TODO sort by number of vectors. should work alot better
            //Only compare shapes with the same number of vectors
            // sort by area
            const aArea = a.bounds.area(); //TODO area needs to count zero with as 1
            const bArea = b.bounds.area();
            let result = aArea - bArea;
            if (result == 0) {
                const avec = a.vectors[0];
                const bvec = b.vectors[0];
                //TODO Experimental only, Need to compare whole path not just first point
                //and reverse path
                result = avec.x - bvec.x;
                if (result == 0) {
                    result = avec.y - bvec.y;
                }
            }
            return result;
        });
        let idx = paths.length;
        while (idx-- > 1) {
            //TODO Experimental only, Need to compare whole path not just start and end point
            const o1 = paths[idx];
            const o2 = paths[idx - 1];
            if (IGMDriver.vectorEquals(IGMDriver.start(o1), IGMDriver.start(o2)) && IGMDriver.vectorEquals(IGMDriver.end(o1), IGMDriver.end(o2))) {
                removed++;
                paths.splice(idx, 1);
            }
        }
        return removed;
    }
    removeSingularites(shapes) {
        let removed = 0;
        let idx = shapes.length;
        while (idx--) {
            if (shapes[idx].vectors.length == 1) {
                removed++;
                shapes.splice(idx, 1);
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
     * @param paths
     * @param fractionalDigits
     */
    joinAdjacent(paths, fractionalDigits) {
        let joined = 0;
        if (paths.length < 2) {
            return joined;
        }
        let idx = 0;
        let last = paths[idx++];
        while (idx < paths.length) {
            const next = paths[idx];
            const lastEnd = IGMDriver.end(last);
            const nextStart = IGMDriver.start(next);
            //console.info(lastEnd, nextStart);
            //TODO check reverse path as well and reverse that
            if (this.pointEquals(lastEnd, nextStart, fractionalDigits)) {
                last.vectors.push.apply(last.vectors, next.vectors);
                paths.splice(idx, 1);
                joined++;
            }
            else {
                last = next;
                idx++;
            }
        }
        return joined;
    }
    pointEquals(v1, v2, fractionalDigits) {
        //TODO use distanceSquared and compare with toleranceSquared instead
        return (v1.x.toFixed(fractionalDigits) === v2.x.toFixed(fractionalDigits) &&
            v1.y.toFixed(fractionalDigits) === v2.y.toFixed(fractionalDigits));
    }
    orderNearestNeighbour(paths, reversePaths) {
        //These are the steps of the algorithm:
        //
        //  start on an arbitrary vertex as current vertex.
        //  find out the shortest edge connecting current vertex and an unvisited vertex V.
        //  set current vertex to V.
        //  mark V as visited.
        //  if all the vertices in domain are visited, then terminate.
        //  Go to step 2.
        const orderedPaths = [];
        let next = this.nearest(IGMDriver.newGCodeVector(0, 0, 0), paths, reversePaths);
        if (next) { // next is undefined if paths is an empty array
            orderedPaths.push(next);
            while (paths.length > 0) {
                next = this.nearest(IGMDriver.end(next), paths, reversePaths);
                orderedPaths.push(next);
            }
            paths.push.apply(paths, orderedPaths);
        }
    }
    nearest(point, paths, reversePaths) {
        let dist = Infinity;
        let index = -1;
        let reverseIndex = -1;
        for (let pathIdx = 0, pathLength = paths.length; pathIdx < pathLength; pathIdx++) {
            const shape = paths[pathIdx];
            const pathStartPoint = shape.vectors[0];
            let distanceSquared;
            const startDS = IGMDriver.distanceSquared(pathStartPoint, point);
            if (reversePaths) {
                //check endpoint as well and reverse path if endpoint is closer
                const pathEndPoint = IGMDriver.end(shape);
                const endDS = IGMDriver.distanceSquared(pathEndPoint, point);
                if (startDS < endDS) {
                    distanceSquared = startDS;
                }
                else {
                    distanceSquared = endDS;
                    //only reverse if shape actually used
                    reverseIndex = pathIdx;
                    //shape.vectors.reverse()
                }
            }
            else {
                distanceSquared = startDS;
            }
            if (distanceSquared < dist) {
                dist = distanceSquared;
                index = pathIdx;
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
        //console.log(reverseIndex, paths.length)
        const nearest = paths.splice(index, 1)[0];
        //only reverse if shape actually used
        if (index > -1 && index === reverseIndex) {
            nearest.vectors.reverse();
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