'use strict';
import {buildRESTRoutes} from './../../common/routes';
import Controller from './controller';
const routes = buildRESTRoutes('profile', Controller);
export default routes;
