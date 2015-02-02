'use strict';
var relativeToServer = './../../../server/';
var relativeTo = './../../../';

var Users = require(relativeToServer + 'users/model');
var Audit = require(relativeToServer + 'audit/model');
var Fs = require('fs');
//var expect = require('chai').expect;
var tu = require('./../testutils');
var Code = require('code');   // assertion library
var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var before = lab.before;
var after = lab.after;
var beforeEach = lab.beforeEach;
var afterEach = lab.afterEach;
var expect = Code.expect;

describe('Users', function () {
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
                return Users.create('test.users@test.api', 'password123');
            })
            .then(function (newUser) {
                newUser.loginSuccess('test', 'test').done();
                done();
            })
            .catch(function (err) {
                if (err) {
                    done(err);
                }
            })
            .done();
    });

    it('should send back a not authorized when user is not logged in', function (done) {
        var authheader = '';
        Users._findOne({email: 'test.users@test.api'})
            .then(function (foundUser) {
                authheader = tu.authorizationHeader(foundUser);
                foundUser.logout('test', 'test');
            })
            .then(function () {
                var request = {
                    method: 'GET',
                    url: '/users',
                    headers: {
                        Authorization: authheader
                    }
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
    });

    it('should send back a not authorized when user does not have permissions to view', function (done) {
        var authheader = '';
        Users._findOne({email: 'test.users@test.api'})
            .then(function (foundUser) {
                authheader = tu.authorizationHeader(foundUser);
                foundUser.updateRoles([], 'test');
            })
            .then(function () {
                var request = {
                    method: 'GET',
                    url: '/users',
                    headers: {
                        Authorization: authheader
                    }
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
    });

    it('should send back users when requestor has permissions and is authenticated, Users:GET /users', function (done) {
        var authheader = '';
        Users._findOne({email: 'one@first.com'})
            .then(function (foundUser) {
                foundUser.loginSuccess('test', 'test').done();
                authheader = tu.authorizationHeader(foundUser);
            })
            .then(function () {
                var request = {
                    method: 'GET',
                    url: '/users',
                    headers: {
                        Authorization: authheader
                    }
                };
                server.inject(request, function (response) {
                    try {
                        expect(response.statusCode).to.equal(200);
                        expect(response.payload).to.exist();
                        done();
                    } catch (err) {
                        done(err);
                    }
                });
            });
    });

    describe('GET /users', function () {
        var authheader = '';
        beforeEach(function (done) {
            Users._findOne({email: 'one@first.com'})
                .then(function (foundUser) {
                    foundUser.loginSuccess('test', 'test').done();
                    authheader = tu.authorizationHeader(foundUser);
                });
            emails.push('test.users2@test.api');
            Users.create('test.users2@test.api', 'password123')
                .then(function (newUser) {
                    newUser.loginSuccess('test', 'test').done();
                    newUser.deactivate('test').done();
                    done();
                });
        });
        it('should give active users when isactive = true is sent', function (done) {
            var request = {
                method: 'GET',
                url: '/users?isActive="true"',
                headers: {
                    Authorization: authheader
                }
            };
            server.inject(request, function (response) {
                try {
                    expect(response.statusCode).to.equal(200);
                    expect(response.payload).to.exist();
                    expect(response.payload).to.not.contain('test.users2@test.api');
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
        it('should give inactive users when isactive = false is sent', function (done) {
            var request = {
                method: 'GET',
                url: '/users?isActive="false"',
                headers: {
                    Authorization: authheader
                }
            };
            server.inject(request, function (response) {
                try {
                    expect(response.statusCode).to.equal(200);
                    expect(response.payload).to.exist();
                    expect(response.payload).to.contain('test.users2@test.api');
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
        it('should give only the user whose email is sent in the parameter', function (done) {
            var request = {
                method: 'GET',
                url: '/users?email=one@first.com',
                headers: {
                    Authorization: authheader
                }
            };
            server.inject(request, function (response) {
                try {
                    expect(response.statusCode).to.equal(200);
                    expect(response.payload).to.exist();
                    expect(response.payload).to.not.contain('test.users2@test.api');
                    expect(response.payload).to.contain('one@first.com');
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
        it('should return both inactive and active users when nothing is sent', function (done) {
            var request = {
                method: 'GET',
                url: '/users',
                headers: {
                    Authorization: authheader
                }
            };
            server.inject(request, function (response) {
                try {
                    expect(response.statusCode).to.equal(200);
                    expect(response.payload).to.exist();
                    expect(response.payload).to.contain('test.users2@test.api');
                    expect(response.payload).to.contain('one@first.com');
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
    });

    describe('GET /users/{id}', function () {
        var authheader = '';
        var id = '';
        beforeEach(function (done) {
            Users._findOne({email: 'one@first.com'})
                .then(function (foundUser) {
                    foundUser.loginSuccess('test', 'test').done();
                    authheader = tu.authorizationHeader(foundUser);
                    id = foundUser._id.toString();
                    done();
                });
        });
        it('should only send back user with the id in params', function (done) {
            var request = {
                method: 'GET',
                url: '/users/' + id,
                headers: {
                    Authorization: authheader
                }
            };
            server.inject(request, function (response) {
                try {
                    expect(response.statusCode).to.equal(200);
                    expect(response.payload).to.exist();
                    expect(response.payload).to.contain(id);
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
        it('should send back not found when the user with the id in params is not found', function (done) {
            var request = {
                method: 'GET',
                url: '/users/abcdefabcdefabcdefabcdef',
                headers: {
                    Authorization: authheader
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
    });

    describe('PUT /users/{id}', function () {
        var authheader = '';
        var id = '';
        beforeEach(function (done) {
            Users._findOne({email: 'root'})
                .then(function (foundUser) {
                    return foundUser.loginSuccess('test', 'test');
                })
                .then(function (foundUser) {
                    authheader = tu.authorizationHeader(foundUser);
                    emails.push('test.users2@test.api');
                    return Users.create('test.users2@test.api', 'password123');
                })
                .then(function (newUser) {
                    newUser.loginSuccess('test', 'test').done();
                    id = newUser._id.toString();
                    done();
                });
        });
        it('should update is active, session should be deactivated and changes audited', function (done) {
            var request = {
                method: 'PUT',
                url: '/users/' + id,
                headers: {
                    Authorization: authheader
                },
                payload: {
                    isActive: false
                }
            };
            server.inject(request, function (response) {
                try {
                    expect(response.statusCode).to.equal(200);
                    Users._findOne({_id: server.plugins['hapi-mongo-models'].BaseModel.ObjectID(id)})
                        .then(function (foundUser) {
                            expect(foundUser.isActive).to.be.false();
                            expect(foundUser.session).to.not.exist();
                            return Audit.findUsersAudit({userId: foundUser.email, action: 'deactivate'});
                        })
                        .then(function (foundAudit) {
                            expect(foundAudit).to.exist();
                            done();
                        })
                        .done();
                } catch (err) {
                    done(err);
                }
            });
        });
        it('should update roles, session should be deactivated and changes audited', function (done) {
            var request = {
                method: 'PUT',
                url: '/users/' + id,
                headers: {
                    Authorization: authheader
                },
                payload: {
                    roles: ['readonly', 'limitedupd']
                }
            };
            server.inject(request, function (response) {
                try {
                    expect(response.statusCode).to.equal(200);
                    Users._findOne({_id: server.plugins['hapi-mongo-models'].BaseModel.ObjectID(id)})
                        .then(function (foundUser) {
                            expect(foundUser.roles).to.include(['readonly', 'limitedupd']);
                            expect(foundUser.session).to.not.exist();
                            return Audit.findUsersAudit({userId: foundUser.email, action: 'update roles'});
                        })
                        .then(function (foundAudit) {
                            expect(foundAudit).to.exist();
                            done();
                        })
                        .done();
                } catch (err) {
                    done(err);
                }
            });
        });
        it('should update password, session should be deactivated and changes audited', function (done) {
            var request = {
                method: 'PUT',
                url: '/users/' + id,
                headers: {
                    Authorization: authheader
                },
                payload: {
                    password: 'newpassword'
                }
            };
            server.inject(request, function (response) {
                try {
                    expect(response.statusCode).to.equal(200);
                    Users._findOne({_id: server.plugins['hapi-mongo-models'].BaseModel.ObjectID(id)})
                        .then(function (foundUser) {
                            expect(foundUser.session).to.not.exist();
                            return Audit.findUsersAudit({userId: foundUser.email, action: 'reset password'});
                        })
                        .then(function (foundAudit) {
                            expect(foundAudit).to.exist();
                            done();
                        })
                        .done();
                } catch (err) {
                    done(err);
                }
            });
        });
        it('should update roles, password and is active, session should be deactivated and all changes audited', function (done) {
            var request = {
                method: 'PUT',
                url: '/users/' + id,
                headers: {
                    Authorization: authheader
                },
                payload: {
                    isActive: true,
                    roles: ['readonly'],
                    password: 'newpassword'
                }
            };
            server.inject(request, function (response) {
                try {
                    expect(response.statusCode).to.equal(200);
                    Users._findOne({_id: server.plugins['hapi-mongo-models'].BaseModel.ObjectID(id)})
                        .then(function (foundUser) {
                            expect(foundUser.session).to.not.exist();
                            expect(foundUser.roles).to.include(['readonly']);
                            expect(foundUser.isActive).to.be.true();
                            done();
                        })
                        .done();

                } catch (err) {
                    done(err);
                }
            });
        });
    });

    afterEach(function (done) {
        tu.cleanup(emails, null, null, done);
    });

});

describe('Signup', function () {
    var server = null;
    var emails = [];

    beforeEach(function (done) {
        tu.setupServer()
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

    it('returns a conflict when you try to signup with user that already exists', function (done) {
        var request = {
            method: 'POST',
            url: '/signup',
            payload: {
                email: 'one@first.com',
                password: 'try becoming the first'
            }
        };
        server.inject(request, function (response) {
            try {
                expect(response.statusCode).to.equal(409);
                done();
            } catch (err) {
                done(err);
            }
        });
    });

    it.skip('fails when the signup email send fails', function (done) {
        Fs.renameSync('./server/emails/welcome.hbs.md', './server/emails/welcome2.hbs.md');
        var request = {
            method: 'POST',
            url: '/signup',
            payload: {
                email: 'test.signup@signup.api',
                password: 'p4ssw0rd'
            }
        };
        emails.push(request.payload.email);
        server.inject(request, function (response) {
            try {
                Fs.renameSync('./server/emails/welcome2.hbs.md', './server/emails/welcome.hbs.md');
                expect(response.statusCode).to.equal(500);
                done();
            } catch (err) {
                done(err);
            }
        });
    });

    it('creates a user succesfully if all validations are complete. The user has a valid session, user email is sent, and user audit shows signup, loginSuccess records', function (done) {
        var request = {
            method: 'POST',
            url: '/signup',
            payload: {
                email: 'test.signup2@signup.api',
                password: 'an0th3r1'
            }
        };
        emails.push(request.payload.email);
        server.inject(request, function (response) {
            try {
                expect(response.statusCode).to.equal(200);
                var p1 = Users._findOne({email: 'test.signup2@signup.api'})
                    .then(function (foundUser) {
                        expect(foundUser).to.exist();
                        expect(foundUser.session).to.exist();
                    });
                var p2 = Audit.findUsersAudit({userId: 'test.signup2@signup.api',action:'signup'})
                    .then(function(foundSignup) {
                        expect(foundSignup).to.exist();
                        expect(foundSignup[0].newValues).to.include('test.signup2@signup.api');
                    });
                var p3 = Audit.findUsersAudit({userId: 'test.signup2@signup.api',action:'login success'})
                    .then(function(foundLogin) {
                        expect(foundLogin).to.exist();
                    });
                Promise.join(p1, p2, p3, function (v1, v2, v3) {
                    done();
                });
            } catch (err) {
                done(err);
            }
        });
    });

    afterEach(function (done) {
        tu.cleanup(emails, null, null, done);
    });

});
