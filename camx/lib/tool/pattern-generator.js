var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { IGMDriver, IGM } from '../model';
export class PatternGenerator {
    constructor() {
    }
    requiredInput() {
        const inputs = [
            {
                controlType: 'text',
                type: 'number',
                name: 'rows',
                label: 'Rows',
                value: 2,
                required: true,
                min: 1,
                order: 4
            },
            {
                controlType: 'text',
                type: 'number',
                name: 'columns',
                label: 'Columns',
                value: 4,
                required: true,
                min: 1,
                order: 3
            },
            {
                controlType: 'text',
                type: 'number',
                name: 'rowSpacing',
                label: 'Row spacing',
                value: 2,
                required: true,
                min: 1,
                order: 1
            },
            {
                controlType: 'text',
                type: 'number',
                name: 'colSpacing',
                label: 'Column spacing',
                value: 2,
                required: true,
                min: 1,
                order: 2
            }
        ];
        return inputs;
    }
    rect(width, height) {
        const shape = IGMDriver.newIgmObject();
        shape.vectors.push(IGMDriver.newGCodeVector(0, 0));
        shape.vectors.push(IGMDriver.newGCodeVector(width, 0));
        shape.vectors.push(IGMDriver.newGCodeVector(width, height));
        shape.vectors.push(IGMDriver.newGCodeVector(0, height));
        shape.vectors.push(IGMDriver.newGCodeVector(0, 0));
        return shape;
    }
    generateSVG(values) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.toSVG(yield this.generate(values));
        });
    }
    generate(values) {
        return __awaiter(this, void 0, void 0, function* () {
            /*
        G90
        G21
        (M100 P1200 Q100)
        (F200)
        M100 P2000 Q100
        F120
        M5 (laser off)
        G0 X0 Y0 Z3
        M3 (laser on)
        G1 X53 Y0
        G1 X53 Y38
        G1 X0 Y38
        G1 X0 Y0
        M5 (laser off)
        G0 X4.75 Y13.25
        M3 (laser on)
        G1 X48.25 Y13.25
        G1 X48.25 Y24.75
        G1 X4.75 Y24.75
        G1 X4.75 Y13.25
        M5 (laser off)
        G0 X0 Y0 Z0
        M2
            // */
            const shape = this.rect(53, 38);
            const shape2 = this.rect(43.5, 11.5);
            IGMDriver.translate(shape2, IGMDriver.newGCodeVector(4.75, 13.25));
            // const shape = this.rect(38,53)
            // const shape2 = this.rect(11.5,43.5)
            // shape2.translate(new GCodeVector(13.25,4.75))
            const igm = new IGM();
            const driver = new IGMDriver(igm);
            IGMDriver.updateBounds([shape, shape2]);
            const width = shape.bounds.width();
            const height = shape.bounds.height();
            for (let row = 0; row < values.rows; row++) {
                for (let col = 0; col < values.columns; col++) {
                    const translate = IGMDriver.newGCodeVector(col * (width + values.colSpacing), row * (height + values.rowSpacing));
                    driver.addToLayerObject('one', IGMDriver.translate(IGMDriver.clone(shape), translate));
                    driver.addToLayerObject('one', IGMDriver.translate(IGMDriver.clone(shape2), translate));
                }
            }
            return igm;
        });
    }
    toSVG(model) {
        let svg = '';
        const res = 1;
        const driver = new IGMDriver(model);
        const paths = driver.allObjectsFlat;
        IGMDriver.updateBounds(paths);
        const bounds = driver.getMaxBounds(paths);
        const w = bounds.x2;
        const h = bounds.y2;
        const dpi = 72; //output DPI
        const dpiScale = dpi / 25.4; // assuming input model in mm not in inches
        svg += '<?xml version="1.0" standalone="no"?>\r\n';
        svg += '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\r\n';
        svg += '<svg width="' + w / res + 'mm" height="' + h / res + 'mm" viewBox="0 0 ' + w * dpiScale + ' ' + h * dpiScale + '" xmlns="http://www.w3.org/2000/svg" version="1.1">\r\n';
        for (const part of driver.allObjectsFlat) {
            //TODO rescaling after calculating bounds???
            IGMDriver.scale(part, dpiScale);
            const points = [];
            let first = true;
            for (const vec of part.vectors) {
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
            svg += `<path d="${points.join(' ')} Z" fill="steelblue" vector-effect="non-scaling-stroke" stroke="black" stroke-width="0.2" />\r\n`;
        }
        svg += ('</svg>\r\n');
        return Promise.resolve(svg);
    }
}
//# sourceMappingURL=pattern-generator.js.map