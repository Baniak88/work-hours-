const { defineConfig } = require("eslint/config");
const expo = require("eslint-config-expo/flat");
module.exports = defineConfig([
  expo,
  { ignores: ["dist/**", "artifacts/**", "test-results/**", "docs/**"] },
  {
    rules: {
      "import/no-named-as-default": "off",
    },
  },
]);
