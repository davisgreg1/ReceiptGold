import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useConnectivity() {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? true);
    });
    NetInfo.fetch().then(state => setIsConnected(state.isConnected ?? true));
    return () => unsubscribe();
  }, []);

  return isConnected;
}
