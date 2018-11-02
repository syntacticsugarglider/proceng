module.exports = {
  configureWebpack: {
    module: {
      rules: [
        {
          test: /\.proto$/,
          use: "file-loader"
        }
      ]
    }
  }
};
