export class SVGModelSettings {
    constructor() {
        this.UnitsPerInch = {
            mm: 25.4,
            in: 1
        };
        this.unit = 'mm';
        //unit: string = 'in'
        this.dpi = 72;
        this.renderText = true;
    }
    getDPIScaleFactor(dpi) {
        const DPI = dpi || this.dpi || 72;
        if (this.UnitsPerInch[this.unit]) {
            return this.UnitsPerInch[this.unit] / DPI;
        }
        else {
            console.log('Invalid unit ' + this.unit);
            return 1;
        }
    }
}
export class IGMModelSettings {
    constructor() {
        this.scale = 1;
        this.unit = 'mm';
        this.cutZ = 0; //20,
        this.safeZ = 0; //10
        this.fractionalDigits = 3;
        this.translateToOrigo = true;
        this.removeOutline = false;
        this.removeSingularites = true;
        this.joinAdjacent = true;
        this.calculateShortestPath = true;
        this.initCode = 'M100 P200 Q100';
        this.feedRate = 250;
        this.materialThickness = 10;
        this.passes = 1;
    }
}
export class PDFModelSettings {
    constructor() {
        this.page = 1;
        this.rotate = 90; // rotate 90 degrees to fit machine area
        this.scale = 1.0;
    }
}
export class DXFModelSettings {
}
export class Material {
}
export class ModelSettings {
    constructor() {
        this.svg = new SVGModelSettings();
        this.pdf = new PDFModelSettings();
        this.igm = new IGMModelSettings();
        this.dxf = new DXFModelSettings();
        this.materials = []; //ex { name: 'Cut 2mm polysterene', ppi: 'M100 P900 Q100', speed: 'F250', passes: 1, thickness: 2 },
    }
    update(from) {
        //update existing object instead of setting a new
        Object.assign(this.svg, from.svg);
        Object.assign(this.pdf, from.pdf);
        Object.assign(this.igm, from.igm);
        Object.assign(this.materials, from.materials);
        Object.assign(this.dxf, from.dxf);
        //Object.assign(new Foo, { a: 1 })
        //Reattach prototype of svg since there are functions in that class
        //setPrototype of is said to be slow. This does not happen often though
        Object.setPrototypeOf(this.svg, SVGModelSettings.prototype);
    }
}
//# sourceMappingURL=model.settings.js.map