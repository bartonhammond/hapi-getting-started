'use strict';
var relativeToServer = './../../../server/';
var relativeTo = './../../../';

var Config = require(relativeTo + 'config');
var Users = require(relativeToServer + 'users/model');
var Audit = require(relativeToServer + 'audit/model');
var Promise = require('bluebird');
var AuthAttempts = require(relativeToServer + 'auth-attempts/model');
//var expect = require('chai').expect;
var tu = require('./../testutils');
var Code = require('code');   // assertion library
var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var beforeEach = lab.beforeEach;
var afterEach = lab.afterEach;
var expect = Code.expect;

describe('Login', function () {
    var server = null;
    var emails = [];
    beforeEach(function (done) {
        server = tu.setupServer()
            .then(function (s) {
                server = s;
                return tu.setupRolesAndUsers();
            })
            .then(function () {
                emails.push('test.users@test.api');
                return Users.create('test.users@test.api', 'password123', 'silver lining');
            })
            .then(function (newUser) {
                newUser.loginSuccess('test', 'test').save();
                done();
            })
            .catch(function (err) {
                if (err) {
                    done(err);
                }
            })
            .done();
    });

    describe('POST /login', function () {
        it('returns early when abuse is detected', function (done) {
            var authAttemptsConfig = Config.authAttempts;
            var authSpam = [];
            var authRequest = function () {
                return new Promise(function (resolve/*, reject*/) {
                    AuthAttempts.create('', 'test.users@test.api')
                        .then(function () {
                            resolve(true);
                        })
                        .catch(function () {
                            resolve(false);
                        });
                });
            };
            for (var i = 0; i < authAttemptsConfig.forIpAndUser + 1; i++) {
                authSpam.push(authRequest());
            }
            Promise.all(authSpam)
                .then(function () {
                    var request = {
                        method: 'POST',
                        url: '/login',
                        payload: {
                            email: 'test.users@test.api',
                            password: 'password123'
                        }
                    };
                    server.inject(request, function (response) {
                        try {
                            expect(response.statusCode).to.equal(429);
                            done();
                        } catch (err) {
                            done(err);
                        }
                    });
                });
        });

        it('returns an error when you pass incorrect credentials', function (done) {
            var request = {
                method: 'POST',
                url: '/login',
                payload: {
                    email: 'test.users@test.api',
                    password: 'bogus'
                }
            };
            server.inject(request, function (response) {
                try {
                    expect(response.statusCode).to.equal(401);
                    AuthAttempts._find({email: 'test.users@test.api'})
                        .then(function (aa) {
                            expect(aa).to.exist();
                            expect(aa.length).to.equal(1);
                            return Audit.findAudit('Users', 'test.users@test.api', {action: 'login fail'});
                        })
                        .then(function (foundAudit) {
                            expect(foundAudit).to.exist();
                            done();
                        });
                } catch (err) {
                    done(err);
                }
            });
        });

        it('returns an error when you pass non existent user', function (done) {
            var request = {
                method: 'POST',
                url: '/login',
                payload: {
                    email: 'test.unknown@test.api',
                    password: 'bogus'
                }
            };
            server.inject(request, function (response) {
                try {
                    expect(response.statusCode).to.equal(404);
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });

        it('returns a session successfully', function (done) {
            var request = {
                method: 'POST',
                url: '/login',
                payload: {
                    email: 'test.users@test.api',
                    password: 'password123'
                }
            };
            server.inject(request, function (response) {
                try {
                    expect(response.statusCode).to.equal(200);
                    expect(response.payload).to.exist();
                    expect(response.payload).to.contain('test.users@test.api');
                    Audit.findAudit('Users', 'test.users@test.api', {action: 'login success'})
                        .then(function (foundAudit) {
                            expect(foundAudit).to.exist();
                            done();
                        });
                } catch (err) {
                    done(err);
                }
            });
        });
    });

    describe('POST /login/forgot', function () {
        it('returns an error when user does not exist', function (done) {
            var request = {
                method: 'POST',
                url: '/login/forgot',
                payload: {
                    email: 'test.unknown@test.api'
                }
            };
            server.inject(request, function (response) {
                try {
                    expect(response.statusCode).to.equal(200);
                    expect(response.payload).to.contain('Success');
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });

        it('successfully sends a reset password request', function (done) {
            var request = {
                method: 'POST',
                url: '/login/forgot',
                payload: {
                    email: 'test.users@test.api'
                }
            };
            server.inject(request, function (response) {
                try {
                    expect(response.statusCode).to.equal(200);
                    expect(response.payload).to.contain('Success');
                    Audit.findAudit('Users', 'test.users@test.api', {action: 'reset password sent'})
                        .then(function (foundAudit) {
                            expect(foundAudit).to.exist();
                            return Users._findOne({email: 'test.users@test.api'});
                        })
                        .then(function (foundUser) {
                            expect(foundUser.resetPwd).to.exist();
                            done();
                        });
                } catch (err) {
                    done(err);
                }
            });
        });
    });

    describe('POST /login/reset', function () {
        it('returns an error when user does not exist', function (done) {
            var request = {
                method: 'POST',
                url: '/login/reset',
                payload: {
                    key: 'abcdefgh-ijkl-mnop-qrst-uvwxyz123456',
                    email: 'test.unkown@test.api',
                    password: 'random'
                }
            };
            server.inject(request, function (response) {
                try {
                    expect(response.statusCode).to.equal(400);
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });

        it('returns a bad request if the key does not match', function (done) {
            Users._findOne({email: 'test.users@test.api'})
                .then(function (foundUser) {
                    return foundUser.resetPasswordSent('test').save();
                })
                .then(function () {
                    var request = {
                        method: 'POST',
                        url: '/login/reset',
                        payload: {
                            key: 'abcdefgh-ijkl-mnop-qrst-uvwxyz123456',
                            email: 'test.users@test.api',
                            password: 'password1234'
                        }
                    };
                    server.inject(request, function (response) {
                        try {
                            expect(response.statusCode).to.equal(400);
                            done();
                        } catch (err) {
                            done(err);
                        }
                    });
                });
        });

        it('successfully sets a password, invalidates session and logs user out', function (done) {
            var key = '';
            Users._findOne({email: 'test.users@test.api'})
                .then(function (foundUser) {
                    return foundUser.resetPasswordSent('test').save();
                })
                .then(function (foundUser) {
                    key = foundUser.resetPwd.token;
                })
                .then(function () {
                    var request = {
                        method: 'POST',
                        url: '/login/reset',
                        payload: {
                            key: key,
                            email: 'test.users@test.api',
                            password: 'password1234'
                        }
                    };
                    server.inject(request, function (response) {
                        try {
                            expect(response.statusCode).to.equal(200);
                            expect(response.payload).to.contain('Success');
                            Audit.findAudit('Users', 'test.users@test.api', {action: 'reset password'})
                                .then(function (foundAudit) {
                                    expect(foundAudit).to.exist();
                                    return Users._findOne({email: 'test.users@test.api'});
                                })
                                .then(function (foundUser) {
                                    expect(foundUser.resetPwd).to.not.exist();
                                    done();
                                });
                        } catch (err) {
                            done(err);
                        }
                    });
                });
        });
    });
    afterEach(function (done) {
        return tu.cleanup({ users: emails}, done);
    });
});

describe('Logout', function () {
    var server = null;
    var emails = [];

    beforeEach(function (done) {
        server = tu.setupServer()
            .then(function (s) {
                server = s;
                tu.setupRolesAndUsers();
                done();
            })
            .catch(function (err) {
                if (err) {
                    done(err);
                }
            })
            .done();
    });

    it('returns an error when no authorization is passed', function (done) {
        var request = {
            method: 'DELETE',
            url: '/logout'
        };
        server.inject(request, function (response) {
            try {
                expect(response.statusCode).to.equal(401);
                done();
            } catch (err) {
                done(err);
            }
        });
    });

    it('returns a not found when user does not exist', function (done) {
        var request = {
            method: 'DELETE',
            url: '/logout',
            headers: {
                Authorization: tu.authorizationHeader2('test.not.created@logout.api', '123')
            }
        };
        server.inject(request, function (response) {
            try {
                expect(response.statusCode).to.equal(401);
                emails.push('test.not.created@logout.api');
                done();
            } catch (err) {
                emails.push('test.not.created@logout.api');
                done(err);
            }
        });
    });

    it('returns a not found when user has already logged out', function (done) {
        var request = {
            method: 'DELETE',
            url: '/logout',
            headers: {
                Authorization: ''
            }
        };
        Users._findOne({email: 'one@first.com'})
            .then(function (foundUser) {
                return foundUser.loginSuccess('test', 'test').save();
            })
            .then(function (foundUser) {
                request.headers.Authorization = tu.authorizationHeader(foundUser);
                return foundUser.logout('test', 'test').save();
            })
            .done();
        server.inject(request, function (response) {
            try {
                expect(response.statusCode).to.equal(401);
                Users._findOne({email: 'one@first.com'})
                    .then(function (foundUser) {
                        foundUser.loginSuccess('test', 'test').save();
                        done();
                    })
                    .done();
            } catch (err) {
                done(err);
            }
        });
    });

    it('removes the authenticated user session successfully', function (done) {
        Users._findOne({email: 'one@first.com'})
            .then(function (foundUser) {
                return foundUser.loginSuccess('test', 'test').save();
            }).
            then(function (foundUser) {
                var request = {
                    method: 'DELETE',
                    url: '/logout',
                    headers: {
                        Authorization: ''
                    }
                };
                request.headers.Authorization = tu.authorizationHeader(foundUser);
                return request;
            })
            .then(function (request) {
                server.inject(request, function (response) {
                    try {
                        expect(response.statusCode).to.equal(200);
                        Users._findOne({email: 'one@first.com'})
                            .then(function (foundUser) {
                                expect(foundUser.session).to.not.exist();
                                foundUser.loginSuccess('test', 'test').save();
                                done();
                            });
                    } catch (err) {
                        done(err);
                    }
                });
            });
    });

    afterEach(function (done) {
        return tu.cleanup({users: emails}, done);
    });
});

