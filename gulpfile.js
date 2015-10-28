var _ = require('lodash');
var gulp = require('gulp');
var stripJsonComments = require('strip-json-comments');
var gutil = require('gulp-util');
var bower = require('bower');
var ngAnnotate = require('gulp-ng-annotate');
var concat = require('gulp-concat');
var sass = require('gulp-sass');
var minifyCss = require('gulp-minify-css');
var rename = require('gulp-rename');
var sh = require('shelljs');
var gitRev = require('git-rev');
var template = require('gulp-template');
var uglify = require('gulp-uglify');
var fs = require('fs');
var Q = require('q');
var gulpif = require('gulp-if');
var notifier = require('node-notifier');
var livereload = require('gulp-livereload');
var fontello = require('gulp-fontello');

var isWatch = false;
var isLiveReload = process.argv.indexOf('--live-reload') !== false || process.argv.indexOf('--livereload') !== false;

var buildAppConfig = function() {
    var def = Q.defer();

    gitRev.branch(function(branch) {
        gitRev.short(function(rev) {
            var config = {
                VERSION: branch + ":" + rev
            };

            ['./appconfig.json', './appconfig.default.json'].forEach(function(filename) {
                var json = fs.readFileSync(filename);

                if (json) {
                    var data = JSON.parse(stripJsonComments(json.toString('utf8')));
                    config = _.defaults(config, data);
                }
            });

            if (typeof config.API_HTTPS !== "undefined" && config.API_HTTPS === false) {
                config.API_URL = "http://" + config.API_HOST;
            } else {
                config.API_URL = "https://" + config.API_HOST;
            }

            def.resolve(config);
        });
    });

    return def.promise;
};

var appConfig = Q.fcall(buildAppConfig);

gulp.task('appconfig', function() {
    appConfig = Q.fcall(buildAppConfig);
});

gulp.task('templates:index', ['appconfig'], function(done) {

    appConfig.then(function(APPCONFIG) {
        var readTranslations = function(filename) {
            var raw = fs.readFileSync(filename);

            if (!raw) {
                throw new Error("Missing translations!");
            }

            return JSON.parse(stripJsonComments(raw.toString('utf8')));
        };

        var translations = {
            english: readTranslations('./src/translations/translations/english.json'),
            americanEnglish: readTranslations('./src/translations/translations/americanEnglish.json'),
            french: readTranslations('./src/translations/translations/french.json'),

            mobile: {
                english: readTranslations('./src/translations/translations/mobile/english.json'),
                french: readTranslations('./src/translations/translations/mobile/french.json')
            }
        };

        gulp.src("./src/index.html")
            .pipe(template({
                VERSION: APPCONFIG.VERSION,
                APPCONFIG_JSON: JSON.stringify(APPCONFIG),
                TRANSLATIONS: JSON.stringify(translations)
            }))
            .pipe(gulp.dest("./www"))
            .on('end', done);
    });
});

gulp.task('templates:rest', ['appconfig'], function(done) {

    appConfig.then(function(APPCONFIG) {
        gulp.src("./src/templates/**/*")
            .pipe(gulp.dest("./www/templates"))
            .on('end', done);
    });
});

gulp.task('js:libs', ['appconfig'], function(done) {

    appConfig.then(function(APPCONFIG) {
        gulp.src([
            "./src/lib/q/q.js",
            "./src/lib/angular/angular.js",
            "./src/lib/ionic-service-core/ionic-core.js",
            "./src/lib/ionic-service-analytics/ionic-analytics.js",
            "./src/lib/angular-ui-router/release/angular-ui-router.js",
            "./src/lib/ng-infinite-scroller-origin/build/ng-infinite-scroll.js",

            // "./src/lib/bootstrap-sass/assets/javascripts/dropdown.js",

            "./src/lib/angular-bootstrap/ui-bootstrap-tpls.js",
            "./src/lib/angular-toggle-switch/angular-toggle-switch.js",

            "./src/lib/pouchdb/dist/pouchdb.js",

            "./src/lib/angular-translate/angular-translate.js",
            "./src/lib/libphonenumber/dist/libphonenumber.js",
            "./src/lib/intl-tel-input/src/js/data.js",

            "./src/lib/moment/moment.js",
            "./src/lib/angular-moment/angular-moment.js",
            "./src/lib/ngImgCrop/compile/unminified/ng-img-crop.js",
            "./src/lib/qrcode/lib/qrcode.js",
            "./src/lib/angular-qr/src/angular-qr.js"
        ])
            .pipe(concat('libs.js'))
            .pipe(gulpif(APPCONFIG.MINIFY, uglify()))
            .pipe(gulp.dest('./www/js/'))
            .on('end', done);
    });
});

gulp.task('js:app', ['appconfig'], function(done) {

    appConfig.then(function(APPCONFIG) {
        gulp.src([
            './src/js/**/*.js',
            '!./src/js/workers/*.js'
        ])
            .pipe(concat('app.js'))
            .pipe(ngAnnotate())
            .on('error', function(e) {
                if (isWatch) {
                    notifier.notify({
                        title: 'GULP watch + js:app + ngAnnotate ERR',
                        message: e.message
                    });
                    console.error(e);
                    this.emit('end');
                } else {
                    throw e;
                }
            })
            .pipe(gulpif(APPCONFIG.MINIFY, uglify()))
            .pipe(gulp.dest('./www/js/'))
            .on('end', done)
        ;
    });
});

gulp.task('js:webworkers', ['appconfig'], function(done) {

    appConfig.then(function(APPCONFIG) {
        gulp.src([
            "./src/js/workers/*.js"
        ])
        .pipe(gulpif(APPCONFIG.MINIFY, uglify()))
        .pipe(gulp.dest('./www/js/'))
        .on('end', done);
    });
});

gulp.task('js:sdk', ['appconfig'], function(done) {

    appConfig.then(function(APPCONFIG) {
        gulp.src([
            "./src/lib/blocktrail-sdk/build/blocktrail-sdk-full.js"
        ])
            .pipe(concat('sdk.js'))
            .pipe(gulpif(APPCONFIG.MINIFY, uglify({
                mangle: {
                    except: ['Buffer', 'BigInteger', 'Point', 'Script', 'ECPubKey', 'ECKey']
                }
            })))
            .pipe(gulp.dest('./www/js/'))
            .on('end', done);
    });
});

var sassTask = function(done) {

    appConfig.then(function(APPCONFIG) {
        gulp.src('./src/sass/app.scss')
            .pipe(sass({errLogToConsole: true}))
            .pipe(gulp.dest('./www/css/'))
            .pipe(gulpif(APPCONFIG.MINIFY, minifyCss({keepSpecialComments: 0})))
            .pipe(gulp.dest('./www/css/'))
            .on('end', done);
    });
};

// create a sass with and without dependancy on fontello
gulp.task('sass', ['appconfig', 'css-rename'], sassTask);
gulp.task('sassfontello', ['appconfig', 'fontello', 'css-rename'], sassTask);

/**
 * css-rename to change .css to .sass extensions because we want the css imported :/
 */
gulp.task('css-rename', function(done) {

    gulp.src([
        './src/lib/angular-toggle-switch/angular-toggle-switch.css',
        './src/lib/angular-toggle-switch/angular-toggle-switch-bootstrap.css'
    ], { base: process.cwd() })
        .pipe(rename({
            extname: ".scss"
        }))
        .pipe(gulp.dest('./')) // back where you came from
        .on('end', done);
});

gulp.task('fontello-dl', function(done) {

    gulp.src('./fontello.json')
        .pipe(fontello())
        .pipe(gulp.dest('./www/fontello/'))
        .on('end', done);
});

gulp.task('fontello-rename', ['fontello-dl'], function(done) {

    gulp.src(['./www/fontello/css/fontello.css'])
        .pipe(rename('_fontello.scss'))
        .pipe(gulp.dest('./www/fontello/css'))
        .on('end', done);
});

gulp.task('fontello', ['fontello-dl', 'fontello-rename'], function(done) {

    gulp.src('./www/fontello/font/*')
        .pipe(gulp.dest('./www/font'))
        .on('end', done);
});

gulp.task('watch', function() {
    isWatch = true;

    if (isLiveReload) {
        livereload.listen();
    }

    gulp.watch(['./fontello.json'], ['fontello:livereload']);
    gulp.watch(['./src/sass/**/*.scss', './www/fontello/**/*'], ['sass:livereload']);
    gulp.watch(['./src/js/**/*.js', '!./src/js/workers/*.js'], ['js:app:livereload']);
    gulp.watch(['./src/js/workers/*.js'], ['js:webworkers:livereload']);
    gulp.watch(['./src/lib/**/*.js'], ['js:libs:livereload', 'js:sdk:livereload']);
    gulp.watch(['./src/templates/**/*', './src/index.html'], ['templates:livereload']);
    gulp.watch(['./appconfig.json', './appconfig.default.json'], ['default:livereload']);
});

gulp.task('fontello:livereload', ['fontello'], function() {
    livereload.reload();
});

gulp.task('sass:livereload', ['sass'], function() {
    livereload.reload();
});

gulp.task('js:app:livereload', ['js:app'], function() {
    livereload.reload();
});

gulp.task('js:webworkers:livereload', ['js:webworkers'], function() {
    livereload.reload();
});

gulp.task('js:libs:livereload', ['js:libs'], function() {
    livereload.reload();
});

gulp.task('js:sdk:livereload', ['js:sdk'], function() {
    livereload.reload();
});

gulp.task('templates:livereload', ['templates'], function() {
    livereload.reload();
});

gulp.task('default:livereload', ['default'], function() {
    livereload.reload();
});

gulp.task('js', ['js:libs', 'js:app', 'js:sdk', 'js:webworkers']);
gulp.task('templates', ['templates:index', 'templates:rest']);
gulp.task('default', ['sassfontello', 'templates', 'js']);
