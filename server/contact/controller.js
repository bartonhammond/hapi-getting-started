'use strict';
let Joi = require('joi');
let Config = require('./../../config');
let ControllerFactory = require('./../common/controller-factory');
let mailer = require('./../common/plugins/mailer');
let utils = require('./../common/utils');
var Controller = new ControllerFactory()
    .forMethod('contact')
    .withValidation({
        payload: {
            name: Joi.string().required(),
            email: Joi.string().email().required(),
            message: Joi.string().required()
        }
    })
    .handleUsing(function contactHandler (request, reply) {
        let options = {
            subject: Config.projectName + ' contact form',
            to: Config.system.toAddress,
            replyTo: {
                name: request.payload.name,
                address: request.payload.email
            }
        };
        mailer.sendEmail(options, __dirname + '/contact.hbs.md', request.payload)
            .then(function () {
                reply({message: 'Success.'});
            })
            .catch(function (err) {
                utils.logAndBoom(err, reply);
            });
    })
    .doneConfiguring();
module.exports = Controller;