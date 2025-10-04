import React, { createContext, useState, useContext, useCallback, ReactNode } from 'react';
import AlertModal from '../components/ui/AlertModal';

type AlertType = 'info' | 'success' | 'error';

interface AlertState {
  isOpen: boolean;
  message: string;
  type: AlertType;
}

interface AlertContextType {
  showAlert: (message: string, type?: AlertType) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [alertState, setAlertState] = useState<AlertState>({
    isOpen: false,
    message: '',
    type: 'info',
  });

  const showAlert = useCallback((message: string, type: AlertType = 'info') => {
    setAlertState({ isOpen: true, message, type });
  }, []);

  const closeAlert = () => {
    setAlertState({ ...alertState, isOpen: false });
  };

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <AlertModal
        isOpen={alertState.isOpen}
        message={alertState.message}
        type={alertState.type}
        onClose={closeAlert}
      />
    </AlertContext.Provider>
  );
};

export const useAlert = (): AlertContextType => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};
