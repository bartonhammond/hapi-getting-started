'use strict';
var _ = require('lodash');

var RouteFactory = function () {
    var self = this;
    self._canContinueConfiguring = function () {
        if (!self.addedToServer) {
            return self;
        } else {
            throw new Error('Route already configured, cannot modify now');
        }
    };
    self.newRoute = function () {
        self.addedToServer = false;
        if (self.route) {
            delete self.route;
        }
        self.route = {
            config: {}
        };
        return self;
    };
    self.forMethod = function (method) {
        if (self._canContinueConfiguring()) {
            self.route.method = method;
        }
        return self;
    };
    self.forGET = function () {
        return self.forMethod('GET');
    };
    self.forPUT = function () {
        return self.forMethod('PUT');
    };
    self.forPOST = function () {
        return self.forMethod('POST');
    };
    self.forDELETE = function () {
        return self.forMethod('DELETE');
    };
    self.onPath = function (path) {
        self.route.path = path;
        return self;
    };
    self.usingAuthStrategy = function (strategy) {
        if (self._canContinueConfiguring()) {
            self.route.config.auth = {
                strategy: strategy
            };
        }
        return self;
    };
    self.withValidation = function (validator) {
        if (self._canContinueConfiguring()) {
            self.route.config.validate = validator;
        }
        return self;
    };
    self.withPayloadValidation = function (validator) {
        if (self._canContinueConfiguring()) {
            self.route.config.validate = {payload: validator};
        }
        return self;
    };
    self.withQueryValidation = function (validator) {
        if (self._canContinueConfiguring()) {
            self.route.config.validate = {query: validator};
        }
        return self;
    };
    self.preProcessWith = function (preProcess) {
        if (self._canContinueConfiguring()) {
            if (!self.route.config.pre) {
                self.route.config.pre = [];
            }
            if (_.isArray(preProcess)) {
                preProcess.forEach(function (pre) {
                    self.route.config.pre.push(pre);
                });
            } else {
                self.route.config.pre.push(preProcess);
            }
        }
        return self;
    };
    self.handleUsing = function (handler) {
        if (self._canContinueConfiguring()) {
            self.route.handler = handler;
        }
        return self;
    };
    self.doneConfiguring = function () {
        if (!self.addedToServer) {
            self.addedToServer = true;
        } else {
            throw new Error('already registered route, create new route before registering with server again');
        }
        return self.route;
    };
    return self;
};

module.exports = new RouteFactory();