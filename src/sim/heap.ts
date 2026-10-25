/** Binary min-heap on (priority, node) over two parallel arrays; ties break on the lower node. */
export function heapPush(f: number[], n: number[], fv: number, nv: number): void {
  let i = f.length;
  f.push(fv);
  n.push(nv);
  while (i > 0) {
    const p = (i - 1) >> 1;
    const pf = f[p] as number;
    if (pf < fv || (pf === fv && (n[p] as number) <= nv)) break;
    f[i] = pf;
    n[i] = n[p] as number;
    i = p;
  }
  f[i] = fv;
  n[i] = nv;
}

export function heapPop(f: number[], n: number[]): number {
  const top = n[0] as number;
  const lf = f.pop() as number;
  const ln = n.pop() as number;
  const size = f.length;
  if (size > 0) {
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= size) break;
      const r = c + 1;
      if (r < size && ((f[r] as number) < (f[c] as number) || (f[r] === f[c] && (n[r] as number) < (n[c] as number)))) c = r;
      const cf = f[c] as number;
      if (lf < cf || (lf === cf && ln <= (n[c] as number))) break;
      f[i] = cf;
      n[i] = n[c] as number;
      i = c;
    }
    f[i] = lf;
    n[i] = ln;
  }
  return top;
}

