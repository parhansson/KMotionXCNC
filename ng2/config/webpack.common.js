var webpack = require('webpack');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var helpers = require('./helpers');

module.exports = {
  entry: {
    'polyfills': './src/polyfills.ts',
    'vendor': './src/vendor.ts',
    'app': './src/main.ts'
  },

  resolve: {
    //extensions: ['', '.js', '.ts']
    //extensions: ['*', '.js', '.ts']
    extensions: ['.js', '.ts']
  },

  module: {
    rules: [
      {
        test: /\.ts$/,
        enforce: "pre",
        loader: 'tslint-loader',
        options: {
            configuration: {
              extends: "tslint:recommended",
              defaultSeverity: "error",
              rules: {
                  quotemark: [true, "single"],
                  //"callable-types": true,
                  "max-line-length": {
                      options: 200,
                      severity: "warning"
                  }
              },
              jsRules: {
                "max-line-length": {
                  "options": [20]
                }
              }
            },
            emitErrors: false,
            failOnHint: true
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
        test: /\.worker.ts$/,
        use: [
          'worker-loader',
          'ts-loader'
        ]
      },
      {
        test: /\.ts$/,
        exclude: /\.component.ts|\.worker.ts$/,
        loader: 'ts-loader'
      },
      {
        test: /\.html$/,
        loader: 'html-loader'
      },
      {
        test: /pdf.worker.js$/,
        loader: 'file-loader',
        options: { name: 'assets/[name].[ext]' }
      },
      {
        test: /\.(png|jpe?g|gif|svg|woff|woff2|ttf|eot|ico)$/,
        loader: 'file-loader',
        options: { name: 'assets/[name].[hash].[ext]' }
      },
      {
        test: /\.css$/,
        exclude: helpers.root('src', 'app'),
        //use: ExtractTextPlugin.extract({ fallbackLoader: 'style-loader', loader: 'css?sourceMap'})
        //loader: ExtractTextPlugin.extract({ fallback: 'style-loader', use: 'css-loader' })
        loader: ExtractTextPlugin.extract({ 
          fallback: 'style-loader', 
          use: { 
            loader: 'css-loader',
            options: {
              sourceMap: true
            }
          } 
        })
      },
      {
        test: /\.css$/,
        include: helpers.root('src', 'app'),
        loader: 'raw-loader'
      }
    ]
  },

  plugins: [
    // Workaround for angular/angular#11580
    new webpack.ContextReplacementPlugin(
      // The (\\|\/) piece accounts for path separators in *nix and Windows
      ///angular(\\|\/)core(\\|\/)(esm(\\|\/)src|src)(\\|\/)linker/,
      /angular(\\|\/)core(\\|\/)@angular/,
      helpers.root('./src'), // location of your src
      {} // a map of your routes
    ),
    
    new webpack.optimize.CommonsChunkPlugin({
      names: ['app', 'vendor', 'polyfills', 'manifest']
    }),

    new HtmlWebpackPlugin({
      template: 'src/index.html'
    }),
    /*
        new webpack.ProvidePlugin({
          "StringView": "vendor/mozilla/stringview.js"
        }) 
        new webpack.ProvidePlugin({
          "THREE": "three"
        }) 
        */
  ]

};


