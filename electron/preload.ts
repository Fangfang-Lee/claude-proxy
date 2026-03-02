import { contextBridge, ipcRenderer } from 'electron'
import { RouteRule, AppSettings, TestResult } from '../src/types/index'

contextBridge.exposeInMainWorld('api', {
  routes: {
    list: (): Promise<RouteRule[]> => ipcRenderer.invoke('routes:list'),
    add: (rule: Omit<RouteRule, 'id'>): Promise<RouteRule> => ipcRenderer.invoke('routes:add', rule),
    update: (rule: RouteRule): Promise<RouteRule> => ipcRenderer.invoke('routes:update', rule),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('routes:delete', { id }),
    reorder: (ids: string[]): Promise<void> => ipcRenderer.invoke('routes:reorder', { ids }),
    test: (id: string, model: string): Promise<TestResult> => ipcRenderer.invoke('route:test', { id, model }),
  },
  proxy: {
    status: (): Promise<{ running: boolean; port: number }> => ipcRenderer.invoke('proxy:status'),
    restart: (): Promise<{ success: boolean }> => ipcRenderer.invoke('proxy:restart'),
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    update: (s: Partial<AppSettings>): Promise<AppSettings> => ipcRenderer.invoke('settings:update', s),
  },
  claude: {
    applyConfig: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('claude:apply-config'),
    readConfig: (): Promise<{ success: boolean; content?: string; error?: string }> => ipcRenderer.invoke('claude:read-config'),
    saveConfig: (content: string): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('claude:save-config', content),
  },
  onLog: (cb: (entry: unknown) => void) => {
    ipcRenderer.on('log:entry', (_event, entry) => cb(entry))
    return () => ipcRenderer.removeAllListeners('log:entry')
  },
})
