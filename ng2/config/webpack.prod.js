const webpack = require('webpack');
const webpackMerge = require('webpack-merge');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const commonConfig = require('./webpack.common.js');
const helpers = require('./helpers');
//const UglifyJSPlugin = require('uglifyjs-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin');
const { BaseHrefWebpackPlugin } = require('base-href-webpack-plugin');

const ENV = process.env.NODE_ENV = process.env.ENV = 'production';

const baseHref = '/kmx/'

module.exports = webpackMerge(commonConfig, {
  mode: 'production',
  devtool: 'source-map',

  output: {
    path: helpers.root('../kmx'),
    publicPath: baseHref,
    filename: '[name].[chunkhash].js',
    chunkFilename: '[id].[chunkhash].chunk.js'
  },
  optimization: {
    noEmitOnErrors: true, // NoEmitOnErrorsPlugin
    minimizer: [
      // Added to makte opentype work when miminized. bug in uglify, reuses variables names in inlined functions
      new TerserPlugin({
          parallel: true,  // Webpack default
          cache: true,      // Webpack default
          terserOptions:{
            compress: true //{ inline: false },
          },
          //uglifyOptions: {
              /*
                  inlining is broken sometimes where inlined function uses the same variable name as inlining function.
                  See https://github.com/mishoo/UglifyJS2/issues/2842, https://github.com/mishoo/UglifyJS2/issues/2843
               */
          //    compress: { inline: false },
          //},
      })
  ],    
  },
  /*
    htmlLoader: {
      minimize: false // workaround for ng2
    },
  */
  plugins: [
    //new UglifyJSPlugin(),
    new BaseHrefWebpackPlugin({ baseHref: baseHref }),
    new ExtractTextPlugin({
      filename: '[name].[chunkhash].css',
      allChunks: true
    }),
    new webpack.DefinePlugin({
      'process.env': {
        'ENV': JSON.stringify(ENV)
      }
    })
  ]
});
