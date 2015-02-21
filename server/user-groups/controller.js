'use strict';
var _ = require('lodash');
var Joi = require('joi');
var AuthPlugin = require('./../common/auth');
var UserGroups = require('./model');
var Users = require('./../users/model');
var BaseController = require('./../common/controller').BaseController;
var areValid = require('./../common/controller').areValid;
var validAndPermitted = require('./../common/controller').validAndPermitted;

var Controller = {};

Controller.find = BaseController.find('user-groups', UserGroups, {
    query: {
        email: Joi.string(),
        groupName: Joi.string(),
        isActive: Joi.string()
    }
}, function (request) {
    var query = {};
    var fields = [['email', 'members'], ['groupName', 'name']];
    _.forEach(fields, function (pair) {
        if (request.query[pair[0]]) {
            query[pair[1]] = {$regex: new RegExp('^.*?' + request.query[pair[0]] + '.*$', 'i')};
        }
    });
    return query;
});

Controller.findOne = BaseController.findOne('user-groups', UserGroups);

Controller.update = BaseController.update('user-groups', UserGroups, {
    payload: {
        isActive: Joi.boolean(),
        addedMembers: Joi.array().includes(Joi.string()).unique(),
        removedMembers: Joi.array().includes(Joi.string()).unique(),
        addedOwners: Joi.array().includes(Joi.string()).unique(),
        removedOwners: Joi.array().includes(Joi.string()).unique(),
        description: Joi.string(),
        access: Joi.string().valid(['restricted', 'public'])
    }
}, [{assign: 'validAndPermitted', method: validAndPermitted(UserGroups, 'id', ['owners'])},
    {assign: 'validMembers', method: areValid(Users, 'email', 'addedMembers')},
    {assign: 'validOwners', method: areValid(Users, 'email', 'addedOwners')}
], 'update');

Controller.new = BaseController.new('user-groups', UserGroups, {
    payload: {
        name: Joi.string().required(),
        members: Joi.array().includes(Joi.string()),
        owners: Joi.array().includes(Joi.string()),
        description: Joi.string(),
        access: Joi.string().valid(['restricted', 'public'])
    }
}, [
    {assign: 'validMembers', method: areValid(Users, 'email', 'members')},
    {assign: 'validOwners', method: areValid(Users, 'email', 'owners')}
], function (request) {
    return {
        name: request.payload.name,
        organisation: request.auth.credentials.user.organisation
    };
});

Controller.delete = BaseController.delete('user-groups', UserGroups);
Controller.delete.pre.push({assign: 'validAndPermitted', method: validAndPermitted(UserGroups, 'id', ['owners'])});

Controller.join = BaseController.update('user-groups', UserGroups, {
    payload: {
        addedMembers: Joi.array().includes(Joi.string()).unique()
    }
}, [
    AuthPlugin.preware.ensurePermissions('view', 'user-groups'),
    {assign: 'validMembers', method: areValid(Users, 'email', 'addedMembers')}
], 'join');

Controller.approve = BaseController.update('user-groups', UserGroups, {
    payload: {
        addedMembers: Joi.array().includes(Joi.string()).unique()
    }
}, [
    {assign: 'validAndPermitted', method: validAndPermitted(UserGroups, 'id', ['owners'])},
    {assign: 'validMembers', method: areValid(Users, 'email', 'addedMembers')}
], 'approve');

Controller.reject = BaseController.update('user-groups', UserGroups, {
    payload: {
        addedMembers: Joi.array().includes(Joi.string()).unique()
    }
}, [
    {assign: 'validAndPermitted', method: validAndPermitted(UserGroups, 'id', ['owners'])},
    {assign: 'validMembers', method: areValid(Users, 'email', 'addedMembers')}
], 'reject');

module.exports.Controller = Controller;
