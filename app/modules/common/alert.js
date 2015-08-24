/**
 * Created by VinceZK on 11/22/14.
 */
angular.module('dk-alert',[])
    .controller('alertCtrl', ['$rootScope','$scope',function ($rootScope,$scope) {
        $rootScope.alerts = [
//        { type: 'danger', msg: 'Oh snap! Change a few things up and try submitting again.' },
//        { type: 'success', msg: 'Well done! You successfully read this important alert message.' }
        ];
        $scope.closeAlert = function(index){
            $rootScope.alerts.splice(index, 1);
        }
    }])
    .factory('alertSer',['$rootScope', function($rootScope){
        return {
            addAlert:addAlert,
            clearAlerts:clearAlerts
        };

        function addAlert(type, msg){
            $rootScope.alerts.push({type: type,  msg: msg});
        }

        function clearAlerts(){
            $rootScope.alerts = [];
        }
    }]);