declare module 'svg-path-parser' {
  export interface SvgPathCommand {
    code: string;
    command: string;
    relative?: boolean;
    x0?: number;
    y0?: number;
    x?: number;
    y?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
    rx?: number;
    ry?: number;
    xAxisRotation?: number;
    largeArc?: boolean;
    sweep?: boolean;
  }

  export interface SvgPathParserFn {
    (pathData: string): SvgPathCommand[];
    parseSVG: (pathData: string) => SvgPathCommand[];
    makeAbsolute: (commands: SvgPathCommand[]) => SvgPathCommand[];
  }

  const parseSVG: SvgPathParserFn;
  export default parseSVG;
}
