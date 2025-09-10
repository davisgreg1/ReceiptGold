export default ({ config }) => {
  return {
    ...config,
    ios: {
      ...config.ios,
      googleServicesFile: process.env.GOOGLE_SERVICES_PLIST,
    },
  };
};