const webpack = require('webpack');
const webpackMerge = require('webpack-merge');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const commonConfig = require('./webpack.common.js');
const helpers = require('./helpers');
const { BaseHrefWebpackPlugin } = require('base-href-webpack-plugin');
// Base Href same as in index.html
const baseHref = '/kmx/'

module.exports = webpackMerge(commonConfig, {
  mode: 'development',
  devtool: 'cheap-module-eval-source-map',

  output: {
    path: helpers.root('dist'),
    pathinfo: true,
    publicPath: baseHref,
    filename: '[name].js',
    chunkFilename: '[id].chunk.js'
  },

  plugins: [
     new MiniCssExtractPlugin({
    //   allChunks: true
          filename: '[name].css',
          chunkFilename: '[id].css',
    }),
    new BaseHrefWebpackPlugin({ baseHref: baseHref })
    // ,
    // new webpack.WatchIgnorePlugin([
    //   /\.js$/,
    //   /\.d\.ts$/
    // ])
  ],

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
});
