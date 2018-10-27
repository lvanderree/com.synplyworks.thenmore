'use strict';
const Homey = require('homey')

module.exports = [
    {
        description: 'Retrieve all devices with their information',
        method: 'GET',
        path: '/devices',
        fn: function(args, callback) {
            Homey.app.getDevices().then(res => {
                callback(null, res);
            })
                .catch(error => callback(error, null));
        }
    }
]