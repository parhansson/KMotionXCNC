import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { DropZoneDirective } from './drop-zone.directive'
import { FileDialogComponent } from './file-dialog.component'
import { FilePathComponent } from './file-path.component'
import { FormsModule } from '@angular/forms'

@NgModule({
  imports: [CommonModule,FormsModule],
  exports: [DropZoneDirective, FileDialogComponent, FilePathComponent],
  declarations: [
    DropZoneDirective,
    FileDialogComponent,
    FilePathComponent,
  ], // directives, components, and pipes owned by this NgModule
})
export class ResourceModule {

}