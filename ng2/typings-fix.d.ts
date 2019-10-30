
// Instructs tsc (but not worker loader) to do its job
// should work with these tsconfig options (but does not)
// allowSyntheticDefaultImports :true,
// esModuleInterop : true,
declare module "@workers/*" {
  class WebpackWorker extends Worker {
    constructor();
  }
  export default WebpackWorker;
}