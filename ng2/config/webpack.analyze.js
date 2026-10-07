import { merge } from 'webpack-merge';
import prodConfig from './webpack.prod.js';
import {BundleAnalyzerPlugin}  from 'webpack-bundle-analyzer';




const config = merge(prodConfig, {
  plugins: [
    new BundleAnalyzerPlugin()
  ]
});

export default config; // Exporting the merged configuration
