import React, { createContext, useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Platform } from 'react-native';
import { CheckCircle2, AlertCircle, Info, X, HelpCircle } from 'lucide-react-native';
import { COLORS } from '../utils/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastState {
  message: string;
  type: ToastType;
  visible: boolean;
}

interface DialogState {
  title: string;
  message: string;
  visible: boolean;
  type: 'alert' | 'confirm';
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

interface AlertContextType {
  showToast: (message: string, type?: ToastType) => void;
  showAlert: (title: string, message: string) => void;
  showConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    options?: {
      confirmText?: string;
      cancelText?: string;
      isDestructive?: boolean;
      onCancel?: () => void;
    }
  ) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState>({ message: '', type: 'success', visible: false });
  const [dialog, setDialog] = useState<DialogState>({ title: '', message: '', visible: false, type: 'alert' });
  const [toastAnim] = useState(new Animated.Value(-100));

  // Auto-hide toast
  useEffect(() => {
    if (toast.visible) {
      Animated.spring(toastAnim, {
        toValue: insets.top > 0 ? insets.top + 10 : 20,
        useNativeDriver: true,
        speed: 12,
        bounciness: 6,
      }).start();

      const timer = setTimeout(() => {
        hideToast();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [toast.visible]);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type, visible: true });
  };

  const hideToast = () => {
    Animated.timing(toastAnim, {
      toValue: -100,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setToast(prev => ({ ...prev, visible: false }));
    });
  };

  const showAlert = (title: string, message: string) => {
    setDialog({
      title,
      message,
      visible: true,
      type: 'alert',
      confirmText: 'OK',
    });
  };

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    options?: {
      confirmText?: string;
      cancelText?: string;
      isDestructive?: boolean;
      onCancel?: () => void;
    }
  ) => {
    setDialog({
      title,
      message,
      visible: true,
      type: 'confirm',
      onConfirm,
      confirmText: options?.confirmText || 'Confirm',
      cancelText: options?.cancelText || 'Cancel',
      isDestructive: options?.isDestructive || false,
      onCancel: options?.onCancel,
    });
  };

  const handleConfirm = () => {
    setDialog(prev => ({ ...prev, visible: false }));
    if (dialog.onConfirm) {
      dialog.onConfirm();
    }
  };

  const handleCancel = () => {
    setDialog(prev => ({ ...prev, visible: false }));
    if (dialog.onCancel) {
      dialog.onCancel();
    }
  };

  const getToastIcon = (type: ToastType) => {
    switch (type) {
      case 'success': return <CheckCircle2 size={20} color="#FFFFFF" />;
      case 'error': return <AlertCircle size={20} color="#FFFFFF" />;
      case 'warning': return <AlertCircle size={20} color="#FFFFFF" />;
      case 'info': return <Info size={20} color="#FFFFFF" />;
    }
  };

  const getToastBgColor = (type: ToastType) => {
    switch (type) {
      case 'success': return COLORS.success;
      case 'error': return COLORS.danger;
      case 'warning': return COLORS.warning;
      case 'info': return COLORS.accent;
    }
  };

  return (
    <AlertContext.Provider value={{ showToast, showAlert, showConfirm }}>
      {children}

      {/* Global Toast Banner */}
      {toast.visible && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              transform: [{ translateY: toastAnim }],
              backgroundColor: getToastBgColor(toast.type),
            },
          ]}
        >
          <View style={styles.toastContent}>
            {getToastIcon(toast.type)}
            <Text style={styles.toastText}>{toast.message}</Text>
          </View>
          <TouchableOpacity onPress={hideToast} style={styles.toastCloseBtn}>
            <X size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Global Dialog Modal */}
      <Modal
        transparent={true}
        animationType="fade"
        visible={dialog.visible}
        onRequestClose={handleCancel}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard}>
            <View style={[
              styles.dialogIconContainer,
              { 
                backgroundColor: dialog.isDestructive 
                  ? 'rgba(239, 68, 68, 0.1)' 
                  : dialog.type === 'confirm' 
                    ? 'rgba(92, 62, 163, 0.1)' 
                    : 'rgba(16, 185, 129, 0.1)'
              }
            ]}>
              {dialog.isDestructive ? (
                <AlertCircle size={32} color={COLORS.danger} />
              ) : dialog.type === 'confirm' ? (
                <HelpCircle size={32} color={COLORS.primary} />
              ) : (
                <CheckCircle2 size={32} color={COLORS.success} />
              )}
            </View>

            <Text style={styles.dialogTitle}>{dialog.title}</Text>
            <Text style={styles.dialogMessage}>{dialog.message}</Text>

            <View style={styles.dialogActions}>
              {dialog.type === 'confirm' && (
                <TouchableOpacity
                  style={[styles.dialogBtn, styles.dialogBtnCancel]}
                  onPress={handleCancel}
                >
                  <Text style={styles.dialogBtnCancelText}>{dialog.cancelText || 'Cancel'}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.dialogBtn,
                  dialog.isDestructive ? styles.dialogBtnDanger : styles.dialogBtnConfirm,
                  dialog.type === 'alert' && { flex: 0, width: '100%' }
                ]}
                onPress={handleConfirm}
              >
                <Text style={styles.dialogBtnConfirmText}>{dialog.confirmText || 'OK'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </AlertContext.Provider>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  toastCloseBtn: {
    padding: 2,
    marginLeft: 10,
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(30, 27, 75, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialogCard: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 320,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  dialogIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  dialogMessage: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  dialogActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  dialogBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogBtnCancel: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#FFFFFF',
  },
  dialogBtnCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  dialogBtnConfirm: {
    backgroundColor: COLORS.primary,
  },
  dialogBtnDanger: {
    backgroundColor: COLORS.danger,
  },
  dialogBtnConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
