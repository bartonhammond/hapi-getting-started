'use strict';
var Joi = require('joi');
var Boom = require('boom');
var BaseModel = require('hapi-mongo-models').BaseModel;
var _ = require('lodash');
var Promise = require('bluebird');
var Permissions = require('./model');
var AuthPlugin = require('./../common/auth');

var permissionCheck = function (request, reply) {
    var query = {
        action: request.payload.action,
        object: request.payload.object
    };
    Permissions._findOne(query)
        .then(function (permissions) {
            if (!permissions) {
                reply(Boom.conflict('Permissions already exist, modify the existing ones.'));
            } else {
                reply(true);
            }
        })
        .catch(function (err) {
            if (err) {
                reply(Boom.badImplementation(err));
            }
        })
        .done();
};

var Controller = {
};

Controller.find = {
    validator: {
        query: {
            user: Joi.string(),
            action: Joi.string(),
            object: Joi.string(),
            isActive: Joi.string(),
            fields: Joi.string(),
            sort: Joi.string(),
            limit: Joi.number().default(20),
            page: Joi.number().default(1)
        }
    },
    pre: [AuthPlugin.preware.ensurePermissions('view', 'permissions')],
    handler: function (request, reply) {
        var query = {};
        if (request.query.user) {
            query.users.user = new RegExp('^.*?' + request.query.user + '.*$', 'i');
        }
        if (request.query.action) {
            query.action = request.query.action;
        }
        if (request.query.object) {
            query.object = request.query.object;
        }
        if (request.query.isActive) {
            query.isActive = request.query.isActive === '"true"';
        }
        var fields = request.query.fields;
        var sort = request.query.sort;
        var limit = request.query.limit;
        var page = request.query.page;
        Permissions.pagedFind(query, fields, sort, limit, page, function (err, results) {
            if (err) {
                reply(Boom.badImplementation(err));
            } else {
                reply(results);
            }
        });
    }
};

Controller.findOne = {
    pre: [AuthPlugin.preware.ensurePermissions('view', 'permissions')],
    handler: function (request, reply) {
        Permissions._findOne({_id: BaseModel.ObjectID(request.params.id)})
            .then(function (permission) {
                if (!permission) {
                    reply(Boom.notFound('permission definition not found.'));
                } else {
                    reply(permission);
                }
            })
            .catch(function (err) {
                if (err) {
                    reply(Boom.badImplementation(err));
                }
            })
            .done();
    }
};

Controller.update = {
    validator: {
        payload: {
            isActive: Joi.boolean(),
            addedUsers: Joi.array().includes(Joi.string()),
            removedUsers: Joi.array().includes(Joi.string()),
            addedGroups: Joi.array().includes(Joi.string()),
            removedGroups: Joi.array().includes(Joi.string()),
            description: Joi.string()
        }
    },
    pre: [AuthPlugin.preware.ensurePermissions('update', 'permissions')],
    handler: function (request, reply) {
        Permissions._findOne({_id: BaseModel.ObjectID(request.params.id)})
            .then(function (permissions) {
                if (!permissions) {
                    reply(Boom.notFound('Permissions not found.'));
                } else {
                    var p = [permissions];
                    var by = request.auth.credentials.user.email;
                    if (request.payload.isActive === true) {
                        p.push(permissions.reactivate(by));
                    }
                    if (request.payload.isActive === false) {
                        p.push(permissions.deactivate(by));
                    }
                    if (request.payload.addedUsers) {
                        p.push(permissions.addUsers(request.payload.addedUsers, 'user', by));
                    }
                    if (request.payload.removedUsers) {
                        p.push(permissions.removeUsers(request.payload.removedUsers, 'user', by));
                    }
                    if (request.payload.addedGroups) {
                        p.push(permissions.addUsers(request.payload.addedGroups, 'group', by));
                    }
                    if (request.payload.removedGroups) {
                        p.push(permissions.removeUsers(request.payload.removedGroups, 'group', by));
                    }
                    if (request.payload.description) {
                        p.push(permissions.updateDesc(request.payload.description, by));
                    }
                    return Promise.all(p);
                }
            })
            .then(function (p) {
                reply(p[0]);
            })
            .catch(function (err) {
                if (err) {
                    reply(Boom.badImplementation(err));
                }
            })
            .done();
    }
};

Controller.new = {
    validator: {
        payload: {
            description: Joi.string().required(),
            users: Joi.array().includes(Joi.object().keys({
                user: Joi.string(),
                type: Joi.string().valid('user', 'group'),
                isActive: Joi.boolean().default(true)
            })),
            action: Joi.string().required(),
            object: Joi.string().required()
        }
    },
    pre: [
        AuthPlugin.preware.ensurePermissions('update', 'permissions'),
        {assign: 'permissionCheck', method: permissionCheck}
    ],
    handler: function (request, reply) {
        var by = request.auth.credentials.user.email;
        Permissions.create(request.payload.descriptions, request.payload.users, request.payload.action, request.payload.object, by)
            .then(function (permissions) {
                if (!permissions) {
                    reply(Boom.notFound('permissions could not be created.'));
                } else {
                    reply(permissions);
                }
            })
            .catch(function (err) {
                if (err) {
                    reply(Boom.badImplementation(err));
                }
            })
            .done();
    }
};

Controller.delete = {
    pre: [AuthPlugin.preware.ensurePermissions('update', 'permissions')],
    handler: function (request, reply) {
        Permissions._findOne({_id: BaseModel.ObjectID(request.params.id)})
            .then(function (permissions) {
                if (!permissions) {
                    reply(Boom.notFound('Permissions not found.'));
                } else {
                    var by = request.auth.credentials.user.email;
                    reply(permissions.deactivate(by));
                }
            })
            .catch(function (err) {
                if (err) {
                    reply(Boom.badImplementation(err));
                }
            })
            .done();
    }
};

module.exports.Controller = Controller;