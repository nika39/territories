const path = require("path");
const webpack = require("webpack");
const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const bannerFn = require("../../../license.js");
const pkg = require("../package.json");
const ESLintPlugin = require("eslint-webpack-plugin");

module.exports = () => {
    return merge(common, {
        name: "modern",
        mode: "production",
        devtool: false,
        target: "web",

        output: {
            path: path.resolve(__dirname, "../dist"),
            filename: "index.js",
            library: {
                name: "Videra",
                type: "umd",
                export: "default",
            },
            globalObject: "this",
        },

        // Override the babel-loader rule with modern-specific browserslist
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    exclude: /node_modules/,
                    use: {
                        loader: "babel-loader",
                        options: {
                            presets: [
                                [
                                    "@babel/preset-env",
                                    {
                                        useBuiltIns: "usage",
                                        corejs: 3,
                                        bugfixes: true,
                                        modules: false,
                                    },
                                ],
                                "@babel/preset-typescript",
                            ],
                        },
                    },
                },
                {
                    test: /\.s[ac]ss$/i,
                    use: [
                        {
                            loader: "style-loader",
                            options: {
                                attributes: {
                                    "data-videra": "all-players",
                                },
                            },
                        },
                        { loader: "css-loader", options: { importLoaders: 2 } },
                        {
                            loader: "postcss-loader",
                            options: {
                                postcssOptions: {
                                    plugins: [
                                        "postcss-preset-env",
                                        [
                                            "autoprefixer",
                                            { cascade: false, env: "modern" },
                                        ],
                                        [
                                            "cssnano",
                                            {
                                                preset: [
                                                    "default",
                                                    {
                                                        discardComments: {
                                                            removeAll: true,
                                                        },
                                                    },
                                                ],
                                            },
                                        ],
                                    ],
                                },
                            },
                        },
                        {
                            loader: "sass-loader",
                            options: {
                                sassOptions: {
                                    outputStyle: "compressed",
                                },
                            },
                        },
                    ],
                },
            ],
        },

        optimization: {
            minimize: true,
            minimizer: [
                new TerserPlugin({
                    test: /\.js(\?.*)?$/i,
                    terserOptions: {
                        compress: true,
                        mangle: true,
                    },
                    extractComments: false,
                }),
            ],
        },
        plugins: [
            new CleanWebpackPlugin(),
            new webpack.BannerPlugin({
                banner: bannerFn(pkg),
                entryOnly: true,
            }),
            new ESLintPlugin({
                extensions: ["ts", "js"],
            }),
        ],
    });
};
