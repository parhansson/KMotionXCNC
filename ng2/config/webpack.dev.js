//import webpack from 'webpack';
import { merge } from 'webpack-merge';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import commonConfig from './webpack.common.js';
import { root } from './helpers.js';
// Base Href same as in index.html

//This is for npm run serve
const baseHref = '/'

const config = merge(commonConfig, {
  mode: 'development',
  devtool: 'cheap-module-source-map',

  output: {
    path: root('dist'),
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

export default config; // Exporting the merged configuration