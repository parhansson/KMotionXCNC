
import { root } from './helpers.js'; // Ensure this uses the ES module export
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
// import ESLintPlugin from 'eslint-webpack-plugin';

const commonConfig = {

  entry: {
    'polyfills': './src/polyfills.ts',
    'vendor': './src/vendor.ts',
    'brace': './src/brace.ts',
    'app': './src/main.ts',
    // 'pdf.worker': 'pdfjs-dist/build/pdf.worker.entry'
  },
  optimization: {
    runtimeChunk: 'single',
    splitChunks: {
      chunks: "all",
    },
    emitOnErrors: true, // NoEmitOnErrorsPlugin
    concatenateModules: true //ModuleConcatenationPlugin
  },
  plugins: [
    // new ESLintPlugin({
    //   overrideConfigFile: './eslint.config.mjs',
    //   files: 'src/**/*.ts', // *.{ts,tsx}Inkludera .ts och .tsx-filer
    //   extensions: ['js', 'ts'], // Include relevant file extensions
    //   emitWarning: true, // För att skriva ut varningar      
    // }),
    // new HtmlWebpackPlugin({
    //   template: 'src/index.html',
    //   'base': process.env.NODE_ENV === 'development' ? '/' : './'
    // }),
    /*
        new webpack.ProvidePlugin({
          "StringView": "vendor/mozilla/stringview.js"
        }) 
        */
  ],
  resolve: {
    extensions: ['.js', '.ts'],
    alias: {
      "camx": "camx/lib",
    }
  },
  module: {
    rules: [
      // {
      //   test: /\.ts$/,
      //   enforce: "pre",
      //   loader: 'tslint-loader',
      //   options: {
      //     configFile: './tslint.json',
      //     emitErrors: false,
      //     failOnHint: false
      //   }
      // },
      {
        test: /\.component.ts$/,
        use: [
          'ts-loader',
          'angular2-template-loader'
        ]
      },
      {
        test: /\.ts$/,
        exclude: /\.component.ts$/,
        loader: 'ts-loader'
      },
      {
        test: /\.html$/,
        loader: 'html-loader',
        options: {
          esModule: false,
        },
      },
      {
        //fontawesome
        test: /\.(png|jpe?g|gif|svg|woff|woff2|ttf|eot|ico)$/,
        loader: 'file-loader',
        options: {
          name: 'assets/[name].[hash].[ext]',
          esModule: false
        }
      },
      {
        // Handle import './styles.css' statements
        test: /\.css$/,
        exclude: /\.component.css$/,
        use: [
          MiniCssExtractPlugin.loader, // extract CSS
          'css-loader' // load CSS-files
        ]
      },
      {
        //This is for styleUrls in components
        test: /\.component.css$/,
        use: [
          'to-string-loader',
          'css-loader',
        ]
      },
    ],
    noParse: [
      /pdfjs-dist\/build\/pdf\.js$/,
      //   /pdfjs-dist\/build\/pdf\.min\.js$/,
      //   /pdfjs-dist\/build\/pdf\.worker\.js$/
    ],
  }

};
export default commonConfig; // Exporting the merged configuration

