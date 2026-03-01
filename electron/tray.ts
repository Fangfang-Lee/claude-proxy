import { Tray, Menu, nativeImage } from 'electron'
import path from 'path'

let tray: Tray | null = null

export function createTray(onShow: () => void, onQuit: () => void): void {
  const icon = nativeImage.createFromPath(path.join(__dirname, '../assets/tray-icon.png'))
  tray = new Tray(icon.resize({ width: 16, height: 16 }))

  const menu = Menu.buildFromTemplate([
    { label: '打开 Claude Proxy', click: onShow },
    { type: 'separator' },
    { label: '退出', click: onQuit },
  ])

  tray.setToolTip('Claude Proxy')
  tray.setContextMenu(menu)
  tray.on('click', onShow)
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
