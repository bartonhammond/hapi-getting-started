'use strict';
var _ = require('lodash');
var errors = require('./../errors');

module.exports = function isMemberOf (Model, groups) {
    return {
        assign: 'isMemberOf' + _.capitalize(Model._collection) + '(' + groups.join(',') + ')',
        method: function isMemberOfPermittedGroup (request, reply) {
            var obj = request.pre[Model._collection];
            var user = request.auth.credentials.user.email;
            if (user === 'root' || !!_.find(groups, function (role) {
                    return obj._isMemberOf(role, user);
                })
            ) {
                reply(true);
            } else {
                reply(new errors.NotAMemberOfValidGroupError({owners: JSON.stringify(groups)}));
            }
            return {message: 'not permitted'};
        }
    };
};
