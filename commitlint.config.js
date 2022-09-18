module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-case': [2, 'always', ['camel-case', 'lower-case']],
    'type-enum': [
      2,
      'always',
      [
        'build',
        'ci',
        'docs',
        'feat',
        'fix',
        'chore',
        'refactor',
        'releaseAutomat',
        'revert',
        'style',
        'test',
      ],
    ],
  },
};
