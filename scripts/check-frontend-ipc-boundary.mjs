import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [file] : [];
  });
}

function inside(directory, file) {
  const relative = path.relative(directory, file);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function unwrapExpression(expression) {
  while (expression && (
    ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) || ts.isSatisfiesExpression(expression) ||
    ts.isNonNullExpression(expression)
  )) expression = expression.expression;
  return expression;
}

export function checkFrontendIpcBoundary(root = projectRoot) {
  const frontend = path.resolve(root, 'frontend');
  const facade = path.join(frontend, 'common', 'services', 'ipc');
  const adapters = path.join(facade, 'adapters');
  const files = sourceFiles(frontend).sort();
  const violations = [];

  for (const file of files) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const allowed = inside(adapters, file);
    const relativeFile = path.relative(frontend, file).split(path.sep).join('/');
    const composition = relativeFile === 'common/services/ipc/platformServices.ts';
    const transport = /\/services\/transport\//.test(`/${relativeFile}`);

    function report(location, specifier, reason) {
      const { line, character } = source.getLineAndCharacterOfPosition(location.getStart(source));
      violations.push({ file: path.relative(root, file).split(path.sep).join('/'),
        line: line + 1, column: character + 1, specifier, reason });
    }

    function check(specifier, location, computed = false) {
      specifier = unwrapExpression(specifier);
      const literal = specifier && (ts.isStringLiteral(specifier) || ts.isNoSubstitutionTemplateLiteral(specifier));
      if (computed && !literal) {
        const { line, character } = source.getLineAndCharacterOfPosition(location.getStart(source));
        violations.push({ file: path.relative(root, file).split(path.sep).join('/'),
          line: line + 1, column: character + 1, specifier: specifier?.getText(source) ?? '<missing>',
          reason: 'computed module specifier cannot be checked' });
      } else if (literal && specifier.text.startsWith('@tauri-apps/') && !allowed) {
        const { line, character } = source.getLineAndCharacterOfPosition(specifier.getStart(source));
        violations.push({ file: path.relative(root, file).split(path.sep).join('/'),
          line: line + 1, column: character + 1, specifier: specifier.text,
          reason: 'Tauri SDK dependency must stay inside common/services/ipc/adapters/' });
      } else if (literal && !allowed) {
        const id = specifier.text;
        const resolved = id.startsWith('@/') ? path.join(frontend, id.slice(2))
          : id.startsWith('.') ? path.resolve(path.dirname(file), id) : undefined;
        if (resolved && inside(adapters, resolved) && (!composition || !ts.isImportDeclaration(location))) {
          report(specifier, id, 'platform adapters are private to platform composition');
        } else if (resolved && /[\\/]services[\\/]ipc[\\/](ipcClient|ipcEvents|ipcWindow|ipcPath|types)(\.[cm]?tsx?)?$/.test(resolved)) {
          report(specifier, id, 'SDK facade primitives were replaced by platform contracts and feature services');
        } else if (transport && resolved && /[\\/](store|components)[\\/]|[\\/]services[\\/]runtime[\\/]/.test(resolved)) {
          report(specifier, id, 'transport services depend on ports and data, not application state or runtime');
        }
      }
    }

    function visit(node) {
      const member = ts.isPropertyAccessExpression(node) ? node.name.text
        : ts.isElementAccessExpression(node) && (ts.isStringLiteral(unwrapExpression(node.argumentExpression)) ||
          ts.isNoSubstitutionTemplateLiteral(unwrapExpression(node.argumentExpression)))
          ? unwrapExpression(node.argumentExpression).text : undefined;
      const nativeName = ts.isPropertyAccessExpression(node) ? node.name.text
        : ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text
          : ts.isBindingElement(node) ? (node.propertyName ?? node.name).getText(source) : undefined;
      if (!allowed && nativeName?.startsWith('__TAURI')) {
        report(node, nativeName, 'native bridge internals are private to platform adapters');
      }
      if (!allowed && !inside(facade, file) && !transport &&
        (['executeCommand', 'executeWithProgress'].includes(member) ||
          (ts.isBindingElement(node) && ['executeCommand', 'executeWithProgress'].includes(
            (node.propertyName ?? node.name).getText(source).replace(/^['"]|['"]$/g, ''))))) {
        // These methods belong exclusively to the command transport port. Feature
        // workflows call named service methods rather than selecting wire commands.
        report(node, node.getText(source), 'command execution belongs in services/transport/');
      }
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        if (node.moduleSpecifier) check(node.moduleSpecifier, node);
      } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
        check(node.moduleReference.expression, node, true);
      } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
        check(node.argument.literal, node);
      } else if (ts.isCallExpression(node)) {
        const callee = unwrapExpression(node.expression);
        if (callee.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(callee) && callee.text === 'require')) {
          check(node.arguments[0], node, true);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }

  return { files: files.length, violations };
}

export function formatIpcBoundaryViolation(violation) {
  return `${violation.file}:${violation.line}:${violation.column}: ${violation.specifier}: ${violation.reason}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = checkFrontendIpcBoundary();
  for (const violation of result.violations) console.error(formatIpcBoundaryViolation(violation));
  if (result.violations.length) process.exitCode = 1;
  else console.log(`Frontend IPC boundary OK: ${result.files} files.`);
}
