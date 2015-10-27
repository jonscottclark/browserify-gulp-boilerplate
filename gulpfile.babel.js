var gulp = require('gulp');

/*
 * Required modules
 */

// Build utilities
var $            = require('gulp-load-plugins')();
var bowerFiles   = require('main-bower-files');

// Utility packages
var path         = require('path');
var fs           = require('fs');
var del          = require('del');
var rfile        = require('rfile');
var readdir      = require('fs-readdir-recursive');
var mkdirp       = require('mkdirp');
var argv         = require('minimist')(process.argv.slice(2));
var runSequence  = require('run-sequence');
var uniq         = require('uniq');
var glob         = require('glob');

// Stream/buffer utilities
var map          = require('map-stream');
var source       = require('vinyl-source-stream');
var buffer       = require('vinyl-buffer');
var transform    = require('vinyl-transform');
var through      = require('through2');

// Browserify
var browserify   = require('browserify');

// PostCSS plugins
var autoprefixer = require('autoprefixer');
var cssnano      = require('cssnano');


/*
 * Path config
 */

const bowerrc = JSON.parse(rfile('./.bowerrc'));

const srcDir = {
  js: './src/js',
  css: './src/css',
  img: './src/images',
  html: './src/html'
};

const dist = {
  js: './dist/js',
  css: './dist/css',
  img: './dist/images',
  html: './dist',
  fonts: './dist/fonts'
};

const src = {
  js: `${srcDir.js}/**/*.js`,
  css: `${srcDir.css}/*.scss`,
  img: `${srcDir.img}/**/*.{gif,png,jpg,webp}`,
  html: [
    `${srcDir.html}/**/*.jade`,
    `!${srcDir.html}/{components,layouts,mixins}/**/*.jade`,
    `!${srcDir.html}/_mixins.jade`
  ],
  components: `${srcDir.html}/components/**/*.jade`
};

const bower = bowerFiles({
  paths: {
    bowerDirectory: bowerrc.directory
  }
});

const filters = {
  js: $.filter('**/*.js'),
  sass: $.filter('**/*.scss'),
  css: $.filter('**/*.css'),
  img: $.filter('**/*.{gif,png,jpg,webp}'),
  fonts: $.filter('**/*.{eot,woff,woff2,ttf,svg}')
};

/*
 * Watch (Needs to be defined first, the watch variable is used in other tasks)
 */

var watch = false;

gulp.task('watch', done => {
  // Tell other tasks we're watching (most importantly, browserify)
  watch = true;

  // Build and then define watching tasks
  runSequence('build', () => {
    // Compile Sass
    gulp.watch(src.css, ['sass']);

    // Compress Images
    gulp.watch(src.img, ['images']);

    // Re-bundle JS
    gulp.watch(src.js, ['browserify']);

    // Compile Jade templates
    gulp.watch(src.components, ['components']);
    gulp.watch(src.html, ['html']);

    done();
  });
});

/*
 * Tasks
 */

// Clean dist/ directory
gulp.task('clean', del.bind(
  null, ['dist/*'], {dot: true}
));

// Generate custom modernizr build
gulp.task('modernizr', () => {
  gulp.src(src.js)
    .pipe($.modernizr('modernizr.js', {
      tests: [
        'mediaqueries'
      ]
    }))
    .pipe($.uglify())
    .pipe(gulp.dest(dist.js));
});

// Browserify
gulp.task('browserify', done => {
  // Define the filename for the shared code
  var common = 'common.js';

  // Tell Browserify which bundles to create (hint: app.js and components/*.js)
  var srcJS = readdir(srcDir.js);
  var entries = srcJS.map(file => `${srcDir.js}/${file}`);

  // Define where each file should go (same order as `entries`)
  var outputs = srcJS;

  // Create any directories (outside of the scope of `factor-bundle`)
  uniq(entries.map(file => path.dirname(file).replace('src','dist'))).forEach(dir => {
    mkdirp(dir);
  });

  // Set browserify options
  var b = browserify({
    entries,
    debug: (!argv.deploy)
  });

  var bundle = $.watchifyFactorBundle(b,
    { entries, outputs, common },
    function (bundleStream) {
      return bundleStream
        .pipe(buffer())
        .pipe($.if(argv.deploy, $.uglify()))
        .pipe(gulp.dest(dist.js))
        .pipe($.connect.reload());
    }
  );

  bundle();

  // Finish task when all files have bundled.
  srcJS.push(common);
  var checkBundles = setInterval(() => {
    if (glob.sync(`${dist.js}/{${srcJS.join(',')}}`).length == srcJS.length) {
      done();
      clearInterval(checkBundles);
    }
  }, 500);
});

// Move bower components into proper paths
gulp.task('bower', (cb) => {
  runSequence([
    'bower-js',
    'bower-sass',
    'bower-css',
    'bower-images',
    'bower-fonts'
  ], cb);
});

gulp.task('bower-sass', () => {
  // Vendor Sass

  // Define where to look for the Sass in each bower package
  var baseDirs = {
    'bootstrap-sass': '/assets/stylesheets',
    'scut': '/dist'
  };

  // Move the relevant files to our Sass directory
  gulp.src(bower)
    .pipe(filters.sass)
    .pipe(map((file, cb) => {
      var rel = file.path.replace(path.join(__dirname, bowerrc.directory), '');
      var pkg = rel.split(path.sep)[1];
      var base = rel.replace(path.join(pkg, baseDirs[pkg], '/'), '').replace(path.basename(file.path), '');
      var dest = path.join(srcDir.css, 'vendor', pkg, base);

      gulp.src(file.path)
        .pipe(gulp.dest(dest));
      cb();
    }));
});

gulp.task('bower-js', () => {
  // Vendor JS
  return gulp.src(bower)
    .pipe(filters.js)
    .pipe($.uglify())
    .pipe(gulp.dest(dist.js));
});

gulp.task('bower-css', () => {
  return gulp.src(bower)
    .pipe(filters.css)
    .pipe($.concat('_base.scss'))
    .pipe(gulp.dest(`${srcDir.css}/vendor`));
});

gulp.task('bower-images', () => {
  return gulp.src(bower)
    .pipe(filters.img)
    .pipe(gulp.dest(dist.img));
});

gulp.task('bower-fonts', () => {
  return gulp.src(bower)
    .pipe(filters.fonts)
    .pipe(gulp.dest(dist.fonts));
});

// Custom SCSS
gulp.task('sass', () => {
  // Auto-generate @import statements for components and partials
  ['components', 'partials'].forEach(type => {
    var target = `${srcDir.css}/_${type}.scss`;
    fs.writeFileSync(target, '');
    readdir(`${srcDir.css}/${type}`).forEach(file => {
      fs.appendFileSync(target, `@import '${type}/${file.replace('.scss','')}';\n`);
    });
  });

  // Set up PostCSS plugins
  var browsers = [
    'last 1 version',
    '> 1%',
    'ie >= 9',
    'not ie <= 8'
  ];
  var processors = [
    autoprefixer({
      browsers: browsers
    })
  ];

  // http://cssnano.co/
  if (argv.deploy) {
    processors.push(cssnano);
  }

  return gulp.src(src.css)
    .pipe($.sass({
      includePaths: [srcDir.css],
      imagePath: dist.img
    }))
    .pipe($.postcss(processors))
    .pipe(gulp.dest(dist.css))
    .pipe($.connect.reload());
});

// Images
gulp.task('images', () => {
  return gulp.src(src.img)
    .pipe($.changed(dist.img))
    .pipe($.imagemin({ progressive: true }))
    .pipe(gulp.dest(dist.img))
    .pipe($.connect.reload());
});

// HTML
gulp.task('mixins', (cb) => {
  // Create list of mixins to include in main templates
  var target = `${srcDir.html}/_mixins.jade`;
  fs.writeFileSync(target, '');
  readdir(`${srcDir.html}/mixins`).forEach(v => {
    fs.appendFileSync(target, `include mixins/${v.replace('.jade','')}\n`);
  });
  cb();
});

gulp.task('html', ['mixins'], () => {
  // Process everything but components, ensure mixins are built out first
  return gulp.src(src.html)
    .pipe($.jade({ pretty: true }))
    .pipe(gulp.dest(dist.html))
    .pipe($.connect.reload());
});

gulp.task('components', ['html'], () => {
  // Now operate on the components we excluded using `filters.pages`
  // See https://github.com/gulpjs/gulp/blob/master/docs/writing-a-plugin/using-buffers.md
  var prepComponents = function(prependText) {

    // Create a stream through which each file will pass
    var stream = through.obj(function(file, enc, cb) {

      // Add 1 level of indentation for all content to be added under "block content"
      var modifiedContent = file.contents.toString('utf8').split('\n').map(line => {
        return '    ' + line;
      }).join('\n');

      // Prepend text to top of each file
      var prependBuffer = new Buffer(prependText);
      file.contents = Buffer.concat([prependBuffer, new Buffer(modifiedContent)]);

      // Make sure the file goes through the next gulp plugin
      this.push(file);
      cb();
    });

    return stream;
  }

  return gulp.src(src.components)
    .pipe(prepComponents('extend ../layouts/default\n\nblock content\n'))
    .pipe($.jade({ pretty: true }))
    .pipe(gulp.dest(`${dist.html}/components`))
    .pipe($.connect.reload());
});

// Server
gulp.task('serve', () => {
  var port = 9001;

  $.connect.server({
    root: 'dist',
    port: port,
    livereload: true
  });
});

// Report

gulp.task('report', function() {
  $.util.log($.util.colors.yellow('⇒ Asset file size report:'));

  gulp.src(`${dist.images}/**/*.{gif,png,jpg,webp}`)
    .pipe($.size({title: '⇒ Images (optimized with imagemin)'}));

  gulp.src(`${dist.css}/**/*.css`)
    .pipe($.size({ title: '⇒ CSS ' + (argv.deploy ? '(minified)' : '(unminified)'), showFiles: true }))

  return gulp.src(`${dist.js}/**/*.js`)
    .pipe($.size({ title: '⇒ JS ' + (argv.deploy ? '(uglified)' : '(debug mode)'), showFiles: true }));
});

/*
 * Task Groupings
 */

// Default task
gulp.task('default', ['watch', 'serve'], () => {
  $.util.log($.util.colors.yellow('⇒ Watching for changes...'));
});

// Standalone build task
gulp.task('build', done => {
  runSequence(
    'clean',
    'bower',
    ['sass', 'components', 'browserify', 'modernizr', 'images'],
    'report',
    done
  );
});
