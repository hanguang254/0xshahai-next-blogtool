export default module.exports = {
    presets: [
        [
          'next/babel',
          {
            'preset-react': {
              runtime: 'automatic',
              importSource: '@emotion/react', // 根据你的需要，你可以更改这个导入源
            },
            'swc': true, // 启用 SWC
          },
        ],
      ],
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