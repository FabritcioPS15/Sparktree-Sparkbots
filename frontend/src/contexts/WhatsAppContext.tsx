import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

interface WhatsAppNumber {
  id: string;
  phoneNumber: string;
  displayName: string;
  status: 'connected' | 'disconnected' | 'connecting';
  qrCode?: string;
  organizationId: string;
  createdAt: string;
  lastConnected?: string;
}

interface WhatsAppContextType {
  numbers: WhatsAppNumber[];
  loading: boolean;
  addNumber: (phoneNumber: string, displayName: string) => Promise<void>;
  removeNumber: (numberId: string) => Promise<void>;
  updateNumberStatus: (numberId: string, status: WhatsAppNumber['status'], qrCode?: string) => void;
  getNumbersByOrganization: (organizationId: string) => WhatsAppNumber[];
  canAddMoreNumbers: (organizationId: string) => boolean;
}

const WhatsAppContext = createContext<WhatsAppContextType | undefined>(undefined);

export const WhatsAppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [numbers, setNumbers] = useState<WhatsAppNumber[]>([]);
  const [loading, setLoading] = useState(true);

  const { user } = useAuth();

  useEffect(() => {
    if (user) fetchNumbers();
    else { setNumbers([]); setLoading(false); }
  }, [user]);

  const fetchNumbers = async () => {
    try {
      const response = await api.get('/whatsapp-connections');
      setNumbers(response.data);
    } catch (error) {
      console.error('Error fetching WhatsApp numbers:', error);
      setNumbers([]);
    } finally {
      setLoading(false);
    }
  };

  const addNumber = async (phoneNumber: string, displayName: string) => {
    try {
      const response = await api.post('/whatsapp-connections', {
        phoneNumber,
        displayName
      });
      setNumbers(prev => [...prev, response.data]);
    } catch (error) {
      console.error('Error adding number:', error);
      throw error;
    }
  };

  const removeNumber = async (numberId: string) => {
    try {
      await api.delete(`/whatsapp-connections/${numberId}`);
      setNumbers(prev => prev.filter(n => n.id !== numberId));
    } catch (error) {
      console.error('Error removing number:', error);
      // Fallback para desarrollo
      setNumbers(prev => prev.filter(n => n.id !== numberId));
    }
  };

  const updateNumberStatus = (numberId: string, status: WhatsAppNumber['status'], qrCode?: string) => {
    setNumbers(prev => prev.map(n => 
      n.id === numberId 
        ? { ...n, status, qrCode, lastConnected: status === 'connected' ? new Date().toISOString() : n.lastConnected }
        : n
    ));
  };

  const getNumbersByOrganization = (organizationId: string) => {
    return numbers.filter(n => n.organizationId === organizationId);
  };

  const canAddMoreNumbers = (organizationId: string) => {
    const orgNumbers = getNumbersByOrganization(organizationId);
    return orgNumbers.length < 2; // Límite de 2 números por empresa
  };

  return (
    <WhatsAppContext.Provider value={{
      numbers,
      loading,
      addNumber,
      removeNumber,
      updateNumberStatus,
      getNumbersByOrganization,
      canAddMoreNumbers
    }}>
      {children}
    </WhatsAppContext.Provider>
  );
};

export const useWhatsApp = () => {
  const context = useContext(WhatsAppContext);
  if (context === undefined) {
    throw new Error('useWhatsApp must be used within a WhatsAppProvider');
  }
  return context;
};
