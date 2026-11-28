export {
  sourceRefEquals,
  type CameraPreset,
  type MachineBounds,
  type MoveKind,
  type RenderLayerBuffer,
  type RenderSceneData,
  type RotaryAxisAOptions,
  type SourceRef,
  type TessellateOptions,
  type ToolpathRenderer,
  type Vec3,
  type ViewerTheme,
} from './types';

export { projectPoint, tessellateIgm } from './tessellate';

export {
  createTessellateWorkerClient,
  type TessellateWorkerClient,
  type TessellateWorkerRequest,
  type TessellateWorkerResponse,
} from './tessellate.worker';

export {
  ThreeToolpathRenderer,
  type ThreeToolpathRendererOptions,
} from './three-renderer';
