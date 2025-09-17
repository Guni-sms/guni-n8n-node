const { src, dest, task } = require('gulp');

// Task to copy icons
task('build:icons', copyIcons);

function copyIcons() {
    const nodeSourcePng = 'nodes/**/*.png';
    const nodeSourceSvg = 'nodes/**/*.svg';
    const nodeDest = 'dist/nodes';

    // Copy node icons
    src(nodeSourcePng).pipe(dest(nodeDest));
    src(nodeSourceSvg).pipe(dest(nodeDest));

    const credSourcePng = 'credentials/**/*.png';
    const credSourceSvg = 'credentials/**/*.svg';
    const credDest = 'dist/credentials';

    // Copy credential icons
    src(credSourcePng).pipe(dest(credDest));
    return src(credSourceSvg).pipe(dest(credDest));
}
