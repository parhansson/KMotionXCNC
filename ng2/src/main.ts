import { enableProdMode } from '@angular/core'
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic'

import { KmxAppModule } from './app/kmx.module'
import { environment } from './environments/environment'

// The development server proxies API, resources and WebSocket to kmxWeb.
export const baseUrl = window.location.origin

if (environment.production) {
  enableProdMode()
}

platformBrowserDynamic().bootstrapModule(KmxAppModule)
  .catch(err => console.log(err))


