# un-jinja

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]

A runtime-agnostic, zero-dependency Jinja2 like template engine for JavaScript. Perfect for edge environments, Cloudflare Workers, browsers, and server-side runtimes.

## Features

- 🚀 **Zero Dependencies** - No external dependencies, just pure JavaScript
- 🌍 **Runtime Agnostic** - Works everywhere: browsers, Node.js, Cloudflare Workers, Deno, etc.
- 🎯 **Jinja2 Compatible** - Familiar Jinja2 syntax and semantics
- 🛡️ **Built-in Security** - HTML escaping by default, optional safe mode
- 🔧 **Extensible** - Custom filters and functions support
- ⚡ **Lightweight** - Minimal footprint

## Installation

```bash
npm install un-jinja
# or
pnpm add un-jinja
# or
yarn add un-jinja
```

## Quick Start

```typescript
import { render } from 'un-jinja'

const template = 'Hello {{ name }}!'
const context = { name: 'World' }

const result = render(template, context)
console.log(result) // Output: Hello World!
```

## Supported Features

### Variables & Interpolation

```typescript
// Simple variables
render('{{ greeting }}', { greeting: 'Hello' })

// Nested paths
render('{{ user.profile.name }}', { user: { profile: { name: 'John' } } })

// Array access
render('{{ items.0 }}', { items: ['first', 'second'] })
```

### Filters

```typescript
// Built-in filters
render('{{ text | upper }}', { text: 'hello' }) // HELLO
render('{{ items | join(", ") }}', { items: ['a', 'b'] }) // a, b
render('{{ count | default(0) }}', { count: null }) // 0

// Math filters
render('{{ 5 | add(3) }}', {}) // 8
render('{{ 10 | sub(2) }}', {}) // 8
```

### Conditionals

```typescript
render('{% if show %}Visible{% endif %}', { show: true })
render('{% if count > 0 %}Items{% else %}Empty{% endif %}', { count: 5 })
render('{% if type == "admin" %}Admin{% elif type == "user" %}User{% else %}Guest{% endif %}', { type: 'user' })
```

### Loops

```typescript
const template = `
  {% for item in items %}
    {{ loop.index }}: {{ item }}
  {% endfor %}
`
render(template, { items: ['a', 'b', 'c'] })

// Loop context variables available:
// - loop.index (1-based)
// - loop.index0 (0-based)
// - loop.first (boolean)
// - loop.last (boolean)
// - loop.length (total items)
```

### Custom Filters

```typescript
const customFilters = {
  multiply: (val, factor) => val * factor,
  greet: name => `Hello, ${name}!`
}

render('{{ 5 | multiply(3) }}', {}, customFilters) // 15
render('{{ "Alice" | greet }}', {}, customFilters) // Hello, Alice!
```

### HTML Escaping

```typescript
// Default: auto-escape
render('{{ html }}', { html: '<script>alert("xss")</script>' })
// Output: &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;

// Marked as safe
render('{{ html | safe }}', { html: '<strong>Bold</strong>' })
// Output: <strong>Bold</strong>
```

## Built-in Filters

- **Text**: `upper`, `lower`, `capitalize`, `title`, `trim`, `striptags`
- **Collections**: `join`, `first`, `last`, `length`, `reverse`, `sort`, `groupby`
- **Defaults**: `default`
- **Math**: `add`, `sub`, `mul`, `div`
- **Encoding**: `urlencode`, `tojson`, `xmlattr`
- **Formatting**: `filesizeformat`

## Examples from Tests

```typescript
import { render } from 'un-jinja'

// Nested variables
render('<h1>Hello {{ user.name }}</h1>', { user: { name: 'Edge' } })

// Conditionals
render('{% if show %}Visible{% else %}Hidden{% endif %}', { show: true })

// Loop with context
const template = `<ul>{% for user in users %}<li>{{ loop.index }}: {{ user.name }}{% if loop.last %} (End){% endif %}</li>{% endfor %}</ul>`
render(template, { users: [{ name: 'Alice' }, { name: 'Bob' }] })

// Custom filters
const customFilters = {
  currency: (val, symbol = '€', digits = 2) => `${symbol}${Number(val).toFixed(digits)}`
}
render('<p>Price: {{ amount | currency("$", 2) }}</p>', { amount: 12.5 }, customFilters)
```

## API

### `render(template, context?, filters?)`

- **template** (string): The template string to render
- **context** (object, optional): Data object passed to the template
- **filters** (object, optional): Custom filter functions

Returns the rendered string.

## Browser Usage

```html
<script type="module">
  import { render } from 'https://unpkg.com/un-jinja@latest'
  
  const template = 'Hello {{ name }}!'
  const result = render(template, { name: 'Browser' })
  document.body.innerHTML = result
</script>
```

## Cloudflare Workers

```typescript
export default {
  fetch(request) {
    const template = 'Hello {{ country }}!'
    const result = render(template, { country: request.cf?.country })
    return new Response(result)
  }
}
```

## License

[MIT](./LICENSE) License © [Shivam Meena](https://github.com/theetherGit)

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/@ethercorps/un-jinja?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmx.dev/package/@ethercorps/un-jinja
[npm-downloads-src]: https://img.shields.io/npm/dm/@ethercorps/un-jinja?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmx.dev/package/@ethercorps/un-jinja
[license-src]: https://img.shields.io/github/license/theetherGit/un-jinja.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/theetherGit/un-jinja/blob/main/LICENSE
