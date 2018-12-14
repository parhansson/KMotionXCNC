import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { TabsModule } from 'ngx-bootstrap/tabs'
import { MCodeValueComponent } from './mcode-value.component'
import { SettingsScreenComponent } from './settings-screen.component'
import { TransformerSettingsComponent } from './transformer-settings.component'
import { ResourceModule } from '../resources/resource.module'

@NgModule({
  imports: [CommonModule,
    FormsModule,
    TabsModule,
    ResourceModule
  ],
  declarations: [
    MCodeValueComponent,
    SettingsScreenComponent,
    TransformerSettingsComponent
  ], // directives, components, and pipes owned by this NgModule
})
export class SettingsModule {

}