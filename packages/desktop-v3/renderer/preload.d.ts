import type {TrpcIpcHandler} from '../main/preload'
import type {DesktopBridge} from '../shared/desktopcontracts'

declare global {
  interface Window {
    trpcIpc: TrpcIpcHandler
    greenlightDesktop?: DesktopBridge
  }
}
