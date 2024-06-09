const exe = require('@angablue/exe');

const build = exe({
    entry: './app.js',
    out: './build/Heartbroker.exe',
    target: 'latest-win-x64'
});

build.then(() => console.log('Build completed!'));