export type TokenType = 'TEXT' | 'VARIABLE' | 'EXPRESSION'

export interface Token {
  readonly type: TokenType
  readonly value: string
}

export function tokenize(templateStr: string): readonly Token[] {
  const tokens: Token[] = []

  // IMMUNE TO REDOS: Completely free of variable spacing loops or overlapping quantifiers
  const regex = /\{\{([\s\S]+?)\}\}|\{%([\s\S]+?)%\}/g

  let lastIndex = 0
  let match = regex.exec(templateStr)

  while (match !== null) {
    const matchIndex = match.index
    let rawText = templateStr.slice(lastIndex, matchIndex)

    const isVariable = match[1] !== undefined
    const bodyContent = isVariable ? match[1] : match[2]

    // Determine structural space trims cleanly via pure string methods
    const leftTrim = bodyContent.startsWith('-')
    const rightTrim = bodyContent.endsWith('-')

    // Clean up the template logic payload text securely
    let expressionValue = bodyContent
    if (leftTrim) {
      expressionValue = expressionValue.slice(1)
    }
    if (rightTrim) {
      expressionValue = expressionValue.slice(0, -1)
    }
    expressionValue = expressionValue.trim()

    if (leftTrim) {
      rawText = rawText.trimEnd()
    }

    if (rawText) {
      tokens.push({ type: 'TEXT', value: rawText })
    }

    // RAW BLOCK PROTECTOR INTERCEPTOR
    if (!isVariable && expressionValue === 'raw') {
      const startRawContentIndex = regex.lastIndex

      // FIXED: Simplified, unique alternative that eliminates the rule conflict
      const endRawRegex = /\{%\s*(?:-\s*)?endraw\s*(?:-\s*)?%\}/g
      endRawRegex.lastIndex = startRawContentIndex

      const endRawMatch = endRawRegex.exec(templateStr)
      if (endRawMatch) {
        let rawBlockText = templateStr.slice(startRawContentIndex, endRawMatch.index)

        if (rightTrim) {
          rawBlockText = rawBlockText.trimStart()
        }

        const leftTrimClose = endRawMatch[0].includes('-')
        if (leftTrimClose) {
          rawBlockText = rawBlockText.trimEnd()
        }

        tokens.push({ type: 'TEXT', value: rawBlockText })

        regex.lastIndex = endRawRegex.lastIndex
        lastIndex = regex.lastIndex
        match = regex.exec(templateStr)
        continue
      }
    }

    if (isVariable) {
      tokens.push({ type: 'VARIABLE', value: expressionValue })
    }
    else {
      tokens.push({ type: 'EXPRESSION', value: expressionValue })
    }

    lastIndex = regex.lastIndex

    if (rightTrim && lastIndex < templateStr.length) {
      const rest = templateStr.slice(lastIndex)
      const spaceMatch = rest.match(/^\s+/)
      if (spaceMatch) {
        lastIndex += spaceMatch[0].length
        regex.lastIndex = lastIndex
      }
    }

    match = regex.exec(templateStr)
  }

  const remainingText = templateStr.slice(lastIndex)
  if (remainingText) {
    tokens.push({ type: 'TEXT', value: remainingText })
  }

  return Object.freeze(tokens)
}
