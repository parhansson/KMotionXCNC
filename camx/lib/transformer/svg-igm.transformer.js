import { IGM, IGMDriver } from '../model/igm';
import { ModelTransformer } from './model.transformer';
import { SvgParser } from '../parser/svg-parser';
export class Svg2IgmTransformer extends ModelTransformer {
    constructor(settings) {
        super();
        this.settings = settings;
    }
    execute(svgRootElement, targetObserver) {
        const igm = new IGM();
        const driver = new IGMDriver(igm);
        // let the fun begin
        const contentFilterDissalowed = [
        //'style', 
        //'defs'
        ];
        const contentFilter = (element) => {
            return contentFilterDissalowed.indexOf(element.localName) < 0;
        };
        new SvgParser(contentFilter, this.settings.renderText).parse(svgRootElement).then(node => {
            this.makeModel(node, driver);
            targetObserver.next(igm);
        });
    }
    makeModel(node, driver) {
        if (node.defs) {
            return;
        }
        if (node.unsupported) {
            return;
        }
        //if stroke is undefined we do not generate shape
        //TODO this should be handled in igm.addToLayerObject as invisible layer
        //sometimes an invisible outline is present in pdf files
        //if both fill and stroke is undefined skip since it is invisible
        const hasFill = node.fill && node.fill !== 'none';
        const hasStroke = node.stroke && node.stroke !== 'none';
        const hasPath = node.path.length > 0;
        if (hasPath || // this happens in awsometiger.svg
            hasFill ||
            hasStroke ||
            node.text) {
            //console.log('stroke', node.stroke)
            this.makeShape(node, driver);
        }
        for (const child of node.children) {
            this.makeModel(child, driver);
        }
    }
    makeShape(node, driver) {
        const dpiScaleFactor = this.settings.getDPIScaleFactor();
        for (const subpath of node.path) {
            const shape = IGMDriver.newIgmObject();
            shape.type = 'Linear interpolation';
            shape.cmd = 'G1';
            shape.node = node; //Not currently in use
            for (const point of subpath) {
                shape.vectors.push(IGMDriver.newGCodeVector(point[0], point[1], 0));
                //TODO clip on clipPath here. this will be extremely difficult
            }
            IGMDriver.scale(shape, dpiScaleFactor);
            if (node.unsupported === true) {
                driver.addUnsupported(subpath);
            }
            else {
                //this.boundarys.allcolors.push(subpath);
                driver.addToLayerObject(node.stroke, shape);
            }
        }
    }
}
//# sourceMappingURL=svg-igm.transformer.js.map