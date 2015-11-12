'use strict';
import {org} from './../common/utils';
import {build} from './../common/dao';
import schemas from './schemas';
class UserGroups {
    constructor(attrs) {
        this.init(attrs);
    }
    static newObject(doc, by) {
        return UserGroups.create(doc.payload.name,
            org(doc),
            doc.payload.description,
            by)
            .then(userGroup => {
                return userGroup
                    .addMembers(doc.payload.members, by)
                    .addOwners(doc.payload.owners, by)
                    .setAccess(doc.payload.access, by)
                    .save();
            });
    }
    static create(name, organisation, description, owner) {
        return UserGroups.insertAndAudit({
            name,
            organisation,
            description,
            members: [owner],
            owners: [owner],
            needsApproval: [],
            access: 'restricted'
        }, owner);
    }
}
build(UserGroups, schemas.dao, schemas.model, [], 'name');
export default UserGroups;
