const path = require("path");
const ESLintPlugin = require("eslint-webpack-plugin");

/** @type {import("webpack").Configuration} */
module.exports = {
  target: "node",
  entry: "./src/index.ts",
  output: {
    filename: "main.js",
    path: path.resolve(__dirname, "dist"),
    clean: true
  },
  externals: {
    ws: "commonjs ws"
  },
  resolve: {
    extensions: [".ts", ".js"]
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: "ts-loader",
        exclude: /node_modules/
      }
    ]
  },
  plugins: [
    new ESLintPlugin({
      extensions: ["ts"],
      configType: "flat"
    })
  ],
  devtool: "source-map",
  optimization: {
    minimize: false
  }
};
