'use strict';
const {get, flatten, filter, capitalize, find} = require('lodash');
const Bluebird = require('bluebird');
const Joi = require('joi');
const {hasItems, org, logAndBoom, user, by, lookupParamsOrPayloadOrQuery, ip, timing} = require('./utils');
import {NotValidUsersOrGroupsError, NoPermissionsForActionError, NotAMemberOfValidGroupError,
    ObjectAlreadyExistsError, NotObjectOwnerError, ObjectNotFoundError, AbusiveLoginAttemptsError} from './errors';
const Users = require('./../users/model');
const AuthAttempts = require('./../users/session/auth-attempts/model');
const UserGroups = require('./../user-groups/model');
const Posts = require('./../blogs/posts/model');
function buildAreValid(Model, pldPropToLookup) {
    const tags = {collection: Model.collection, method: 'areValid', type: 'pre'};
    return function areValid(request, reply) {
        const start = Date.now();
        let toLookup = filter(flatten(pldPropToLookup.map(pldProp => get(request.payload, pldProp.split('.')))));
        if (hasItems(toLookup)) {
            Model.areValid(toLookup, org(request))
                .then(validated => {
                    const msg = toLookup.map(a => !validated[a] ? a.toString() + ',' : '').join('');
                    return (msg.indexOf(',') > -1) ? Bluebird.reject(new NotValidUsersOrGroupsError({msg})) : true;
                })
                .catch(logAndBoom)
                .then(reply)
                .finally(() => {
                    timing('handler', tags, {elapsed: Date.now() - start});
                });
        } else {
            timing('handler', tags, {elapsed: Date.now() - start});
            reply(true);
        }
    };
}
module.exports.areValidUsers = function areValidUsers(payloadPropertiesToLookup) {
    return {
        assign: 'validUsers',
        method: buildAreValid(Users, payloadPropertiesToLookup)
    };
};
module.exports.areValidGroups = function areValidGroups(payloadPropertiesToLookup) {
    return {
        assign: 'validUserGroups',
        method: buildAreValid(UserGroups, payloadPropertiesToLookup)
    };
};
module.exports.areValidPosts = function areValidPosts(payloadPropertiesToLookup) {
    return {
        assign: 'validPosts',
        method: buildAreValid(Posts, payloadPropertiesToLookup)
    };
};
function ensurePermissions(action, object) {
    const tags = {collection: object, method: 'ensurePermissions', type: 'pre'};
    return {
        assign: 'ensurePermissions',
        method(request, reply) {
            const start = Date.now();
            reply(
                !user(request).hasPermissionsTo(action, object) ?
                    new NoPermissionsForActionError({action, object, user: by(request)}) :
                    true
            );
            timing('handler', tags, {elapsed: Date.now() - start});
        }
    };
}
module.exports.canView = function canView(object) {
    return ensurePermissions('view', object);
};
module.exports.canUpdate = function canUpdate(object) {
    return ensurePermissions('update', object);
};
module.exports.isMemberOf = function isMemberOf(Model, groups) {
    const tags = {collection: Model.collection, method: 'isMemberOf', type: 'pre'};
    return {
        assign: `isMemberOf${capitalize(Model.collection)}(${groups.join(',')})`,
        method(request, reply) {
            const start = Date.now();
            const obj = request.pre[Model.collection];
            const user = by(request);
            if (user === 'root' || !!find(groups, role => obj[`isPresentIn${role.split('.').map(capitalize).join('')}`](user))) {
                reply(true);
            } else {
                reply(new NotAMemberOfValidGroupError({owners: JSON.stringify(groups)}));
            }
            timing('handler', tags, {elapsed: Date.now() - start});
            return {message: 'not permitted'};
        }
    };
};
module.exports.uniqueCheck = function uniqueCheck(Model, queryBuilder) {
    const tags = {collection: Model.collection, method: 'uniqueCheck', type: 'pre'};
    return {
        assign: 'uniqueCheck',
        method(request, reply) {
            const start = Date.now();
            Model.findOne(queryBuilder(request))
                .then(f => f ? Bluebird.reject(new ObjectAlreadyExistsError()) : true)
                .catch(logAndBoom)
                .then(reply)
                .finally(() => {
                    timing('handler', tags, {elapsed: Date.now() - start});
                });
        }
    };
};
module.exports.onlyOwner = function onlyOwner(Model) {
    const tags = {collection: Model.collection, method: 'onlyOwner', type: 'pre'};
    return {
        assign: 'allowedToViewOrEditPersonalInfo',
        method(request, reply) {
            const start = Date.now();
            const u = by(request);
            if ((request.pre[Model.collection].email === u) || (u === 'root')) {
                reply(true);
            } else {
                reply(new NotObjectOwnerError({email: u}));
            }
            timing('handler', tags, {elapsed: Date.now() - start});
        }
    };
};
module.exports.prePopulate = function prePopulate(Model, idToUse) {
    const tags = {collection: Model.collection, method: 'prePopulate', type: 'pre'};
    return {
        assign: Model.collection,
        method(request, reply) {
            const start = Date.now();
            const id = lookupParamsOrPayloadOrQuery(request, idToUse);
            Model.findOne({_id: Model.ObjectID(id)})
                .then(obj => !obj ?
                    Bluebird.reject(new ObjectNotFoundError({
                        type: capitalize(Model.collection),
                        idstr: id.toString()
                    })) : obj)
                .catch(logAndBoom)
                .then(reply)
                .finally(() => {
                    timing('handler', tags, {elapsed: Date.now() - start});
                });
        }
    };
};
module.exports.abuseDetected = function abuseDetected() {
    const tags = {collection: 'User', method: 'abuseDetected', type: 'pre'};
    return {
        assign: 'abuseDetected',
        method(request, reply) {
            const start = Date.now();
            AuthAttempts.abuseDetected(ip(request), request.payload.email)
                .then(detected => detected ? Bluebird.reject(new AbusiveLoginAttemptsError()) : false)
                .catch(logAndBoom)
                .then(reply)
                .finally(() => {
                    timing('handler', tags, {elapsed: Date.now() - start});
                });
        }
    };
};
module.exports.findValidator = function findValidator(validator, sort = '-updatedOn', limit = 5, page = 1) {
    validator.query.fields = Joi.string();
    validator.query.sort = Joi.string().default(sort);
    validator.query.limit = Joi.number().default(limit);
    validator.query.page = Joi.number().default(page);
    return validator;
};
