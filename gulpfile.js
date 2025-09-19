const { src, dest, task } = require('gulp');
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

	// ✅ Merge all streams and return
	return merge(nodePng, nodeSvg, credPng, credSvg);
});
