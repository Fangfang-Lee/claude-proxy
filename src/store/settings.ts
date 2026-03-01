import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { AppSettings, DEFAULT_SETTINGS } from '../types/index'

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

export function loadSettings(): AppSettings {
  const filePath = getSettingsPath()
  if (!fs.existsSync(filePath)) {
    saveSettings(DEFAULT_SETTINGS)
    return { ...DEFAULT_SETTINGS }
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: AppSettings): void {
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8')
}
