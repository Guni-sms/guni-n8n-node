const { src, dest, task, series } = require('gulp');
const merge = require('merge-stream');
const fs = require('fs');

// Copy icons
task('build:icons', function () {
	const nodeSourceSvg = 'nodes/**/*.svg';
	const nodeDest = 'dist/nodes';

	const credSourceSvg = 'credentials/**/*.svg';
	const credDest = 'dist/credentials';

	const nodeSvg = src(nodeSourceSvg).pipe(dest(nodeDest));
	const credSvg = src(credSourceSvg).pipe(dest(credDest));

	return merge(nodeSvg, credSvg);
});

// Create minimal dist/package.json for n8n
task('build:package-json', function (done) {
	const pkg = JSON.parse(fs.readFileSync('./package.json'));
	const minimal = {
		name: pkg.name,
		version: pkg.version,
		description: pkg.description,
		license: pkg.license,
		n8n: pkg.n8n,
	};
	fs.writeFileSync('./dist/package.json', JSON.stringify(minimal, null, 2));
	done();
});

// Final build
task('build', series('build:icons', 'build:package-json'));
