import { describe, expect, it } from 'vitest';
import { invertOp, invertOps } from '@/core/transaction/invert';

describe('invertOp', () => {
  it('move inverts to reverse move', () => {
    const inv = invertOp({ kind: 'move', from: '/a/x', to: '/b/x' });
    expect(inv).toEqual({ kind: 'move', from: '/b/x', to: '/a/x' });
  });

  it('mkdir inverts to delete', () => {
    const inv = invertOp({ kind: 'mkdir', path: '/a/new' });
    expect(inv).toEqual({ kind: 'delete', path: '/a/new', recursive: false });
  });

  it('delete is not invertible directly', () => {
    expect(invertOp({ kind: 'delete', path: '/a/x', recursive: false })).toBeNull();
  });
});

describe('invertOps', () => {
  it('reverses order and inverts each', () => {
    const ops = [
      { kind: 'mkdir', path: '/a/new' } as const,
      { kind: 'move', from: '/a/x', to: '/a/new/x' } as const,
    ];
    const inv = invertOps(ops);
    expect(inv).toEqual([
      { kind: 'move', from: '/a/new/x', to: '/a/x' },
      { kind: 'delete', path: '/a/new', recursive: false },
    ]);
  });
});
