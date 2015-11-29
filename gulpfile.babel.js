let gulp = require('gulp');

/*
 * Required modules
 */

// Build utilities
let $            = require('gulp-load-plugins')();
let bowerFiles   = require('main-bower-files');

// Utility packages
let path         = require('path');
let fs           = require('fs');
let del          = require('del');
let rfile        = require('rfile');
let readdir      = require('fs-readdir-recursive');
let mkdirp       = require('mkdirp');
let argv         = require('minimist')(process.argv.slice(2));
let runSequence  = require('run-sequence');
let uniq         = require('uniq');
let glob         = require('glob');

// Pipeline utilities
let map          = require('map-stream');
let buffer       = require('vinyl-buffer');

// Browserify
let browserify   = require('browserify');
let babelify     = require('babelify');

// PostCSS plugins
let autoprefixer = require('autoprefixer');
let cssnano      = require('cssnano');


/*
 * Path config
 */

const bowerrc = JSON.parse(rfile('./.bowerrc'));

const srcDir = {
  'js': './src/js',
  'css': './src/css',
  'img': './src/images',
  'html': './src/html'
};

const dist = {
  'js': './dist/js',
  'css': './dist/css',
  'img': './dist/images',
  'html': './dist',
  'fonts': './dist/fonts'
};

const src = {
  'js': `${srcDir.js}/**/*.js`,
  'css': `${srcDir.css}/*.scss`,
  'img': `${srcDir.img}/**/*.{gif,png,jpg,webp,svg}`,
  'html': [
    `${srcDir.html}/**/*.jade`,
    `!${srcDir.html}/{components,layouts}/**/*.jade`,
    `!${srcDir.html}/utilities/**/*.jade`
  ],
  'components': `${srcDir.html}/components/**/*.jade`
};

const bower = bowerFiles({
  'paths': {
    'bowerDirectory': bowerrc.directory
  }
});

const filters = {
  'js': $.filter('**/*.js'),
  'sass': $.filter('**/*.scss'),
  'css': $.filter('**/*.css'),
  'img': $.filter('**/*.{gif,png,jpg,webp,svg}'),
  'fonts': $.filter('**/*.{eot,woff,woff2,ttf,svg}'),
  'svg': $.filter('**/*.svg', {'restore': true})
};

const ignore = {
  'img': $.filter(['*', '!slick.svg'])
};

const plumberOpts = {
  'errorHandler': function(err) {
    let msg = err.messageFormatted.split('\n');
    $.util.log($.util.colors.red(msg.shift()));
    msg.splice(0, 2).forEach(m => {
      $.util.log($.util.colors.yellow(m));
    });
    msg.forEach(m => {
      if (m.length) {
        $.util.log($.util.colors.blue(m));
      }
    });
    this.emit('end');
  }
};

/*
 * Watch (Needs to be defined first, the watch letiable is used in other tasks)
 */

let watch = false;

gulp.task('watch', done => {
  // Tell other tasks we're watching (most importantly, browserify)
  watch = true;

  // Build and then define watching tasks
  runSequence('build', () => {
    // Compile Sass
    gulp.watch(`${srcDir.css}/**/*.scss`, ['sass']);

    // Compress Images
    gulp.watch(src.img, ['images']);

    // Re-bundle JS
    gulp.watch(src.js, ['browserify']);

    // Compile Jade templates
    gulp.watch([src.html, src.components, `${srcDir.html}/{layouts}/**/*.jade`], ['html']);

    done();
  });
});

/*
 * Tasks
 */

// Clean dist/ directory
gulp.task('clean', del.bind(
  null, ['dist/*'], {'dot': true}
));

// Generate custom modernizr build
gulp.task('modernizr', () => {
  gulp.src(src.js)
    .pipe($.modernizr('modernizr.js', {
      'tests': [
        'mediaqueries'
      ]
    }))
    .pipe($.uglify())
    .pipe(gulp.dest(dist.js));
});

// Browserify
gulp.task('browserify', done => {
  // Define the filename for the shared code
  let common = 'common.js';

  // Tell Browserify which bundles to create (hint: app.js and components/*.js)
  let srcJS = readdir(srcDir.js, file => {
    return !file.match('vendor');
  });

  let entries = srcJS.map(file => `${srcDir.js}/${file}`);

  // Define where each file should go (same order as `entries`)
  let outputs = srcJS;

  // Create any directories (outside of the scope of `factor-bundle`)
  uniq(entries.map(file => path.dirname(file).replace('src', 'dist'))).forEach(dir => {
    mkdirp(dir);
  });

  // Set browserify options
  let b = browserify({
    entries,
    'debug': !argv.deploy
  });

  b.transform(babelify, {
    'presets': ['es2015']
  });

  let bundle = $.watchifyFactorBundle(b,
    { entries, outputs, common },
    function(bundleStream) {
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
  let checkBundles = setInterval(() => {
    if (glob.sync(`${dist.js}/{${srcJS.join(',')}}`).length === srcJS.length) {
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
  let baseDirs = {
    'bootstrap-sass': '/assets/stylesheets',
    'scut': '/dist'
  };

  // Move the relevant files to our Sass directory
  return gulp.src(bower)
    .pipe(filters.sass)
    .pipe(map((file, cb) => {
      let rel = file.path.replace(path.join(__dirname, bowerrc.directory), '');
      let pkg = rel.split(path.sep)[1];

      let vendor = path.join(srcDir.css, 'vendor', pkg);
      mkdirp(vendor);

      let base = rel.replace(path.join(pkg, baseDirs[pkg], '/'), '').replace(path.basename(file.path), '');
      let dest = path.join(vendor, base);

      let ws = fs.createWriteStream(path.join(dest, path.basename(file.path)));
      ws.on('close', cb);
      file.pipe(ws);
    }));
});

gulp.task('bower-js', () => {
  // Vendor JS
  return gulp.src(bower)
    .pipe(filters.js)
    .pipe($.uglify())
    .pipe(gulp.dest(`${dist.js}/vendor`));
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
    .pipe(ignore.img)
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
    let target = `${srcDir.css}/utilities/_${type}.scss`;
    fs.writeFileSync(target, '');
    readdir(`${srcDir.css}/${type}`).forEach(file => {
      fs.appendFileSync(target, `@import '../${type}/${file.replace('.scss', '')}';\n`);
    });
  });

  // Set up PostCSS plugins
  let browsers = [
    'last 1 version',
    '> 1%',
    'ie >= 9',
    'not ie <= 8'
  ];
  let processors = [
    autoprefixer({
      'browsers': browsers
    })
  ];

  // http://cssnano.co/
  if (argv.deploy) {
    processors.push(cssnano);
  }

  return gulp.src(src.css)
    .pipe($.plumber(plumberOpts))
    .pipe($.sass({
      'includePaths': [srcDir.css],
      'imagePath': dist.img,
      'precision': 8
    }))
    .pipe($.postcss(processors))
    .pipe(gulp.dest(dist.css))
    .pipe($.connect.reload());
});

// Images
gulp.task('images', () => {
  return gulp.src(src.img)
    .pipe($.if(argv.deploy, $.imagemin({ 'progressive': true })))
    .pipe(filters.svg)
    .pipe($.if(argv.deploy, $.svg2png()))
    .pipe(filters.svg.restore)
    .pipe(gulp.dest(dist.img))
    .pipe($.connect.reload());
});

// HTML
gulp.task('components', (cb) => {
  // Create list of component mixins to include in main templates
  let target = `${srcDir.html}/utilities/components.jade`;
  fs.writeFileSync(target, '');
  readdir(`${srcDir.html}/components`).forEach(v => {
    fs.appendFileSync(target, `include ../components/${v.replace('.jade', '')}\n`);
  });
  cb();
});

gulp.task('html', ['components'], () => {
  return gulp.src(src.html)
    .pipe($.jade({ 'pretty': true }))
    .pipe(gulp.dest(dist.html))
    .pipe($.connect.reload());
});

// Server
gulp.task('serve', () => {
  let port = 9001;

  $.connect.server({
    'root': 'dist',
    'port': port,
    'livereload': true
  });
});

// Report

gulp.task('report', done => {
  runSequence(
    'report:images',
    'report:css',
    'report:js',
    done
  );
});

gulp.task('report:images', () => {
  return gulp.src(`${dist.images}/**/*.{gif,png,jpg,webp}`)
    .pipe($.size({'title': '⇒ Images (optimized with imagemin)'}));
});

gulp.task('report:css', () => {
  return gulp.src(`${dist.css}/**/*.css`)
    .pipe($.size({ 'title': '⇒ CSS ' + (argv.deploy ? '(minified)' : '(unminified)'), 'showFiles': true }));
});

gulp.task('report:js', () => {
  return gulp.src(`${dist.js}/**/*.js`)
    .pipe($.size({ 'title': '⇒ JS ' + (argv.deploy ? '(uglified)' : '(debug mode)'), 'showFiles': true }));
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
    ['sass', 'html', 'browserify', 'modernizr', 'images'],
    'report',
    done
  );
});
