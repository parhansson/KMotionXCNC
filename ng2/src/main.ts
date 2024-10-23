import { enableProdMode } from '@angular/core'
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic'

import { KmxAppModule } from './app/kmx.module'
import { environment } from './environments/environment'

export const baseUrl = "http://localhost:8080"  //""

if (environment.production) {
  enableProdMode()
}

platformBrowserDynamic().bootstrapModule(KmxAppModule)
  .catch(err => console.log(err))



