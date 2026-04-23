export function matchGlob(pattern: string, text: string): boolean {
  if (!pattern) return true;
  const re = globToRegex(pattern);
  return re.test(text);
}

export function globToRegex(pattern: string): RegExp {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!;
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        re += '.*';
        i++;
        if (pattern[i + 1] === '/' || pattern[i + 1] === '\\') i++;
      } else {
        re += '[^/\\\\]*';
      }
    } else if (c === '?') {
      re += '[^/\\\\]';
    } else if (c === '[') {
      const close = pattern.indexOf(']', i + 1);
      if (close < 0) {
        re += '\\[';
      } else {
        re += '[' + pattern.slice(i + 1, close).replace(/\\/g, '\\\\') + ']';
        i = close;
      }
    } else if ('.+^$(){}|\\/'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp('^' + re + '$', 'i');
}
