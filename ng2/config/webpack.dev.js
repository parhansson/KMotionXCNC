const webpack = require('webpack');
const { merge } = require('webpack-merge');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const commonConfig = require('./webpack.common.js');
const helpers = require('./helpers');
// Base Href same as in index.html

//This is for npm run serve
const baseHref = '/'

module.exports = merge(commonConfig, {
  mode: 'development',
  devtool: 'cheap-module-source-map',

  output: {
    path: helpers.root('dist'),
    pathinfo: true,
    publicPath: baseHref,
    filename: '[name].js',
    chunkFilename: '[id].chunk.js'
  },

  plugins: [
    new MiniCssExtractPlugin(
      {
        filename: '[name].css',
        chunkFilename: '[id].css',
      }
    ),
  ],

  devServer: {
    historyApiFallback: {
      index: baseHref
    },
    proxy: [
      // {
      //   context: ['/ws'],
      //   ws: true,
      //   target: 'ws://localhost:8080',
      //   secure: false
      // },
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
  }
});
