import { Component, Inject, Input, Output, ViewChild, ElementRef } from '@angular/core';
import { toPath } from 'svg-catmull-rom-spline'
import { SvgPreviewComponent } from './svg-preview.component'
@Component({
  selector: 'jigsaw-wizard',
  templateUrl: './jigsaw-wizard.component.html'
})
export class JigsawWizardComponent {
  constructor() {
  }

  @ViewChild(SvgPreviewComponent)
  private previewContainer: SvgPreviewComponent

  rows: number = 2
  columns: number = 1
  width = 450
  height = 450;

  render() {
    let svg = this.generate()
    this.previewContainer.render(svg)
  }
  // Returns 6 points representing the shape of one edge of a puzzle piece.
  // Point coordinates are expressed as percentage distances across the width
  // and height of the piece.
  private edgeDistributions() {

    let randomBetween = function (min, max) {
      return Math.random() * (max - min) + min;
    };
    let baselineOffsets = {
      xMin: 33,
      xMax: 45,
      yMin: -5,
      yMax: 5
    };
    let upperOffsets = {
      xMin: 30,
      xMax: 40,
      yMin: 20,
      yMax: 34 
    };
    let point1 = [0, 0];
    let point2 = [
      randomBetween(baselineOffsets.xMin, baselineOffsets.xMax),
      randomBetween(baselineOffsets.yMin, baselineOffsets.yMax)
    ];
    let point3 = [
      randomBetween(upperOffsets.xMin, upperOffsets.xMax),
      randomBetween(upperOffsets.yMin, upperOffsets.yMax)
    ];
    let point4 = [
      randomBetween(100 - upperOffsets.xMax, 100 - upperOffsets.xMin),
      randomBetween(upperOffsets.yMin, upperOffsets.yMax)
    ];
    let point5 = [
      randomBetween(100 - baselineOffsets.xMax, 100 - baselineOffsets.xMin),
      randomBetween(baselineOffsets.yMin, baselineOffsets.yMax)
    ];
    let point6 = [100, 0];
    let sign = Math.random() < 0.5 ? -1 : 1;
    return [point1, point2, point3, point4, point5, point6].map((p) => {
      return [p[0] / 100, p[1] * sign / 100];
    });
  }
  // Builds an m + 1 x n matrix of edge shapes. The first and last rows
  // are straight edges.
  private buildDistributions(m, n) {
    let lineGroups = [];
    let lines = [];
    let i, j;
    for (j = 0; j < n; j++) {
      lines.push([[0, 0], [1, 0]]);
    }
    lineGroups.push(lines);
    for (i = 1; i < m; i++) {
      lines = [];
      for (j = 0; j < n; j++) {
        lines.push(this.edgeDistributions());
      }
      lineGroups.push(lines);
    }
    lines = [];
    for (j = 0; j < n; j++) {
      lines.push([[0, 0], [1, 0]]);
    }
    lineGroups.push(lines);
    return lineGroups;
  };

  private transposePoint(point) {
    return [point[1], point[0]];
  };

  private offsetPoint(point, columnIndex: number, rowIndex: number, columnWidth: number, rowHeight: number) {
    let offsetColumnPosition = (percent, columnWidth, columnIndex) => {
      let columnOffset = columnWidth * columnIndex;
      return percent * columnWidth + columnOffset;
    };
    let offsetRowPosition = (percent, rowHeight, rowIndex) => {
      let rowOffset = rowHeight * rowIndex;
      return percent * rowHeight + rowOffset;
    };
    let x = offsetColumnPosition(point[0], columnWidth, columnIndex);
    let y = offsetRowPosition(point[1], rowHeight, rowIndex);
    return [x, y];
  };
  private offsetPoints(lineGroups, offsetter: (point: any, columnIndex: number, rowIndex: number) => any) {
    for (let i = 0; i < lineGroups.length; i++) {
      let lines = lineGroups[i];
      for (let j = 0; j < lines.length; j++) {
        lines[j] = lines[j].map(function (point) {
          return offsetter(point, j, i);
        });
      }
    }
  };
  private buildPieces(rowCount, columnCount) {
    let rowHeight = this.height / rowCount;
    let columnWidth = this.width / columnCount;
    let pieces = [];
    let rows = this.buildDistributions(rowCount, columnCount);
    this.offsetPoints(rows, (point, j, i) => {
      return this.offsetPoint(point, j, i, columnWidth, rowHeight);
    });
    let columns = this.buildDistributions(columnCount, rowCount);
    this.offsetPoints(columns, (point, j, i) => {
      return this.offsetPoint(this.transposePoint(point), i, j, columnWidth, rowHeight);
    });
    for (let rowIndex = 1; rowIndex <= rowCount; rowIndex++) {
      for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
        var edges = [];
        edges.push(rows[rowIndex - 1][columnIndex]);
        edges.push(columns[columnIndex + 1][rowIndex - 1]);
        edges.push(rows[rowIndex][columnIndex].slice().reverse());
        edges.push(columns[columnIndex][rowIndex - 1].slice().reverse());
        pieces.push(edges);
      }
    }
    return pieces;
  };

  private piecePathData(piece: number[][]) {
    return piece.map((edge) => {
      //if (edge.length > 2) {
        let tolerance = 4;
        let highestQuality = true;
        let points = edge
        //let attribute = SVGCatmullRomSpline.toPath(points.map(points), tolerance, highestQuality);
        let attribute = toPath(points, tolerance, highestQuality);
        return attribute
      //} else {
      //  return 'M' + edge[0] + 'L' + edge[1]
      //}
      //return [1,1]//this.d3CurvedLine(edge);
    }).join('');
  };

  buildpoints(pieces: number[][][][]) {

    let piecesCircles = pieces.map((piece) => {

      let peicecircles = piece.map((edge) => {

        let edgecircles = edge.map((point) => {
          return this.svg.circle(point);
        })
        return edgecircles
      });
      return peicecircles.reduce((prev, curr) => { return prev.concat(curr) });
      //return circles;
    })
    return piecesCircles.reduce((prev, curr) => { return prev.concat(curr) });
  };
  buildPiecePaths(pieces) {
    return pieces.map((piece) => {
      return this.svg.path(this.piecePathData(piece));
    });
  };
  // SVG helpers
  svg = {
    docStart: `<?xml version="1.0" standalone="no"?>
      <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">`,
    openTag: '<svg xmlns="http://www.w3.org/2000/svg" version="1.0" width="' + this.width + '" height="' + this.height + '">',
    styletag: `
      <style>
        body {
          font: 13px sans-serif;
        }

        rect,
        circle,
        path {
          fill: blue;
          stroke: steelblue;
          stroke-width: 1.5px;
        }

        circle {
          fill: #fff;
          fill-opacity: .2;
        }

      </style>`,
    closeTag: '</svg>',
    path: (pathData) => { return '<path vector-effect="non-scaling-stroke" d="' + pathData + '"/>' },
    circle: (point) => { return '<circle class="EndPoint" cx="' + point[0] + '" cy="' + point[1] + '" r="10" />' }
  };

  private generate() {
    let rowCount = this.rows//parseInt($("#rowCount").val(), 10);
    let columnCount = this.columns//parseInt($("#columnCount").val(), 10);
    let pieces = this.buildPieces(rowCount, columnCount);
    //let pieces = []
    //pieces[0] = this.buildPieces(rowCount, columnCount)[0];

    let piecePaths = this.buildPiecePaths(pieces).join('\n');
    let points = this.buildpoints(pieces).join('\n');
    let svgNode = [
      this.svg.openTag,
      this.svg.styletag,
      piecePaths,
      //points,
      this.svg.closeTag
    ].join('');
    console.log(svgNode)
    return svgNode

  }



}