var _ = require('lodash');
var gulp = require('gulp');
var stripJsonComments = require('strip-json-comments');
var bower = require('bower');
var ngAnnotate = require('gulp-ng-annotate');
var concat = require('gulp-concat');
var sass = require('gulp-sass');
var minifyCss = require('gulp-minify-css');
var rename = require('gulp-rename');
var template = require('gulp-template');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var fs = require('fs');
var path = require('path');
var Q = require('q');
var gulpif = require('gulp-if');
var notifier = require('node-notifier');
var livereload = require('gulp-livereload');
var fontello = require('gulp-fontello');
var del = require('del');
var html2js = require('gulp-html2js');
var KarmaServer = require('karma').Server;
var babel = require('gulp-babel');

var readAppConfig = require('./gulp/readappconfig');
var buildAppConfig = require('./gulp/buildappconfig');
var streamAsPromise = require('./gulp/streamaspromise');
var buildSRIMap = require('./gulp/sri');

var DONT_MANGLE = ['Buffer', 'BigInteger', 'Point', 'Script', 'ECPubKey', 'ECKey', 'sha512_asm', 'asm', 'ECPair', 'HDNode', 'ngRaven'];

var isWatch = false;
var isLiveReload = process.argv.indexOf('--live-reload') !== -1 || process.argv.indexOf('--livereload') !== -1;

// determine SRI strategy
var noSRI = false;
if (process.argv.indexOf('--no-sri') !== -1) {
    // even with you force --no-sri it requires the STATICSDIR to be set, because when it's NULL it will autodetect
    //  and switch with new commits etc, which will make `gulp watch` fail horribly
    if (!readAppConfig()['STATICSDIR']) {
        throw new Error("STATICSDIR needs to be set to be able to build with --no-sri");
    }
    noSRI = true;
} else {
    // use config value if present
    var configSRI = readAppConfig()['SRI'];
    if (typeof configSRI !== "undefined" && configSRI !== null) {
        noSRI = !configSRI;
    } else {
        // disable when `DEBUG=true` and `STATICSDIR=dev`, this is so that `gulp watch` doesn't have to rebuild everything all the time.
        noSRI = readAppConfig()['DEBUG'] && readAppConfig()['STATICSDIR'];
    }
}
var doSRI = !noSRI;
if (process.argv.indexOf('--silent') === -1) {
    console.log('SRI?', doSRI);
}

var appConfig = Q.fcall(buildAppConfig);

gulp.task('appconfig', function() {
    appConfig = Q.fcall(buildAppConfig); // refresh the promise with a new build
    return appConfig;
});

gulp.task('appconfig:print', ['appconfig'], function() {
    return appConfig.then(function(APPCONFIG) {
        console.log(JSON.stringify(APPCONFIG));
    });
});

gulp.task('templates:index', ['appconfig', 'js', 'sass'], function() {
    return appConfig.then(function(APPCONFIG) {
        return buildSRIMap([
            "./www/" + APPCONFIG.STATICSDIR + "/js/app.js",
            "./www/" + APPCONFIG.STATICSDIR + "/js/libs.js",
            "./www/" + APPCONFIG.STATICSDIR + "/js/templates.js",
            "./www/" + APPCONFIG.STATICSDIR + "/js/sdk.js",
            "./www/" + APPCONFIG.STATICSDIR + "/js/zxcvbn.js",
            "./www/" + APPCONFIG.STATICSDIR + "/js/config.js",
            "./www/" + APPCONFIG.STATICSDIR + "/js/translations.js",
            "./www/" + APPCONFIG.STATICSDIR + "/js/asmcrypto.js",
            "./www/" + APPCONFIG.STATICSDIR + "/css/app.css"
        ], "./www/" + APPCONFIG.STATICSDIR + "/").then(function(SRI) {
            return streamAsPromise(gulp.src("./src/index.html")
                .pipe(template({
                    APPCONFIG: APPCONFIG,
                    SRI: doSRI && SRI,
                    VERSION: APPCONFIG.VERSION,
                    STATICSDIR: APPCONFIG.STATICSDIR,
                    GOOGLE_RECAPTCHA_SITE_KEY: APPCONFIG.GOOGLE_RECAPTCHA_SITE_KEY,
                    STATICSURL: APPCONFIG.STATICSURL
                }))
                .pipe(gulp.dest("./www"))
            );
        });
    });
});

gulp.task('templates:demo', ['appconfig', 'js'], function() {
    return appConfig.then(function(APPCONFIG) {
        return buildSRIMap([],
            "./www/" + APPCONFIG.STATICSDIR + "/").then(function(SRI) {
            return streamAsPromise(gulp.src("./src/demo.html")
                .pipe(template({
                    APPCONFIG: APPCONFIG,
                    SRI: doSRI && SRI,
                    VERSION: APPCONFIG.VERSION,
                    STATICSDIR: APPCONFIG.STATICSDIR,
                    GOOGLE_RECAPTCHA_SITE_KEY: APPCONFIG.GOOGLE_RECAPTCHA_SITE_KEY,
                    STATICSURL: APPCONFIG.STATICSURL
                }))
                .pipe(gulp.dest("./www"))
            );
        });
    });
});

gulp.task('templates:rest', ['appconfig'], function() {
    return appConfig.then(function(APPCONFIG) {
        return streamAsPromise(gulp.src([
                "./src/js/modules/**/*.html",
                "./src/templates/**/*.html"
            ])
            .pipe(html2js('templates.js', {
                adapter: 'angular',
                base: './src/',
                name: 'blocktrail.templates'
            }))
            .pipe(gulp.dest("./www/" + APPCONFIG.STATICSDIR + "/js"))
        );
    });
});

gulp.task('js:libs', ['appconfig'], function() {

    return appConfig.then(function(APPCONFIG) {
        return streamAsPromise(gulp.src([
            "./src/lib/q/q.js",
            "./src/lib/bip70-js/build/bip70.js",
            "./src/lib/angular/angular.js",
            './src/lib/angulartics/src/angulartics.js',
            './src/lib/angulartics-google-analytics/lib/angulartics-ga.js',
            "./src/lib/angular-ui-router/release/angular-ui-router.js",
            "./src/lib/ng-infinite-scroller-origin/build/ng-infinite-scroll.js",

            // "./src/lib/bootstrap-sass/assets/javascripts/dropdown.js",

            "./src/lib/angular-bootstrap/ui-bootstrap-tpls.js",
            "./src/lib/angular-toggle-switch/angular-toggle-switch.js",

            "./src/lib/pouchdb/dist/pouchdb.js",
            "./src/lib/pouchdb/dist/pouchdb.memory.js",

            "./src/lib/bowser/src/bowser.js",
            "./src/lib/semver/semver.browser.js",
            "./src/lib/powtcha/build/powtcha.js",

            "./src/lib/angular-translate/angular-translate.js",
            "./src/lib/libphonenumber/dist/libphonenumber.js",
            "./src/lib/intl-tel-input/src/js/data.js",

            "./src/lib/moment/moment.js",
            "./src/lib/angular-moment/angular-moment.js",
            "./src/lib/ngImgCrop/compile/unminified/ng-img-crop.js",
            "./src/lib/qrcode/lib/qrcode.js",
            "./src/lib/angular-qr/src/angular-qr.js",

            "./src/lib/fingerprintjs2/fingerprint2.js",
            "./src/lib/raven-js/dist/raven.js",
            "./src/lib/raven-js/dist/plugins/angular.js"
        ])
            .pipe(concat('libs.js'))
            .pipe(sourcemaps.init({largeFile: true}))
            .pipe(gulpif(APPCONFIG.MINIFY, uglify({
                mangle: {
                    except: DONT_MANGLE
                }
            }).on('error', function(e){
                console.log(e);
            })))
            .pipe(sourcemaps.write('./'))
            .pipe(gulp.dest('./www/' + APPCONFIG.STATICSDIR + '/js/'))
        );
    });
});

gulp.task('js:app', ['appconfig'], function() {
    return appConfig.then(function(APPCONFIG) {
        return streamAsPromise(gulp.src([
            '!./src/js/**/*.spec.js',
            './src/js/**/*.js'
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
            .pipe(sourcemaps.init({largeFile: true}))
            .pipe(gulpif(APPCONFIG.MINIFY, uglify({
                mangle: {
                    except: DONT_MANGLE
                }
            }).on('error', function(e){
                console.log(e);
            })))
            .pipe(sourcemaps.write('./'))
            .pipe(gulp.dest('./www/' + APPCONFIG.STATICSDIR + '/js/'))
        );
    });
});

gulp.task('js:sdk', ['appconfig'], function() {

    return appConfig.then(function(APPCONFIG) {
        return streamAsPromise(gulp.src([
                "./src/lib/blocktrail-sdk/build/blocktrail-sdk-full.js"
            ])
                .pipe(concat('sdk.js'))
                .pipe(babel({
                      presets: ['env']
                }))
                .pipe(sourcemaps.init({largeFile: true}))
                .pipe(gulpif(APPCONFIG.MINIFY, uglify({
                    mangle: {
                        except: DONT_MANGLE
                    }
                }).on('error', function(e){
                    console.log(e);
                })))
                .pipe(sourcemaps.write('./'))
                .pipe(gulp.dest('./www/' + APPCONFIG.STATICSDIR + '/js/'))
        );
    });
});

gulp.task('js:sdk:asmcrypto', ['appconfig'], function() {

    return appConfig.then(function(APPCONFIG) {
        return streamAsPromise(gulp.src([
                "./src/lib/blocktrail-sdk/build/asmcrypto.js"
            ])
                .pipe(concat('asmcrypto.js'))
                .pipe(gulp.dest('./www/' + APPCONFIG.STATICSDIR + '/js/'))
        );
    });
});

gulp.task('js:config', ['appconfig'], function() {
    var readTranslations = function(filename) {
        var def = Q.defer();

        fs.readFile(filename, function(err, raw) {
            if (!raw) {
                throw new Error("Missing translations!");
            }

            def.resolve(JSON.parse(stripJsonComments(raw.toString('utf8'))));
        });

        return def.promise;
    };

    var translations = {
        'mobile': {}
    };

    return appConfig.then(function(APPCONFIG) {
        return Q.all(_.map([
            './src/translations/translations/english.json',
            './src/translations/translations/americanEnglish.json',
            './src/translations/translations/french.json',
            './src/translations/translations/dutch.json',
            './src/translations/translations/chinese.json',
            './src/translations/translations/spanish.json',
            './src/translations/translations/russian.json',
            './src/translations/translations/swahili.json',
            './src/translations/translations/arabic.json',
            './src/translations/translations/hindi.json',
            './src/translations/translations/korean.json',
            './src/translations/translations/german.json',
            './src/translations/translations/japanese.json',
            './src/translations/translations/portuguese.json'
        ], function(filename) {
            var language = path.basename(filename, '.json');
            var isMobile = filename.indexOf('mobile/') !== -1;

            return readTranslations(filename).then(function(result) {
                if (isMobile) {
                    translations['mobile'][language] = result;
                } else {
                    translations[language] = result;
                }
            })
        })).then(function() {

            return streamAsPromise(gulp.src([
                "./src/config.js.template",
                "./src/translations.js.template"
            ])
                .pipe(template({
                    APPCONFIG: APPCONFIG,
                    APPCONFIG_JSON: JSON.stringify(APPCONFIG),
                    TRANSLATIONS: JSON.stringify(translations)
                }))
                .pipe(rename({
                    extname: ""
                }))
                .pipe(gulp.dest('./www/' + APPCONFIG.STATICSDIR + '/js/')));
        });
    });
});

gulp.task('js:zxcvbn', ['appconfig'], function() {

    return appConfig.then(function(APPCONFIG) {
        return streamAsPromise(gulp.src([
            "./src/lib/zxcvbn/dist/zxcvbn.js"
        ])
            .pipe(concat('zxcvbn.js'))
            .pipe(gulpif(APPCONFIG.MINIFY, uglify().on('error', function(e){
                console.log(e);
            })))
            .pipe(gulp.dest('./www/' + APPCONFIG.STATICSDIR + '/js/'))
        );
    });
});

var sassTask = function() {

    return appConfig.then(function(APPCONFIG) {
        return streamAsPromise(gulp.src('./src/sass/app.scss')
            .pipe(sass({errLogToConsole: true}))
            .pipe(gulp.dest('./www/' + APPCONFIG.STATICSDIR + '/css/'))
            .pipe(gulpif(APPCONFIG.MINIFY, minifyCss({keepSpecialComments: 0})))
            .pipe(gulp.dest('./www/' + APPCONFIG.STATICSDIR + '/css/'))
        );
    });
};

gulp.task('sass', ['appconfig', 'css-rename'], sassTask);

/**
 * css-rename to change .css to .sass extensions because we want the css imported :/
 */
gulp.task('css-rename', function() {

    return streamAsPromise(gulp.src([
        './src/lib/angular-toggle-switch/angular-toggle-switch.css',
        './src/lib/angular-toggle-switch/angular-toggle-switch-bootstrap.css'
    ], { base: process.cwd() })
        .pipe(rename({
            extname: ".scss"
        }))
        .pipe(gulp.dest('./')) // back where you came from
    );
});

gulp.task('fontello-dl', function() {

    return streamAsPromise(gulp.src('./src/fontello/config.json')
        .pipe(fontello())
        .pipe(gulp.dest('./src/fontello/'))
    );
});

gulp.task('fontello-rename', ['fontello-dl'], function() {

    // rename fontello.css to _fontello.scss so we can include it
    return streamAsPromise(gulp.src(['./src/fontello/css/fontello.css'])
        .pipe(rename('_fontello.scss'))
        .pipe(gulp.dest('./src/fontello/css'))
    );
});

gulp.task('fontello-clean', ['fontello-rename'], function() {

    return del([
        './src/fontello/css/*.css'
    ]);
});

gulp.task('fontello', ['fontello-dl', 'fontello-rename', 'fontello-clean']);

gulp.task('copyfonts', ['appconfig'], function() {

    return appConfig.then(function(APPCONFIG) {
        return streamAsPromise(gulp.src([
            './src/font/*',
            './src/fontello/font/*',
            './src/font/**/*'
            ])
            .pipe(gulp.dest('./www/' + APPCONFIG.STATICSDIR + '/font'))
        );
    });
});

gulp.task('copyimages', ['appconfig'], function() {

    return appConfig.then(function(APPCONFIG) {
        return streamAsPromise(gulp.src(['./src/img/*', './src/img/**/*'])
            .pipe(gulp.dest('./www/' + APPCONFIG.STATICSDIR + '/img'))
        );
    });
});

gulp.task('copymisc', ['appconfig'], function() {

    return appConfig.then(function(APPCONFIG) {
        return Q.all([
            streamAsPromise(gulp.src(['./src/favicon.ico'])
                .pipe(gulp.dest('./www/' + APPCONFIG.STATICSDIR + '/'))
                .pipe(gulp.dest('./www/'))
            )
        ]);
    });
});

gulp.task('copystatics', ['copyfonts', 'copyimages', 'copymisc']);

gulp.task('watch', function() {
    isWatch = true;

    if (isLiveReload) {
        livereload.listen();
    }

    gulp.watch(['./src/sass/**/*.scss'], ['sass:livereload']);
    gulp.watch(['./src/img/**/*', './src/font/**/*'], ['copystatics:livereload']);
    gulp.watch(['./src/js/**/*.js'], ['js:app:livereload']);
    gulp.watch(['./src/lib/**/*.js', '!./src/lib/blocktrail-sdk/*.js'], ['js:libs:livereload']);
    gulp.watch(['./src/lib/blocktrail-sdk/*.js'], ['js:sdk:livereload']);
    gulp.watch(['./src/templates/**/*.html', './src/js/**/*.html', './src/translations/translations/**/*', './src/index.html'], ['templates:livereload']);
    gulp.watch(['./appconfig.json', './appconfig.default.json'], ['default:livereload']);
});

gulp.task('test', ['sass', 'templates', 'js'], function(done) {
    new KarmaServer({
            configFile: __dirname + '/karma.config.js',
            singleRun: true
    }, done).start();
});

gulp.task('sass:livereload', _.merge(['sass'], doSRI ? ['templates:index'] : []), function() {
    livereload.reload();
});

gulp.task('js:app:livereload', _.merge(['js:app'], doSRI ? ['templates:index'] : []), function() {
    livereload.reload();
});

gulp.task('js:libs:livereload', _.merge(['js:libs'], doSRI ? ['templates:index'] : []), function() {
    livereload.reload();
});

gulp.task('js:sdk:livereload', _.merge(['js:sdk', 'js:sdk:asmcrypto'], doSRI ? ['templates:index'] : []), function() {
    livereload.reload();
});

gulp.task('templates:livereload', _.merge(['templates'], doSRI ? ['templates:index'] : []), function() {
    livereload.reload();
});

gulp.task('default:livereload', ['default'], function() {
    livereload.reload();
});

gulp.task('copystatics:livereload', ['copystatics'], function() {
    livereload.reload();
});

gulp.task('js', ['js:libs', 'js:app', 'js:sdk', 'js:sdk:asmcrypto', 'js:zxcvbn', 'js:config']);
gulp.task('templates', ['templates:index', 'templates:rest', 'templates:demo']);
gulp.task('default', ['copystatics', 'sass', 'templates', 'js']);
