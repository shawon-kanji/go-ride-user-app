import { Modal, Text, View } from 'react-native';

import { Button } from './Button';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center bg-black/40 px-6">
        <View className="w-full rounded-lg bg-white p-5">
          <Text className="mb-2 text-lg font-semibold text-neutral-900">{title}</Text>
          <Text className="mb-5 text-sm text-neutral-600">{message}</Text>
          <View className="flex-row justify-end gap-3">
            <View className="flex-1">
              <Button label={cancelLabel} variant="ghost" onPress={onCancel} disabled={loading} />
            </View>
            <View className="flex-1">
              <Button label={confirmLabel} onPress={onConfirm} loading={loading} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
