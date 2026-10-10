import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

function sourceFiles(directory, extensions) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(file, extensions)
      : extensions.has(path.extname(file)) ? [file] : [];
  });
}

function componentName(name) {
  return /^[A-Z]/.test(name) && (/[a-z]/.test(name) || name.length === 1);
}

export function frontendOwners(text, filename = 'source.tsx') {
  const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true);
  const owners = [];
  function visit(node) {
    if (
      ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)
    ) {
      owners.push(node.name?.text ?? '<anonymous class>');
    } else if (ts.isFunctionDeclaration(node) && (
      componentName(node.name?.text ?? '') ||
      node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)
    )) {
      owners.push(node.name?.text ?? '<default component>');
    } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && componentName(node.name.text)) {
      let initializer = node.initializer;
      while (initializer && (
        ts.isAsExpression(initializer) || ts.isSatisfiesExpression(initializer) ||
        ts.isParenthesizedExpression(initializer)
      )) initializer = initializer.expression;
      const topLevel = node.parent?.parent?.parent === source;
      // Nested calls like `const ProviderIcon = getProviderIcon(id)` are aliases,
      // not additional component definitions. Factory/memo/lazy declarations at
      // module scope and actual nested function definitions are owners.
      if (initializer && (
        ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer) ||
        (topLevel && ts.isCallExpression(initializer))
      )) owners.push(node.name.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return owners;
}

function rustTokens(text) {
  const tokens = [];
  let index = 0;
  while (index < text.length) {
    const rest = text.slice(index);
    if (/^\s/.test(rest)) { index += 1; continue; }
    if (rest.startsWith('//')) {
      const newline = text.indexOf('\n', index);
      index = newline < 0 ? text.length : newline + 1;
      continue;
    }
    if (rest.startsWith('/*')) {
      let depth = 1;
      index += 2;
      while (index < text.length && depth > 0) {
        if (text.startsWith('/*', index)) { depth += 1; index += 2; }
        else if (text.startsWith('*/', index)) { depth -= 1; index += 2; }
        else index += 1;
      }
      continue;
    }
    const raw = /^(?:br|cr|r)(#*)"/.exec(rest);
    if (raw) {
      const closing = '"' + raw[1];
      const end = text.indexOf(closing, index + raw[0].length);
      index = end < 0 ? text.length : end + closing.length;
      continue;
    }
    if (rest.startsWith('"') || /^[bc]"/.test(rest)) {
      index += rest.startsWith('"') ? 1 : 2;
      while (index < text.length) {
        if (text[index] === '\\') index += 2;
        else if (text[index++] === '"') break;
      }
      continue;
    }
    const character = /^'(?:\\(?:u\{[\da-fA-F]+\}|x[\da-fA-F]{2}|.)|[^'\\\n])'/u.exec(rest);
    if (character) { index += character[0].length; continue; }
    const identifier = /^[A-Za-z_][A-Za-z_0-9]*/.exec(rest);
    if (identifier) {
      tokens.push(identifier[0]);
      index += identifier[0].length;
    } else tokens.push(text[index++]);
  }
  return tokens;
}

export function backendOwners(text) {
  const tokens = rustTokens(text);
  const owners = [];
  const scopes = ['module'];
  let pendingModule = false;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const inModule = scopes.at(-1) === 'module';
    if (inModule && ['struct', 'enum', 'trait', 'type', 'union'].includes(token) &&
      /^[A-Za-z_][A-Za-z_0-9]*$/.test(tokens[index + 1] ?? '')) {
      owners.push(tokens[index + 1]);
    }
    if (inModule && token === 'mod') pendingModule = true;
    if (token === '{') {
      scopes.push(inModule && pendingModule ? 'module' : 'body');
      pendingModule = false;
    } else if (token === '}') {
      scopes.pop();
      pendingModule = false;
    } else if (token === ';') pendingModule = false;
  }
  return owners;
}

export function checkSourceOwnership(root = projectRoot) {
  const frontend = sourceFiles(path.join(root, 'frontend'), new Set(['.ts', '.tsx']));
  const backend = sourceFiles(path.join(root, 'backend', 'src'), new Set(['.rs']));
  const buildScript = path.join(root, 'backend', 'build.rs');
  if (fs.existsSync(buildScript)) backend.push(buildScript);
  const violations = [];
  for (const [files, identify] of [[frontend, frontendOwners], [backend, backendOwners]]) {
    for (const file of files) {
      const owners = identify(fs.readFileSync(file, 'utf8'), file);
      if (owners.length > 1) violations.push({ file: path.relative(root, file), owners });
    }
  }
  return { frontendFiles: frontend.length, backendFiles: backend.length, violations };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = checkSourceOwnership();
  for (const { file, owners } of result.violations) console.error(`${file}: ${owners.join(', ')}`);
  if (result.violations.length) {
    console.error(`${result.violations.length} file(s) contain multiple source owners.`);
    process.exitCode = 1;
  } else {
    console.log(`Source ownership OK: ${result.frontendFiles} FE files, ${result.backendFiles} BE files.`);
  }
}
