export { broadcast } from "./broadcast";
export { getMainWindow, openMainWindow, revealDoc } from "./main.window";
export {
  openEditorWindow,
  editorWindowCount,
  setEditorPath,
  takeEditorSeed,
} from "./editor.window";
export {
  getCaptureWindow,
  showCaptureWindow,
  hideCaptureWindow,
  isCaptureVisible,
  resizeCaptureWindow,
  whileCaptureDialogOpen,
} from "./capture.window";
export { IS_MAC } from "./load-route";
export { dialogParent } from "./dialog-parent";
