import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { TabsModule } from 'ngx-bootstrap/tabs'
import { MCodeValueComponent } from './mcode-value.component'
import { SettingsScreenComponent } from './settings-screen.component'
import { GeneralSettingsComponent } from './general-settings.component'
import { TransformerSettingsComponent } from './transformer-settings.component'
import { ResourceModule } from '../resources/resource.module'
import { MachineSettingsBase } from './machine-settings-base'
import { MCodeExtSettingsComponent } from './mcode-ext-settings.component'
import { MCodeSettingsComponent } from './mcode-settings.component'
import { UserButtonsSettingsComponent } from './user-buttons-settings.component'
import { MotionParametersSettingsComponent } from './motion-parameters-settings.component'

@NgModule({
  imports: [CommonModule,
    FormsModule,
    TabsModule,
    ResourceModule
  ],
  declarations: [
    MCodeValueComponent,
    SettingsScreenComponent,
    GeneralSettingsComponent,
    TransformerSettingsComponent,
    MCodeExtSettingsComponent,
    MCodeSettingsComponent,
    UserButtonsSettingsComponent,
    MotionParametersSettingsComponent,
    MachineSettingsBase
  ], // directives, components, and pipes owned by this NgModule
})
export class SettingsModule {

}