'use strict';
var Joi = require('joi');
var Users = require('./../model');
var ControllerFactory = require('./../../common/controller-factory');
var onlyOwnerAllowed = require('./../../common/prereqs/only-owner');

var addressSchema = Joi.object().keys({
    apartment: Joi.string(),
    floorHouseNo: Joi.string(),
    street: Joi.string(),
    landmark: Joi.string(),
    area: Joi.string(),
    city: Joi.string(),
    pincode: Joi.string(),
    state: Joi.string(),
    country: Joi.string()
});

var Controller = new ControllerFactory(Users)
    .updateController({
        payload: {
            profile: {
                firstName: Joi.string(),
                lastName: Joi.string(),
                preferredName: Joi.string(),
                title: Joi.string().valid(['Dr', 'Mr', 'Mrs', 'Ms']),
                dateOfBirth: Joi.date(),
                addedPhone: Joi.array().items(Joi.string()),
                removedPhone: Joi.array().items(Joi.string()),
                residentialAddress: addressSchema,
                currentAddress: addressSchema,
                addedEducationalQualification: Joi.array().items(Joi.object().keys({
                    school: Joi.string(),
                    started: Joi.date(),
                    completed: Joi.date(),
                    qualification: Joi.string()
                })),
                removedEducationalQualification: Joi.array().items(Joi.object().keys({
                    school: Joi.string(),
                    started: Joi.date(),
                    completed: Joi.date(),
                    qualification: Joi.string()
                })),
                addedEmploymentHistory: Joi.array().items(Joi.object().keys({
                    company: Joi.string(),
                    designation: Joi.string(),
                    from: Joi.date(),
                    to: Joi.date()
                })),
                removedEmploymentHistory: Joi.array().items(Joi.object().keys({
                    company: Joi.string(),
                    designation: Joi.string(),
                    from: Joi.date(),
                    to: Joi.date()
                }))
            }
        }
    }, [
        onlyOwnerAllowed(Users, 'email')
    ], 'update',
    'updateProfile')
    .doneConfiguring();

module.exports = Controller;
