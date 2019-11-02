export class KMXUtil {
  static createAnchor = {}


  static ab2str(buf: ArrayBuffer) {
    const arr = new Uint8Array(buf)
    let str = ''
    for (let i = 0, l = arr.length; i < l; i++) {
      str += String.fromCharCode(arr[i])
    }
    return str
    //Call stack too deep on certain browsers 
    //return String.fromCharCode.apply(null, new Uint8Array(buf)); //Uint16Array
    //Solution to this can be found in PDF.js
  }

  static str2ab(str: string) {
    const buf = new ArrayBuffer(str.length * 2) // 2 bytes for each char
    const bufView = new Uint16Array(buf)
    for (let i = 0, strLen = str.length; i < strLen; i++) {
      bufView[i] = str.charCodeAt(i)
    }
    return buf
  }

  static injectScript(source: string, loadedCondition: boolean) {
    return new Promise(function (resolve, reject) {
      if (loadedCondition === true) {
        //TODO check if script tag is present instead of external loaded condition 
        resolve('Script already loaded:' + source)
      } else {
        const script = document.createElement('script')
        script.type = 'text/javascript'
        script.async = true
        script.onload = function () {
          // remote script has loaded
          resolve('Script loaded:' + source)
        }
        script.onerror = function () { reject(Error('Load script failed: ' + source)) }
        script.src = source
        document.getElementsByTagName('head')[0].appendChild(script)
      }


    })
  }

  static getSingletonWorker(workerScript: string, messageHandler: (this: Worker, ev: MessageEvent) => any) {
    return new Promise<Worker>(function (resolve: (value?: Worker | PromiseLike<Worker>) => void, reject: (reason?: any) => void) {
      let worker = KMXUtil.workers[workerScript]
      if (worker === undefined) {
        try {
          worker = new Worker(workerScript)
        } catch (error) {
          reject(Error(error))
        }
        KMXUtil.workers[workerScript] = worker
      }
      //This needs to be set every time. Need to figure out why 
      worker.onmessage = messageHandler
      resolve(worker)
    }.bind(this))

  }

  static workers: { [key: string]: Worker } = {}
  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  static debounce(func: (arg: any) => any, wait: number, immediate: boolean) {
    let timeout: number
    return function () {
      const context = this, args = arguments
      const later = function () {
        timeout = null
        if (!immediate) {
          func.apply(context, args)
        }
      }
      const callNow = immediate && !timeout
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)
      if (callNow) {
        func.apply(context, args)
      }
    }
  }
  static svgToString(svg: SVGElement): string {
    // need to add namespace declarations for this to be a valid xml document
    return (svg as any).outerHTML.replace('<svg:svg ', '<svg:svg xmlns:svg="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ')
  }
}