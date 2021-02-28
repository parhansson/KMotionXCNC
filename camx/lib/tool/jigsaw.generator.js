//import { toPath, toPoints } from 'svg-catmull-rom-spline'
/**
 * Convert 'points' to catmull rom bezier spline
 * @param {Array} points
 * @returns {Array}
 */
function toSplinePoints(points) {
    const n = points.length;
    // Abort if there are not sufficient points to draw a curve
    if (n < 3) {
        return points;
    }
    let p0 = points[0];
    let p1 = points[0];
    let p2 = points[1];
    let p3 = points[2];
    const pts = [points[0]];
    for (let i = 1; i < n; i++) {
        pts.push([
            ((-p0[0] + 6 * p1[0] + p2[0]) / 6),
            ((-p0[1] + 6 * p1[1] + p2[1]) / 6),
            ((p1[0] + 6 * p2[0] - p3[0]) / 6),
            ((p1[1] + 6 * p2[1] - p3[1]) / 6),
            p2[0],
            p2[1]
        ]);
        p0 = p1;
        p1 = p2;
        p2 = p3;
        p3 = points[i + 2] || p3;
    }
    return pts;
}
/**
 * Slice out a segment of 'points'
 * @param {Array} points
 * @param {Number} start
 * @param {Number} end
 * @returns {Array}
 */
function slice(points, start, end) {
    const pts = points.slice(start, end);
    // Remove control points for 'M'
    if (start) {
        pts[0] = pts[0].slice(-2);
    }
    return pts;
}
/**
 * Convert 'points' to svg path
 * @param {Array} points
 * @returns {String}
 */
function svgPath(points) {
    let p = '';
    let i = 0;
    for (const point of points) {
        if (i == 1) {
            p += ` C${point[0]}, ${point[1]}, ${point[2]}, ${point[3]}, ${point[4]}, ${point[5]}`;
        }
        else if (i > 1) {
            p += ` S${point[2]}, ${point[3]}, ${point[4]}, ${point[5]}`;
        }
        i++;
    }
    return p;
}
const templateOffsets = [
    {
        name: 'default',
        baselineOffsets: {
            xMin: 35,
            xMax: 43,
            yMin: -5,
            yMax: 5
        },
        upperOffsets: {
            xMin: 30,
            xMax: 40,
            yMin: 16,
            yMax: 30
        }
    }, {
        name: 'extreme',
        baselineOffsets: {
            xMin: 30,
            xMax: 48,
            yMin: -10,
            yMax: 10
        },
        upperOffsets: {
            xMin: 25,
            xMax: 45,
            yMin: 11,
            yMax: 35
        }
    }
];
export class JigsawGenerator {
    constructor() {
        this.rows = 3;
        this.columns = 3;
        this.showControlPoints = false;
        this.width = 500; //450
        this.height = 500; //450
        this.shapeOffsetName = 'default';
        // SVG helpers
        this.svg = {
            docStart: `<?xml version="1.0" standalone="no"?>
      <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">`,
            openTag: '<svg xmlns="http://www.w3.org/2000/svg" version="1.0" width="' + this.width + '" height="' + this.height + '">',
            styletag: `
      <style>
        body {
          /*
          font: 13px sans-serif
          */
        }

        circle{
          stroke: steelblue;
          stroke-width: 0.5px;
          fill: #fff;
          fill-opacity: .1;
        }

        rect,
        path {
          fill: steelblue;
          fill-opacity: .25;
          stroke: black;
          stroke-width: 1px;
        }

      </style>`,
            closeTag: '</svg>',
            path: (pathData) => `<path stroke="black" vector-effect="non-scaling-stroke" d="${pathData}"/>`,
            circle: (point) => `<circle class="EndPoint" cx="${point[0]}" cy="${point[1]}" r="5" />`
        };
    }
    setValues(values) {
        this.rows = values.rows;
        this.columns = values.columns;
        this.showControlPoints = values.showControlPoints;
        this.width = values.width;
        this.height = values.height;
        this.shapeOffsetName = values.shapeOffsetName;
    }
    requiredInput() {
        const inputs = [
            {
                type: 'text',
                controlType: 'selection',
                name: 'shapeOffsetName',
                label: 'Shape',
                options: [
                    { key: 'default', value: 'Standard' },
                    { key: 'extreme', value: 'Extreme' },
                ],
                value: 'default',
                required: true,
                order: 3
            }, {
                type: 'number',
                controlType: 'text',
                name: 'rows',
                label: 'Rows',
                value: 6,
                required: true,
                order: 1
            }, {
                type: 'number',
                controlType: 'text',
                name: 'columns',
                label: 'Columns',
                value: 6,
                required: true,
                order: 1
            }, {
                type: 'number',
                controlType: 'text',
                name: 'width',
                label: 'Width',
                value: 500,
                required: true,
                order: 1
            }, {
                type: 'number',
                controlType: 'text',
                name: 'height',
                label: 'Height',
                value: 500,
                required: true,
                order: 1
            }, {
                type: 'checkbox',
                controlType: 'bool',
                name: 'showControlPoints',
                label: 'Show control points',
                order: 2
            }
        ];
        return inputs;
    }
    generate(values) {
        this.setValues(values);
        return Promise.reject(new Error('Method not implemented.'));
    }
    generateSVG(values) {
        this.setValues(values);
        const rowCount = this.rows;
        const columnCount = this.columns;
        const pieces = this.buildPieces(rowCount, columnCount);
        const piecePaths = this.buildPiecePaths(pieces).join('\n');
        let controlPoints;
        if (this.showControlPoints) {
            controlPoints = this.buildpoints(pieces).join('\n');
        }
        else {
            controlPoints = [];
        }
        const svgNode = [
            this.svg.openTag,
            this.svg.styletag,
            piecePaths,
            controlPoints,
            this.svg.closeTag
        ].join('');
        return Promise.resolve(svgNode);
    }
    // Returns 6 points representing the shape of one edge of a puzzle piece.
    // Point coordinates are expressed as percentage distances across the width
    // and height of the piece.
    edgeDistributions() {
        const randomBetween = (min, max) => {
            return Math.random() * (max - min) + min;
        };
        const offset = templateOffsets.find(o => o.name === this.shapeOffsetName);
        if (!offset) {
            console.error(`No shape found for ${this.shapeOffsetName}`);
            return;
        }
        const baselineOffsets = offset.baselineOffsets;
        const upperOffsets = offset.upperOffsets;
        const point1 = [0, 0];
        const point2 = [
            randomBetween(baselineOffsets.xMin, baselineOffsets.xMax),
            randomBetween(baselineOffsets.yMin, baselineOffsets.yMax)
        ];
        const point3 = [
            randomBetween(upperOffsets.xMin, upperOffsets.xMax),
            randomBetween(upperOffsets.yMin, upperOffsets.yMax)
        ];
        const point4 = [
            randomBetween(100 - upperOffsets.xMax, 100 - upperOffsets.xMin),
            randomBetween(upperOffsets.yMin, upperOffsets.yMax)
        ];
        //add midpoint somewhere between upper offset points
        const midpoint = [
            randomBetween(point3[0] + 10, point4[0] - 10),
            randomBetween(Math.max(point3[1], point4[1]) + 4, Math.max(point3[1], point4[1]) + 8)
        ];
        const point5 = [
            randomBetween(100 - baselineOffsets.xMax, 100 - baselineOffsets.xMin),
            randomBetween(baselineOffsets.yMin, baselineOffsets.yMax)
        ];
        const point6 = [100, 0];
        //Randomly flip edge 
        const sign = Math.random() < 0.5 ? -1 : 1;
        const result = [point1, point2, point3, midpoint, point4, point5, point6].map((p) => {
            return [p[0] / 100, p[1] * sign / 100];
        });
        return result;
    }
    // Builds an m + 1 x n matrix of edge shapes. The first and last rows
    // are straight edges.
    buildDistributions(m, n) {
        const lineGroups = [];
        let lines = [];
        for (let j = 0; j < n; j++) {
            lines.push([[0, 0], [1, 0]]);
        }
        lineGroups.push(lines);
        for (let i = 1; i < m; i++) {
            lines = [];
            for (let j = 0; j < n; j++) {
                lines.push(this.edgeDistributions());
            }
            lineGroups.push(lines);
        }
        lines = [];
        for (let j = 0; j < n; j++) {
            lines.push([[0, 0], [1, 0]]);
        }
        lineGroups.push(lines);
        return lineGroups;
    }
    transposePoint(point) {
        return [point[1], point[0]];
    }
    offsetPoint(point, columnIndex, rowIndex, columnWidth, rowHeight) {
        const offsetPosition = (percent, length, index) => {
            const offset = length * index;
            return percent * length + offset;
        };
        const x = offsetPosition(point[0], columnWidth, columnIndex);
        const y = offsetPosition(point[1], rowHeight, rowIndex);
        return [x, y];
    }
    offsetPoints(lineGroups, offsetter) {
        for (let i = 0; i < lineGroups.length; i++) {
            const lines = lineGroups[i];
            for (let j = 0; j < lines.length; j++) {
                lines[j] = lines[j].map((point) => {
                    return offsetter(point, j, i);
                });
            }
        }
    }
    buildPieces(rowCount, columnCount) {
        const rowHeight = this.height / rowCount;
        const columnWidth = this.width / columnCount;
        const pieces = [];
        const rows = this.buildDistributions(rowCount, columnCount);
        this.offsetPoints(rows, (point, j, i) => {
            return this.offsetPoint(point, j, i, columnWidth, rowHeight);
        });
        const columns = this.buildDistributions(columnCount, rowCount);
        this.offsetPoints(columns, (point, j, i) => {
            return this.offsetPoint(this.transposePoint(point), i, j, columnWidth, rowHeight);
        });
        for (let rowIndex = 1; rowIndex <= rowCount; rowIndex++) {
            for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
                const edges = [];
                edges.push(rows[rowIndex - 1][columnIndex]);
                edges.push(columns[columnIndex + 1][rowIndex - 1]);
                edges.push(rows[rowIndex][columnIndex].slice().reverse());
                edges.push(columns[columnIndex][rowIndex - 1].slice().reverse());
                pieces.push(edges);
            }
        }
        return pieces;
    }
    edgePathdata(edge) {
        const interpolateLines = false;
        if (edge.length > 2 || interpolateLines) {
            const tolerance = 4;
            const highestQuality = true;
            const points = edge;
            //let attribute = SVGCatmullRomSpline.toPath(points.map(points), tolerance, highestQuality)
            //const attribute: string = toPath(points, tolerance, highestQuality)
            //const attribute: string = toPath(points)
            const attribute = svgPath(toSplinePoints(points));
            //console.log(points, attribute)
            return attribute;
        }
        else {
            //return `M${edge[0][0]},${edge[0][1]}L${edge[1][0]},${edge[1][1]}`
            return `L${edge[1][0]},${edge[1][1]}`;
        }
    }
    piecePathData(piece) {
        const piecePath = piece.map((edge) => {
            return this.edgePathdata(edge);
        });
        //if (piece[0].length < 3)  {
        piecePath.unshift(`M${piece[0][0][0]},${piece[0][0][1]}`);
        //}
        return piecePath;
    }
    buildpoints(pieces) {
        const piecesCircles = pieces.map((piece) => {
            const peicecircles = piece.map((edge) => {
                const edgecircles = edge.map((point) => {
                    return this.svg.circle(point);
                });
                return edgecircles;
            });
            return peicecircles.reduce((prev, curr) => prev.concat(curr));
            //return circles
        });
        return piecesCircles.reduce((prev, curr) => prev.concat(curr));
    }
    buildPiecePaths(pieces) {
        return pieces.map((piece) => {
            return this.svg.path(this.piecePathData(piece).join(''));
            //return this.piecePathData(piece).map(edgePath => this.svg.path(edgePath)) 
        });
    }
}
//# sourceMappingURL=jigsaw.generator.js.map