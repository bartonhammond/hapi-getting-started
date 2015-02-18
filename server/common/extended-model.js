'use strict';
var BaseModel = require('hapi-mongo-models').BaseModel;
var Promise = require('bluebird');
var _ = require('lodash');
var logger = require('./../manifest').logger;

var ExtendedModel = BaseModel.extend({
});

var defaultcb = function (resolve, reject) {
    return function (err, doc) {
        err ? reject(err) : resolve(doc);
    };
};

ExtendedModel._find = function (conditions) {
    var self = this;
    return new Promise(function (resolve, reject) {
        self.find(conditions, defaultcb(resolve, reject));
    });
};

ExtendedModel._findOne = function (conditions) {
    var self = this;
    return new Promise(function (resolve, reject) {
        self.findOne(conditions, defaultcb(resolve, reject));
    });
};

ExtendedModel._findByIdAndUpdate = function (id, obj) {
    var self = this;
    return new Promise(function (resolve, reject) {
        self.findByIdAndUpdate(id, obj, defaultcb(resolve, reject));
    });
};

ExtendedModel._count = function (query) {
    var self = this;
    return new Promise(function (resolve, reject) {
        self.count(query, defaultcb(resolve, reject));
    });
};

ExtendedModel._insert = function (document, notCreated) {
    var self = this;
    return new Promise(function (resolve, reject) {
        self.insert(document, function (err, docs) {
            if (err) {
                reject(err);
            } else {
                if (!docs) {
                    resolve(notCreated);
                } else {
                    resolve(docs[0]);
                }
            }
        });
    });
};

ExtendedModel._findByIdAndRemove = function (id) {
    var self = this;
    return new Promise(function (resolve, reject) {
        var collection = BaseModel.db.collection(self._collection);
        collection.findAndRemove({ _id: id }, function (err, doc) {
            if (err) {
                reject(err);
            } else {
                if (!doc) {
                    reject(new Error ('document not found'));
                } else {
                    resolve(doc);
                }
            }
        });
    });
};

ExtendedModel.areValid = function (property, toCheck, organisation) {
    var self = this;
    return new Promise(function (resolve, reject) {
        if (!toCheck || toCheck.length === 0) {
            resolve({});
        } else {
            var conditions = {};
            conditions[property] = {$in: toCheck};
            conditions.isActive = true;
            conditions.organisation = organisation;
            self._find(conditions)
                .then(function (docs) {
                    if (!docs) {
                        resolve({});
                    } else {
                        var results = Object.create(null);
                        _.forEach(docs, function (doc) {
                            results[doc[property]] = true;
                        });
                        _.forEach(toCheck, function (e) {
                            if (!results[e]) {
                                results[e] = false;
                            }
                        });
                        resolve(results);
                    }
                })
                .catch(function (err) {
                    reject(err);
                });
        }
    });
};

module.exports.ExtendedModel = ExtendedModel;

var CommonMixinAddRemove = function (roles) {
    return {
        _isMemberOf: function (role, email) {
            var self = this;
            return !!_.findWhere(self[role], email);
        },
        _find: function (role, toFind) {
            var self = this;
            return _.findWhere(self[role], toFind);
        },
        _findRoles: function (role) {
            return _.find(_.pairs(roles), function (pair) {
                return role.indexOf(pair[0]) !== -1;
            });
        },
        add: function (toAdd, role, by) {
            var self = this;
            var rolePair = self._findRoles(role);
            if (toAdd && toAdd.length > 0 && rolePair) {
                _.forEach(toAdd, function (memberToAdd) {
                    var found = _.findWhere(self[rolePair[1]], memberToAdd);
                    if (!found) {
                        self[rolePair[1]].push(memberToAdd);
                        self._audit('add ' + role, null, memberToAdd, by);
                    }
                });
            }
            return self;
        },
        remove: function (toRemove, role, by) {
            var self = this;
            var rolePair = self._findRoles(role);
            if (toRemove && toRemove.length > 0 && rolePair) {
                _.forEach(toRemove, function (memberToRemove) {
                    var found = _.remove(self[rolePair[1]], function (m) {
                        return m === memberToRemove;
                    });
                    if (found && found.length > 0) {
                        self._audit('remove ' + role, memberToRemove, null, by);
                    }
                });
            }
            return self;
        }
    };
};

module.exports.AddRemove = CommonMixinAddRemove;

var CommonMixinIsActive = {
    deactivate: function (by) {
        var self = this;
        return self.setIsActive(false, by);
    },
    reactivate: function (by) {
        var self = this;
        return self.setIsActive(true, by);
    }
};

module.exports.IsActive = CommonMixinIsActive;

var CommonMixinProperties = function (properties) {
    var ret = {};
    _.forEach(properties, function (property) {
        ret['set' + _.capitalize(property)] = function (newValue, by) {
            var self = this;
            if (!_.isUndefined(newValue) && !_.isEqual(self[property], newValue)) {
                self._audit(property, self[property], newValue, by);
                self[property] = newValue;
            }
            return self;
        };
    });
    return ret;
};

module.exports.Properties = CommonMixinProperties;

var CommonMixinSave = function (Model, Audit) {
    return {
        _logFn: function (start, end) {
            var self = this;
            logger.info({
                collection: Model._collection,
                id: self._id.toString(),
                start: start,
                end: end,
                elapsed: end - start
            });
            return self;
        },
        _saveAudit: function () {
            var self = this;
            return new Promise(function (resolve/*, reject*/) {
                if (self.audit && self.audit.length > 0) {
                    Promise.settle(_.map(self.audit, function (a) {
                        return Audit._insert(a, []);
                    }))
                        .then(function () {
                            self.audit = [];
                            resolve(self);
                        });
                } else {
                    resolve(self);
                }
            });
        },
        save: function () {
            var self = this;
            return new Promise(function (resolve, reject) {
                var start = Date.now();
                self._saveAudit()
                    .then(function () {
                        resolve(Model._findByIdAndUpdate(self._id, self));
                        self._logFn(start, Date.now());
                    })
                    .catch(function (err) {
                        reject(err);
                        self._logFn(start, Date.now());
                    })
                    .done();
            });
        }
    };
};

module.exports.Save = CommonMixinSave;

var CommonMixinAudit = function (type, idToUse) {
    return {
        _audit: function (action, oldValues, newValues, by) {
            var self = this;
            if (!self.audit) {
                self.audit = [];
            }
            self.audit.push({
                objectChangedType: type,
                objectChangedId: self[idToUse],
                action: action,
                origValues: oldValues,
                newValues: newValues,
                organisation: self.organisation,
                by: by,
                timestamp: new Date()
            });
            self.updatedBy = by;
            self.updatedOn = new Date();
            return self;
        }
    };
};

module.exports.Audit = CommonMixinAudit;
