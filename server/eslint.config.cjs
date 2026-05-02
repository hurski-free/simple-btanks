const js = require("@eslint/js");
const globals = require("globals");
const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");

module.exports = [
  {
    ignores: ["dist/**", "node_modules/**"]
  },
  js.configs.recommended,
  {
    files: ["webpack.config.js", "*.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        require: "readonly",
        module: "readonly",
        __dirname: "readonly",
        __filename: "readonly"
      }
    }
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
      },
      globals: globals.node
    },
    plugins: {
      "@typescript-eslint": tsPlugin
    },
    rules: {
      ...tsPlugin.configs.recommended.rules
    }
  }
];
