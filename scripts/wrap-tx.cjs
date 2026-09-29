// Codemod: wrap user-visible string literals in JSX with tx() (i18n/tx.js)
// so a screen follows the app language without hand-writing a dictionary
// entry per string. Splices the original source at node offsets, so the
// file's own formatting is preserved.
//
// Wraps: JSX text; string values of text-ish attributes (title,
// placeholder, label, message, …); string literals that are the direct
// result of a ?: / && / || inside a JSX child or such an attribute.
// Never touches className/style/keys/values or anything already in tx().
//
// Usage: node scripts/wrap-tx.cjs <file.jsx> [...]
const fs = require('fs')
const path = require('path')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default

const TEXT_ATTRS = new Set(['title', 'placeholder', 'label', 'message', 'confirmLabel', 'cancelLabel', 'aria-label', 'eyebrow', 'desc', 'alt', 'subtitle', 'hint'])
const hasLetters = (s) => /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(s)
const MEMBER_PROPS = new Set(['label', 'desc', 'description', 'headline', 'nextAction', 'tagline', 'statusLabel', 'hint', 'reason', 'subtitle'])

function attrName(attr) {
  return attr.name.type === 'JSXNamespacedName' ? `${attr.name.namespace.name}:${attr.name.name.name}` : attr.name.name
}

function wrapFile(file) {
  const src = fs.readFileSync(file, 'utf8')
  const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'] })
  const edits = [] // { start, end, text }

  traverse(ast, {
    // {opt.label} / {x.desc} / {c.headline} … as a JSX child — labels from
    // option lists and app-generated hints (never user-typed fields).
    MemberExpression(p) {
      if (!process.env.WRAP_MEMBERS) return
      const prop = p.node.property
      if (p.node.computed || prop.type !== 'Identifier' || !MEMBER_PROPS.has(prop.name)) return
      const parent = p.parentPath
      if (!parent.isJSXExpressionContainer()) return
      const holder = parent.parentPath
      const inChild = holder.isJSXElement() || holder.isJSXFragment()
      const inTextAttr = holder.isJSXAttribute() && TEXT_ATTRS.has(attrName(holder.node))
      if (!inChild && !inTextAttr) return
      edits.push({ start: p.node.start, end: p.node.end, text: `tx(${src.slice(p.node.start, p.node.end)})` })
    },
    JSXText(p) {
      const raw = src.slice(p.node.start, p.node.end)
      if (!hasLetters(raw)) return
      const lead = raw.match(/^\s*/)[0]
      const trail = raw.match(/\s*$/)[0]
      const value = p.node.value.trim().replace(/\s+/g, ' ')
      if (!value) return
      edits.push({ start: p.node.start, end: p.node.end, text: `${lead}{tx(${JSON.stringify(value)})}${trail}` })
    },
    JSXAttribute(p) {
      const v = p.node.value
      if (!v || v.type !== 'StringLiteral') return
      if (!TEXT_ATTRS.has(attrName(p.node)) || !hasLetters(v.value)) return
      edits.push({ start: v.start, end: v.end, text: `{tx(${JSON.stringify(v.value)})}` })
    },
    StringLiteral(p) {
      if (!hasLetters(p.node.value)) return
      // Walk up through ?: / && / || only, to the enclosing JSX expression.
      let child = p
      let parent = p.parentPath
      while (parent && (parent.isConditionalExpression() || parent.isLogicalExpression())) {
        if (parent.isConditionalExpression() && child.key === 'test') return
        child = parent
        parent = parent.parentPath
      }
      if (child === p && !parent?.isJSXExpressionContainer()) return
      if (!parent?.isJSXExpressionContainer()) return
      const holder = parent.parentPath
      const inChild = holder.isJSXElement() || holder.isJSXFragment()
      const inTextAttr = holder.isJSXAttribute() && TEXT_ATTRS.has(attrName(holder.node))
      if (!inChild && !inTextAttr) return
      // Already wrapped: tx("…")
      if (p.parentPath.isCallExpression() && p.parentPath.node.callee.name === 'tx') return
      edits.push({ start: p.node.start, end: p.node.end, text: `tx(${JSON.stringify(p.node.value)})` })
    },
  })

  if (!edits.length) return 0
  if (!/from ['"][./]*\/?i18n\/tx['"]/.test(src)) {
    const rel = path.relative(path.dirname(file), path.join(__dirname, '..', 'src', 'i18n', 'tx')).replace(/\\/g, '/')
    const importPath = rel.startsWith('.') ? rel : `./${rel}`
    const imports = ast.program.body.filter((n) => n.type === 'ImportDeclaration')
    const at = imports.length ? imports[imports.length - 1].end : 0
    edits.push({ start: at, end: at, text: `${at ? '\n' : ''}import { tx } from '${importPath}'${at ? '' : '\n'}` })
  }
  edits.sort((a, b) => b.start - a.start)
  let out = src
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end)
  fs.writeFileSync(file, out)
  return edits.length
}

let total = 0
for (const f of process.argv.slice(2)) {
  const n = wrapFile(f)
  total += n
  console.log(`${n.toString().padStart(4)}  ${f}`)
}
console.log(`${total} strings wrapped`)
