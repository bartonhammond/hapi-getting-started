'use strict';
/*eslint-disable no-process-exit*/
import fs from 'fs';
import Bluebird from 'bluebird';
import {prompt} from 'promptly';
const test = {
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
    logdir: './logs',
    logMetrics: false,
    statsdhost: '127.0.0.1',
    statsdport: 8125,
    certfile: './.secure/cert.pem',
    keyfile: './.secure/key.pem'
};
function fromStdIn(results, property, message, opts) {
    return new Bluebird((resolve, reject) => {
        if (process.env.NODE_ENV === 'test') {
            results[property] = test[property];
            resolve(results);
        } else {
            prompt(message, opts, (err, out) => {
                if (err) {
                    reject(err);
                } else {
                    results[property] = out || opts.default;
                    resolve(results);
                }
            });
        }
    });
}
fromStdIn({}, 'projectName', 'Project name: (hapistart) ', {'default': 'hapistart'})
    .then(results => fromStdIn(results,
        'mongodbUrl',
        'MongoDB URL: (mongodb://localhost:27017/' + results.projectName + ') ',
        {'default': 'mongodb://localhost:27017/' + results.projectName}
    ))
    .then(results => {
        results.rootEmail = 'root';
        return results;
    })
    .then(results => fromStdIn(results, 'rootPassword', 'Root user password: ', {'default': ''}))
    .then(results => fromStdIn(results, 'smtpHost', 'SMTP host: (smtp.gmail.com) ', {'default': 'smtp.gmail.com'}))
    .then(results => fromStdIn(results, 'smtpPort', 'SMTP port: (465) ', {'default': 465}))
    .then(results => fromStdIn(results, 'smtpUsername', 'SMTP username: (' + results.rootEmail + ') ', {'default': results.systemEmail}))
    .then(results => fromStdIn(results, 'smtpPassword', 'SMTP password: ', {'default': ''}))
    .then(results => fromStdIn(results, 'port', 'port: ', {'default': 3000}))
    .then(results => fromStdIn(results, 'logdir', 'log directory: ', {'default': './logs'}))
    .then(results => fromStdIn(results, 'logMetrics', 'capture metrics: ', {'default': true}))
    .then(results => fromStdIn(results, 'statsdhost', 'statsd host: ', {'default': '127.0.0.1'}))
    .then(results => fromStdIn(results, 'statsdport', 'statsd port: ', {'default': 8125}))
    .then(results => fromStdIn(results, 'certfile', 'certificate file for https: ', {'default': './secure/cert.pem'}))
    .then(results => fromStdIn(results, 'keyfile', 'key file for https: ', {'default': './secure/key.pem'}))
    .then(results => {
        console.log('setting up with - ' + JSON.stringify(results));
        const opts = {
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
        const manifest = {
            plugins: {
                'hapi-bunyan': {
                    'logger': '',
                    'mergeData': true,
                    'includeTags': true,
                    'joinTags': ','
                },
                'inert': {},
                'hapi-auth-basic': {},
                './build/common/plugins/connections': {
                    'mongo': {
                        'app': {
                            'url': results.mongodbUrl
                        }
                    }
                },
                './build/common/plugins/auth': {},
                './build/common/plugins/err-handler': {},
                './build/common/plugins/metrics': {},
                './build/common/plugins/app-routes': {
                    'prependRoute': '/api',
                    'modules': [
                        'web/contact',
                        'users',
                        'users/session',
                        'users/profile',
                        'users/session/auth-attempts',
                        'users/notifications',
                        'users/preferences',
                        'user-groups',
                        'blogs',
                        'blogs/posts',
                        'audit'
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
        fs.writeFileSync('./server/.opts', JSON.stringify(opts, null, 4));
        fs.writeFileSync('./server/manifest.json', JSON.stringify(manifest, null, 4));
        return results;
    })
    .then(() => {
        console.log('Setup complete.');
        process.exit(0);
    })
    .catch(err => {
        if (err) {
            console.error('Setup failed.');
            console.error(err);
            return process.exit(1);
        }
    });

/*eslint-enable no-process-exit*/