import { NgModule } from '@angular/core';
import { FormsModule }   from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BsDropdownModule } from 'ngx-bootstrap/dropdown';
import { LogComponent } from './log.component'
@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    BsDropdownModule
  ],
  exports: [LogComponent],
  declarations: [
    LogComponent
  ], // directives, components, and pipes owned by this NgModule
})
export class LogModule {

}