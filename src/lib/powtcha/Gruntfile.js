module.exports = function (grunt) {
    /*
     * parse CLI args for saucelabs filtering
     */
    var browsersIdx = process.argv.indexOf('--browsers');
    var browsers = null;
    if (browsersIdx !== -1) {
        browsers = process.argv[browsersIdx + 1].split(",");
    }

    var localSaucelabsBuild = ('99' + ((new Date).getTime() / 1000).toFixed(0) + (Math.random() * 1000).toFixed(0));

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        /*
         * Connect (used to open connection for saucelabs)
         */
        connect: {
            server: {
                options: {
                    base: '',
                    port: 9999
                }
            }
        },

        /*
         * Saucelabs
         */
        'saucelabs-mocha': {
            tests: {
                options: {
                    // username: 'saucelabs-user-name', // if not provided it'll default to ENV SAUCE_USERNAME (if applicable)
                    // key: 'saucelabs-key', // if not provided it'll default to ENV SAUCE_ACCESS_KEY (if applicable)
                    urls: [
                        'http://127.0.0.1:9999/test/run-tests.html'
                    ],
                    browsers: require('./saucelabs-browsers')
                                .filter(function(browser) { return !browsers || browsers.indexOf(browser.browserName) !== -1; }),
                    build: process.env.TRAVIS_JOB_ID || localSaucelabsBuild,
                    testname: 'mocha tests',
                    throttled: 2,
                    statusCheckAttempts: 360, // statusCheckAttempts * pollInterval = total time
                    pollInterval: 4000,
                    sauceConfig: {
                        'command-timeout': 600,
                        'idle-timeout': 360,
                        'max-duration': 900, // doesn't seem to take effect
                        'video-upload-on-pass': true
                    }
                }
            }
        },

        /*
         * Uglify
         */
        uglify: {
            options: {
                mangle: {
                    except: ['Buffer', 'sha256_asm', 'asm']
                }
            },
            powtcha: {
                files: {
                    'build/powtcha.min.js': ['<%= browserify.powtcha.dest %>']
                }
            },
            test: {
                files: {
                    'build/test.min.js': ['<%= browserify.test.dest %>']
                }
            }
        },

        /*
         * Browserify
         */
        browserify: {
            powtcha: {
                options: {
                    browserifyOptions: {
                        standalone: 'powtcha'
                    },
                    transform: ['brfs']
                },
                src: 'index.js',
                dest: 'build/powtcha.js'
            },
            test: {
                options: {
                    browserifyOptions: {
                        standalone: 'powtchaTEST'
                    },
                    transform: ['brfs']
                },
                src: 'test.js',
                dest: 'build/test.js'
            }
        },

        /*
         * Watch
         */
        watch: {
            options: {},
            test: {
                files: ['test.js', 'index.js', 'test/*', 'test/**/*', 'lib/*', 'lib/**/*'],
                tasks: ['browserify:test']
            }
        }
    });

    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-saucelabs');
    grunt.loadNpmTasks('grunt-exec');

    grunt.registerTask('build', ['browserify', 'uglify']);
    grunt.registerTask('default', ['build']);
    grunt.registerTask('test-browser', ['connect', 'saucelabs-mocha']);
};

