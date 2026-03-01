import { minimatch } from 'minimatch'
import { RouteRule } from '../types/index'

export function matchRoute(model: string, rules: RouteRule[]): RouteRule | null {
  const enabled = rules
    .filter((r) => r.enabled)
    .sort((a, b) => a.priority - b.priority)

  for (const rule of enabled) {
    if (minimatch(model, rule.pattern)) {
      return rule
    }
  }
  return null
}
