var webpack = require('webpack');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var helpers = require('./helpers');

module.exports = {

  entry: {
    'polyfills': './src/polyfills.ts',
    'vendor': './src/vendor.ts',
    'app': './src/main.ts',
    'pdf.worker': 'pdfjs-dist/build/pdf.worker.entry'
  },
  optimization: {
    runtimeChunk: false,
    splitChunks: {
      chunks: "all",
      // chunks: "initial",
      // cacheGroups: {
      // //     default: false,
      // //     vendors: false,
      //   commons: {
      //     test: /[\\/]node_modules[\\/]/,
      //     name: "vendors",
      //     chunks: "all"
      //   }            
      // },
    },
  },
  resolve: {
    //added es2015 for use with angular instead of esm5
    //mainFields: ["browser", "es2015", "module", "main"],
    
    extensions: ['.js', '.ts'],
    alias: {
      'three/three-trackballcontrols': helpers.root('node_modules/three/examples/js/controls/TrackballControls.js')
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
        test: /TrackballControls\.js$/,
        loader: 'imports-loader',
        options : {
          THREE :'three'
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
        test: /\.(png|jpe?g|gif|svg|woff|woff2|ttf|eot|ico)$/,
        loader: 'file-loader',
        options: { name: 'assets/[name].[hash].[ext]' }
      },
      {
        test: /\.css$/,
        exclude: helpers.root('src', 'app'),
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
    ],
    noParse: [
      /pdfjs-dist\/build\/pdf\.js$/,
      /pdfjs-dist\/build\/pdf\.min\.js$/,
      /pdfjs-dist\/build\/pdf\.worker\.js$/
    ],
  },

  plugins: [
    new webpack.ContextReplacementPlugin(
      // The (\\|\/) piece accounts for path separators in *nix and Windows
    
      // For Angular 5, see also https://github.com/angular/angular/issues/20357#issuecomment-343683491
      /\@angular(\\|\/)core(\\|\/)fesm5/,
      helpers.root('src'), // location of your src
      {
        // your Angular Async Route paths relative to this root directory
      }
    ),
    new HtmlWebpackPlugin({
      template: 'src/index.html'
    }),
    /*
        new webpack.ProvidePlugin({
          "StringView": "vendor/mozilla/stringview.js"
        }) 
        */
  ]

};


