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
    'app': './src/main.ts',
   // 'pdf.worker': 'pdfjs-dist/build/pdf.worker.entry'
  },
  optimization: {
    runtimeChunk: 'single',
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
    noEmitOnErrors: false, // NoEmitOnErrorsPlugin
    concatenateModules: true //ModuleConcatenationPlugin
  },
  plugins: [
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
    /*
        new webpack.ProvidePlugin({
          "StringView": "vendor/mozilla/stringview.js"
        }) 
        */
  ],  
  resolve: {
    //added es2015 for use with angular instead of esm5
    //mainFields: ["browser", "es2015", "module", "main"],
    
    extensions: ['.js', '.ts'],
    alias: {
      ...rxPaths(),
      '@workers': helpers.root('src/workers'),
      '@kmx': helpers.root('src/app')
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
            options: { name: '[name].[hash].js' }
          },
          { loader: 'ts-loader' }
        ],
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
        use: [
          'to-string-loader',
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              hmr: process.env.NODE_ENV === 'development',
              // publicPath: (resourcePath, context) => {
              //   // publicPath is the relative path of the resource to the context
              //   // e.g. for ./css/admin/main.css the publicPath will be ../../
              //   // while for ./css/main.css the publicPath will be ../
              //   return path.relative(path.dirname(resourcePath), context) + '/';
              // },
            },
          },
          'css-loader',
        ]
      },
      // {
      //   test: /\.css$/,
      //   exclude: helpers.root('src', 'app'),
      //   loader: ExtractTextPlugin.extract({ 
      //     fallback: 'style-loader', 
      //     use: { 
      //       loader: 'css-loader',
      //       options: {
      //         sourceMap: true
      //       }
      //     } 
      //   })
      // },
      // {
      //   test: /\.css$/,
      //   include: helpers.root('src', 'app'),
      //   loader: 'raw-loader'
      // }
    ],
    // noParse: [
    //   /pdfjs-dist\/build\/pdf\.js$/,
    //   /pdfjs-dist\/build\/pdf\.min\.js$/,
    //   /pdfjs-dist\/build\/pdf\.worker\.js$/
    // ],
  }

};


