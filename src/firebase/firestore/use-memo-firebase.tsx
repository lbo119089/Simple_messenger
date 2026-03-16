'use client';

import { useMemo, DependencyList } from 'react';

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T {
  return useMemo(factory, deps);
}
