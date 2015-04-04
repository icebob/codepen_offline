
var path            = require('path');
var fs 				= require('fs');
var rs              = require('replacestream');
var tap 			= require('gulp-tap');
var runSequence		= require('run-sequence');
var glob			= require("glob");
var unzip			= require("unzip");

var browserSync     = require('browser-sync');
var reload          = browserSync.reload;

var gulp            = require('gulp');
var $ 				= require('gulp-load-plugins')({
						pattern: ['gulp-*']
					});

// Browser-sync task
gulp.task('browser-sync', function() {
	browserSync({
		server: {
			baseDir: "./"
		}
	});
});

// Sass task
gulp.task('sass', function () {

	glob('**/scss/*.scss', function(err, files) {
		if (err) return;

		files.forEach(function(file) {

			var subDir = file.split("/")[0];
			gulp.src(file)
				.pipe($.plumber())
				.pipe($.compass({
					project: path.join(__dirname, subDir),
					css: 'css',
					sass: 'scss',
					style: 'expanded',
					cache: false
				}));
		});
	})
});

// Coffescript task
gulp.task('coffee', function () {
	return gulp.src('**/coffeescript/*.coffeescript')
		.pipe($.plumber())
		.pipe($.coffee({bare: true }))
		.pipe($.rename(function(path) {
			path.dirname = path.dirname.replace("coffeescript", "js");
		}))
		.pipe(gulp.dest("."));
});

// JADE task (index.jade -> __body.html)
gulp.task('jade-body', function () {
	return gulp.src(['**/index.jade', '!./node_modules/**'])
		.pipe($.plumber())
		.pipe($.jade({
			pretty: true
		}))
		.pipe($.rename(function(path) {
			path.basename = path.basename.replace("index", "__body");
		}))
		.pipe(gulp.dest("."));
});

// HTML concatenate (layout.html + __body.html -> index.html)
gulp.task('html-concat', function() {
	return gulp.src(['**/layout.html', '!./node_modules/**'])
		.pipe(tap(function(file) {
			// Read __body.html
			var bodyFile = file.path.replace("layout.html", "__body.html");
			var bodyContent = fs.readFileSync(bodyFile, "UTF-8");

			// Replace content
			if (file.isBuffer())
				file.contents = new Buffer(String(file.contents).replace(/<body[^>]*>((.|\s)*)<\/body>/im, "<body>" + bodyContent + "</body>"));

			fs.unlinkSync(bodyFile);
		}))
		.pipe($.rename(function(path) {
			// Rename to index.html
			path.basename = path.basename.replace("layout", "index");
		}))
		.pipe(gulp.dest("."));
});

// Jade compile task
gulp.task('jade', function(cb) {
  runSequence('jade-body', 'html-concat', cb);
});


// Unzip task. (unzip downloaded pens to a folder)
gulp.task('unzip', function (done) {

	glob("*.zip", function(err, files) {

		files.forEach(function(f) {
			var name = path.basename(f, '.zip');
			console.log("Unzip pen " + name + "...");
			fs.createReadStream(f).pipe(unzip.Extract({ path: './' + name }));

			fs.unlinkSync(f);
		});


		done();
	});

});


// Scan pen directories and make a default index.html
gulp.task('dirs', ['unzip'], function (done) {

	// Pen html template
	var penHTML = 
	'	<div class="pen">	\r\n'+
	'		<div class="iframe-wrap" style="position: relative;">	\r\n'+
	'			<a href="%%PENNAME%%" class="cover-link"></a>	\r\n'+

	'			<iframe id="iframe_%%PENNAME%%" src="%%PENNAME%%" allowtransparency="true" frameborder="0" scrolling="no" sandbox="allow-scripts allow-pointer-lock allow-same-origin">	\r\n'+
	'			</iframe>	\r\n'+

	'			<div class="info">	\r\n'+
	'				%%PENNAME%%	\r\n'+
	'			</div>	\r\n'+
	'		</div>	\r\n'+
	'	</div>	\r\n';

	// Read index template
	var indexContent = fs.readFileSync("template.html", "UTF-8");
	var pens = [];

	// Search directories
	glob('*/', function(err, dirs) {
		if (err) return;

		dirs.forEach(function(dir) {
			if (dir != "node_modules/") {
				pens.push(penHTML.replace(/%%PENNAME%%/g, dir));
			}
		})

	}).on("end", function() {

		console.log("Found " + pens.length + " pens.");
		indexContent = indexContent.replace("%%PENS%%", pens.join("\r\n"));
		fs.writeFileSync("index.html", indexContent);

		done();
	})

});

/**
 * Reload all Browsers
 */
gulp.task('bs-reload', function () {
	browserSync.reload();
});

// Default full task (compile + watch + reload)
gulp.task('default', ['dirs', 'sass', 'coffee', 'browser-sync'], function () {
	$.watch(['**/css/*.css', '!./node_modules/**'], function(file) {
 		reload(file.path);
	});

	$.watch(['**/*.html', '!./node_modules/**', '!index_template.html'], function() {
		gulp.start('bs-reload');
	});
	$.watch(['**/js/*.js', '!./node_modules/**'], function() {
		gulp.start('bs-reload');
	});

	$.watch(['**/*.jade', '!./node_modules/**'], function() {
		gulp.start('jade');
	});
	$.watch(['**/coffeescript/*.coffeescript', '!./node_modules/**'], function() {
		gulp.start('coffee');
	});
	$.watch(['**/scss/*.scss', '!./node_modules/**'], function() {
		gulp.start('sass');
	});

	$.watch(['index_template.html'], function() {
		gulp.start('dirs');
	});

	$.watch(['*.zip'], function() {
		gulp.start('dirs');
	});

});

