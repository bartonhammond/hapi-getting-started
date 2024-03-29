'use strict';
const path = require('path');
const {functions, flattenDeep} = require('lodash');
const fs = require('fs');
function describeRoutes(routes) {
    return routes.map(route => `${route.method}  ${route.path}`).join('\n');
}
function describeModel(model) {
    if (fs.existsSync(model + '.js')) {
        const modl = require(model);
        return `class: ${modl.name}\nstatic methods:${functions(modl).join('\n\t')}\nprototype methods:${functions(modl.prototype).join('\n\t')}`;
    }
    return '';
}
const register = function register(server, options, next) {
    const buildPath = path.join(process.cwd(), '/build/');
    options.modules.forEach(module => {
        const model = path.join(buildPath, module, '/model');
        const routes = flattenDeep(require(path.join(buildPath, module, '/routes')));
        routes.forEach(route => {
            route.path = options.prependRoute + route.path;
            server.route(route);
        });
        /*istanbul ignore if*/
        /*istanbul ignore else*/
        if (process.env.NODE_ENV !== 'production') {
            console.log(`${describeModel(model)}\n${describeRoutes(routes)}`);
        }
    });
    server.route({
        method: 'GET',
        path: '/public/{param*}',
        handler: {
            directory: {
                path: 'public',
                listing: true
            }
        }
    });
    return next();
};
register.attributes = {
    name: 'AppRoutes'
};
module.exports = register;
