export default ({ config }) => {
  return {
    ...config,
    ios: {
      ...config.ios,
      googleServicesFile: "./GoogleService-Info.plist",
    },
  };
};