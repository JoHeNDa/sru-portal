'use client';
import { useCallback, useState } from 'react';
import type { ConfirmOptions } from '@/components/ConfirmModal';

type State = (ConfirmOptions & { resolve: (v: boolean) => void }) | null;

export function useConfirm() {
  const [state, setState] = useState<State>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>(resolve => {
      setState({ ...options, resolve });
    });
  }, []);

  const handleClose = useCallback((answer: boolean) => {
    setState(current => {
      current?.resolve(answer);
      return null;
    });
  }, []);

  return {
    confirm,
    modalState: state,
    handleConfirm: () => handleClose(true),
    handleCancel: () => handleClose(false),
  };
}
