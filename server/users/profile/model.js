'use strict';
let schemas = require('./schemas');
let ModelBuilder = require('./../../common/model-builder');
let Profile = (new ModelBuilder())
    .virtualModel()
    .usingSchema(schemas.model)
    .decorateWithUpdates([
        'profile.firstName',
        'profile.lastName',
        'profile.preferredName',
        'profile.title',
        'profile.dateOfBirth',
        'profile.firstName',
        'profile.lastName',
        'profile.preferredName',
        'profile.title',
        'profile.dateOfBirth',
        'profile.permanentAddress.apartment',
        'profile.permanentAddress.floorHouseNo',
        'profile.permanentAddress.street',
        'profile.permanentAddress.landmark',
        'profile.permanentAddress.area',
        'profile.permanentAddress.city',
        'profile.permanentAddress.pincode',
        'profile.permanentAddress.state',
        'profile.permanentAddress.country',
        'profile.currentAddress.apartment',
        'profile.currentAddress.floorHouseNo',
        'profile.currentAddress.street',
        'profile.currentAddress.landmark',
        'profile.currentAddress.area',
        'profile.currentAddress.city',
        'profile.currentAddress.pincode',
        'profile.currentAddress.state',
        'profile.currentAddress.country'
    ], [
        'profile.phone',
        'profile.educationalQualifications',
        'profile.employmentHistory'
    ], 'updateProfile')
    .doneConfiguring();
Profile.prototype.resetProfile = () => {
    let self = this;
    self.profile = Profile.create();
    return self;
};
Profile.create = () => {
    let emptyAddress = {
        apartment: '',
        floorHouseNo: '',
        street: '',
        landmark: '',
        area: '',
        city: '',
        pincode: '',
        state: '',
        country: ''
    };
    return {
        firstName: '',
        lastName: '',
        preferredName: '',
        title: '',
        dateOfBirth: new Date(1900, 1, 1),
        phone: [],
        permanentAddress: emptyAddress,
        currentAddress: emptyAddress,
        educationalQualification: [],
        employmentHistory: []
    };
};
module.exports = Profile;
