const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");
const fs = require("fs");
const path = require("path");

/** @type {import('webpack').Configuration} */
module.exports = merge(common, {
    mode: "development",
    devtool: "eval-source-map",
    target: "web",

    output: {
        filename: "territories.js",
        library: {
            name: "Territories",
            type: "umd",
            export: "default",
        },
        globalObject: "this",
    },

    devServer: {
        host: "territories.localhost",
        port: 443,
        hot: true,
        server: {
            type: "https",
            options: {
                key: fs.readFileSync(
                    path.join(__dirname, "../certs/privkey.key"),
                ),
                cert: fs.readFileSync(
                    path.join(__dirname, "../certs/fullchain.crt"),
                ),
            },
        },
        // open: true,
        static: false,
        historyApiFallback: true,
        client: {
            overlay: {
                errors: true,
                warnings: false,
            },
        },
    },

    // Override babel targets for dev — use modern browsers only
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: [
                            "@babel/preset-env",
                            "@babel/preset-typescript",
                        ],
                    },
                },
            },
            {
                test: /\.(s[ac]ss|css)$/i,
                use: [
                    {
                        loader: "style-loader",
                        options: {
                            attributes: {
                                "data-videra": "all-players",
                            },
                        },
                    },
                    {
                        loader: "css-loader",
                        options: {
                            sourceMap: true,
                        },
                    },
                    {
                        loader: "sass-loader",
                        options: {
                            sourceMap: true,
                        },
                    },
                ],
            },
        ],
    },
});
