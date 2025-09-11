import React from 'react';
import { useSubscription } from '../context/SubscriptionContext';
import ChoosePlanScreen from './ChoosePlanScreen';
import AdjustPlanScreen from './AdjustPlanScreen';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';

interface SubscriptionRouterProps {
  navigation: StackNavigationProp<any>;
  route: RouteProp<any>;
}

const SubscriptionRouter: React.FC<SubscriptionRouterProps> = (props) => {
  const { subscription } = useSubscription();
  
  // Check if user has an active paid subscription
  const hasPaidSubscription = subscription.currentTier && 
    subscription.currentTier !== 'free' && 
    subscription.currentTier !== 'trial' &&
    subscription.isActive;

  // Show beautiful adjust plan screen for existing subscribers
  if (hasPaidSubscription) {
    return <AdjustPlanScreen {...props} />;
  }

  // Show original choose plan screen for new subscribers
  return <ChoosePlanScreen {...props} />;
};

export default SubscriptionRouter;