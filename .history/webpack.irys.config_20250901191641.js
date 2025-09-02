const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: 'production',
  entry: './src/irys-bundled-client.js',
  output: {
    filename: 'irys-bundle.js',
    path: path.resolve(__dirname, 'public'),
    library: {
      name: 'IrysBundle',
      type: 'umd',
      export: 'default'
    }
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                targets: {
                  chrome: '88',
                  firefox: '78',
                  safari: '14'
                }
              }]
            ]
          }
        }
      }
    ]
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser'
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.NEXT_PUBLIC_IRYS_PRIVATE_KEY': JSON.stringify('')  // Will be set at runtime
    })
  ],
  resolve: {
    fallback: {
      "crypto": require.resolve("crypto-browserify"),
      "stream": require.resolve("stream-browserify"),
      "buffer": require.resolve("buffer/"),
      "process": require.resolve("process/browser.js"),
      "path": false,
      "fs": false,
      "http": false,
      "https": false,
      "zlib": false,
      "url": require.resolve("url/"),
      "util": require.resolve("util/"),
      "assert": require.resolve("assert/"),
      "vm": require.resolve("vm-browserify")
    }
  },
  optimization: {
    minimize: true
  }
};
