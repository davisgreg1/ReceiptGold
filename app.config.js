export default ({ config }) => {
  return {
    ...config,
    ios: {
      ...config.ios,
      googleServicesFile: "./GoogleService-Info.plist",
    },
    android: {
      ...config.android,
      permissions: [
        ...(config.android?.permissions || []),
        "com.android.vending.BILLING"
      ],
    },
  };
};