import { readdir, readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import ts from 'typescript';

const root = resolve('frontend');
const verbose = process.argv.includes('--details');
const attributes = new Set(['title', 'placeholder', 'aria-label', 'aria-description', 'alt', 'label', 'description']);
const messageCalls = new Set(['showToast', 'setApplyError', 'setError', 'alert']);
const candidates = [];

async function scanDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = resolve(directory, entry.name);
    if (entry.isDirectory()) await scanDirectory(file);
    else if (/\.tsx?$/.test(entry.name)) await scanFile(file);
  }
}

function record(file, source, node, text, kind) {
  const value = text.replace(/\s+/g, ' ').trim();
  if (!/[a-zA-Z]{2}/.test(value) || /^https?:\/\//.test(value)) return;
  const position = source.getLineAndCharacterOfPosition(node.getStart(source));
  candidates.push({ file: relative(process.cwd(), file), line: position.line + 1, kind, value });
}

function expressions(file, source, node, kind) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    record(file, source, node, node.text, kind);
  } else if (ts.isTemplateExpression(node)) {
    record(file, source, node, node.head.text + node.templateSpans.map(span => `{{…}}${span.literal.text}`).join(''), kind);
  } else if (ts.isConditionalExpression(node)) {
    expressions(file, source, node.whenTrue, kind);
    expressions(file, source, node.whenFalse, kind);
  } else if (ts.isBinaryExpression(node) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) {
    expressions(file, source, node.right, kind);
  }
}

async function scanFile(file) {
  const content = await readFile(file, 'utf8');
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  function visit(node) {
    if (ts.isJsxText(node)) record(file, source, node, node.text, 'text');
    if (ts.isJsxAttribute(node) && attributes.has(node.name.getText(source)) && node.initializer) {
      const value = ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer;
      if (value) expressions(file, source, value, node.name.getText(source));
    }
    if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) {
      expressions(file, source, node.expression, 'expression');
    }
    if (ts.isCallExpression(node) && node.arguments.length &&
        (ts.isIdentifier(node.expression) || ts.isPropertyAccessExpression(node.expression))) {
      const name = ts.isIdentifier(node.expression) ? node.expression.text : node.expression.name.text;
      if (messageCalls.has(name)) expressions(file, source, node.arguments[0], name);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

await scanDirectory(root);
candidates.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
const files = new Set(candidates.map(item => item.file));
console.log(`${candidates.length} candidate literals in ${files.size} files (includes identifiers and other intentional text; review before translating).`);
if (verbose) for (const item of candidates) console.log(`${item.file}:${item.line} [${item.kind}] ${item.value}`);
