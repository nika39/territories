const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const Dotenv = require("dotenv-webpack");

/** @type {import('webpack').Configuration} */
module.exports = {
    entry: path.resolve(__dirname, "../src/index.ts"),

    resolve: {
        extensions: [".ts", ".js", ".scss"],
        alias: {
            "@": path.resolve(__dirname, "../src"),
        },
    },

    plugins: [
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, "../src/index.html"),
            favicon: path.resolve(__dirname, "../src/favicon.svg"),
            inject: "body",
        }),
        new Dotenv({
            path: path.resolve(__dirname, "../.env"),
            systemvars: true,
            silent: true,
        }),
    ],
};
