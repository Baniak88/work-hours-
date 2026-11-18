module.exports = ({ config }) => {
  const baseUrl = (process.env.WORKHOURS_BASE_PATH || "").replace(/\/$/, "");
  return {
    ...config,
    experiments: { ...config.experiments, ...(baseUrl ? { baseUrl } : {}) },
  };
};
