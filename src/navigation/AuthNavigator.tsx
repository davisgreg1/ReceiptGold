import React, { useState } from 'react';
import { SignInScreen } from '../screens/SignInScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';

type AuthScreen = 'signIn' | 'signUp' | 'forgotPassword';

export const AuthNavigator: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<AuthScreen>('signIn');

  const navigateToSignIn = () => setCurrentScreen('signIn');
  const navigateToSignUp = () => setCurrentScreen('signUp');
  const navigateToForgotPassword = () => setCurrentScreen('forgotPassword');

  switch (currentScreen) {
    case 'signIn':
      return (
        <SignInScreen
          onNavigateToSignUp={navigateToSignUp}
          onNavigateToForgotPassword={navigateToForgotPassword}
        />
      );
    case 'signUp':
      return (
        <SignUpScreen
          onNavigateToSignIn={navigateToSignIn}
        />
      );
    case 'forgotPassword':
      return (
        <ForgotPasswordScreen
          onNavigateToSignIn={navigateToSignIn}
        />
      );
    default:
      return (
        <SignInScreen
          onNavigateToSignUp={navigateToSignUp}
          onNavigateToForgotPassword={navigateToForgotPassword}
        />
      );
  }
};
