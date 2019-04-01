import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { TabsModule } from 'ngx-bootstrap/tabs'
import { ResourceModule } from '../resources'
import { MitreBoxWizardComponent } from './mitrebox-wizard.component'
import { TextWizardComponent } from './text-wizard.component'
import { JigsawWizardComponent } from './jigsaw-wizard.component'
import { SvgPreviewComponent } from './svg-preview.component'
import { ImportWizardComponent } from './import-wizard.component'
import { PatternWizardComponent } from './pattern-wizard.component'
import { ChipherWheelWizardComponent } from './cipher-wheel-wizard.component'
  
@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    TabsModule,
    ResourceModule
  ],
  declarations: [
    ImportWizardComponent,
    JigsawWizardComponent,
    MitreBoxWizardComponent,
    PatternWizardComponent,
    SvgPreviewComponent,
    TextWizardComponent,
    ChipherWheelWizardComponent
  ], 
  exports: [
    ImportWizardComponent,
    JigsawWizardComponent,
    MitreBoxWizardComponent,
    PatternWizardComponent,
    SvgPreviewComponent,
    TextWizardComponent,
    ChipherWheelWizardComponent
  ],  
})
export class WizardModule {

}