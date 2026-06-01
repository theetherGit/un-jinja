import { expect, it } from 'vitest'
import { render } from '../src/index'

it('should execute multi-layer PEMDAS operations and pipeline filters matching Nunjucks spec', () => {
  const template = `
    Calculated Outcome: {{ (baseValue + offset * multiplier) - dividend / 2 | round }}
  `.trim()

  const context = {
    baseValue: 10, // 10
    offset: 5, // + (5
    multiplier: 4, // * 4) = 30
    dividend: 6, // - (6 / 2) = 27
  }

  // Nunjucks spec ensures custom math parses natively before hitting the final formatting filter pipes
  expect(render(template, context)).toBe('Calculated Outcome: 27')
})
