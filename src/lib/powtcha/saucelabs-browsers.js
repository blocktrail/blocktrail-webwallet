module.exports = [{
    // latest chrome
    browserName: 'googlechrome',
    platform: 'Windows 10',
    version: 'latest',
    webcrypto: true
}, {
    // latest chrome as of writing
    browserName: 'googlechrome',
    platform: 'Windows 10',
    version: '54.0',
    webcrypto: true
}, {
    // latest firefox
    browserName: 'firefox',
    platform: 'Windows 10',
    version: 'latest',
    webcrypto: true
}, {
    // latest firefox as of writing
    browserName: 'firefox',
    platform: 'Windows 10',
    version: '49.0',
    webcrypto: true
}, {
    // latest Safari
    browserName: 'Safari',
    version: 'latest',
    webcrypto: false
}, {
    // latest Safari as of writing
    browserName: 'Safari',
    version: '10.0',
    webcrypto: false
}, {
    // latest edge
    browserName: 'MicrosoftEdge',
    platform: 'Windows 10',
    version: 'latest',
    webcrypto: false
}, {
    // latest edge as of writing
    browserName: 'MicrosoftEdge',
    platform: 'Windows 10',
    version: '14.14393',
    webcrypto: false
}, {
    // latest IE (EOL)
    browserName: 'internet explorer',
    platform: 'Windows 10',
    version: '11.103',
    webcrypto: false
}, {
    // android 5.0
    browserName: 'android',
    platform: 'Linux',
    version: '5.0',
    webcrypto: false
}, {
    // iphone iOS 9.2
    browserName: 'iphone',
    platform: 'OS X 10.10',
    version: '9.2',
    webcrypto: false
}, {
    // on FF < 48 there's no crypto.getRandomValues in webworkers
    browserName: 'firefox',
    platform: 'Windows 10',
    version: '47',
    webcrypto: false
}];
