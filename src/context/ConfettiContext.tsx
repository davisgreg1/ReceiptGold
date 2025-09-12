import React, { createContext, useContext, useState, useCallback } from 'react';
import { ConfettiOverlay } from '../components/ConfettiOverlay';

interface ConfettiContextValue {
  triggerConfetti: () => void;
  isConfettiShowing: boolean;
}

const ConfettiContext = createContext<ConfettiContextValue | undefined>(undefined);

export const useConfettiContext = () => {
  const context = useContext(ConfettiContext);
  if (!context) {
    throw new Error('useConfettiContext must be used within a ConfettiProvider');
  }
  return context;
};

interface ConfettiProviderProps {
  children: React.ReactNode;
}

export const ConfettiProvider: React.FC<ConfettiProviderProps> = ({ children }) => {
  const [showConfetti, setShowConfetti] = useState(false);

  const triggerConfetti = useCallback(() => {
    console.log('🎊 Global confetti triggered!');
    setShowConfetti(true);
    
    // Auto-hide confetti after 4 seconds (matching our enhanced duration)
    setTimeout(() => {
      setShowConfetti(false);
    }, 4000);
  }, []);

  const value: ConfettiContextValue = {
    triggerConfetti,
    isConfettiShowing: showConfetti,
  };

  return (
    <ConfettiContext.Provider value={value}>
      {children}
      {/* Global confetti overlay that shows on top of everything */}
      <ConfettiOverlay show={showConfetti} />
    </ConfettiContext.Provider>
  );
};