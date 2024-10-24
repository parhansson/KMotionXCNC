const webpack = require('webpack');
const { merge } = require('webpack-merge');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const commonConfig = require('./webpack.common.js');
const helpers = require('./helpers');
//const TerserPlugin = require('terser-webpack-plugin');

const ENV = process.env.NODE_ENV = process.env.ENV = 'production';

const baseHref = '/'

module.exports = merge(commonConfig, {
  mode: 'production',
  devtool: 'source-map',

  output: {
    path: helpers.root('../kmx'),
    publicPath: baseHref,
    filename: '[name].[chunkhash].js',
    chunkFilename: '[id].[chunkhash].chunk.js'
  },
  optimization: {
    emitOnErrors: false, // NoEmitOnErrorsPlugin
  //   minimizer: [
  //     // Added to makte opentype work when miminized. bug in uglify, reuses variables names in inlined functions
  //     new TerserPlugin({
  //         parallel: true,  // Webpack default
  //         cache: true,      // Webpack default
  //         terserOptions:{
  //           compress: true //{ inline: false },
  //         },
  //     })
  // ],    
  },
  /*
    htmlLoader: {
      minimize: false // workaround for ng2
    },
  */
  plugins: [
    new MiniCssExtractPlugin({
      filename: '[name].[chunkhash].css',
      //allChunks: true
    }),
    new webpack.DefinePlugin({
      'process.env': {
        'ENV': JSON.stringify(ENV)
      }
    })
  ]
});
