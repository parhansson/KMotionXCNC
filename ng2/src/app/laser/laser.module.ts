import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabsModule } from 'ngx-bootstrap/tabs';
import { LaserCalculatorComponent } from './laser-calculator.component'
import { LaserScreenComponent } from './laser-screen.component'
import { WizardModule } from '../wizard'
import { MaterialSettingsComponent } from './material-settings.component'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    TabsModule,
    WizardModule
  ],
  declarations: [
    LaserScreenComponent,
    LaserCalculatorComponent,
    MaterialSettingsComponent
  ], // directives, components, and pipes owned by this NgModule
})
export class LaserModule {

}