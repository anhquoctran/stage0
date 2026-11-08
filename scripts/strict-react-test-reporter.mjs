export function assertReactTestResults(modules, errors) {
  const tests = modules.flatMap(module => [...module.children.allTests()]);
  if (!tests.length || errors.length || tests.some(test => {
    const result = test.result();
    return result.state !== 'passed' || result.errors?.length;
  })) throw Error('React suite must execute nonempty tests without failures, skips, todos or hidden retries');
}

export default {
  onTestRunEnd(modules, errors) { assertReactTestResults(modules, errors); },
};
