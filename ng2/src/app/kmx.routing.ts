import { Routes, RouterModule } from '@angular/router'
import { ModuleWithProviders } from '@angular/core'
import { LaserScreenComponent } from './laser'
import { GCodeScreenComponent } from './gcode'
import { CCodeScreenComponent } from './ccode'
import { DebugScreenComponent } from './debug'
import { SettingsScreenComponent } from './settings'
import { ImportWizardComponent } from './wizard'



const appRoutes: Routes = [
  {
    path: 'gcode',
    component: GCodeScreenComponent
  },
  {
    path: 'ccode',
    component: CCodeScreenComponent
  },
  {
    path: 'laser',
    component: LaserScreenComponent
  },
  {
    path: 'settings',
    component: SettingsScreenComponent
  },
  {
    path: 'debug',
    component: DebugScreenComponent
  },
  {
    path: 'import',
    component: ImportWizardComponent
  },  
  {
    path: '',
    redirectTo: '/gcode',
    pathMatch: 'full'
  }
]

export const appRoutingProviders: any[] = [

]

export const routing: ModuleWithProviders<RouterModule> = RouterModule.forRoot(appRoutes, { relativeLinkResolution: 'legacy' })