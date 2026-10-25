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

export function checkFrontendIpcBoundary(root = projectRoot) {
  const frontend = path.resolve(root, 'frontend');
  const facade = path.join(frontend, 'common', 'services', 'ipc');
  const files = sourceFiles(frontend).sort();
  const violations = [];

  for (const file of files) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const allowed = inside(facade, file);

    function check(specifier, location, computed = false) {
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
          reason: 'Tauri SDK dependency must go through common/services/ipc/' });
      }
    }

    function visit(node) {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        if (node.moduleSpecifier) check(node.moduleSpecifier, node);
      } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
        check(node.moduleReference.expression, node, true);
      } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
        check(node.argument.literal, node);
      } else if (ts.isCallExpression(node) && (
        node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require')
      )) {
        check(node.arguments[0], node, true);
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
