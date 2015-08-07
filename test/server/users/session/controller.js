'use strict';
/*eslint-disable no-unused-expressions*/
/*jshint -W079*/
let Bluebird = require('bluebird');
let Config = require('./../../../../server/config');
let Users = require('./../../../../server/users/model');
let Audit = require('./../../../../server/audit/model');
let AuthAttempts = require('./../../../../server/users/session/auth-attempts/model');
let tu = require('./../../testutils');
let expect = require('chai').expect;
describe('Session', () => {
    let server = null;
    let emails = [];
    before((done) => {
        tu.setupServer()
            .then((res) => {
                server = res.server;
            })
            .then(() => {
                emails.push('test.users@test.api');
                return Users.create('test.users@test.api', 'silver lining', 'password123', 'en');
            })
            .then((newUser) => {
                newUser.loginSuccess('test', 'test').save();
                done();
            })
            .catch((err) => {
                done(err);
            })
            .done();
    });
    describe('POST /session', () => {
        it('returns early when abuse is detected', (done) => {
            let authAttemptsConfig = Config.authAttempts;
            let authSpam = [];
            for (let i = 0; i < authAttemptsConfig.forIpAndUser + 1; i++) {
                authSpam.push(AuthAttempts.create('test', 'test.users@test.api'));
            }
            Bluebird.all(authSpam)
                .then(() => {
                    let request = {
                        method: 'POST',
                        url: '/session',
                        payload: {
                            email: 'test.users@test.api',
                            password: 'password123'
                        }
                    };
                    server.injectThen(request).then((response) => {
                        expect(response.statusCode).to.equal(429);
                        tu.cleanupAuthAttempts();
                        done();
                    }).catch((err) => {
                        done(err);
                    });
                });
        });
        it('returns an error when you pass incorrect credentials', (done) => {
            let request = {
                method: 'POST',
                url: '/session',
                payload: {
                    email: 'test.users@test.api',
                    password: 'bogus'
                }
            };
            server.injectThen(request).then((response) => {
                expect(response.statusCode).to.equal(401);
                AuthAttempts.find({email: 'test.users@test.api'})
                    .then((aa) => {
                        expect(aa).to.exist;
                        expect(aa.length).to.equal(1);
                        return Audit.findAudit('users', 'test.users@test.api', {'change.action': 'login fail'});
                    })
                    .then((foundAudit) => {
                        expect(foundAudit).to.exist;
                        done();
                    });
            }).catch((err) => {
                done(err);
            });
        });
        it('returns an error when you pass non existent user', (done) => {
            let request = {
                method: 'POST',
                url: '/session',
                payload: {
                    email: 'test.unknown@test.api',
                    password: 'bogus'
                }
            };
            server.injectThen(request).then((response) => {
                expect(response.statusCode).to.equal(404);
                done();
            }).catch((err) => {
                done(err);
            });
        });
        it('returns a session successfully', (done) => {
            let request = {
                method: 'POST',
                url: '/session',
                payload: {
                    email: 'test.users@test.api',
                    password: 'password123'
                }
            };
            server.injectThen(request).then((response) => {
                expect(response.statusCode).to.equal(200);
                expect(response.payload).to.exist;
                expect(response.payload).to.contain('test.users@test.api');
                Audit.findAudit('users', 'test.users@test.api', {'change.action': 'login success'})
                    .then((foundAudit) => {
                        expect(foundAudit).to.exist;
                        done();
                    });
            }).catch((err) => {
                done(err);
            });
        });
    });
    describe('DELETE /session', () => {
        it('returns an error when no authorization is passed', (done) => {
            let request = {
                method: 'DELETE',
                url: '/session'
            };
            server.injectThen(request).then((response) => {
                expect(response.statusCode).to.equal(401);
                done();
            }).catch((err) => {
                done(err);
            });
        });
        it('returns a not found when user does not exist', (done) => {
            let request = {
                method: 'DELETE',
                url: '/session',
                headers: {
                    Authorization: tu.authorizationHeader2('test.not.created@logout.api', '123')
                }
            };
            server.injectThen(request).then((response) => {
                expect(response.statusCode).to.equal(404);
                emails.push('test.not.created@logout.api');
                done();
            }).catch((err) => {
                emails.push('test.not.created@logout.api');
                done(err);
            });
        });
        it('returns a not found when user has already logged out', (done) => {
            let request = null;
            tu.findAndLogin('one@first.com')
                .then((u) => {
                    request = {
                        method: 'DELETE',
                        url: '/session',
                        headers: {
                            Authorization: u.authheader
                        }
                    };
                    return u.user.logout('test', 'test').save();
                })
                .then(() => {
                    server.injectThen(request).then((response) => {
                        expect(response.statusCode).to.equal(401);
                        Users.findOne({email: 'one@first.com'})
                            .then((foundUser) => {
                                foundUser.loginSuccess('test', 'test').save();
                                done();
                            });
                    }).catch((err) => {
                        done(err);
                    });
                });
        });
        it('removes the authenticated user session successfully', (done) => {
            tu.findAndLogin('one@first.com')
                .then((u) => {
                    let request = {
                        method: 'DELETE',
                        url: '/session',
                        headers: {
                            Authorization: u.authheader
                        }
                    };
                    server.injectThen(request).then((response) => {
                        expect(response.statusCode).to.equal(200);
                        Users.findOne({email: 'one@first.com'})
                            .then((foundUser) => {
                                expect(foundUser.session.length).to.equal(0);
                                foundUser.loginSuccess('test', 'test').save();
                                done();
                            });
                    }).catch((err) => {
                        done(err);
                    });
                });
        });
    });
    after((done) => {
        return tu.cleanup({users: emails}, done);
    });
});

