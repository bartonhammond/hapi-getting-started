'use strict';
let gulp = require('gulp');
let _ = require('lodash');
let $ = require('gulp-load-plugins')({pattern: ['gulp-*', 'del', 'gutil', 'merge-stream', 'run-sequence']});
let path = require('path');
let MongoClient = require('mongodb').MongoClient;
let exec = require('child_process').exec;
let pkg = require('./package.json');
let opts = require('./server/options.json');
let mongourl = opts.manifest.plugins['./build/common/plugins/connections'].mongo.app.url;
let influxdb = opts.influxdb;
gulp.task('server:eslint', () => {
    return gulp.src('server/**/*.js')
        .pipe($.eslint(pkg.eslintConfig))
        .pipe($.eslint.format())
        .pipe($.eslint.failOnError());
});
gulp.task('server:jscs', () => {
    return gulp.src('server/**/*.js')
        .pipe($.jscs(pkg.jscsConfig))
        .pipe($.jscs.reporter())
        .pipe($.jscs.reporter('fail'));
});
gulp.task('server:jshint', () => {
    let jshintConfig = pkg.jshintConfig;
    jshintConfig.lookup = false;
    return gulp.src('server/**/*.js')
        .pipe($.jshint(jshintConfig))
        .pipe($.jshint.reporter('unix'))
        .pipe($.jshint.reporter('fail'));
});
gulp.task('server:clean', (cb) => {
    $.del(['build/options.json', 'build/**/*', 'test/artifacts/**/*.*']).then(() => cb());
});
gulp.task('server:build', ['server:eslint', 'server:jscs', 'server:jshint'], () => {
    return $.mergeStream(
        gulp.src(['server/**/*', '!server/*.json', '!server/**/*.md'], {base: './server'})
            .pipe($.sourcemaps.init())
            .pipe($.babel({
                optional: ['validation.undeclaredVariableCheck', 'runtime'],
                loose: ['es6.classes', 'es6.modules'],
                blacklist: ['es6.blockScoping', 'es6.arrowFunctions', 'es6.properties.shorthand', 'es6.properties.computed', 'es6.constants', 'es6.templateLiterals']
            }))
            .pipe($.replace(/(\s+)_classCallCheck\(this/, '/*istanbul ignore next: dont mess up my coverage*/\n$1_classCallCheck(this'))
            .pipe($.sourcemaps.write('.', {
                includeContent: false,
                sourceRoot(file) {
                    return path.relative(file.path, __dirname);
                }
            })) //http://stackoverflow.com/questions/29440811/debug-compiled-es6-nodejs-app-in-webstorm
            .pipe(gulp.dest('build')),
        gulp.src('server/*.json')
            .pipe(gulp.dest('build')),
        gulp.src('server/**/*.md')
            .pipe(gulp.dest('build'))
    );
});
gulp.task('server:watch', () => {
    gulp.watch('server/**/*.js', ['server:build']);
});
gulp.task('server:test:prep', (cb) => {
    const toExec = `${influxdb.shellCmd} -host '${influxdb.host}' -port '${influxdb.httpport}' -database '${influxdb.database}' -execute 'create database ${influxdb.database}'`;
    exec(toExec, (err, stdout, stderr) => {
        $.gutil.log(stdout);
        $.gutil.log(stderr);
        if (err) {
            $.gutil.log(err);
        }
        cb();
    });
});
gulp.task('server:test:perf', (cb) => {
    const toExec = `node --harmony ./perf.js`;
    exec(toExec, (err, stdout, stderr) => {
        $.gutil.log(stdout);
        $.gutil.log(stderr);
        if (err) {
            $.gutil.log(err);
            cb(err);
        } else {
            cb();
        }
    });
});
gulp.task('server:test:clean', (cb) => {
    let db;
    $.del(['i18n/hi.json'])
        .then(() => {
            return MongoClient.connect(mongourl);
        })
        .then((dbconn) => {
            db = dbconn;
            return db.collections();
        })
        .then((collections) => {
            collections.forEach((collection) => {
                if (!(collection.collectionName.startsWith('system.'))) {
                    $.gutil.log('dropping ' + collection.collectionName);
                    collection.drop();
                }
            });
        })
        .then(() => {
            db.close();
            cb();
        })
        .catch(err => {
            cb(err);
        });
});
gulp.task('server:test:nocov', (cb) => {
    return gulp.src(['test/server/**/*.js'], {read: false})
        .pipe($.mocha({
            reporter: 'spec',
            ui: 'bdd',
            timeout: 6000000
        }))
        .once('error', (err) => {
            $.gutil.log(err);
            cb(err);
        })
        .once('end', () => {
            cb();
        });
});
gulp.task('server:test:cov', (cb) => {
    gulp.src(['build/**/*.js'])
        .pipe($.istanbul())
        .pipe($.istanbul.hookRequire())
        .once('finish', () => {
            gulp.src(['test/server/**/*.js'], {read: false})
                .pipe($.mocha({
                    reporter: 'spec',
                    ui: 'bdd',
                    timeout: 6000000
                }))
                .pipe($.istanbul.writeReports({
                    dir: './test/artifacts',
                    reporters: ['lcov', 'html', 'text', 'text-summary'],
                    reportOpts: {dir: './test/artifacts'}
                }))
                .pipe($.istanbul.enforceThresholds({thresholds: {global: 95}}))
                .once('error', (err) => {
                    $.gutil.log(err);
                    cb(err);
                })
                .once('end', () => {
                    cb();
                });
        });
});
gulp.task('server:test:watch', () => {
    return gulp.watch(['test/server/**/*.js', 'server/**/*.js'], ['server:test:nocov']);
});
gulp.task('server:test', (cb) => {
    $.runSequence(
        ['server:test:clean', 'server:clean', 'server:test:prep'],
        'server:build',
        'server:test:cov',
        ['server:test:clean', 'server:test:perf'],
        cb
    );
});
gulp.task('server:dev', ['server:clean', 'server:build'], () => {
    //https://github.com/remy/nodemon/blob/master/doc/arch.md
    $.nodemon({
        exec: 'node --harmony ',
        script: './build/index.js',
        watch: ['build/index.js'],
        ignore: ['**/node_modules/**/*', 'public/**/*.*', 'dist/**/*.*', 'test/**/*.*', '.git/**/*.*'],
        tasks: ['server:build'],
        delay: '20000ms'
    });
});
console.log('running for ' + process.env.NODE_ENV);
gulp.task('mark-for-prod', (cb) => {
    process.env.NODE_ENV = 'production';
    console.log('running for ' + process.env.NODE_ENV);
    cb();
});
gulp.task('server:default', ['server:watch', 'server:dev']);
gulp.task('default', ['server:default']);
gulp.task('test', ['server:test']);
gulp.task('coverage', () => {
    process.env['COVERALLS_REPO_TOKEN'] = 'IYP8L16MHhTpbiZ5dWPkAJQ1dMjg1xt6S';
    process.env['CODECLIMATE_REPO_TOKEN']='9940f0a450f94f5dda0fb33a2389529ce79888ae1e3e5d13bbb0e92cb2c2aaee';
    return $.mergeStream(
        gulp.src('test/artifacts/lcov.info')
            .pipe($.coveralls()),
        gulp.src('test/artifacts/lcov.info')
            .pipe($.codeclimateReporter({token: process.env['CODECLIMATE_REPO_TOKEN']}))
    );
});
