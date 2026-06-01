import type { Context, FilterRegistry } from './resolver'
import type { Token } from './tokenizer'
import { escapeHTML, resolvePath } from './resolver'
import { tokenize } from './tokenizer'

const isLiteralString = (str: string): boolean => /^(['"]).*?\1$/.test(str)
const stripQuotes = (str: string): string => str.slice(1, -1)

function parseFilterArgs(paramStr: string): any[] {
  if (!paramStr)
    return []
  return paramStr.split(',').map((arg) => {
    const trimmed = arg.trim()
    if (isLiteralString(trimmed))
      return stripQuotes(trimmed)
    if (!Number.isNaN(Number(trimmed)))
      return Number(trimmed)
    if (trimmed === 'true')
      return true
    if (trimmed === 'false')
      return false
    return trimmed
  })
}

interface SafeString {
  __isSafe: boolean
  value: string
}
const makeSafe = (str: string): SafeString => ({ __isSafe: true, value: str })

function parseAndComputeMath(mathExpr: string, context: Context): number {
  const tokens = mathExpr.match(/([\w.]+)|([+\-*/])/g)
  if (!tokens)
    return 0

  const values: (number | string)[] = tokens.map((t) => {
    if (['+', '-', '*', '/'].includes(t))
      return t
    if (!Number.isNaN(Number(t)))
      return Number(t)
    return Number(resolvePath(t, context) ?? 0)
  })

  for (let i = 0; i < values.length; i++) {
    if (values[i] === '*' || values[i] === '/') {
      const op = values[i]
      const left = values[i - 1] as number
      const right = values[i + 1] as number
      const res = op === '*' ? left * right : (right !== 0 ? left / right : 0)
      values.splice(i - 1, 3, res)
      i--
    }
  }

  let total = (values[0] as number) || 0
  for (let i = 1; i < values.length; i += 2) {
    const op = values[i]
    const nextVal = values[i + 1] as number
    if (op === '+')
      total += nextVal
    if (op === '-')
      total -= nextVal
  }

  return total
}

const BUILT_IN_FILTERS: FilterRegistry = Object.freeze({
  upper: (val: any) => String(val ?? '').toUpperCase(),
  lower: (val: any) => String(val ?? '').toLowerCase(),
  join: (val: any, separator = ', ') => Array.isArray(val) ? val.join(separator) : val,
  default: (val: any, fallback: any) => (val !== undefined && val !== null && val !== '') ? val : fallback,
  first: (val: any) => Array.isArray(val) ? val[0] : val,
  last: (val: any) => Array.isArray(val) ? val[val.length - 1] : val,
  length: (val: any) => (val && typeof val.length === 'number') ? val.length : 0,
  reverse: (val: any) => {
    if (Array.isArray(val))
      return [...val].reverse()
    if (typeof val === 'string')
      return [...val].reverse().join('')
    return val
  },
  sort: (val: any) => Array.isArray(val) ? [...val].sort() : val,
  trim: (val: any) => String(val ?? '').trim(),
  capitalize: (val: any) => {
    const s = String(val ?? '')
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
  },
  title: (val: any) => String(val ?? '').replace(/\b\w/g, c => c.toUpperCase()),
  striptags: (val: any) => String(val ?? '').replace(/<[^>]+(>|$)/g, ''),
  tojson: (val: any) => makeSafe(JSON.stringify(val ?? null)),
  xmlattr: (val: any) => {
    if (!val || typeof val !== 'object')
      return makeSafe('')
    const attrs = Object.entries(val).map(([k, v]) => ` ${k}="${String(v).replace(/"/g, '&quot;')}"`).join('')
    return makeSafe(attrs)
  },
  urlencode: (val: any) => {
    if (!val)
      return makeSafe('')
    if (typeof val !== 'object')
      return makeSafe(encodeURIComponent(String(val)))
    return makeSafe(new URLSearchParams(val).toString())
  },
  filesizeformat: (val: any, binary = true) => {
    let bytes = Number(val)
    if (Number.isNaN(bytes) || bytes < 0)
      return '0 B'
    const base = binary ? 1024 : 1000
    const units = binary ? ['B', 'KiB', 'MiB', 'GiB', 'TiB'] : ['B', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0)
      return `0 ${units[0]}`
    let i = 0
    while (bytes >= base && i < units.length - 1) {
      bytes /= base
      i++
    }
    return `${bytes.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
  },
  groupby: (val: any, attribute: string) => {
    if (!Array.isArray(val) || !attribute)
      return []
    const groupsMap = val.reduce((acc: Record<string, any[]>, item: any) => {
      const key = String(resolvePath(attribute, item) ?? 'undefined')
      if (!acc[key])
        acc[key] = []
      acc[key].push(item)
      return acc
    }, {})
    return Object.entries(groupsMap).map(([grouper, list]) => ({ grouper, list }))
  },
  add: (val: any, amount: any) => Number(val ?? 0) + Number(amount ?? 0),
  sub: (val: any, amount: any) => Number(val ?? 0) - Number(amount ?? 0),
  mul: (val: any, amount: any) => Number(val ?? 0) * Number(amount ?? 0),
  div: (val: any, amount: any) => Number(amount) !== 0 ? Number(val ?? 0) / Number(amount) : 0,
})

function evaluateVariableExpression(expressionStr: string, context: Context, customFilters: FilterRegistry): any {
  const [expressionBody, ...filterParts] = expressionStr.split('|').map(s => s.trim())

  let value: any

  if (/[+\-*/]/.test(expressionBody) && !isLiteralString(expressionBody)) {
    value = parseAndComputeMath(expressionBody, context)
  }
  else {
    if (isLiteralString(expressionBody)) {
      value = stripQuotes(expressionBody)
    }
    else if (expressionBody !== '' && !Number.isNaN(Number(expressionBody))) {
      value = Number(expressionBody)
    }
    else {
      value = resolvePath(expressionBody, context)
    }
  }

  const activeFilters: FilterRegistry = { ...BUILT_IN_FILTERS, ...customFilters }

  return filterParts.reduce((currentValue, filterExpression) => {
    if (filterExpression === 'safe')
      return currentValue
    const match = filterExpression.match(/^\w+(?:\((.*)\))?$/)
    if (!match)
      return currentValue

    // Fixed: non-capturing prefix matching to avoid unused filter references
    const filterName = filterExpression.split('(')[0].trim()
    const rawArgs = match[1]
    const args = parseFilterArgs(rawArgs)

    const cleanValue = (currentValue && currentValue.__isSafe) ? currentValue.value : currentValue
    const filterFunc = activeFilters[filterName]
    return typeof filterFunc === 'function' ? filterFunc(cleanValue, ...args) : cleanValue
  }, value)
}

function evaluateTokens(tokens: readonly Token[], context: Context, customFilters: FilterRegistry, index = 0): string {
  if (index >= tokens.length)
    return ''

  const token = tokens[index]

  if (token.type === 'TEXT') {
    return token.value + evaluateTokens(tokens, context, customFilters, index + 1)
  }

  if (token.type === 'VARIABLE') {
    const result = evaluateVariableExpression(token.value, context, customFilters)
    const isExplicitSafe = token.value.split('|').map(s => s.trim()).includes('safe')
    if (isExplicitSafe || (result && result.__isSafe)) {
      return String(result.__isSafe ? result.value : result) + evaluateTokens(tokens, context, customFilters, index + 1)
    }
    return escapeHTML(result) + evaluateTokens(tokens, context, customFilters, index + 1)
  }

  if (token.type === 'EXPRESSION') {
    if (token.value.startsWith('if ')) {
      let depth = 1
      let scanIndex = index + 1
      const branches: { conditionPath: string | null, start: number, end: number }[] = []
      let currentBranchStart = index + 1
      let currentCondition: string | null = token.value.slice(3).trim()

      while (scanIndex < tokens.length && depth > 0) {
        const t = tokens[scanIndex]
        if (t.type === 'EXPRESSION') {
          if (t.value.startsWith('if '))
            depth++
          if (t.value === 'endif')
            depth--

          if (depth === 1) {
            if (t.value.startsWith('elif ') || t.value === 'else') {
              branches.push({ conditionPath: currentCondition, start: currentBranchStart, end: scanIndex })
              currentBranchStart = scanIndex + 1
              currentCondition = t.value.startsWith('elif ') ? t.value.slice(5).trim() : null
            }
          }
        }
        if (depth === 0) {
          branches.push({ conditionPath: currentCondition, start: currentBranchStart, end: scanIndex })
        }
        scanIndex++
      }

      const endIfIndex = scanIndex - 1

      for (const branch of branches) {
        const isTruthy = branch.conditionPath === null || !!resolvePath(branch.conditionPath, context)
        if (isTruthy) {
          const branchContent = evaluateTokens(tokens.slice(branch.start, branch.end), context, customFilters)
          return branchContent + evaluateTokens(tokens, context, customFilters, endIfIndex + 1)
        }
      }
      return evaluateTokens(tokens, context, customFilters, endIfIndex + 1)
    }

    if (token.value.startsWith('for ')) {
      const match = token.value.match(/^for\s+(\w+)\s+in\s+([\w.]+)(?:\s*\|\s*([\w|()"'-]+))?$/)
      if (!match)
        return evaluateTokens(tokens, context, customFilters, index + 1)

      const itemKey = match[1]
      const baseArrayPath = match[2]
      const trailingFilters = match[3] ? `| ${match[3]}` : ''

      const iterableExpression = `${baseArrayPath}${trailingFilters}`
      const list = evaluateVariableExpression(iterableExpression, context, customFilters)

      let depth = 1
      let scanIndex = index + 1
      let endforIndex = -1

      while (scanIndex < tokens.length && depth > 0) {
        const t = tokens[scanIndex]
        if (t.type === 'EXPRESSION') {
          if (t.value.startsWith('for '))
            depth++
          if (t.value === 'endfor')
            depth--
        }
        if (depth === 0)
          endforIndex = scanIndex
        scanIndex++
      }

      const loopBodyTokens = tokens.slice(index + 1, endforIndex)

      if (Array.isArray(list) && list.length > 0) {
        let output = ''

        for (let idx = 0; idx < list.length; idx++) {
          const childContext = Object.freeze({
            ...context,
            [itemKey]: list[idx],
            loop: Object.freeze({
              index: idx + 1,
              index0: idx,
              first: idx === 0,
              last: idx === list.length - 1,
              length: list.length,
            }),
          })

          // Evaluate the tokens sequentially for this specific loop iteration
          const iterationResult = evaluateTokens(loopBodyTokens, childContext, customFilters)

          // Handle loop modifier signals cleanly
          if (iterationResult.includes('__LOOP_SIGNAL_BREAK__')) {
            // Append anything rendered up to the break, then halt completely
            output += iterationResult.split('__LOOP_SIGNAL_BREAK__')[0]
            break
          }
          if (iterationResult.includes('__LOOP_SIGNAL_CONTINUE__')) {
            // Append anything rendered up to the continue, then jump to next item
            output += iterationResult.split('__LOOP_SIGNAL_CONTINUE__')[0]
            continue
          }

          output += iterationResult
        }

        return output + evaluateTokens(tokens, context, customFilters, endforIndex + 1)
      }

      return evaluateTokens(tokens, context, customFilters, endforIndex + 1)
    }

    // Capture standalone break and continue keywords to propagate signals upstream safely
    if (token.value === 'break') {
      return '__LOOP_SIGNAL_BREAK__'
    }
    if (token.value === 'continue') {
      return '__LOOP_SIGNAL_CONTINUE__'
    }
  }

  return evaluateTokens(tokens, context, customFilters, index + 1)
}

export function render(templateStr: string, context: Context = {}, filters: FilterRegistry = {}): string {
  const tokens = tokenize(templateStr)
  return evaluateTokens(tokens, Object.freeze({ ...context }), Object.freeze({ ...filters }))
}
