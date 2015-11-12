'use strict';
import {unique, flatten, isArray} from 'lodash';
import Bluebird from 'bluebird';
import {build} from './../../common/dao';
import schemas from './schemas';
class Notifications {
    constructor(attrs) {
        this.init(attrs);
    }
    static createOne (email, organisation, objectType, objectId, title, state, action, priority, content, by) {
        return Notifications.upsert({
            email,
            organisation,
            objectType,
            objectId,
            title,
            state,
            action,
            priority,
            content,
            isActive: true,
            createdBy: by,
            createdOn: new Date(),
            updatedBy: by,
            updatedOn: new Date()
        });
    }
    static createMany(email, organisation, objectType, objectId, title, state, action, priority, content, by) {
        return Bluebird.all(unique(flatten(email)).map(e =>
                Notifications.createOne(e, organisation, objectType, objectId, title, state, action, priority, content, by))
        );
    }
    static create(email, organisation, objectType, objectId, title, state, action, priority, content, by) {
        if (isArray(email)) {
            return Notifications.createMany(email, organisation, objectType, objectId, title, state, action, priority, content, by);
        } else {
            return Notifications.createOne(email, organisation, objectType, objectId, title, state, action, priority, content, by);
        }
    }
}
build(Notifications, schemas.dao, schemas.model);
export default Notifications;
