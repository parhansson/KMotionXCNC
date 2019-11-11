import { Component } from '@angular/core'
import { PatternGenerator, JigsawGenerator, MitreBox, ChipherWheelGenerator, TextPathGenerator } from 'camx'

@Component({
    selector: 'laser-screen',
    templateUrl: './laser-screen.component.html'
})
export class LaserScreenComponent {
    patternGenerator: PatternGenerator
    jigsawGenerator: JigsawGenerator
    mitreBoxGenerator: MitreBox
    chipherWheelGenerator: ChipherWheelGenerator
    textPathGenerator: TextPathGenerator
    constructor() {
        this.patternGenerator = new PatternGenerator()
        this.jigsawGenerator = new JigsawGenerator()
        this.mitreBoxGenerator = new MitreBox()
        this.chipherWheelGenerator = new ChipherWheelGenerator()
        this.textPathGenerator = new TextPathGenerator()
    }


}