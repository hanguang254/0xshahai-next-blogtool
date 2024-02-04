module.exports = {
    presets: ['next/babel'],
    plugins: [
      [
        'import',
        {
          libraryName: '@ant-design/icons-svg',
          camel2DashComponentName: false,
        },
      ],
    ],
  };