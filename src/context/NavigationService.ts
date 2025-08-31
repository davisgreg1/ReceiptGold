import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export class NavigationService {
  private static navigationRef: any = null;
  private static navigationIntent: any = null;

  /**
   * Set the navigation reference from your main navigator
   */
  static setNavigationRef(ref: any) {
    this.navigationRef = ref;
    
    // Process any pending navigation intent
    if (this.navigationIntent) {
      setTimeout(() => {
        this.navigate(this.navigationIntent.screen, this.navigationIntent.params);
        this.navigationIntent = null;
      }, 100);
    }
  }

  /**
   * Store navigation intent to be processed when app becomes active
   * This is useful for deep links from notifications
   */
  static setNavigationIntent(intent: any) {
    console.log('📍 Setting navigation intent:', intent);
    this.navigationIntent = intent;
    
    // If navigation is ready, navigate immediately
    if (this.navigationRef?.isReady()) {
      this.navigate(intent.screen, intent.params);
      this.navigationIntent = null;
    }
  }

  /**
   * Navigate to a specific screen with parameters
   */
  static navigate(screen: string, params?: any) {
    if (this.navigationRef?.isReady()) {
      console.log('📍 Navigating to:', screen, params);
      this.navigationRef.navigate(screen, params);
    } else {
      console.log('📍 Navigation not ready, storing intent');
      this.navigationIntent = { screen, params };
    }
  }

  /**
   * Get current route name
   */
  static getCurrentRouteName(): string | undefined {
    if (this.navigationRef?.isReady()) {
      return this.navigationRef.getCurrentRoute()?.name;
    }
    return undefined;
  }

  /**
   * Go back
   */
  static goBack() {
    if (this.navigationRef?.isReady() && this.navigationRef.canGoBack()) {
      this.navigationRef.goBack();
    }
  }

  /**
   * Reset navigation stack
   */
  static reset(routeName: string, params?: any) {
    if (this.navigationRef?.isReady()) {
      this.navigationRef.reset({
        index: 0,
        routes: [{ name: routeName, params }],
      });
    }
  }

  /**
   * Check if navigation is ready
   */
  static isReady(): boolean {
    return this.navigationRef?.isReady() || false;
  }

  /**
   * Process any pending navigation intent (call this when app becomes active)
   */
  static processPendingIntent() {
    if (this.navigationIntent && this.navigationRef?.isReady()) {
      console.log('📍 Processing pending navigation intent:', this.navigationIntent);
      this.navigate(this.navigationIntent.screen, this.navigationIntent.params);
      this.navigationIntent = null;
    }
  }

  /**
   * Clear any pending navigation intent
   */
  static clearPendingIntent() {
    console.log('📍 Clearing pending navigation intent');
    this.navigationIntent = null;
  }
}

export default NavigationService;