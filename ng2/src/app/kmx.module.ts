
import { NgModule } from '@angular/core';
import { enableProdMode } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpModule } from '@angular/http';
import { FormsModule } from '@angular/forms';
import { RouteReuseStrategy } from '@angular/router';
import { BsDropdownModule } from 'ngx-bootstrap/dropdown';
import { TabsModule } from 'ngx-bootstrap/tabs';
import { routing, appRoutingProviders } from './kmx.routing';
import { BackendService } from './backend/backend.service';
import { KFlopBackendService } from './backend/kflop/kflop.backend.service';
import { SocketService } from './backend/socket.service'
import { LogService } from './log';
import { KmxComponent } from './kmx.component'
import { ModelSettingsService } from './model/model.settings.service';
import { StaticTransformer } from './model/transformers'
import { SharedModule } from './shared'
import { GCodeModule } from './gcode'
import { CCodeModule } from './ccode'
import { LogModule } from './log';
import { EditorModule } from './editor';
import { ResourceModule, FileServiceToken } from './resources'
import { SettingsModule, SettingsService } from './settings'
import { DebugModule } from './debug'
import { LaserModule } from './laser'
import { CustomReuseStrategy1 as CustomReuseStrategy } from './route-reuse.strategy'
@NgModule({
  imports: [
    BrowserModule,
    HttpModule,
    TabsModule.forRoot(),
    BsDropdownModule.forRoot(),
    FormsModule,

    SharedModule,
    DebugModule,
    ResourceModule,
    EditorModule,
    GCodeModule,
    CCodeModule,
    LogModule,
    LaserModule,
    SettingsModule,
    routing
    //Ng2BootstrapModule
  ],
  declarations: [
    KmxComponent,
  ], // directives, components, and pipes owned by this NgModule
  providers: [
    appRoutingProviders,
    SocketService,
    LogService,
    SettingsService,
    ModelSettingsService,
    StaticTransformer,
    { provide: BackendService, useClass: KFlopBackendService },
    { provide: FileServiceToken, useExisting: BackendService },
    { provide: RouteReuseStrategy, useClass: CustomReuseStrategy }
  ], // additional providers
  bootstrap: [KmxComponent],
})
export class KmxAppModule {

}