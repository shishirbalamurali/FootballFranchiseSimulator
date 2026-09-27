import { useEffect } from 'react';
import { useToast } from './ui';
import { onSaveStatus } from '../store/gameStore';

// Tells the player when their franchise didn't save. Renders nothing.
export default function SaveStatusWatcher() {
  const toast = useToast();
  useEffect(() => onSaveStatus(status => {
    if (status === 'failed') {
      toast.error({
        title: 'Your franchise could not be saved',
        body: 'Browser storage is full. Delete an unused save slot to free space — progress since the last save will be lost on reload.',
        duration: 0,
      });
    } else if (status === 'trimmed') {
      toast.warn({
        title: 'Save trimmed to fit storage',
        body: 'Older box scores and news were dropped so your progress could be saved.',
      });
    }
  }), [toast]);
  return null;
}
