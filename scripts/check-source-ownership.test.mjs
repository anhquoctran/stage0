import assert from 'node:assert/strict';
import test from 'node:test';
import { backendOwners, checkSourceOwnership, frontendOwners } from './check-source-ownership.mjs';

test('FE identifies separate props, components, classes, interfaces and aliases', () => {
  assert.deepEqual(frontendOwners(`
    interface ButtonProps { label: string; }
    type Variant = 'primary' | 'secondary';
    class Controller {}
    export const Button = memo(() => <button />);
    export function Panel() { return <div />; }
  `), ['ButtonProps', 'Variant', 'Controller', 'Button', 'Panel']);
});

test('FE allows imports, re-exports, helpers and dynamic component aliases', () => {
  assert.deepEqual(frontendOwners(`
    import type { Props } from './Props';
    export type { Variant } from './Variant';
    const MAX_ITEMS = Number('10');
    function resolveIcon(id: string) { return Icons[id]; }
    export const Panel = () => {
      const ActiveProviderIcon = resolveIcon('git');
      return <ActiveProviderIcon />;
    };
  `), ['Panel']);
});

test('FE counts anonymous default components, wrapped components and nested definitions', () => {
  assert.deepEqual(frontendOwners(`
    const Avatar = (memo(() => <img />)) satisfies React.FC;
    export default function() {
      function Nested() { return <span />; }
      return <Nested />;
    }
  `), ['Avatar', '<default component>', 'Nested']);
});

test('BE treats a type and all its impl blocks as one owner', () => {
  assert.deepEqual(backendOwners(`
    pub struct Registry { value: String }
    impl Registry { fn new() -> Self { Self { value: String::new() } } }
    impl Default for Registry { fn default() -> Self { Self::new() } }
    impl Iterator for Registry { type Item = String; }
  `), ['Registry']);
});

test('BE ignores comments, escaped strings, raw strings, byte strings, chars and lifetimes', () => {
  assert.deepEqual(backendOwners(`
    // struct Fake {}
    /* enum Fake {} /* trait Fake {} */ */
    const MESSAGE: &str = "struct Fake { \\"quoted\\" }";
    const SCRIPT: &str = r##"enum Fake { \" } trait Another {}"##;
    const BYTES: &[u8] = br#"struct Fake {}"#;
    const BRACE: char = '}';
    struct Real<'a> { value: &'a str }
  `), ['Real']);
});

test('BE identifies models in inline modules but not associated types', () => {
  assert.deepEqual(backendOwners(`
    mod models { pub struct Request; pub enum Response { Ok } }
    pub trait Adapter { type Output; }
    pub type Alias = String;
  `), ['Request', 'Response', 'Adapter', 'Alias']);
});

test('all application source files have at most one owner', () => {
  assert.deepEqual(checkSourceOwnership().violations, []);
});
