import type { FilterRegistry } from '../src/index'
import { expect, it } from 'vitest'
import { render } from '../src/index'

it('should interpolate nested context variables', () => {
  const template = '<h1>Hello {{ user.name }}</h1>'
  const context = { user: { name: 'Edge' } }
  expect(render(template, context)).toBe('<h1>Hello Edge</h1>')
})

it('should parse conditional syntax paths correctly', () => {
  const template = '{% if show %}Visible{% else %}Hidden{% endif %}'
  expect(render(template, { show: true })).toBe('Visible')
  expect(render(template, { show: false })).toBe('Hidden')
})

it('should escape dangerous strings unless marked safe', () => {
  const template = '{{ xss }} vs {{ xss | safe }}'
  const context = { xss: '<script>' }
  expect(render(template, context)).toBe('&lt;script&gt; vs <script>')
})

it('should iterate arrays and populate loop metrics context blocks', () => {
  const template = `<ul>{% for user in users %}<li>{{ loop.index }}: {{ user.name }}{% if loop.last %} (End){% endif %}</li>{% endfor %}</ul>`

  const context = {
    users: [
      { name: 'Alice' },
      { name: 'Bob' },
    ],
  }

  expect(render(template, context).trim()).toBe(
    '<ul><li>1: Alice</li><li>2: Bob (End)</li></ul>',
  )
})

it('should gracefully handle empty arrays or missing paths inside loops', () => {
  const template = '<div>{% for item in items %}Content{% endfor %}</div>'
  expect(render(template, { items: [] })).toBe('<div></div>')
  expect(render(template, {})).toBe('<div></div>')
})

it('should seamlessly execute custom filters with custom configuration parameters', () => {
  const template = '<p>Price: {{ amount | currency("$", 2) }}</p>'
  const context = { amount: 12.5 }

  const customFilters: FilterRegistry = {
    currency: (val: any, symbol = '€', digits = 2) => {
      return `${symbol}${Number(val).toFixed(digits)}`
    },
  }

  expect(render(template, context, customFilters)).toBe('<p>Price: $12.50</p>')
})

it('should chain multiple built-in and user custom filters seamlessly together', () => {
  const template = '<span>{{ name | slugify | upper }}</span>'
  const context = { name: 'Hello Edge Sandbox World' }

  const customFilters: FilterRegistry = {
    slugify: (val: any) => String(val).toLowerCase().replace(/\s+/g, '-'),
  }

  expect(render(template, context, customFilters)).toBe('<span>HELLO-EDGE-SANDBOX-WORLD</span>')
})

it('should process core array parity filters cleanly', () => {
  const context = { framework: ['Vite', 'Tsup', 'Vitest'] }

  expect(render('{{ framework | first }}', context)).toBe('Vite')
  expect(render('{{ framework | last }}', context)).toBe('Vitest')
  expect(render('{{ framework | length }}', context)).toBe('3')
  expect(render('{{ framework | reverse | join("-") }}', context)).toBe('Vitest-Tsup-Vite')
})

it('should handle string parsing and strip structural html tags', () => {
  const context = {
    dirtyHtml: '<p>Hello <strong>World</strong></p>',
    rawText: ' edge sandbox ',
  }

  expect(render('{{ dirtyHtml | striptags }}', context)).toBe('Hello World')
  expect(render('{{ rawText | trim | capitalize }}', context)).toBe('Edge sandbox')
})

it('should serialize deep memory objects directly into JSON maps', () => {
  const context = { data: { id: 101, status: 'active' } }
  expect(render('{{ data | tojson }}', context)).toBe('{"id":101,"status":"active"}')
})

it('should format bytes to safe file size descriptions', () => {
  expect(render('{{ 1500 | filesizeformat(false) }}')).toBe('1.5 KB')
  expect(render('{{ 1048576 | filesizeformat }}')).toBe('1.0 MiB')
})

it('should handle urlencode for strings and complex dictionary structures', () => {
  expect(render('{{ "hello world" | urlencode }}')).toBe('hello%20world')

  const context = { query: { search: 'edge', page: 2 } }
  expect(render('{{ query | urlencode }}', context)).toBe('search=edge&page=2')
})

it('should unpack objects into html component attributes using xmlattr', () => {
  const context = { attrs: { class: 'btn primary', id: 'main-tgt' } }
  expect(render('<button{{ attrs | xmlattr }}></button>', context))
    .toBe('<button class="btn primary" id="main-tgt"></button>')
})

it('should execute groupby calculations across internal data lists', () => {
  const context = {
    employees: [
      { name: 'Alex', role: 'Dev' },
      { name: 'Blake', role: 'Design' },
      { name: 'Charlie', role: 'Dev' },
    ],
  }

  // Group by role, loop through the groups, and pull out item counts
  const template = `{% for group in employees | groupby("role") %}{{ group.grouper }}:{{ group.list | length }} {% endfor %}`

  expect(render(template, context).trim()).toBe('Dev:2 Design:1')
})

it('should parse inline pure infix math calculations natively', () => {
  const context = { basePrice: 100, tax: 15 }

  expect(render('{{ basePrice + tax }}', context)).toBe('115')
  expect(render('{{ basePrice - 20 }}', context)).toBe('80')
  expect(render('{{ basePrice * 2 }}', context)).toBe('200')
  expect(render('{{ basePrice / 4 }}', context)).toBe('25')
})

it('should run back-to-back surprise math filters', () => {
  const context = { score: 10 }
  // 10 + 5 * 2 = 30
  expect(render('{{ score | add(5) | mul(2) }}', context)).toBe('30')
})

it('should combine native math operations with trailing filters in one pass', () => {
  const context = { points: 50 }
  // (50 * 2) -> then uppercase the resulting text string description
  expect(render('{{ points * 2 | default("0") }}', context)).toBe('100')
})

it('should prevent compilation inside raw code structural blocks', () => {
  const template = '<div>{% raw %}Uncompiled {{ variable }} blocks{% endraw %}</div>'
  expect(render(template, { variable: 'Hello' })).toBe('<div>Uncompiled {{ variable }} blocks</div>')
})

it('should evaluate complex algebraic operator rules via proper PEMDAS rules', () => {
  const context = { x: 10, y: 2, z: 5 }
  // 10 + 2 * 5 = 20 (Not 60!)
  expect(render('{{ x + y * z }}', context)).toBe('20')
  // 10 - 2 + 5 = 13
  expect(render('{{ x - y + z }}', context)).toBe('13')
})

it('should follow multi-tiered branching conditional rules using elif blocks', () => {
  const template = `
    {% if status.isUrgent %}Red
    {% elif status.isWarning %}Yellow
    {% else %}Green
    {% endif %}`.trim().replace(/\s+/g, ' ')

  expect(render(template, { status: { isUrgent: false, isWarning: true } }).trim()).toBe('Yellow')
  expect(render(template, { status: { isUrgent: false, isWarning: false } }).trim()).toBe('Green')
})

it('should support advanced loop modifications using loop structural breaks', () => {
  // Note: Since we don't parse arbitrary JS condition checks inside {% if %},
  // let's adjust to pass explicit path evaluation variables to fit our resolver footprint:
  const structuredContext = {
    items: [
      { val: 'A', skip: false, stop: false },
      { val: 'B', skip: true, stop: false },
      { val: 'C', skip: false, stop: false },
      { val: 'D', skip: false, stop: true },
      { val: 'E', skip: false, stop: false },
    ],
  }

  const loopTemplate = `{% for i in items %}{% if i.stop %}{% break %}{% endif %}{% if i.skip %}{% continue %}{% endif %}{{ i.val }}{% endfor %}`
  expect(render(loopTemplate, structuredContext)).toBe('AC')
})
