export function highlightJsoncLine(line: string, continuesBlockComment: boolean) {
  const segments: { value: string; className: string }[] = [];
  let index = 0;
  let inBlockComment = continuesBlockComment;

  const append = (value: string, className = '') => {
    const last = segments.at(-1);
    if (last?.className === className) last.value += value;
    else segments.push({ value, className });
  };

  while (index < line.length) {
    if (inBlockComment) {
      const end = line.indexOf('*/', index);
      if (end < 0) {
        append(line.slice(index), 'text-overlay0 italic');
        index = line.length;
      } else {
        append(line.slice(index, end + 2), 'text-overlay0 italic');
        index = end + 2;
        inBlockComment = false;
      }
      continue;
    }

    if (line.startsWith('//', index)) {
      append(line.slice(index), 'text-overlay0 italic');
      break;
    }

    if (line.startsWith('/*', index)) {
      const end = line.indexOf('*/', index + 2);
      if (end < 0) {
        append(line.slice(index), 'text-overlay0 italic');
        inBlockComment = true;
        break;
      }
      append(line.slice(index, end + 2), 'text-overlay0 italic');
      index = end + 2;
      continue;
    }

    if (line[index] === '"') {
      let end = index + 1;
      let escaped = false;
      while (end < line.length) {
        const character = line[end];
        end++;
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') break;
      }
      const value = line.slice(index, end);
      let next = end;
      while (/\s/.test(line[next] ?? '')) next++;
      append(value, line[next] === ':' ? 'text-blue' : 'text-green');
      index = end;
      continue;
    }

    const literal = line.slice(index).match(/^(?:true|false|null)\b/)?.[0];
    if (literal) {
      append(literal, 'text-mauve');
      index += literal.length;
      continue;
    }

    const number = line.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/)?.[0];
    if (number) {
      append(number, 'text-peach');
      index += number.length;
      continue;
    }

    if ('{}[]:,'.includes(line[index])) {
      append(line[index], 'text-overlay1');
      index++;
      continue;
    }

    append(line[index]);
    index++;
  }

  return { segments, continuesBlockComment: inBlockComment };
}
