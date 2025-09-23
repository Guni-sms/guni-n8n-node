const { src, dest, task, series, parallel } = require('gulp');
const merge = require('merge-stream');

// Task to copy icons
task('build:icons', function () {
	const nodeSourcePng = 'nodes/**/*.png';
	const nodeSourceSvg = 'nodes/**/*.svg';
	const nodeDest = 'dist/nodes';

	const credSourcePng = 'credentials/**/*.png';
	const credSourceSvg = 'credentials/**/*.svg';
	const credDest = 'dist/credentials';

	const nodePng = src(nodeSourcePng).pipe(dest(nodeDest));
	const nodeSvg = src(nodeSourceSvg).pipe(dest(nodeDest));
	const credPng = src(credSourcePng).pipe(dest(credDest));
	const credSvg = src(credSourceSvg).pipe(dest(credDest));

	return merge(nodePng, nodeSvg, credPng, credSvg);
});

// Task to copy Vue files
task('build:vue', function () {
	return src('nodes/**/*.vue', { base: 'nodes', allowEmpty: true })
		.pipe(dest('dist/nodes'));
});

// Final build task (tsc + icons + vue)
task('build', series(
	'build:icons',
	'build:vue',
));
