import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../frontend/features/git/utils/cloneOptions.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
});
const helpers = {};
new Function('exports', outputText)(helpers);
const { createCloneOptions, validateCloneOptions, previewCloneCommand } = helpers;

test('default options retain full history, all branches, tags, LFS and recursive submodules', () => {
  const full = createCloneOptions();
  assert.equal(full.depth, null);
  assert.equal(full.recurseSubmodules, true);
  assert.equal(full.skipLfs, false);
  assert.equal(full.singleBranch, false);
  assert.equal(full.noTags, false);
  assert.equal(full.blobless, false);
  assert.equal(full.sparse, false);
  assert.equal(full.shallowSubmodules, false);
  assert.equal(full.filterSubmodules, false);
  assert.equal(full.submoduleJobs, 4);
  assert.equal(full.timeoutMinutes, 60);
  assert.equal(validateCloneOptions(full), null);
});

test('validates depth, bounded parallelism, timeout, branch syntax, and submodule dependencies', () => {
  for (const patch of [
    {depth:0},{depth:1.2},{depth:NaN},{depth:1_000_001},
    {submoduleJobs:0},{submoduleJobs:33},{timeoutMinutes:0},{timeoutMinutes:1441},
    {branch:'--upload-pack=bad'},{branch:'bad..branch'},{branch:'@{-1}'},{branch:'bad\nname'},
    {recurseSubmodules:false,shallowSubmodules:true},{filterSubmodules:true},
  ]) assert.ok(validateCloneOptions({...createCloneOptions(),...patch}), JSON.stringify(patch));
  assert.equal(validateCloneOptions({...createCloneOptions(),branch:'feature/large-repo',depth:50}),null);
  assert.equal(validateCloneOptions({...createCloneOptions(),recurseSubmodules:true,blobless:true,filterSubmodules:true,shallowSubmodules:true}),null);
});

test('command preview contains matching flags and quotes user-controlled operands', () => {
  const options = {...createCloneOptions(),branch:'feature/test',depth:50,singleBranch:true,noTags:true,blobless:true,sparse:true,recurseSubmodules:true,
    shallowSubmodules:true,filterSubmodules:true,submoduleJobs:8};
  const command = previewCloneCommand('https://example.test/repo','C:\\Projects\\My Repo',options);
  for (const flag of ['--depth=50','--single-branch','--no-tags','--filter=blob:none','--sparse',
    '--recurse-submodules','--shallow-submodules','--also-filter-submodules','--jobs=8']) {
    assert.ok(command.includes(flag), flag);
  }
  assert.ok(command.includes(JSON.stringify('C:\\Projects\\My Repo')));
  assert.ok(command.includes('--branch="feature/test"'));
  assert.ok(previewCloneCommand('', '', createCloneOptions()).endsWith('-- <url> <destination>'));
});

test('clone options are always visible without presets and every checkbox remains independently editable', () => {
  const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
  const formSource = fs.readFileSync(new URL('../frontend/features/git/components/CloneOptionsForm.tsx', import.meta.url), 'utf8');
  const { outputText: formOutput } = ts.transpileModule(formSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  });
  const formExports = {};
  new Function('require', 'exports', formOutput)((id) => {
    if (id === 'react') return { ...react, default: react };
    if (id === '../utils/cloneOptions') return helpers;
    if (id === '../../../common/components/CustomSelect') return { CustomSelect: () => null };
    if (id === '../utils/cloneRefOptions') return { cloneRefOptions: () => [] };
    throw new Error(`Unexpected import: ${id}`);
  }, formExports);
  let options = createCloneOptions();
  const render = () => formExports.CloneOptionsForm({ options, onChange: (next) => { options = next; }, disabled: false });
  function nodes(node) {
    if (!node || typeof node !== 'object') return [];
    return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
  }
  const checkbox = (label) => nodes(render()).find((node) => node.type === 'label'
    && node.props.children.flat(Infinity).includes(label)).props.children.flat(Infinity).find((node) => node?.type === 'input');
  assert.equal(render().type, 'section');
  assert.ok(!nodes(render()).some((node) => node.type === 'details' || node.type === 'summary' || node.type === 'select'));
  assert.ok(!formSource.toLowerCase().includes('preset'));
  for (const [label, field, checked, inverted] of [
    ['Clone all branches', 'singleBranch', true, true],
    ['Include tags', 'noTags', true, true],
    ['Download Git LFS files', 'skipLfs', true, true],
    ['Partial clone (blob:none)', 'blobless', false, false],
    ['Sparse checkout (top-level files only)', 'sparse', false, false],
    ['Clone submodules recursively (including nested submodules)', 'recurseSubmodules', true, false],
  ]) {
    assert.equal(checkbox(label).props.checked, checked);
    const original = { ...options };
    checkbox(label).props.onChange({ target: { checked: !checked } });
    assert.deepEqual(options, { ...original, [field]: inverted ? checked : !checked });
    checkbox(label).props.onChange({ target: { checked } });
    assert.deepEqual(options, original);
  }
  checkbox('Partial clone (blob:none)').props.onChange({ target: { checked: true } });
  assert.equal(checkbox('Apply partial clone to submodules (Git 2.36+)').props.disabled, false);
  checkbox('Apply partial clone to submodules (Git 2.36+)').props.onChange({ target: { checked: true } });
  checkbox('Shallow submodules (depth 1)').props.onChange({ target: { checked: true } });
  checkbox('Clone submodules recursively (including nested submodules)').props.onChange({ target: { checked: false } });
  assert.equal(options.shallowSubmodules, false);
  assert.equal(options.filterSubmodules, false);
  assert.equal(checkbox('Shallow submodules (depth 1)').props.disabled, true);
  assert.equal(checkbox('Apply partial clone to submodules (Git 2.36+)').props.disabled, true);
  assert.equal(validateCloneOptions(options), null);
  const disabledForm = formExports.CloneOptionsForm({ options, onChange() {}, disabled: true });
  assert.equal(nodes(disabledForm).find((node) => node.type === 'fieldset').props.disabled, true);
});
