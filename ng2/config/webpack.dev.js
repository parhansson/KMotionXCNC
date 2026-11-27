//import webpack from 'webpack';
import { merge } from 'webpack-merge';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
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
    new HtmlWebpackPlugin({
      template: '!!html-loader!src/index.html',
      base: '/'
    }),
    new MiniCssExtractPlugin(
      {
        filename: '[name].css',
        chunkFilename: '[id].css',
      }
    ),
  ],

  devServer: {
    historyApiFallback: {
      index: '/index.html'
    },
    proxy: [
      {
        context: ['/ws'],
        ws: true,
        target: 'http://127.0.0.1:8080',
        secure: false
      },
      {
        context: ['/api/**', '/settings/fonts/**', '/settings/textures/**'],
        target: 'http://127.0.0.1:8080',
        secure: false
      },
      {
        context: ['/upload'],
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        secure: false
      }
    ],
  }
});

export default config; // Exporting the merged configuration
