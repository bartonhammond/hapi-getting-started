'use strict';
var BaseModel = require('hapi-mongo-models').BaseModel;
var ObjectAssign = require('object-assign');
var Joi = require('joi');
var Uuid = require('node-uuid');
var Bcrypt = require('bcrypt');
var Promise = require('bluebird');
var Promisify = require('./../common/mixins/promisify');
var Insert = require('./../common/mixins/insert');
var AreValid = require('./../common/mixins/exist');
var Properties = require('./../common/mixins/properties');
var IsActive = require('./../common/mixins/is-active');
var Save = require('./../common/mixins/save');
var CAudit = require('./../common/mixins/audit');
var Roles = require('./../roles/model');
var _ = require('lodash');
var moment = require('moment');
var errors = require('./../common/errors');

var Users = BaseModel.extend({
    /* jshint -W064 */
    constructor: function user (attrs) {
        ObjectAssign(this, attrs);
        Object.defineProperty(this, '_roles', {
            writable: true,
            enumerable: false
        });
        Object.defineProperty(this, 'audit', {
            writable: true,
            enumerable: false
        });
    }
    /* jshint +W064 */
});

Users._collection = 'users';

Promisify(Users, ['find', 'findOne', 'pagedFind', 'findByIdAndUpdate', 'insert']);
_.extend(Users, new Insert('email', 'signup'));
_.extend(Users, new AreValid('email'));
_.extend(Users.prototype, new IsActive());
_.extend(Users.prototype, new Properties(['isActive', 'roles']));
_.extend(Users.prototype, new Save(Users));
_.extend(Users.prototype, new CAudit(Users._collection, 'email'));

Users.prototype.hasPermissionsTo = function hasPermissionsTo (performAction, onObject) {
    var self = this;
    var ret = !!_.find(self._roles, function (role) {
        return role.hasPermissionsTo(performAction, onObject);
    });
    return ret;
};
Users.prototype.hydrateRoles = function hydrateRoles () {
    var self = this;
    if (self._roles || !self.roles || self.roles.length === 0) {
        return Promise.resolve(self);
    } else {
        return Roles._find({name: {$in: self.roles}, organisation: self.organisation})
            .then(function (roles) {
                self._roles = roles;
                return self;
            });
    }
};
Users.prototype._invalidateSession = function invalidateSession () {
    var self = this;
    self.session = {};
    delete self.session;
    return self;
};
Users.prototype._newSession = function newSession () {
    var self = this;
    self.session = {
        key: Bcrypt.hashSync(Uuid.v4().toString(), 10),
        expires: moment().add(1, 'month').toDate()
    };
    return self;
};
Users.prototype.loginSuccess = function loginSuccess (ipaddress, by) {
    var self = this;
    self._newSession();
    delete self.resetPwd;
    return self._audit('login success', null, ipaddress, by);
};
Users.prototype.loginFail = function loginFail (ipaddress, by) {
    var self = this;
    self._invalidateSession();
    return self._audit('login fail', null, ipaddress, by);
};
Users.prototype.logout = function logout (ipaddress, by) {
    var self = this;
    self._invalidateSession();
    return self._audit('logout', null, ipaddress, by);
};
Users.prototype.resetPasswordSent = function resetPasswordSent (by) {
    var self = this;
    self.resetPwd = {
        token: Uuid.v4(),
        expires: Date.now() + 10000000
    };
    return self._audit('reset password sent', null, self.resetPwd, by);
};
Users.prototype.resetPassword = function resetPassword (newPassword, by) {
    var self = this;
    if (newPassword) {
        var oldPassword = self.password;
        var newHashedPassword = Bcrypt.hashSync(newPassword, 10);
        self.password = newHashedPassword;
        delete self.resetPwd;
        self._audit('reset password', oldPassword, newHashedPassword, by);
    }
    return self;
};
Users.prototype.stripPrivateData = function stripData () {
    var self = this;
    return {
        email: self.email,
        isLoggedIn: self.session.key ? true : false
    };
};
Users.prototype.afterLogin = function afterLogin () {
    var self = this;
    return {
        user: self.email,
        session: self.session,
        authHeader: 'Basic ' + new Buffer(self.email + ':' + self.session.key).toString('base64')
    };
};
Users.prototype.update = function update (doc, by) {
    var self = this;
    return self._invalidateSession()
        .setIsActive(doc.payload.isActive, by)
        .setRoles(doc.payload.roles, by)
        .resetPassword(doc.payload.password, by);
};

Users.schema = Joi.object().keys({
    _id: Joi.object(),
    email: Joi.string().email().required(),
    password: Joi.string().required(),
    organisation: Joi.string().required(),
    roles: Joi.array().items(Joi.string()).unique(),
    resetPwd: Joi.object().keys({
        token: Joi.string().required(),
        expires: Joi.date().required()
    }),
    session: Joi.object().keys({
        key: Joi.object(),
        expires: Joi.date()
    }),
    isActive: Joi.boolean().default(true),
    createdBy: Joi.string(),
    createdOn: Joi.date(),
    updatedBy: Joi.string(),
    updatedOn: Joi.date()
});

Users.indexes = [
    [{email: 1}, {unique: true}],
    [{email: 1, organisation: 1}, {unique: true}]
];

Users.create = function create (email, password, organisation) {
    var self = this;
    var hash = Bcrypt.hashSync(password, 10);
    var document = {
        email: email,
        password: hash,
        organisation: organisation,
        roles: ['readonly'],
        session: {},
        isActive: true,
        createdBy: email,
        createdOn: new Date(),
        updatedBy: email,
        updatedOn: new Date()
    };
    return self._insertAndAudit(document);
};

Users.findByCredentials = function findByCredentials (email, password) {
    var self = this;
    return self._findOne({email: email, isActive: true})
        .then(function (user) {
            if (!user) {
                return Promise.reject(new errors.UserNotFoundError({email: email}));
            }
            var passwordMatch = Bcrypt.compareSync(password, user.password);
            if (!passwordMatch) {
                return Promise.reject(new errors.IncorrectPasswordError({email: email}));
            }
            return user;
        });
};

Users.findBySessionCredentials = function findBySessionCredentials (email, key) {
    var self = this;
    return self._findOne({email: email, isActive: true})
        .then(function (user) {
            if (!user) {
                return Promise.reject(new errors.UserNotFoundError({email: email}));
            }
            if (!user.session || !user.session.key) {
                return Promise.reject(new errors.UserNotLoggedInError({email: email}));
            }
            if (moment().isAfter(user.session.expires)) {
                return Promise.reject(new errors.SessionExpiredError({email: email}));
            }
            var keyMatch = Bcrypt.compareSync(key, user.session.key) || key === user.session.key;
            if (!keyMatch) {
                return Promise.reject(new errors.SessionCredentialsNotMatchingError({email: email}));
            }
            return user.hydrateRoles();
        });
};

module.exports = Users;

