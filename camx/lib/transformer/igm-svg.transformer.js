var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { IGMDriver } from '../model/igm';
export class Igm2SvgTransformer {
    constructor(settings) {
        this.settings = settings;
    }
    transform(input) {
        return __awaiter(this, void 0, void 0, function* () {
            return Promise.resolve(igm2SVG(input));
        });
    }
}
export function igm2SVG(model) {
    let svg = '';
    const res = 1;
    const driver = new IGMDriver(model);
    const paths = driver.allVisibleObjects;
    driver.updateBounds(paths);
    const bounds = driver.getMaxBounds(paths);
    const dpi = 72; //output DPI
    const dpiScale = dpi / 25.4; // assuming input model in mm not in inches
    const minx = bounds.x;
    const miny = bounds.y;
    const height = bounds.height();
    const width = bounds.width();
    svg += '<?xml version="1.0" standalone="no"?>\r\n';
    svg += '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\r\n';
    svg += `<svg width="${width}mm" height="${height}mm" viewBox="${minx * dpiScale} ${miny * dpiScale} ${width * dpiScale} ${height * dpiScale}" xmlns="http://www.w3.org/2000/svg" version="1.1">\r\n`;
    svg += '<g fill="steelblue" fill-opacity="25%" stroke="black" vector-effect="non-scaling-stroke" stroke-width="0.2">';
    svg += createPaths(driver, dpiScale)
        .map(path => `<path d="${path}"/>`).join('\r\n');
    svg += ('</g>\r\n');
    svg += ('</svg>\r\n');
    return svg;
}
const createPaths = (driver, dpiScale) => {
    const paths = [];
    for (const shape of driver.allVisibleObjects) {
        //we need to clone because we scale it and would not like to scale original model
        const part = driver.clone(shape);
        //TODO rescaling after calculating bounds???
        driver.scale(part, dpiScale);
        const geometry = part.geometry;
        let path;
        if (geometry.type == 'LINE') {
            path = linePath(geometry.vectors);
        }
        if (geometry.type == 'ARC') {
            path = arcPath(driver.start(part), driver.end(part), geometry.radius, geometry.startAngle, geometry.endAngle, geometry.clockwise);
        }
        paths.push(path);
    }
    return paths;
};
const linePath = (vectors) => {
    const points = [];
    let first = true;
    for (const vec of vectors) {
        if (first) {
            first = false;
            points.push('M');
            points.push(vec.x);
            points.push(vec.y);
            points.push('L');
        }
        else {
            points.push(vec.x);
            points.push(vec.y);
        }
    }
    return points.join(' ');
};
const arcPath = (start, end, radius, startAngle, endAngle, clockwise) => {
    //TODO red ut hur det här kana bli rätt nån gång
    const sweep = clockwise ? 0 : 1;
    const largeArcFlag = Math.abs(endAngle - startAngle) <= Math.PI ? '0' : '1';
    const d = [
        'M', start.x, start.y,
        'A', radius, radius, 0, largeArcFlag, sweep, end.x, end.y
    ].join(' ');
    return d;
};
//# sourceMappingURL=igm-svg.transformer.js.map