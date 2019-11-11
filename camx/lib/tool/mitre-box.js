var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { IGM, IGMDriver } from '../model/igm';
export class MitreBox {
    constructor() {
    }
    requiredInput() {
        const inputs = [
            {
                type: 'number',
                controlType: 'text',
                name: 'materialThickness',
                label: 'Material thickness',
                placeholder: 'Material thickness',
                append: 'mm',
                value: 4,
                required: true,
                min: 1,
                order: 4
            },
            {
                type: 'number',
                controlType: 'text',
                name: 'depth',
                label: 'Box depth',
                append: 'mm',
                value: 50,
                required: true,
                min: 1,
                order: 3
            }, {
                type: 'number',
                controlType: 'text',
                name: 'width',
                label: 'Width',
                append: 'mm',
                value: 70,
                required: true,
                min: 1,
                order: 1
            }, {
                type: 'number',
                controlType: 'text',
                name: 'height',
                label: 'Height',
                append: 'mm',
                value: 60,
                required: true,
                min: 1,
                order: 2
            }, {
                type: 'checkbox',
                controlType: 'bool',
                name: 'lid',
                label: 'Create lid',
                value: true,
                order: 4
            },
        ];
        return inputs;
    }
    generateSVG(values) {
        return __awaiter(this, void 0, void 0, function* () {
            return Promise.resolve(this.toSVG(yield this.generate(values)));
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
        return svg;
    }
    generate(values) {
        /* Box dimensions (int 1 of a mm, and how many mitres to have, divided by two */
        const w = values.width;
        const h = values.height;
        const d = values.depth;
        const lid = values.lid;
        /* Thickness for the material (depth of the mitres) in 1 of a mm */
        const thick = values.materialThickness;
        /* How big the corner mitres are, in 1 of a mm
          default is thickness of material times 4
        */
        const corner = thick * 4;
        /* how many mitres */
        const div_w = Math.floor(((w - 2 * corner) / thick) / 4);
        const div_h = Math.floor(((h - 2 * corner) / thick) / 4);
        const div_d = Math.floor(((d - 2 * corner) / thick) / 4);
        //let div_w = 6
        //let div_h = 3;
        //let div_d = 0;
        /* Frame around the sides panels */
        const frame = 5;
        this.models = [];
        /* Fudge Factor for kerf (width of cuts) - must be even as it is divided by two */
        this.cut_width = 0;
        /*******************************************************************/
        //Original code 
        //this.StartDoc(frame * 3 + w + d, frame * 3 + h + d);
        //this.MitrePanel(frame + w / 2, frame + h / 2, w, h, corner, div_w, div_h, thick, 0, 0);
        //this.MitrePanel(frame + w + frame + d / 2, frame + h / 2, d, h, corner, div_d, div_h, thick, 1, 0);
        //this.MitrePanel(frame + w / 2, frame + h + frame + d / 2, w, d, corner, div_w, div_d, thick, 1, 1);
        this.StartDoc(frame + w + d, frame + h + d);
        if (lid) {
            const options = { mitreTop: true, mitreRight: true, mitreBottom: true, mitreLeft: true };
            this.MitrePanel(w / 2, h / 2, w, h, corner, div_w, div_h, thick, false, false, options);
            this.MitrePanel(w + frame + d / 2, h / 2, d, h, corner, div_d, div_h, thick, true, false, options);
            this.MitrePanel(w / 2, h + frame + d / 2, w, d, corner, div_w, div_d, thick, true, true, options);
        }
        else {
            const no_flat_edges = { mitreTop: true, mitreRight: true, mitreBottom: true, mitreLeft: true };
            const flat_right = { mitreTop: true, mitreRight: false, mitreBottom: true, mitreLeft: true };
            const flat_bottom = { mitreTop: true, mitreRight: true, mitreBottom: false, mitreLeft: true };
            this.MitrePanel(w / 2, h / 2, w, h, corner, div_w, div_h, thick, false, false, no_flat_edges);
            this.MitrePanel(w + frame + d / 2, h / 2, d, h, corner, div_d, div_h, thick, true, false, flat_right);
            this.MitrePanel(w / 2, h + frame + d / 2, w, d, corner, div_w, div_d, thick, true, true, flat_bottom);
        }
        this.EndDoc();
        //console.log(this.svg);
        const igm = new IGM();
        const driver = new IGMDriver(igm);
        driver.addToLayerObject('', this.models);
        return Promise.resolve(igm);
    }
    MitrePanel(x, y, w, h, corner_size, div_x, div_y, thick, invertX, invertY, options) {
        let a, b, i, d, half_cut;
        x = x - w / 2 + (invertX ? thick : 0);
        y = y - h / 2 + (invertY ? thick : 0);
        this.PolyStart();
        /////////////////////////////////
        // Top side
        /////////////////////////////////
        this.PolyPoint(x, y);
        x += corner_size - (invertX ? thick : 0);
        half_cut = (invertY ? -this.cut_width / 2 : this.cut_width / 2);
        d = (invertY ? -1 : 1);
        this.PolyPoint(x + half_cut, y);
        y += thick * d;
        d = -d;
        this.PolyPoint(x + half_cut, y);
        half_cut = -half_cut;
        // All but the center one
        a = (w - 2 * corner_size) / (2 * div_x + 1);
        // the center one
        b = w - 2 * corner_size - a * (2 * div_x);
        for (i = 0; i < div_x; i++) {
            x += a;
            this.PolyPoint(x + half_cut, y);
            y += thick * d;
            d = -d;
            this.PolyPoint(x + half_cut, y);
            half_cut = -half_cut;
        }
        x += b;
        this.PolyPoint(x + half_cut, y);
        y += thick * d;
        d = -d;
        this.PolyPoint(x + half_cut, y);
        half_cut = -half_cut;
        for (i = 0; i < div_x; i++) {
            x += a;
            this.PolyPoint(x + half_cut, y);
            y += thick * d;
            d = -d;
            this.PolyPoint(x + half_cut, y);
            half_cut = -half_cut;
        }
        x += corner_size - (invertX ? thick : 0);
        this.PolyPoint(x, y);
        /////////////////////////////////
        // Right Side
        /////////////////////////////////
        half_cut = (invertX ? -this.cut_width / 2 : this.cut_width / 2);
        y += corner_size - (invertY ? thick : 0);
        d = (invertX ? 1 : -1);
        this.PolyPoint(x, y + half_cut);
        x += thick * d;
        d = -d;
        if (options.mitreRight) {
            this.PolyPoint(x, y + half_cut);
        }
        half_cut = -half_cut;
        // All but the center one
        a = (h - 2 * corner_size) / (2 * div_y + 1);
        // the center one
        b = h - 2 * corner_size - a * (2 * div_y);
        for (i = 0; i < div_y; i++) {
            y += a;
            if (options.mitreRight) {
                this.PolyPoint(x, y + half_cut);
            }
            x += thick * d;
            d = -d;
            if (options.mitreRight) {
                this.PolyPoint(x, y + half_cut);
            }
            half_cut = -half_cut;
        }
        y += b;
        if (options.mitreRight) {
            this.PolyPoint(x, y + half_cut);
        }
        x += thick * d;
        d = -d;
        if (options.mitreRight) {
            this.PolyPoint(x, y + half_cut);
        }
        half_cut = -half_cut;
        for (i = 0; i < div_y; i++) {
            y += a;
            if (options.mitreRight) {
                this.PolyPoint(x, y + half_cut);
            }
            x += thick * d;
            d = -d;
            if (options.mitreRight) {
                this.PolyPoint(x, y + half_cut);
            }
            half_cut = -half_cut;
        }
        y += corner_size - (invertY ? thick : 0);
        this.PolyPoint(x, y);
        /////////////////////////////////////////////////////
        // bottom Side
        /////////////////////////////////////////////////////
        half_cut = (invertY ? this.cut_width / 2 : -this.cut_width / 2);
        x -= corner_size - (invertX ? thick : 0);
        d = (invertY ? 1 : -1);
        this.PolyPoint(x + half_cut, y);
        y += thick * d;
        d = -d;
        if (options.mitreBottom) {
            this.PolyPoint(x + half_cut, y);
        }
        half_cut = -half_cut;
        // All but the center one
        a = (w - 2 * corner_size) / (2 * div_x + 1);
        // the center one
        b = w - 2 * corner_size - a * (2 * div_x);
        for (i = 0; i < div_x; i++) {
            x -= a;
            if (options.mitreBottom) {
                this.PolyPoint(x + half_cut, y);
            }
            y += thick * d;
            d = -d;
            if (options.mitreBottom) {
                this.PolyPoint(x + half_cut, y);
            }
            half_cut = -half_cut;
        }
        x -= b;
        if (options.mitreBottom) {
            this.PolyPoint(x + half_cut, y);
        }
        y += thick * d;
        d = -d;
        if (options.mitreBottom) {
            this.PolyPoint(x + half_cut, y);
        }
        half_cut = -half_cut;
        for (i = 0; i < div_x; i++) {
            x -= a;
            if (options.mitreBottom) {
                this.PolyPoint(x + half_cut, y);
            }
            y += thick * d;
            d = -d;
            if (options.mitreBottom) {
                this.PolyPoint(x + half_cut, y);
            }
            half_cut = -half_cut;
        }
        x -= corner_size - (invertX ? thick : 0);
        this.PolyPoint(x, y);
        /////////////////////////////////////////////////////
        // Left side
        /////////////////////////////////////////////////////
        half_cut = (invertX ? this.cut_width / 2 : -this.cut_width / 2);
        y -= corner_size - (invertY ? thick : 0);
        d = (invertX ? -1 : 1);
        this.PolyPoint(x, y + half_cut);
        x += thick * d;
        d = -d;
        this.PolyPoint(x, y + half_cut);
        half_cut = -half_cut;
        // All but the center one
        a = (h - 2 * corner_size) / (2 * div_y + 1);
        // the center one
        b = h - 2 * corner_size - a * (2 * div_y);
        for (i = 0; i < div_y; i++) {
            y -= a;
            this.PolyPoint(x, y + half_cut);
            x += thick * d;
            d = -d;
            this.PolyPoint(x, y + half_cut);
            half_cut = -half_cut;
        }
        y -= b;
        this.PolyPoint(x, y + half_cut);
        x += thick * d;
        d = -d;
        this.PolyPoint(x, y + half_cut);
        half_cut = -half_cut;
        for (i = 0; i < div_y; i++) {
            y -= a;
            this.PolyPoint(x, y + half_cut);
            x += thick * d;
            d = -d;
            this.PolyPoint(x, y + half_cut);
            half_cut = -half_cut;
        }
        y -= corner_size - (invertY ? thick : 0);
        this.PolyPoint(x, y);
        this.PolyEnd();
    }
    PolyStart() {
        this.models.push(IGMDriver.newIgmObject());
    }
    getLast() {
        return this.models[this.models.length - 1];
    }
    PolyPoint(x, y) {
        this.getLast().vectors.push(IGMDriver.newGCodeVector(x, y));
    }
    PolyEnd() {
    }
    StartDoc(w, h) {
    }
    EndDoc() {
    }
}
//# sourceMappingURL=mitre-box.js.map