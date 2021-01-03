const path = require('path')
const webpack = require('webpack')
const HtmlWebPackPlugin = require("html-webpack-plugin")
const { CleanWebpackPlugin } = require('clean-webpack-plugin')

module.exports = {
    entry: './src/client/index.js',
    output: {
        libraryTarget: 'var',
        library: 'Client'
    },
    mode: 'development',
    devtool: 'source-map',
    stats: 'verbose',
    module: {
        rules: [
            {
                test: '/\.js$/',
                exclude: /node_modules/,
                loader: "babel-loader"
            },
            {
                test: /\.scss$/,
                use: [ 'style-loader', 'css-loader', 'sass-loader' ]
            }
        ]
    },
    node: {
        fs: 'empty'
      },
      //allows dev environment to post to prod server
      devServer: {
          port: 8888,
        proxy: {
          '/': 'http://localhost:3330',
          '/validate': 'http://localhost:3330',
          '/signin': 'http://localhost:3330',
          '/user_login': 'http://localhost:3330',
          '/post_team': 'http://localhost:3330',
          '/admin_signin': 'http://localhost:3330',
          '/post_qs': 'http://localhost:3330',
          '/get_qs': 'http://localhost:3330',
          '/questions': 'http://localhost:3330',
          '/trivia': 'http://localhost:3330',
          '/create_team': 'http://localhost:3330',
          '/get_answer': 'http://localhost:3330',
          '/check_answered': 'http://localhost:3330',
          '/check_if_answered': 'http://localhost:3330',
          '/final_answer': 'http://localhost:3330'
        }
      },
    plugins: [
        new HtmlWebPackPlugin({
            template: "./views/login.ejs",
            filename: "./login.ejs",
        }),
        new CleanWebpackPlugin({
            // Simulate the removal of files
            dry: true,
            // Write Logs to Console
            verbose: true,
            // Automatically remove all unused webpack assets on rebuild
            cleanStaleWebpackAssets: true,
            protectWebpackAssets: false
        })
    ]
}
