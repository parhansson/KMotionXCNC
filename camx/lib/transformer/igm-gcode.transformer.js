var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { IGMDriver, GCodeSource } from '../model/igm';
class GCodeOutput {
    constructor(spindleOnCommand, spindleOffCommand, commentsOn, fractionalDigits) {
        this.spindleOnCommand = spindleOnCommand;
        this.spindleOffCommand = spindleOffCommand;
        this.commentsOn = commentsOn;
        this.fractionalDigits = fractionalDigits;
        this.code = [];
        this.currentLocation = {
            x: 0,
            y: 0,
            z: 0,
            a: 0,
            b: 0,
            c: 0
        };
        this._spindleOn = false;
    }
    spindleOn() {
        if (!this._spindleOn && this.spindleOnCommand != null) {
            this.addBlocks(this.spindleOnCommand);
            this._spindleOn = true;
        }
    }
    spindleOff() {
        if (this._spindleOn && this.spindleOffCommand != null) {
            this.addBlocks(this.spindleOffCommand);
            this._spindleOn = false;
        }
    }
    endProgram() {
        this.addBlocks('M2');
    }
    dwell(duration) {
        this.addBlocks(`G4 P${duration}`);
    }
    comment(text) {
        if (this.commentsOn && text) {
            this.addBlocks('(' + text + ')');
        }
    }
    g0(x, y, z) {
        this.addBlocks(this.moveTo('G0', x, y, z).join(' '));
    }
    g1(x, y, z) {
        this.addBlocks(this.moveTo('G1', x, y, z).join(' '));
    }
    g2(x, y, z, i, j) {
        this.arcTo('G2', x, y, z, i, j);
    }
    g3(x, y, z, i, j) {
        this.arcTo('G3', x, y, z, i, j);
    }
    arcTo(moveCode, x, y, z, i, j) {
        const gc = this.moveTo(moveCode, x, y, z);
        gc.push(`I${this.format(i)}`);
        gc.push(`J${this.format(j)}`);
        this.addBlocks(gc.join(' '));
    }
    moveTo(moveCode, x, y, z) {
        const gc = [moveCode];
        const X = this.format(x);
        const Y = this.format(y);
        const Z = this.format(z);
        if (X != null) {
            gc.push('X' + X);
        }
        if (Y != null) {
            gc.push('Y' + Y);
        }
        if (Z != null) {
            gc.push('Z' + Z);
        }
        this.currentLocation = {
            x: X != null ? X : this.currentLocation.x,
            y: Y != null ? Y : this.currentLocation.y,
            z: Z != null ? Z : this.currentLocation.z,
            a: 0,
            b: 0,
            c: 0
        };
        return gc;
    }
    format(numb) {
        //fix fractional digits
        if (numb == null) {
            return null;
        }
        // Note the plus sign that drops any 'extra' zeroes at the end.
        // It changes the result (which is a string) into a number again (think '0 + foo'),
        // which means that it uses only as many digits as necessary.
        return +numb.toFixed(this.fractionalDigits);
    }
    addBlocks(block) {
        let blocks;
        if (block instanceof Array) {
            blocks = block;
        }
        else {
            blocks = [block];
        }
        blocks.forEach(b => this.code.push(b));
    }
    onPosition(position) {
        return this.pointEquals(this.currentLocation, position);
    }
    pointEquals(v1, v2) {
        const fractionalDigits = this.fractionalDigits;
        return (v1.x.toFixed(fractionalDigits) === v2.x.toFixed(fractionalDigits) &&
            v1.y.toFixed(fractionalDigits) === v2.y.toFixed(fractionalDigits) &&
            v1.z.toFixed(fractionalDigits) === v2.z.toFixed(fractionalDigits));
    }
}
export class Igm2GcodeTransformer {
    constructor(settings) {
        this.settings = settings;
    }
    transform(igm) {
        return __awaiter(this, void 0, void 0, function* () {
            const settings = this.settings;
            //settings.seekRate = settings.seekRate || 800;
            //settings.bitWidth = settings.bitWidth || 1; // in mm 
            const driver = new IGMDriver(igm);
            const shapes = driver.applyModifications(settings, true);
            const gcode = new GCodeOutput('M3 (laser on)', 'M5 (laser off)', true, this.settings.fractionalDigits);
            //const gcode = new GCodeOutput(null, null, false, this.settings.fractionalDigits)
            const maxBounds = driver.getMaxBounds(shapes);
            gcode.comment(this.describe(maxBounds));
            gcode.addBlocks('G90'); //Absolute Coordinates
            const unitGCode = {
                mm: 'G21',
                in: 'G20'
            };
            //G20 Inch units
            //G21 mm units
            gcode.addBlocks(unitGCode[settings.unit]);
            if (settings.initCode) {
                //TODO use IGM material setting (currently non existing)
                gcode.addBlocks(settings.initCode);
            }
            gcode.addBlocks('F' + settings.feedRate);
            if (settings.multipass) {
                gcode.g0(0, 0, this.scaleNoDPI(settings.safeZ));
            }
            else {
                gcode.g0(0, 0, 0);
            }
            for (const shape of shapes) {
                //Given that the IGM in the future might contain move shapes (G0)
                //if shape is of type move(G0) then no G0 should be inserted
                // moving around fixtures etc
                //Also handle other type of shapes circle and arcs. 
                //this will remove the need of converting to vectors when importing from DXF SVG etc
                //add scale and transform
                const startPoint = driver.start(shape);
                // seek to index 0
                //gcode.push('N 100 ');
                if (!gcode.onPosition(startPoint)) {
                    gcode.spindleOff();
                    gcode.g0(startPoint.x, startPoint.y);
                }
                if (settings.multipass) {
                    this.passCut(driver, shape, gcode);
                }
                else {
                    gcode.comment(shape.comment);
                    gcode.comment(this.describe(shape.bounds));
                    gcode.spindleOn();
                    this.toGCODE(driver, gcode, shape.geometry);
                }
            }
            gcode.spindleOff();
            // go home
            gcode.g0(0, 0, 0);
            gcode.endProgram();
            return Promise.resolve(new GCodeSource(gcode.code));
        });
    }
    /**
     * Cut material in several passes. Do reverse passes if shape is not closed
     */
    passCut(driver, shape, gcode) {
        const settings = this.settings;
        const passWidth = settings.materialThickness / settings.passes;
        const endPoint = driver.end(shape);
        //check if path ends where we are then revers geometry
        const reversePath = !gcode.onPosition(endPoint);
        //cache reverse clone 
        let reverseClone = null;
        for (let p = passWidth; p <= settings.materialThickness; p += passWidth) {
            gcode.comment(this.describe(shape.bounds));
            gcode.comment('Forward pass depth ' + p);
            // begin the cut by dropping the tool to the work
            gcode.g0(null, null, this.scaleNoDPI(settings.cutZ + p));
            gcode.spindleOn();
            //add forward path
            this.toGCODE(driver, gcode, shape.geometry);
            if (reversePath) {
                p += passWidth;
                if (p <= settings.materialThickness) {
                    if (!reverseClone) {
                        reverseClone = driver.clone(shape);
                        driver.reverse(reverseClone);
                    }
                    gcode.comment('Reverse pass depth ' + p);
                    // begin the cut by dropping the tool to the work
                    gcode.g0(null, null, this.scaleNoDPI(settings.cutZ + p));
                    this.toGCODE(driver, gcode, reverseClone.geometry);
                }
            }
        }
        // go safe
        gcode.comment('Go safe');
        gcode.g0(null, null, this.scaleNoDPI(settings.safeZ));
    }
    toGCODE(driver, gcode, geometry) {
        // if (!geometry.limit) {
        //   driver.updateLimit(geometry)
        // }
        switch (geometry.type) {
            case 'ARC':
                const start = geometry.limit.start;
                const end = geometry.limit.end;
                if (geometry.clockwise) {
                    gcode.g2(end.x, end.y, null, geometry.x - start.x, geometry.y - start.y);
                }
                else {
                    gcode.g3(end.x, end.y, null, geometry.x - start.x, geometry.y - start.y);
                }
                break;
            case 'LINE':
                for (const point of geometry.vectors) {
                    //Hmm this will also filter out single points?
                    if (!gcode.onPosition(point)) {
                        gcode.g1(point.x, point.y);
                    }
                }
                break;
        }
    }
    scaleNoDPI(val) {
        //Comment below does not make sence
        //TODO only used for tool moves. maybe scale should be inverted to avoid z scaling
        return val * this.settings.scale;
    }
    describe(rect) {
        return 'Width: ' + this.format(rect.width()) + ' Height: ' + this.format(rect.height()) + ' Area: ' + this.format(rect.area());
    }
    format(numb) {
        //fix fractional digits
        numb = +numb.toFixed(this.settings.fractionalDigits);
        // Note the plus sign that drops any 'extra' zeroes at the end.
        // It changes the result (which is a string) into a number again (think '0 + foo'),
        // which means that it uses only as many digits as necessary.
        return numb;
    }
}
//# sourceMappingURL=igm-gcode.transformer.js.map