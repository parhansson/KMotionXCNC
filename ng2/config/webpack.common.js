const webpack = require('webpack');
const helpers = require('./helpers');
const rxPaths = require('rxjs/_esm2015/path-mapping');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const path = require('path');

module.exports = {

  entry: {
    'polyfills': './src/polyfills.ts',
    'vendor': './src/vendor.ts',
    'brace': './src/brace.ts',
    'app': './src/main.ts',
   // 'pdf.worker': 'pdfjs-dist/build/pdf.worker.entry'
  },
  optimization: {
    runtimeChunk: 'single',
    splitChunks: {
      chunks: "all",
    },
    emitOnErrors: true, // NoEmitOnErrorsPlugin
    concatenateModules: true //ModuleConcatenationPlugin
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'src/index.html',
      'base': process.env.NODE_ENV === 'development' ? '/' : '/'
    }),
    /*
        new webpack.ProvidePlugin({
          "StringView": "vendor/mozilla/stringview.js"
        }) 
        */
  ],  
  resolve: {
    extensions: ['.js', '.ts'],
    alias: {
      ...rxPaths(),
      '@workers': helpers.root('src/workers'),
      '@kmx': helpers.root('src/app'),
      "camx": "camx/lib",
      //"camx": path.resolve(__dirname, 'camx/lib'),
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        enforce: "pre",
        loader: 'tslint-loader',
        options: {
          configFile: './tslint.json',
          emitErrors: false,
          failOnHint: false
        }
      },
      {
        test: /\.component.ts$/,
        use: [
          'ts-loader',
          'angular2-template-loader'
        ]
      },
      {
        test: /workers\/.*\.worker\.ts$/,
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
        test: /\.ts$/,
        exclude: /\.component.ts|\.worker.ts$/,
        //exclude: /\.component.ts|\.worker.ts|node_modules$/,
        loader: 'ts-loader'
      },
      {
        test: /\.html$/,
        loader: 'html-loader',
        options: {
          esModule: false,
        },
      },
      {
        //fontawesome
        test: /\.(png|jpe?g|gif|svg|woff|woff2|ttf|eot|ico)$/,
        loader: 'file-loader',
        options: { 
          name: 'assets/[name].[hash].[ext]',
          esModule: false
        }
      },
      {
        // Handle import './styles.css' statements
        test: /\.css$/,
        exclude: /\.component.css$/,
        use: [
          MiniCssExtractPlugin.loader, // extract CSS
          'css-loader' // load CSS-files
        ]
      },
      {
        //This is for styleUrls in components
        test: /\.component.css$/,
        use: [
          'to-string-loader',
          'css-loader',
        ]
      },
    ],
    noParse: [
       /pdfjs-dist\/build\/pdf\.js$/,
    //   /pdfjs-dist\/build\/pdf\.min\.js$/,
    //   /pdfjs-dist\/build\/pdf\.worker\.js$/
    ],
  }

};


