'use strict';
const moment = require('moment');
const {filter, flatten} = require('lodash');
const {lookupParamsOrPayloadOrQuery, org, buildQuery} = require('./../../common/utils');
const {canView, canUpdate, prePopulate, isMemberOf, areValidPosts, uniqueCheck, findValidator} = require('./../../common/prereqs');
const {buildCreateHandler, buildFindHandler, buildFindOneHandler, buildUpdateHandler} = require('./../../common/handlers');
const {sendNotifications, cancelNotifications} = require('./../../common/posthandlers');
const UserGroups = require('./../../user-groups/model');
const Blogs = require('./../model');
const schemas = require('./schemas');
const Posts = require('./model');
/*jshint unused:false*/
/*eslint-disable no-unused-vars*/
const sendNotificationsWhen = {
    'published'(post, request) {
        const blog = request.pre.blogs;
        return UserGroups.find({name: {$in: blog.subscriberGroups}, organisation: post.organisation})
            .then(groups => {
                const to = filter(flatten([blog.owners, blog.subscribers, groups.map(group => group.members)]));
                return {
                    to: to,
                    title: ['New Post {{postTitle}} created.', {postTitle: post.title}],
                    description: ['New Post {{postTitle}} in Blog {{blogTitle}} published by {{publishedBy}}',
                        {postTitle: post.title, publishedBy: post.publishedBy, blogTitle: blog.title}]
                };
            });
    },
    'pending review'(post, request) {
        const blog = request.pre.blogs;
        return {
            to: blog.owners,
            title: ['New Post {{postTitle}} needs your approval to be published.', {postTitle: post.title}],
            description: ['New Post {{postTitle}} in Blog {{blogTitle}} published by {{publishedBy}} needs your approval to be published',
                {postTitle: post.title, blogTitle: blog.title, publishedBy: post.publishedBy}],
            action: 'review',
            priority: 'medium'
        };
    },
    'do not publish'(post, request) {
        const blog = request.pre.blogs;
        return {
            to: post.publishedBy,
            title: ['Post {{postTitle}} not approved for publication.', {postTitle: post.title}],
            description: ['Post {{postTitle}} in Blog {{blogTitle}} not allowed by {{reviewedBy}}',
                {postTitle: post.title, reviewedBy: post.reviewedBy, blogTitle: blog.title}]
        };
    },
    'draft'(post, request) {
        return {
            to: []
        };
    },
    'archived'(post, request) {
        return {
            to: []
        };
    }
};
/*jshint unused:true*/
/*eslint-enable no-unused-vars*/
module.exports = {
    new: {
        validate: schemas.controller.create,
        pre: [
            canUpdate(Posts.collection),
            uniqueCheck(Posts, request => {
                return {
                    blogId: lookupParamsOrPayloadOrQuery(request, 'blogId'),
                    organisation: org(request),
                    title: request.payload.title,
                    createdOn: {$gte: moment().subtract(300, 'seconds').toDate()}
                };
            }),
            prePopulate(Blogs, 'blogId'),
            isMemberOf(Blogs, ['contributors', 'owners']),
            areValidPosts(['content.recipes'])
        ],
        handler: buildCreateHandler(Posts),
        post: [
            sendNotifications(Posts, (post, request) => sendNotificationsWhen[post.state](post, request))
        ]
    },
    find: {
        validate: findValidator(schemas.controller.find),
        pre: [
            canView(Posts.collection)
        ],
        handler: buildFindHandler(Posts, request => {
            if (lookupParamsOrPayloadOrQuery(request, 'blogTitle')) {
                return Blogs.find(buildQuery(request, {forPartial: [['blogTitle', 'title']]}))
                    .then(blogs => {
                        request.query.blogId = blogs.map(blog => blog._id);
                        return buildQuery(request, schemas.controller.findOptions);
                    });
            } else {
                return buildQuery(request, schemas.controller.findOptions);
            }
        })
    },
    findOne: {
        pre: [
            canView(Posts.collection),
            prePopulate(Posts, 'id')
        ],
        handler: buildFindOneHandler(Posts)
    },
    update: {
        validate: schemas.controller.update,
        pre: [
            canUpdate(Posts.collection),
            prePopulate(Posts, 'id'),
            prePopulate(Blogs, 'blogId'),
            isMemberOf(Blogs, ['contributors', 'owners'])
        ],
        handler: buildUpdateHandler(Posts, 'update')
    },
    publish: {
        validate: schemas.controller.publish,
        pre: [
            canUpdate(Posts.collection),
            prePopulate(Posts, 'id'),
            prePopulate(Blogs, 'blogId'),
            isMemberOf(Blogs, ['contributors', 'owners'])
        ],
        handler: buildUpdateHandler(Posts, 'publish'),
        post: [
            sendNotifications(Posts, (post, request) => sendNotificationsWhen[post.state](post, request)),
            cancelNotifications(Posts, 'review')
        ]
    },
    reject: {
        validate: schemas.controller.reject,
        pre: [
            canUpdate(Posts.collection),
            prePopulate(Posts, 'id'),
            prePopulate(Blogs, 'blogId'),
            isMemberOf(Blogs, ['contributors', 'owners'])
        ],
        handler: buildUpdateHandler(Posts, 'reject'),
        post: [
            sendNotifications(Posts, (post, request) => sendNotificationsWhen[post.state](post, request)),
            cancelNotifications(Posts, 'review')
        ]
    },
    delete: {
        pre: [
            canUpdate(Posts.collection),
            prePopulate(Posts, 'id'),
            prePopulate(Blogs, 'blogId'),
            isMemberOf(Blogs, ['owners'])
        ],
        handler: buildUpdateHandler(Posts, 'del')
    }
};
