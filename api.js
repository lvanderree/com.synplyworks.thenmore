const Homey = require('homey');

module.exports = [
    {
        method:         'GET',
        path:           '/timers',
        public:         false,
        fn: function( args, callback ){
            var result = Homey.app.exportTimers();

            // callback follows ( err, result )
            callback(null, result);
        }
    },
    {
        method:         'DELETE',
        path:           '/timers',
        public:         false,
        path:           '/timers/:id',
        fn: function( args, callback ){
            var result = Homey.app.cancelTimer( {id: args.params.id} );

            if (result instanceof Error) return callback( result );
            return callback(null, result);
        }
    }

]
