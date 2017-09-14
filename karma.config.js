module.exports = function(karma) {
    karma.set({
        /**
         * From where to look for files, starting with the location of this file.
         */
        basePath: "./",

        /**
         * This is the list of file patterns to load into the browser during testing.
         * TODO add angular mocks
         */
        files: [
            "www/dev/js/libs.js",
            "node_modules/angular-mocks/angular-mocks.js",
            "www/dev/js/sdk.js",
            "www/dev/js/config.js",
            "www/dev/js/translations.js",
            "www/dev/js/templates.js",
            "www/dev/js/app.js",
            "src/js/**/*.spec.js"
        ],

        browserConsoleLogOptions: {
            level: 'log',
            format: '%b %T: %m',
            terminal: true
        },

        frameworks: ["jasmine"],
        plugins: ["karma-jasmine", "karma-phantomjs-launcher", "karma-spec-reporter"],

        /**
         * On which port should the browser connect, on which port is the test runner
         * operating, and what is the URL path for the browser to use.
         */
        port: 9018,
        runnerPort: 9100,
        urlRoot: "/",

        reporters: ["spec"],
        specReporter: {
            maxLogLines: 5,             // limit number of lines logged per test
            suppressErrorSummary: true, // do not print error summary
            suppressFailed: false,      // do not print information about failed tests
            suppressPassed: false,      // do not print information about passed tests
            suppressSkipped: true,      // do not print information about skipped tests
            showSpecTiming: false,      // print the time elapsed for each spec
            failFast: true              // test would finish with error when a first fail occurs.
        },

        /**
         * Disable file watching by default.
         */
        autoWatch: false,

        /**
         * The list of browsers to launch to test on. This includes only "Firefox" by
         * default, but other browser names include:
         * Chrome, ChromeCanary, Firefox, Opera, Safari, PhantomJS
         *
         * Note that you can also use the executable name of the browser, like "chromium"
         * or "firefox", but that these vary based on your operating system.
         *
         * You may also leave this blank and manually navigate your browser to
         * http://localhost:9018/ when you"re running tests. The window/tab can be left
         * open and the tests will automatically occur there during the build. This has
         * the aesthetic advantage of not launching a browser every time you save.
         */
        browsers: ["PhantomJS"],

        /**
         * Continuous Integration mode
         * if true, Karma captures browsers, runs the tests and exits
         */
        singleRun: false
    });
};