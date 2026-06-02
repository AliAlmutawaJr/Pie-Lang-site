Prism.languages.pie = {
  'comment': {
    pattern: /\.:(?!:)/, // .:(?!:) // \.:(?:.*$)
    greedy: true
  },
  'string': {
    pattern: /"(?:\\.|[^"\\])*"/,
    greedy: true
  },
  'number': /\b\d+(?:\.\d+)?\b/,
  'keyword': /\b(?:class|infix|prefix|suffix|exfix|mixfix|self|union|match|loop|break|continue|break|import|space|use|true|false)\b/,
  'type': {
    pattern: /\b(?:Any|Int|Bool|String|Lazy)\b/,
    alias: 'class-name'
  },
  'builtin': /\b__builtin_\w+\b/,
  'function': {
    pattern: /\b[A-Za-z0-9_!@#$%^*+~\-]+(?=\s*\()/,
    alias: 'function'
  },
  'operator': /=>|[=(){},;.]/,
  'variable': {
    pattern: /\b[A-Za-z0-9_!@#$%^*+~\-]+\b/,
    alias: 'variable'
  }
};
