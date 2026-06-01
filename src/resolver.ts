export type Context = Record<string, any>
export type FilterFunction = (value: any, ...args: any[]) => any
export type FilterRegistry = Record<string, FilterFunction>

export function resolvePath(pathStr: string, context: Context): any {
  if (!pathStr || !context)
    return undefined
  return pathStr
    .split('.')
    .reduce((acc, part) => (acc !== null && acc !== undefined) ? acc[part.trim()] : undefined, context)
}

const ESCAPE_MAP: Record<string, string> = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '\'': '&#x27;',
  '`': '&#x60;',
})

export function escapeHTML(str: unknown): string {
  return String(str ?? '').replace(/[&<>"'`]/g, match => ESCAPE_MAP[match])
}
