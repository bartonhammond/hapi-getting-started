'use strict';
var Joi = require('joi');
var Boom = require('boom');
var Users = require('./../users/model');
var AuthAttempts = require('./../auth-attempts/model');
var ControllerFactory = require('./../common/controller-factory');
var utils = require('./../common/utils');
var i18n = require('./../../config').i18n;
var errors = require('./../common/errors');

var abuseDetected = function abuseDetected (request, reply) {
    AuthAttempts.abuseDetected(request.info.remoteAddress, request.payload.email)
        .then(function (detected) {
            if (detected) {
                reply(Boom.tooManyRequests(i18n.__({
                    phrase: 'Maximum number of auth attempts reached. Please try again later.',
                    locale: utils.locale(request)
                })));
            } else {
                reply();
            }
        })
        .catch(function (err) {
            utils.logAndBoom(err, reply);
        });
};

var Controller = new ControllerFactory()
    .forMethod('login')
    .withValidation({
        payload: {
            email: Joi.string().required(),
            password: Joi.string().required()
        }
    })
    .preProcessWith([
        {assign: 'abuseDetected', method: abuseDetected}
    ])
    .handleUsing(function loginHandler (request, reply) {
        var email = request.payload.email;
        var password = request.payload.password;
        var ip = request.info.remoteAddress;
        Users.findByCredentials(email, password)
            .then(function (user) {
                return user.loginSuccess(ip, user.email).save();
            })
            .then(function (user) {
                reply(user.afterLogin());
            })
            .catch(errors.UserNotFoundError, errors.IncorrectPasswordError, function (err) {
                AuthAttempts.create(ip, email);
                reply(err.getBoomError(utils.locale(request)));
            })
            .catch(function (err) {
                utils.logAndBoom(err, reply);
            });
    })
    .forMethod('logout')
    .handleUsing(function logoutHandler(request, reply) {
        var user = request.auth.credentials.user;
        user.logout(request.info.remoteAddress, user.email).save()
            .then(function () {
                reply({message: 'Success.'});
            });
    })
    .doneConfiguring();

module.exports = Controller;
