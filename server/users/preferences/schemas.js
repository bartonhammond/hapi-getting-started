'use strict';
import Joi from 'joi';
const channelSchema = Joi.object().keys({
    frequency: Joi.string().only('none', 'immediate', 'daily', 'weekly'),
    lastSent: Joi.date()
});
const notificationPrefSchema = Joi.object().keys({
    inapp: channelSchema,
    email: channelSchema,
    blocked: Joi.array().items(Joi.object())
});
const updateChannelSchema = Joi.object().keys({
    frequency: Joi.string().only('none', 'immediate', 'daily', 'weekly')
});
const notificationUpdatePrefSchema = Joi.object().keys({
    inapp: updateChannelSchema,
    email: updateChannelSchema,
    addedBlocked: Joi.array().items(Joi.object()),
    removedBlocked: Joi.array().items(Joi.object())
});
export default {
    dao: {
        isVirtualModel: true,
        updateMethod: {
            method: 'updatePreferences',
            props: [
                'preferences.notifications.blogs.inapp.frequency',
                'preferences.notifications.blogs.inapp.lastSent',
                'preferences.notifications.blogs.email.frequency',
                'preferences.notifications.blogs.email.lastSent',
                'preferences.notifications.posts.inapp.frequency',
                'preferences.notifications.posts.inapp.lastSent',
                'preferences.notifications.blogs.email.frequency',
                'preferences.notifications.blogs.email.lastSent',
                'preferences.notifications.userGroups.inapp.frequency',
                'preferences.notifications.userGroups.inapp.lastSent',
                'preferences.notifications.userGroups.email.frequency',
                'preferences.notifications.userGroups.email.lastSent',
                'preferences.locale'
            ],
            arrProps: [
                'preferences.notifications.blogs.blocked',
                'preferences.notifications.posts.blocked',
                'preferences.notifications.userGroups.blocked'
            ]
        }
    },
    model: {
        notifications: Joi.object().keys({
            blogs: notificationPrefSchema,
            posts: notificationPrefSchema,
            userGroups: notificationPrefSchema
        }),
        locale: Joi.string().only('en', 'hi')
    },
    controller: {
        update: {
            payload: {
                preferences: {
                    notifications: Joi.object().keys({
                        blogs: notificationUpdatePrefSchema,
                        posts: notificationUpdatePrefSchema,
                        userGroups: notificationUpdatePrefSchema
                    }),
                    locale: Joi.string().only('en', 'hi')
                }
            }
        }
    }
};