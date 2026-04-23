import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Operation } from '@/types';

export interface AppliedTx {
  txId: string;
  label: string;
  timestamp: number;
  rootFsPath: string;
  ops: Operation[];
  inverseOps: Operation[];
  rolledBack?: boolean;
}

interface TxHistoryState {
  history: AppliedTx[];
  push(tx: AppliedTx): void;
  markRolledBack(txId: string): void;
  clear(): void;
}

const HISTORY_CAP = 20;

export const useTxHistoryStore = create<TxHistoryState>()(
  persist(
    set => ({
      history: [],
      push: tx =>
        set(state => {
          const next = [tx, ...state.history];
          if (next.length > HISTORY_CAP) next.length = HISTORY_CAP;
          return { history: next };
        }),
      markRolledBack: txId =>
        set(state => ({
          history: state.history.map(t =>
            t.txId === txId ? { ...t, rolledBack: true } : t,
          ),
        })),
      clear: () => set({ history: [] }),
    }),
    {
      name: 'structura-tx-history',
      version: 1,
    },
  ),
);
