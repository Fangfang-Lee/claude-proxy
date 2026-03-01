import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { RouteRule } from '../types/index'

function getRoutesPath(): string {
  return path.join(app.getPath('userData'), 'routes.json')
}

export function loadRoutes(): RouteRule[] {
  const filePath = getRoutesPath()
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '[]', 'utf-8')
    return []
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as RouteRule[]
  } catch {
    fs.copyFileSync(filePath, filePath + '.bak')
    fs.writeFileSync(filePath, '[]', 'utf-8')
    return []
  }
}

export function saveRoutes(rules: RouteRule[]): void {
  fs.writeFileSync(getRoutesPath(), JSON.stringify(rules, null, 2), 'utf-8')
}
