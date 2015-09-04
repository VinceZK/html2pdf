/**
 * Created by VinceZK on 7/4/15.
 */
'use strict';

angular.module('snapshot', ['ui.bootstrap','dk-alert'])
    .controller('snapshotCtrl', ['$scope','$window','$timeout','$modal','snapshotSer','alertSer',
        function($scope,$window,$timeout,$modal,snapshotSer,alertSer){
            var ossHost = 'http://snapshots.darkhouse.com.cn/snapshots/';

            $scope.inputURL = null;
            $scope.jobList = [];
            $scope.phantomOpts = {
                format:'pdf',
                width:$window.innerWidth,
                height:100000,
                orientation:'Portrait',
                paperFormat:'A4',
                margin:'1cm',
                headerAndFooter:true
            };
            $scope.margin = 'Default';
            $scope.customMargin = 0.5;
            $scope.subemail = null;

            function switch2SingleUrlInput(){
                $scope.urlInput = 'single';
                $scope.switchDesc = '切换至批量转换';
            }

            function switch2MultiUrlInput(){
                $scope.urlInput = 'multi';
                $scope.switchDesc = '切换至单网址转换';
            }

            function showAdvancedOptions(){
                $scope.advancedOption = 'show';
                $scope.optionDesc = '关闭高级选项';
            }

            function hideAdvancedOptions(){
                $scope.advancedOption = 'hide';
                $scope.optionDesc = '高级选项';
            }

            function refreshJobStatus(){
                if($scope.jobList.length === 0)return;
                var jobGuids = [];
                var allFinished = true;

//                console.log('refresh job');
                angular.forEach($scope.jobList,function(job){
                    if(job.STATUS < 3)
                    jobGuids.push(job.JOB_GUID);
                });
                snapshotSer.getJobList(jobGuids,function(newJobList){
                    var jobListTableRowEle =  angular.element('#jobListTable tr');
                    var currIndex;
                    angular.forEach(newJobList,function(job){

                        angular.forEach($scope.jobList, function(oldJob,index){
                            if(oldJob.JOB_GUID === job.JOB_GUID){
                                currIndex = index;
                                return;
                            }
                        });

                        if($scope.jobList[currIndex].STATUS !== job.STATUS){
                            $scope.jobList[currIndex].STATUS = job.STATUS;
                            $scope.jobList[currIndex].STATUS_TEXT = snapshotSer.getStatusText(job.STATUS);
                            if(job.STATUS < 3){
                                allFinished = false;
                            }else if(job.STATUS === 3){//Finished
                                var downloadLink = '';
                                if($scope.urlInput === 'single'){
                                    downloadLink = ossHost + job.JOB_GUID + '.' + eval("(" + job.OPTIONS + ")").format;
                                }else{
                                    downloadLink = ossHost + job.JOB_GUID + '.zip';
                                }

                                angular.element(jobListTableRowEle[currIndex+1].children[0]).replaceWith(
                                    '<td><a href="'+ downloadLink +
                                        '" target="_blank">' + job.JOB_GUID + '</a></td>'
                                );
                                angular.element(jobListTableRowEle[currIndex+1].children[2]).addClass("snapshot-table-success");
                            }else if(job.STATUS === 4){//Error Happened
                                var errMsg = eval("(" + job.PROCESS_MSG + ")");
                                angular.element(jobListTableRowEle[currIndex+1].children[0]).replaceWith(
                                    '<td><a tabindex="0" data-toggle="popover" data-trigger="focus" title="出错信息"'+
                                        'data-content="'+ errMsg.msgText.substr(0,42) + '">' + job.JOB_GUID + '</a></td>'
                                );
                                angular.element('[data-toggle="popover"]').popover();
                                angular.element(jobListTableRowEle[currIndex+1].children[2]).addClass("snapshot-table-fail");
                            }
                        }else{
                            if(job.STATUS < 3) allFinished = false;
                        }
                    });

                    if (!allFinished){
                        $timeout(refreshJobStatus, 1000);
                    }
                });
            }

            $scope.switchUrlInput = function(){
                $scope.urlInput === 'single'?switch2MultiUrlInput():switch2SingleUrlInput();
            };

            $scope.toggleAdvancedOptions = function(){
                $scope.advancedOption === 'show'?hideAdvancedOptions():showAdvancedOptions();
            };

            $scope.submitSnapshotJob = function(){
                var urls = [];
                var hasInvalidUrl = false;
                alertSer.clearAlerts();

                if ($scope.urlInput === 'single'){
                    if(snapshotSer.checkURLisValid($scope.inputURL))
                        urls.push($scope.inputURL);
                    else{
                        alertSer.addAlert('danger','输入的网址不合法，也许你忘记加上“http://”或者“https://”了！');
                        hasInvalidUrl = true;
                    }
                }else{
                    urls = snapshotSer.textarea2Array($scope.inputURL);
                    angular.forEach(urls, function(url){
                        if(!snapshotSer.checkURLisValid(url)){
                            alertSer.addAlert('danger','输入的网址中存在不合法：'+url);
                            hasInvalidUrl = true;
                        }
                    })
                }

                if(hasInvalidUrl)return;

                switch($scope.margin){
                    case 'Default':
                        $scope.phantomOpts.margin = '1cm';
                        break;
                    case 'None':
                        $scope.phantomOpts.margin = '0cm';
                        break;
                    case 'Minimum':
                        $scope.phantomOpts.margin = '0.3cm';
                        break;
                    case 'Custom':
                        angular.isNumber($scope.customMargin)&&$scope.customMargin>0?
                        $scope.phantomOpts.margin = $scope.customMargin+'cm':
                            $scope.phantomOpts.margin = '1cm';
                }

//                console.log($scope.phantomOpts);

                snapshotSer.submitSnapshotJob(urls,$scope.phantomOpts,function(err, data){
                    if(err){
                        alertSer.addAlert('danger',err);
                    }else if (data.errorMsg) {
                        alertSer.addAlert('danger',data.errorMsg);
                    } else {
                        alertSer.addAlert('success',data.successMsg);
                        $scope.inputURL = null;
                        $scope.jobList.push({
                            JOB_GUID:data.jobGuid,
                            STATUS:1,
                            STATUS_TEXT:snapshotSer.getStatusText(1),
                            JOB_DESC:urls[0]
                        });
                        if($scope.subemail){
                            snapshotSer.addSubscribeEmail([data.jobGuid],$scope.subemail);
                        }
                        $timeout(refreshJobStatus, 1000);
                    }
                })
            };
            $scope.enterToSubmit = function($event){
                if($event.keyCode === 13){
                    $scope.submitSnapshotJob();
                }
            };
            $scope.registerEmail = function(size){
                var modalInstance = $modal.open({
                    templateUrl: 'addEmail.html',
                    controller: 'addEmailCtrl',
                    size: size
                });

                modalInstance.result.then(function (subemail) {
                    var jobGuids = [];
                    angular.forEach($scope.jobList,function(job){
                        jobGuids.push(job.JOB_GUID);
                    });

                    snapshotSer.addSubscribeEmail(jobGuids,subemail,function(err, data){
                        if(err){
                            alertSer.addAlert('danger',err);
                        }else if (data.errorMsg) {
                            alertSer.addAlert('danger',data.errorMsg);
                        } else {
                            $scope.subemail=subemail;
                            alertSer.addAlert('success',data.successMsg);
                        }
                    })
                });
            };

            switch2SingleUrlInput();
            hideAdvancedOptions();
        }])
    .controller('addEmailCtrl',['$scope','$modalInstance',function($scope,$modalInstance){
        $scope.subemail = null;
        $scope.focusSubEmail = true;
        $scope.ok = function () {
            if(!$scope.subemail)return;
            $modalInstance.close($scope.subemail);
        };

        $scope.cancel = function () {
            $modalInstance.dismiss('cancel');
        };
    }])
    .factory('snapshotSer', ['$http', function($http){
        return {
            submitSnapshotJob:submitSnapshotJob,
            getJobList:getJobList,
            getStatusText:getStatusText,
            addSubscribeEmail:addSubscribeEmail,
            textarea2Array:textarea2Array,
            checkURLisValid:checkURLisValid
        };

        function submitSnapshotJob(urls, opts, callback){
            $http.post('/pub/api/snapshot', {urls:urls,opts:opts})
                .success(function(data){
                    callback(null, data);
                })
                .error(function(err){
                    callback(err);
                })
        }

        function getJobList(jobGuids, callback){
            $http.get('/pub/api/snapshot',{params:{jobGuids:jobGuids}})
                .success(function(data){
                    callback(data.jobList);
                })
                .error(function(){
                    callback(null);
                })
        }

        function getStatusText(statusCode){
            var statusText = '';
            switch (statusCode){
                case 0:
                    statusText = '等待付款';
                    break;
                case 1:
                    statusText = '就绪';
                    break;
                case 2:
                    statusText = '运行中';
                    break;
                case 3:
                    statusText = '成功完成';
                    break;
                case 4:
                    statusText = '运行失败';
                    break;
            }
            return statusText;
        }

        function addSubscribeEmail(jobGuids,email,callback){
            $http.put('/pub/api/snapshot', {jobGuids:jobGuids,email:email})
                .success(function(data){
                    callback(null, data);
                })
                .error(function(err){
                    callback(err);
                })
        }

        function checkURLisValid(url){
            var urlStr = url;
            var urlExpression=/http(s)?:\/\/([\w-]+\.)*[\w-]+(:[0-9]+)*(\/[\w- .\/?%&=]*)?/;
            var urlExp=new RegExp(urlExpression);
            return urlExp.test(urlStr);
        }


        function textarea2Array(text){
            var lines = text.split(/\n/);
            var urls = [];
            for (var i=0; i < lines.length; i++) {
                if (/\S/.test(lines[i])) {
                    urls.push(lines[i].replace(/(^\s*)|(\s*$)/g,''));
                }
            }
            return urls;
        }
    }])
    .directive('focusMe', ['$timeout','$parse',function($timeout, $parse) {
        return {
            link: function(scope, element, attrs) {
                var model = $parse(attrs.focusMe);
                scope.$watch(model, function(value) {
                    //console.log('value=',value);
                    if(value === true) {
                        $timeout(function() {
                            element[0].focus();
                        });
                    }
                });
                element.bind('blur', function() {
                    //console.log('blur')
                    scope.$apply(model.assign(scope, false));
                })
            }
        }}]);