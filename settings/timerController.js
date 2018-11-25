angular.module('TimerApp',['smart-table'])
    .controller('TimerSettingsController', function($scope, $timeout) {
        var homey;
        $scope.timers = [];

        $scope.initHomey = function(homey) {
            this.homey = homey;

            // listen to add timer event
            this.homey.on('timer_started', function(addedTimer) {
                $scope.updateTimers(addedTimer.timers);
            });

            // listen to delete timer event
            this.homey.on('timer_deleted', function(deletedTimer) {
                $scope.updateTimers(deletedTimer.timers);
            });

            // get current state of timers
            this.homey.api('GET', '/timers', null, function( err, result ) {
                if (err) return this.homey.alert(err);
               
                $scope.updateTimers(result);
            });

        };

        $scope.updateTimers = function(timers) {
            $scope.timers = timers;

            $scope.renderTimers();
        }

        $scope.renderTimers = function() {
            $scope.$digest();

            // keep refreshing, as long as there are timers
            if (Object.keys($scope.timers).length) {
                $timeout( function() {
                    $scope.renderTimers();
                }, 1000);
            }
        }

        //remove to the real data holder
        $scope.cancelTimer = function(deviceId) {
            this.homey.api('DELETE', `/timers/${deviceId}`, null, function( err, result ) {
                if (err) return this.homey.alert(err);
            });
        }

        $scope.showDetails  = function(timer) {
            $scope.detail = timer;
        }

        $scope.getTemplate = function(timer) {
            return 'display';
            //TODO: return 'edit';
        };

        // calculate remaining seconds
        $scope.remainingInSeconds = function(time) {
            return Math.round((time - new Date().getTime())/1000);
        }

    })
;