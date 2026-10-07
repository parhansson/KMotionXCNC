import webpack from 'webpack';
import { merge } from 'webpack-merge';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import commonConfig from './webpack.common.js';
import { root } from './helpers.js';


//const TerserPlugin = require('terser-webpack-plugin');

const ENV = process.env.NODE_ENV = process.env.ENV = 'production';

const baseHref = './'

const config = merge(commonConfig, {
  mode: 'production',
  devtool: 'source-map',

  output: {
    path: root('../kmx'),
    publicPath: baseHref,
    filename: '[name].[chunkhash].js',
    chunkFilename: '[id].[chunkhash].chunk.js'
  },
  optimization: {
    emitOnErrors: false, // NoEmitOnErrorsPlugin   
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: 'src/index.html',
      base: './'
    }),
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
export default config; // Exporting the merged configuration