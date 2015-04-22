'use strict';
let _ = require('lodash');
let fs = require('fs');
let devnull = require('dev-null');
let Bunyan = require('bunyan');
let StatsD = require('node-statsd');
let i18n = require('i18n');
if (!fs.existsSync('.opts')) {
    console.log('.opts file missing. will exit');
    process.exit(1);
}
if (!fs.existsSync('manifest.json')) {
    console.log('manifest.json file missing. will exit');
    process.exit(1);
}
let args = JSON.parse(fs.readFileSync('.opts'));
let manifest = JSON.parse(fs.readFileSync('manifest.json'));
let nodemailer = {};
if (!args.sendemails) {
    nodemailer = {
        name: 'minimal',
        version: '0.1.0',
        send: (mail, callback) => {
            let input = mail.message.createReadStream();
            input.pipe(devnull());
            input.on('end', function () {
                callback(null, true);
            });
        }
    };
} else {
    nodemailer = args.nodemailer;
}
i18n.configure(args.i18n);
var config = {
    projectName: args.project,
    authAttempts: {
        forIp: 50,
        forIpAndUser: 7
    },
    nodemailer: nodemailer,
    logger: Bunyan.createLogger(args.bunyan),
    system: {
        fromAddress: {
            name: args.project,
            address: args.nodemailer.auth.user
        },
        toAddress: {
            name: args.project,
            address: args.nodemailer.auth.user
        }
    },
    storage: {
        diskPath: args.storage.diskPath
    },
    statsd: new StatsD(args.statsd),
    i18n: i18n,
    manifest: {
        plugins: manifest.plugins,
        server: manifest.server,
        connections: manifest.connections
    }
};

_.forEach(manifest.connections, (connection) => {
    if (connection.tls &&
        connection.tls.key &&
        connection.tls.key.length > 0 &&
        connection.tls.cert &&
        connection.tls.cert.length > 0 &&
        fs.existsSync(connection.tls.key) &&
        fs.existsSync(connection.tls.cert)) {
        connection.tls.key = fs.readFileSync(connection.tls.key);
        connection.tls.cert = fs.readFileSync(connection.tls.cert);
    } else {
        delete connection.tls;
    }
});

config.manifest.plugins['hapi-bunyan'].logger = config.logger;
module.exports = config;
