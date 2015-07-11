'use strict';
/*eslint-disable no-process-exit*/
let Fs = require('fs');
let Promptly = require('promptly');
let Bluebird = require('bluebird');
let test = {
    projectName: 'hapistart',
    mongodbUrl: 'mongodb://127.0.0.1:27017/hapistart',
    rootEmail: 'root',
    rootPassword: '^YOURPWD$',
    systemEmail: 'system@yoursystem.com',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    smtpUsername: 'you',
    smtpPassword: '^YOURSMTPWD$',
    port: 3000,
    logdir: './../logs',
    logMetrics: false,
    statsdhost: '127.0.0.1',
    statsdport: 8125,
    certfile: './.secure/cert.pem',
    keyfile: './.secure/key.pem'
};
let fromStdIn = (results, property, message, opts) => {
    return new Bluebird((resolve, reject) => {
        if (process.env.NODE_ENV === 'test') {
            results[property] = test[property];
            resolve(results);
        } else {
            Promptly.prompt(message, opts, (err, out) => {
                if (err) {
                    reject(err);
                } else {
                    if (out) {
                        results[property] = out;
                    } else {
                        results[property] = opts.default;
                    }
                }
                resolve(results);
            });
        }
    });
};
fromStdIn({}, 'projectName', 'Project name: (hapistart) ', {'default': 'hapistart'})
    .then((results) => fromStdIn(results,
        'mongodbUrl',
        'MongoDB URL: (mongodb://localhost:27017/' + results.projectName + ') ',
        {'default': 'mongodb://localhost:27017/' + results.projectName}
    ))
    .then((results) => {
        results.rootEmail = 'root';
        return results;
    })
    .then((results) => fromStdIn(results, 'rootPassword', 'Root user password: ', {'default': ''}))
    .then((results) => fromStdIn(results, 'smtpHost', 'SMTP host: (smtp.gmail.com) ', {'default': 'smtp.gmail.com'}))
    .then((results) => fromStdIn(results, 'smtpPort', 'SMTP port: (465) ', {'default': 465}))
    .then((results) => fromStdIn(results, 'smtpUsername', 'SMTP username: (' + results.rootEmail + ') ', {'default': results.systemEmail}))
    .then((results) => fromStdIn(results, 'smtpPassword', 'SMTP password: ', {'default': ''}))
    .then((results) => fromStdIn(results, 'port', 'port: ', {'default': 3000}))
    .then((results) => fromStdIn(results, 'logdir', 'log directory: ', {'default': './logs'}))
    .then((results) => fromStdIn(results, 'logMetrics', 'capture metrics: ', {'default': true}))
    .then((results) => fromStdIn(results, 'statsdhost', 'statsd host: ', {'default': '127.0.0.1'}))
    .then((results) => fromStdIn(results, 'statsdport', 'statsd port: ', {'default': 8125}))
    .then((results) => fromStdIn(results, 'certfile', 'certificate file for https: ', {'default': './secure/cert.pem'}))
    .then((results) => fromStdIn(results, 'keyfile', 'key file for https: ', {'default': './secure/key.pem'}))
    .then((results) => {
        console.log('setting up with - ' + JSON.stringify(results));
        let opts = {
            env: 'dev',
            project: results.projectName,
            nodemailer: {
                auth: {
                    user: results.smtpUsername,
                    pass: results.smtpPassword
                },
                secure: true,
                host: results.smtpHost,
                port: results.smtpPort
            },
            bunyan: {
                name: 'main',
                streams: [{
                    type: 'rotating-file',
                    path: results.logdir + '/' + results.projectName + '.log',
                    period: '1d',
                    count: 7,
                    name: 'file',
                    level: 'debug'
                }]
            },
            sendemails: false,
            statsd: {
                host: results.statsdhost,
                port: results.statsdport,
                mock: !results.logMetrics
            },
            'i18n': {
                locales: ['en'],
                defaultLocale: 'en',
                directory: './i18n'
            }
        };
        let manifest = {
            plugins: {
                'hapi-bunyan': {
                    'logger': '',
                    'mergeData': true,
                    'includeTags': true,
                    'joinTags': ','
                },
                'lout': {},
                'tv': {},
                'hapi-require-https': {},
                'hapi-auth-basic': {},
                './server/common/plugins/connections': {
                    'mongo': {
                        'app': {
                            'url': results.mongodbUrl
                        }
                    }
                },
                './server/common/plugins/dbindexes': {
                    'dependencies': [
                        'MongoConnections',
                        'auth',
                        'AppRoutes'
                    ],
                    'modules': [
                        'users',
                        'users/roles',
                        'users/session/auth-attempts',
                        'users/notifications',
                        'user-groups',
                        'blogs',
                        'blogs/posts',
                        'meal-plans',
                        'meal-plans/grocery-list',
                        'audit'
                    ]
                },
                './server/common/plugins/auth': {},
                './server/common/plugins/i18n': {},
                './server/common/plugins/metrics': {},
                './server/common/plugins/app-routes': {
                    'prependRoute': '/api',
                    'modules': [
                        './server/web/contact',
                        './server/users',
                        './server/users/session',
                        './server/users/session/auth-attempts',
                        './server/users/notifications',
                        './server/users/preferences',
                        './server/user-groups',
                        './server/blogs',
                        './server/blogs/posts',
                        './server/blogs/posts/meals',
                        './server/blogs/posts/recipes',
                        './server/meal-plans',
                        './server/meal-plans/grocery-list',
                        './server/audit'
                    ]
                }
            },
            connections: [{
                port: 8000,
                labels: ['http']
            }, {
                port: 443,
                labels: ['secure', 'api'],
                tls: {
                    key: results.keyfile,
                    cert: results.certfile
                }
            }],
            server: {
                connections: {
                    routes: {
                        security: true
                    }
                }
            }
        };
        Fs.writeFileSync('./server/.opts', JSON.stringify(opts, null, 4));
        Fs.writeFileSync('./server/manifest.json', JSON.stringify(manifest, null, 4));
        return results;
    })
    .then(() => {
        console.log('Setup complete.');
        process.exit(0);
    })
    .catch((err) => {
        if (err) {
            console.error('Setup failed.');
            console.error(err);
            return process.exit(1);
        }
    });

/*eslint-enable no-process-exit*/
