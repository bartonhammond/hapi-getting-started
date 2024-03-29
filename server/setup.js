'use strict';
/*eslint-disable no-process-exit*/
const fs = require('fs');
const Bluebird = require('bluebird');
const {prompt} = require('promptly');
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
    logdir: './logs',
    logMetrics: false,
    certfile: './build/cert.pem',
    keyfile: './build/key.pem',
    influxdbHost: 'localhost',
    influxdbHttpPort: 8086,
    influxdbUdpPort: 8088,
    influxdbDatabase: 'frame',
    influxdbShellCmd: '$HOME/opt/influxdb/versions/0.9.4.2/influx'
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
    .then(results => fromStdIn(results, 'mongodbUrl', `MongoDB URL: (mongodb://localhost:27017/${results.projectName}) `,{'default': `mongodb://localhost:27017/${results.projectName}`}))
    .then(results => fromStdIn(results, 'rootEmail', 'Root email: (root)',{'default': 'root'}))
    .then(results => fromStdIn(results, 'rootPassword', 'Root user password: ', {'default': ''}))
    .then(results => fromStdIn(results, 'smtpHost', 'SMTP host: (smtp.gmail.com) ', {'default': 'smtp.gmail.com'}))
    .then(results => fromStdIn(results, 'smtpPort', 'SMTP port: (465) ', {'default': 465}))
    .then(results => fromStdIn(results, 'smtpUsername', `SMTP username: (${results.rootEmail}) `, {'default': results.systemEmail}))
    .then(results => fromStdIn(results, 'smtpPassword', 'SMTP password: ', {'default': ''}))
    .then(results => fromStdIn(results, 'influxdbHost', 'influxdb host: (localhost) ', {'default': 'localhost'}))
    .then(results => fromStdIn(results, 'influxdbHttpPort', 'influxdb http port: (8086)', {'default': 8086}))
    .then(results => fromStdIn(results, 'influxdbUdpPort', 'influxdb udp port: (8088) ', {'default': 8088}))
    .then(results => fromStdIn(results, 'influxdbDatabase', 'influxdb database: (frame) ', {'default': 'frame'}))
    .then(results => fromStdIn(results, 'influxdbShellCmd', 'influxdb shell cmd: (/opt/influxdb/influx) ', {'default': '$HOME/opt/influxdb/versions/0.9.4.2/influx'}))
    .then(results => fromStdIn(results, 'logdir', 'log directory: ', {'default': './logs'}))
    .then(results => fromStdIn(results, 'certfile', 'certificate file for https: ', {'default': './.secure/cert.pem'}))
    .then(results => fromStdIn(results, 'keyfile', 'key file for https: ', {'default': './.secure/key.pem'}))
    .then(results => {
        console.log(`setting up with - ${JSON.stringify(results)}`);
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
                    path: `${results.logdir}/${results.projectName}.log`,
                    period: '1d',
                    count: 7,
                    name: 'file',
                    level: 'debug'
                }]
            },
            influxdb: {
                host: results.influxdbHost,
                httpport: results.influxdbHttpPort,
                udpport: results.influxdbUdpPort,
                database: results.influxdbDatabase,
                shellCmd: results.influxdbShellCmd
            },
            sendemails: false,
            i18n: {
                locales: ['en'],
                defaultLocale: 'en',
                directory: './build/i18n'
            },
            manifest: {
                plugins: {
                    'hapi-bunyan': {
                        logger: '',
                        mergeData: true,
                        includeTags: true,
                        joinTags: ','
                    },
                    inert: {},
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
                        prependRoute: '/api',
                        modules: [
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
            }
        };
        fs.writeFileSync('./server/options.json', JSON.stringify(opts, null, 4));
        console.log(`options.json - ${JSON.stringify(opts, null, 4)}`);
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
