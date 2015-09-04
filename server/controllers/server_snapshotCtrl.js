/**
 * Created by VinceZK on 7/12/15.
 */
var debug = require('debug')('darkhouse:server_auth');
var snapshotBatch = require('../models/server_snapshot_batch.js');

module.exports = {

    submitBatchJob: function (req, res) {
        snapshotBatch.submitBatchJob(req.body.urls, req.body.opts,
            function (msg, jobGuid) {
                var retData = {
                    errorMsg: '',
                    successMsg: '',
                    jobGuid: ''
                };
                if (msg.msgType === 'E') {
                    retData.errorMsg = msg.msgText;
                } else {
                    retData.successMsg = msg.msgText;
                    retData.jobGuid = jobGuid;
                }
                res.json(retData);
        })
    },

    getBatchJobByGuids: function (req, res){
        snapshotBatch.getBatchJobByGuids(req.query.jobGuids,
            function(err, jobs){
                var retData = {
                    errorMsg: '',
                    numberOfItems: '',
                    jobList: ''
                };
                if (err) {
                    err === 'EMPTY_GUID'?retData.errorMsg = '请提供提取号！'
                    :retData.errorMsg='查询出现错误，请联系管理员！';
                } else {
                    retData.numberOfItems = jobs.length;
                    retData.jobList = jobs;
                }
                res.json(retData);
        })
    },

    getPageInfo:function(JobGuid,seq,callback){
        snapshotBatch.getPageInfo(JobGuid,seq,function(err,snapShot){
            if(err){
                callback(err, null);
                return;
            }
            callback(null, snapShot);
        })
    },

    getPageList:function(pageNo,itemsPerPage,callback){
        snapshotBatch.getPageList(pageNo,itemsPerPage,function(err,pages){
           if(err){
               callback(err, null);
               return;
           }
           callback(null, pages);
        })
    },

    getLatestPageList:function(numItems,callback){
        snapshotBatch.getPageList(1,numItems,function(err,pages){
            if(err){
                callback(err, null);
                return;
            }
            callback(null, pages);
        })
    },

    getUnfinishedBatchJobs: function (req, res){
        snapshotBatch.getUnfinishedBatchJobs(function(err,jobs){
            var retData = {
                errorMsg: '',
                numberOfItems: '',
                jobList: ''
            };
            if (err) {
                retData.errorMsg='查询出现错误，请联系管理员！';
            } else {
                retData.numberOfItems = jobs.length;
                retData.jobList = jobs;
            }
            res.json(retData);
        })
    },

    updateBatchJobStatus: function (req, res){
        snapshotBatch.updateBatchJobStatus(req.body.jobGuid,req.body.status,req.body.msg,
           function(msg){
               var retData = {
                   errorMsg: '',
                   successMsg: ''
               };
               if (msg.msgType === 'E') {
                   retData.errorMsg = msg.msgText;
               } else {
                   retData.successMsg = msg.msgText;
               }
               res.json(retData);
           })
    },

    addSubscribeEmail:function (req, res) {
        snapshotBatch.addSubscribeEmail(req.body.jobGuids,req.body.email,
            function(msg){
                var retData = {
                    errorMsg: '',
                    successMsg: ''
                };
                if (msg.msgType === 'E') {
                    retData.errorMsg = msg.msgText;
                } else {
                    retData.successMsg = msg.msgText;
                }
                res.json(retData);
            })
    }

};