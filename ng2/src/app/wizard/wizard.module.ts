import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { TabsModule } from 'ngx-bootstrap/tabs'
import { ResourceModule } from '../resources'
import { SvgPreviewComponent } from './svg-preview.component'
import { ImportWizardComponent } from './import-wizard.component'
import { DynamicFormModule } from '../form/dynamic-form.module'
import { GeneratorWizardComponent } from './generator-wizard.compontent'
  
@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    TabsModule,
    ResourceModule,
    DynamicFormModule
  ],
  declarations: [
    GeneratorWizardComponent,
    ImportWizardComponent,
    SvgPreviewComponent,
  ], 
  exports: [
    GeneratorWizardComponent,
    ImportWizardComponent,
    SvgPreviewComponent,
  ],  
})
export class WizardModule {

}