//import { AngularCompilerPlugin } from '@ngtools/webpack';
const ngtoolsWebpack = require('@ngtools/webpack')
const webpack = require('webpack');
const helpers = require('./helpers');
const rxPaths = require('rxjs/_esm2015/path-mapping');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { BaseHrefWebpackPlugin } = require('base-href-webpack-plugin');
const path = require('path');
// Base Href same as in index.html
const baseHref = '/kmx/'

module.exports = {
    mode: 'development',
    devtool: 'cheap-module-eval-source-map',
    entry: {
        'polyfills': './src/polyfills.ts',
        'vendor': './src/vendor.ts',
        'app': './src/main.ts',
        //'socket.worker': './src/workers/socket.worker.ts',
        // 'pdf.worker': 'pdfjs-dist/build/pdf.worker.entry'
    },
    output: {
        path: helpers.root('dist'),
        pathinfo: true,
        publicPath: baseHref,
        filename: '[name].js',
        chunkFilename: '[id].chunk.js'
    },
    // optimization: {
    //     runtimeChunk: 'single',
    //     splitChunks: {
    //         chunks: "all",
    //         // chunks: "initial",
    //         // cacheGroups: {
    //         // //     default: false,
    //         // //     vendors: false,
    //         //   commons: {
    //         //     test: /[\\/]node_modules[\\/]/,
    //         //     name: "vendors",
    //         //     chunks: "all"
    //         //   }            
    //         // },
    //     },
    //     noEmitOnErrors: false, // NoEmitOnErrorsPlugin
    //     concatenateModules: true //ModuleConcatenationPlugin
    // },
    plugins: [
        new ngtoolsWebpack.AngularCompilerPlugin({
            tsConfigPath: helpers.root('./tsconfig.json'),
            entryModule: helpers.root('src/app/kmx.module#KmxAppModule'),
            //mainPath: helpers.root('./src/main.aot.ts'),
            sourceMap: true,
            //   hostReplacementPaths: {
            //     'path/to/config.development.ts': 'path/to/config.production.ts'
            //   }
        }),
        new webpack.ContextReplacementPlugin(
            // The (\\|\/) piece accounts for path separators in *nix and Windows

            // For Angular 5, see also https://github.com/angular/angular/issues/20357#issuecomment-343683491
            // /\@angular(\\|\/)core(\\|\/)fesm2015/,
            /\@angular(\\|\/)core(\\|\/)fesm5/,
            helpers.root('src'), // location of your src
            {
                // your Angular Async Route paths relative to this root directory
            }
        ),
        new HtmlWebpackPlugin({
            template: 'src/index.html'
        }),
        new MiniCssExtractPlugin({
            //   allChunks: true
            filename: '[name].css',
            chunkFilename: '[id].css',
        }),
        new BaseHrefWebpackPlugin({ baseHref: baseHref })
    ],
    resolve: {
        //added es2015 for use with angular instead of esm5
        //mainFields: ["browser", "es2015", "module", "main"],

        extensions: ['.js', '.ts'],
        alias: {
            ...rxPaths(),
            '@workers': helpers.root('src/workers'),
            '@kmx': helpers.root('src/app'),
            "camx": "camx/lib",
        }
    },
    module: {
        rules: [
            // {
            //     test: /\.ts$/,
            //     enforce: "pre",
            //     loader: 'tslint-loader',
            //     options: {
            //         configFile: './tslint.json',
            //         emitErrors: false,
            //         failOnHint: false
            //     }
            // },
            {
                test: /workers\/.*\.worker\.ts$/,
                //test: /worker\.ts$/,
                //include: helpers.root("src/workers"),
                use: [
                    {
                        loader: 'worker-loader',
                        options: {
                            filename: '[name].[hash].js',
                        }
                    },
                    { loader: 'ts-loader' }
                ],
            },
            {
                //test: /\.ts$/,
                test: /(?:\.ngfactory\.js|\.ngstyle\.js|\.ts)$/,
                //exclude: /\.worker\.ts$/,
                exclude: helpers.root("src/workers"),
                loader: '@ngtools/webpack'
            },
            {
                test: /\.html$/,
                loader: 'html-loader'
            },
            {
                //fontawesome
                test: /\.(png|jpe?g|gif|svg|woff|woff2|ttf|eot|ico)$/,
                loader: 'file-loader',
                options: { name: 'assets/[name].[hash].[ext]' }
            },
            {
                test: /\.css$/,
                include: helpers.root("src", "app"),
                use: "raw-loader"
            }, {
                test: /\.css$/,
                exclude: helpers.root("src", "app"),
                use: [MiniCssExtractPlugin.loader, "css-loader"]
            },
            // {
            //     test: /\.css$/,
            //     loader: '@ngtools/webpack'
            // },
        ],
        noParse: [
            /pdfjs-dist\/build\/pdf\.js$/,
            //   /pdfjs-dist\/build\/pdf\.min\.js$/,
            //   /pdfjs-dist\/build\/pdf\.worker\.js$/
        ],
    },
    devServer: {
        historyApiFallback: {
            index: baseHref
        },
        stats: 'minimal',
        //stats: 'normal',
        proxy: [
            {
                context: ['/ws'],
                ws: true,
                target: 'ws://localhost:8080',
                secure: false
            },
            {
                context: ['/api/**', '/settings/**'],
                target: 'http://localhost:8080',
                secure: false
            },
            {
                context: ['/upload'],
                target: 'http://localhost:8080',
                changeOrigin: true,
                secure: false
            }
        ],
        //bug in filesystem events on osx
        //hence watchoptions added 
        // watchOptions: {
        //   aggregateTimeout: 300,
        //   poll: 500,
        //   ignored: /node_modules/
        // }
    }
};


