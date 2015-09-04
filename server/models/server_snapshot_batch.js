/**
 * Created by VinceZK on 7/11/15.
 */
'use strict';
var debug = require('debug')('html2pdf/snapshot');
var msg = require('../util/msg.js');
var _ = require('underscore');
var guid = require('../util/guid.js');
var entityDB = require('./connections/conn_mysql_mdb.js');
var timeUtil = require('../../server/util/date_time.js');
var async = require('async');
var snapshot = require('./server_snapshot.js');
var snapshotMsg = new msg('snapshot');
var fs = require('fs');

module.exports = {
    /**
     * Submit snapshot batch job
     * @param urls: [url1, url2, ....]
     * @param opts: {format:'png', width:1920, height:1080} can be json or string
     * @param callback(msg, jobGuid)
     */
    submitBatchJob:function(urls, opts, callback){
        var insertSQLs = [];
        var jobGuid = guid.genTimeBased();
        var optsStr;

        (typeof(opts) === 'object')?optsStr=JSON.stringify(opts):optsStr=opts;
        //Insert Batch job head info
        var insertSQL = "INSERT INTO `MDB`.`BATCHJOB` (`JOB_GUID`, `STATUS`, `JOB_DESC`, `OPTIONS`, `CREATE_TIME`) " +
            "VALUES (" + entityDB.pool.escape(jobGuid) +
            ", '1', " + entityDB.pool.escape(urls[0])+
            ", " + entityDB.pool.escape(optsStr) +
            ", " + entityDB.pool.escape(timeUtil.getCurrentDateTime()) + ")";
        insertSQLs.push(insertSQL);

        //Insert urls
        _.each(urls,function(url,index){
            insertSQL = "INSERT INTO `MDB`.`SNAPSHOT_URL` (`JOB_GUID`, `SEQ`, `URL`, `STATUS`) VALUES " +
                "(" + entityDB.pool.escape(jobGuid) +
                ", " + index +
                ", " + entityDB.pool.escape(url) +
                ", " + 0 + ")";
            insertSQLs.push(insertSQL);
        });

        entityDB.doUpdatesParallel(insertSQLs, function(err){
            if(err){
                debug("Error occurs in submitBatchJob() when doing parallel updates.\n" +
                    "Error info: %s \n" +
                    "SQL statements: %s \n", err, insertSQLs);
                callback(snapshotMsg.reportMsg('SUBMIT_BATCH_JOB_FAIL','E'),jobGuid);
            }else{
                callback(snapshotMsg.reportMsg('SUBMIT_BATCH_JOB_SUCCESS','S'),jobGuid);
            }
        });
    },

    /**
     * Get batch jobs detail by their guids.
     * @param JobGuids: [guid1, guid2, ...]
     * @param callback(err, jobs)
     */
    getBatchJobByGuids:function(JobGuids, callback){
        if(typeof(JobGuids) === 'object'){
            if(JobGuids.length === 0) return callback('EMPTY_GUID', null);
        }else{
            var guidStr = JobGuids;
            JobGuids = [];
            JobGuids.push(guidStr);
        }

        var selectSQL = "SELECT * FROM MDB.BATCHJOB WHERE ";
        _.each(JobGuids,function(jobGuid, index){
            index === 0? selectSQL += ("JOB_GUID = " + entityDB.pool.escape(jobGuid)):
                selectSQL += ("OR JOB_GUID = " + entityDB.pool.escape(jobGuid));
        });

        entityDB.executeSQL(selectSQL, function(err, Jobs){
            if(err){
                debug("Error occurs in getBatchJobByGuids() when doing serarch.\n" +
                    "Error info: %s \n" +
                    "SQL statements: %s \n", err, selectSQL);
                callback('BAD_THINGS',Jobs);
            }else{
                callback(null,Jobs);
            }
        })
    },

    /**
     * Get URL page information by the jobGuid and seq number
     * @param jobGuid
     * @param seq
     * @param callback
     */
    getPageInfo:function(jobGuid,seq,callback){
        var selectSQL;
        if(!jobGuid){
            callback(null);
            return;
        }

        if(seq){
            selectSQL = "SELECT A.JOB_GUID,A.SEQ,A.URL,A.TITLE,A.KEYWORDS,A.DESCRIPTION,B.OPTIONS,B.FINISH_TIME,B.PROCESS_MSG " +
                "FROM MDB.SNAPSHOT_URL AS A JOIN MDB.BATCHJOB AS B ON A.JOB_GUID = B.JOB_GUID " +
                "WHERE A.JOB_GUID=" + entityDB.pool.escape(jobGuid) +" AND A.SEQ=" + entityDB.pool.escape(seq);
        }else{
            selectSQL = "SELECT A.JOB_GUID,A.SEQ,A.URL,A.TITLE,A.KEYWORDS,A.DESCRIPTION,B.OPTIONS,B.FINISH_TIME,B.PROCESS_MSG " +
                "FROM MDB.SNAPSHOT_URL AS A JOIN MDB.BATCHJOB AS B ON A.JOB_GUID = B.JOB_GUID " +
                "WHERE A.JOB_GUID=" + entityDB.pool.escape(jobGuid);
        }


        entityDB.executeSQL(selectSQL, function(err, pages){
            if(err){
                debug("Error occurs in getUnevaluatedURLs() when doing search.\n" +
                    "Error info: %s \n" +
                    "SQL statements: %s \n", err, selectSQL);
                callback(snapshotMsg.reportMsg('SQL_ERROR','E',err),null);
            }else{
                if(pages.length === 0)
                    return callback(snapshotMsg.reportMsg('SNAPSHOT_NON_EXIST','E'), null);
                var snapShot = {};
                snapShot.JOB_GUID = pages[0].JOB_GUID;
                snapShot.OPTIONS = eval("(" + pages[0].OPTIONS + ")");
                snapShot.FINISH_TIME = pages[0].FINISH_TIME;
                var fileSize = pages[0].PROCESS_MSG?eval("(" + pages[0].PROCESS_MSG + ")").size:null;
                if(fileSize)
                snapShot.SIZE= fileSize<1048576?Math.ceil(fileSize/1024)+'KB':Math.ceil(fileSize/1048576)+'MB';
                else
                snapShot.SIZE='0KB';
                snapShot.EXTENSION = (pages.length === 1)?('.' + snapShot.OPTIONS.format):'.zip';
                var finishTime = new Date(snapShot.FINISH_TIME);
                snapShot.FINISH_TIME = finishTime.Format('YYYY/MM/DD hh:mm:ss');
                if(snapShot.FINISH_TIME < '2015/09/04'){
                    snapShot.EXTENSION='.zip';
                }
                snapShot.URLS = [];
                _.each(pages, function(page){
                    var pageObj = {};
                    pageObj.SEQ = page.SEQ;
                    pageObj.URL = page.URL;
                    pageObj.TITLE = page.TITLE;
                    pageObj.KEYWORDS = page.KEYWORDS;
                    pageObj.DESCRIPTION = page.DESCRIPTION;
                    snapShot.URLS.push(pageObj);
                });

                callback(null,snapShot);
            }
        })
    },

    /**
     * Get page list limited by page number
     * @param pageNo
     * @param callback
     * @param itemsPerPage
     */
    getPageList:function(pageNo,itemsPerPage,callback){
       if(pageNo <= 0 || itemsPerPage <=1){
           return callback('pageNo should larger than 0, or items per page should be larger than 1!');
       }
       var selectSQL = "SELECT COUNT(*) AS TOTAL_NUM_ITEMS FROM MDB.SNAPSHOT_URL WHERE STATUS = '1'";
       entityDB.executeSQL(selectSQL, function(err, rst){
           if(err){
               debug("Error occurs in getPageList() when doing search.\n" +
                   "Error info: %s \n" +
                   "SQL statements: %s \n", err, selectSQL);
               callback(err,null);
           }else{
               var beginItem = itemsPerPage * (pageNo - 1);
               //TODO the SQL is not performance optimized as the JOB_GUID is not sorted, so I have to user order by finish_time
               selectSQL = "SELECT A.JOB_GUID, A.SEQ,A.URL,A.TITLE, DATE_FORMAT(B.FINISH_TIME,'%Y/%m/%d %H:%i:%S') AS FINISH_TIME " +
                   "FROM MDB.SNAPSHOT_URL AS A JOIN MDB.BATCHJOB AS B ON A.JOB_GUID = B.JOB_GUID " +
                   "WHERE A.STATUS = '1' ORDER BY B.FINISH_TIME DESC LIMIT " + beginItem + "," + itemsPerPage;

               entityDB.executeSQL(selectSQL, function(err, pages){
                   if(err){
                       debug("Error occurs in getPageList() when doing search.\n" +
                           "Error info: %s \n" +
                           "SQL statements: %s \n", err, selectSQL);
                       callback(err,null);
                   }else{
                       var retData = {ITEMS_PER_PAGE:itemsPerPage,
                                      CURRENT_PAGE_NO:pageNo};
                       retData.TOTAL_NUM_ITEMS = rst[0].TOTAL_NUM_ITEMS;
                       retData.NUM_PAGES = Math.ceil(retData.TOTAL_NUM_ITEMS / retData.ITEMS_PER_PAGE);
                       if(retData.CURRENT_PAGE_NO > retData.NUM_PAGES){
                           return callback('Requested page number is outbound!');
                       }
                       if(retData.NUM_PAGES > 11){
                           retData.SHOWED_PAGES = 11;
                           retData.BEGIN_PAGE_NO = retData.CURRENT_PAGE_NO <= 6?1:
                               (retData.CURRENT_PAGE_NO+5>retData.NUM_PAGES?retData.NUM_PAGES-10:retData.CURRENT_PAGE_NO-5);
                       }else{
                           retData.SHOWED_PAGES = retData.NUM_PAGES;
                           retData.BEGIN_PAGE_NO = 1;
                       }

                       retData.snapPages = pages;
                       callback(null,retData);
                   }
               });
           }
       });
    },

    /**
     * Generate a sitemap file for google.
     * @param regenerate
     * @param callback
     */
    generateSiteMap:function(regenerate, callback){
        var today = timeUtil.getCurrentDateTime("YYYY-MM-DD");

        var selectSQL = regenerate?"SELECT A.JOB_GUID, A.SEQ " +
            "FROM MDB.SNAPSHOT_URL AS A JOIN MDB.BATCHJOB AS B ON A.JOB_GUID = B.JOB_GUID " +
            "WHERE A.STATUS = '1'":
            "SELECT A.JOB_GUID, A.SEQ " +
            "FROM MDB.SNAPSHOT_URL AS A JOIN MDB.BATCHJOB AS B ON A.JOB_GUID = B.JOB_GUID " +
            "WHERE A.STATUS = '1' AND B.FINISH_TIME >=" + entityDB.pool.escape(today);

        entityDB.executeSQL(selectSQL, function(err, items){
            if(err){
                debug("Error occurs in generateSiteMap() when doing search.\n" +
                    "Error info: %s \n" +
                    "SQL statements: %s \n", err, selectSQL);
                callback(err);
            }else{
                var sitemapFilePath = __dirname.replace('/models','') + '/seo/sitemap_google_html2pdf.txt';
                _.each(items, function(item){
                    fs.appendFile(sitemapFilePath,
                        'http://html2pdf.cn/snapshots/'+item.JOB_GUID+'/'+item.SEQ+'\n',
                        function (err) {
                           if (err){
                               callback(err);
                               snapshot.sendSysErrorMail('zklee@hotmail.com',err);
                               return;
                           }
                        });
                });
                callback(null);

            }
        });
    },

    /**
     * Get all the unfinished jobs, which has the status = 1 or 2.
     * Only get a week period long.
     * @param callback(err, jobs)
     */
    getUnfinishedBatchJobs:function(callback){
        var today = timeUtil.getCurrentDateTime('YYYY/MM/DD');
        var selectSQL = "SELECT * FROM MDB.BATCHJOB WHERE (STATUS = 1 OR STATUS = 2)" +
            "AND CREATE_TIME >= " + entityDB.pool.escape(today);

        entityDB.executeSQL(selectSQL, function(err, Jobs){
            if(err){
                debug("Error occurs in getUnfinishedBatchJobs() when doing search.\n" +
                    "Error info: %s \n" +
                    "SQL statements: %s \n", err, selectSQL);
                callback(err,Jobs);
            }else{
                callback(null,Jobs);
            }
        })
    },

    /**
     * Get all the unsent email jobs, which has the email_status = 0 and status > 2.
     * Only get a week period long.
     * @param callback
     */
    getUnsentNotifications:function(callback){
        var today = timeUtil.getCurrentDateTime('YYYY/MM/DD');
        var selectSQL = "SELECT * FROM MDB.BATCHJOB WHERE EMAIL_STATUS = 0 AND STATUS > 2 " +
            "AND CREATE_TIME > " + entityDB.pool.escape(today);

        entityDB.executeSQL(selectSQL, function(err, Jobs){
            if(err){
                debug("Error occurs in getUnsentNotifications() when doing search.\n" +
                    "Error info: %s \n" +
                    "SQL statements: %s \n", err, selectSQL);
                callback(err,Jobs);
            }else{
                callback(null,Jobs);
            }
        })
    },

    getUnevaluatedURLs:function(callback){
        var selectSQL = "SELECT * FROM MDB.SNAPSHOT_URL WHERE STATUS = 0";

        entityDB.executeSQL(selectSQL, function(err, URLs){
            if(err){
                debug("Error occurs in getUnevaluatedURLs() when doing search.\n" +
                    "Error info: %s \n" +
                    "SQL statements: %s \n", err, selectSQL);
                callback(err,null);
            }else{
                callback(null,URLs);
            }
        })
    },

    /**
     * Update the job status and the status message
     * @param jobGuid
     * @param status
     * @param msg
     * @param callback(err, msg)
     */
    updateBatchJobStatus:function(jobGuid,status,msg,callback){
        if(typeof(msg) === 'object') msg=JSON.stringify(msg);
        var updateSQL = "UPDATE BATCHJOB SET STATUS=" + entityDB.pool.escape(status) +
            ", PROCESS_MSG=" + entityDB.pool.escape(msg) +
            ", FINISH_TIME=" + entityDB.pool.escape(timeUtil.getCurrentDateTime()) +
            "WHERE JOB_GUID=" + entityDB.pool.escape(jobGuid) ;

        entityDB.executeSQL(updateSQL, function(err){
            if(err){
                debug("Error occurs in updateBatchJobStatus() when doing updates.\n" +
                    "Error info: %s \n" +
                    "SQL statements: %s \n", err, updateSQL);
                callback(snapshotMsg.reportMsg('UPDATE_BATCH_JOB_FAIL','E'));
            }else{
                callback(snapshotMsg.reportMsg('UPDATE_BATCH_JOB_SUCCESS','S'));
            }
        })
    },

    updateAfterPageEvaluate:function(jobGuid,SEQ,status,pageInfo){
        var updateSQL;
        if(status===1){
            updateSQL = "UPDATE SNAPSHOT_URL SET STATUS=" + entityDB.pool.escape(status) +
                ", TITLE=" + entityDB.pool.escape(pageInfo.title) +
                ", KEYWORDS=" + entityDB.pool.escape(pageInfo.keywords) +
                ", DESCRIPTION=" + entityDB.pool.escape(pageInfo.description) +
                " WHERE JOB_GUID=" + entityDB.pool.escape(jobGuid) +
                " AND SEQ=" +  entityDB.pool.escape(SEQ);
        }else{
            updateSQL = "UPDATE SNAPSHOT_URL SET STATUS=" + entityDB.pool.escape(status) +
                " WHERE JOB_GUID=" + entityDB.pool.escape(jobGuid) +
                " AND SEQ=" +  entityDB.pool.escape(SEQ);
        }

        entityDB.executeSQL(updateSQL, function(err){
            if(err){
                debug("Error occurs in updateAfterPageEvaluate() when doing updates.\n" +
                    "Error info: %s \n" +
                    "SQL statements: %s \n", err, updateSQL);
            }
        })
    },

    /**
     * Add subscriber's email. When the snapshot finished, a notification email will be sent.
     * @param jobGuids[]
     * @param email
     * @param callback
     */
    addSubscribeEmail:function(jobGuids,email,callback){
        if(typeof(jobGuids) !== 'object' || jobGuids.length === 0)return;
        var updateSQL = "UPDATE BATCHJOB SET SUB_EMAIL=" + entityDB.pool.escape(email) +
            ",EMAIL_STATUS=0 WHERE ";
        _.each(jobGuids,function(jobGuid,index){
            index === 0? updateSQL += ("JOB_GUID = " + entityDB.pool.escape(jobGuid)):
                updateSQL += ("OR JOB_GUID = " + entityDB.pool.escape(jobGuid));
        });

        entityDB.executeSQL(updateSQL, function(err){
            if(err){
                debug("Error occurs in addSubscribeEmail() when doing updates.\n" +
                    "Error info: %s \n" +
                    "SQL statements: %s \n", err, updateSQL);
                callback(snapshotMsg.reportMsg('ADD_EMAIL_FAIL','E'));
            }else{
                callback(snapshotMsg.reportMsg('ADD_EMAIL_SUCCESS','S'));
            }
        })
    },

    /**
     * Send a successful email include a download link
     * @param recpt
     * @param snapGuid
     */
    sendSuccessfulEmail:function(recpt,snapGuid,jobDesc,callback){
        if(recpt === null || recpt === undefined || recpt === '')return;
        snapshot.sendDownloadLink(recpt, snapGuid, jobDesc,   function(error,info){
            var updateSQL;
            if(error){
                updateSQL = "UPDATE BATCHJOB SET EMAIL_STATUS=2 " +
                    "WHERE JOB_GUID=" + entityDB.pool.escape(snapGuid) ;

            }else{
                updateSQL = "UPDATE BATCHJOB SET EMAIL_STATUS=1 " +
                    "WHERE JOB_GUID=" + entityDB.pool.escape(snapGuid) ;
            }
            entityDB.executeSQL(updateSQL, function(err){
                if(err){
                    debug("Error occurs in sendSuccessfulEmail() when doing updates.\n" +
                        "Error info: %s \n" +
                        "SQL statements: %s \n", err, updateSQL);
                }
                callback(err);
            })
        })
    },

    /**
     * Send a fail notification to the receipt
     * @param recpt
     * @param msg
     * @param snapGuid
     * @param jobDesc
     * @param callback
     */
    sendFailedEmail:function(recpt,snapGuid,jobDesc,msg,callback){
        if(recpt === null || recpt === undefined || recpt === '')return;
        snapshot.sendFailedMail(recpt,jobDesc,msg, function(error,info){
            var updateSQL;
            if(error){
                updateSQL = "UPDATE BATCHJOB SET EMAIL_STATUS=2 " +
                    "WHERE JOB_GUID=" + entityDB.pool.escape(snapGuid) ;

            }else{
                updateSQL = "UPDATE BATCHJOB SET EMAIL_STATUS=1 " +
                    "WHERE JOB_GUID=" + entityDB.pool.escape(snapGuid) ;
            }
            entityDB.executeSQL(updateSQL, function(err){
                if(err){
                    debug("Error occurs in sendFailedEmail() when doing updates.\n" +
                        "Error info: %s \n" +
                        "SQL statements: %s \n", err, updateSQL);
                }
                callback(err);
            })
        })
    },

    /**
     * Schedule page evaluate job to grap thumbnail, title, keywords, and description
     */
    schedulePageEvaluateJob:function(immediate){
        var _this = this;
        var startTime = null;
        if(immediate){
            run();
        }else{ //Schedule the job run at every 2:00
            var currTime = new Date();
            var currHour = currTime.getHours();
            if(currHour < 2){
                startTime = new Date(currTime.getFullYear(),currTime.getMonth(),currTime.getDate(),2,0,0,0);
            }else{
                var nextDay = currTime.DateAdd('d',1);
                startTime = new Date(nextDay.getFullYear(),nextDay.getMonth(),nextDay.getDate(),2,0,0,0);
            }
            var timeout = currTime.DateDiff('s',startTime) * 1000;
//            console.log('startTime='+startTime);
//            console.log('timeout='+timeout);
            run();
//            _this.generateSiteMap(true,function(err){});
            setTimeout(run,timeout);
            setTimeout(recurrentRun,timeout);
        }

        function run(){
            console.log('PageEvaluateJob begins running at ' + timeUtil.getCurrentDateTime());
            _this.getUnevaluatedURLs(function(err,URLs){
                if(err){
                    debug("Error occurs in getting all the unevaluated URLs.\n" +
                        "Error info: %s ", err);
                    return;
                }

                async.eachSeries(URLs, function(url,callback) {
                    snapshot.createThumbnailFromURLs(url.URL,{width:1230, height:1080}, function (pRender) {
                        snapshot.saveThumbnail2ALYOSS(pRender, url.JOB_GUID, url.SEQ, function(retData, errMsg){
                            if (errMsg) {
                                _this.updateAfterPageEvaluate(url.JOB_GUID, url.SEQ, 2, null);
                            } else {
                                _this.updateAfterPageEvaluate(url.JOB_GUID, url.SEQ, 1, pRender.pageInfo);
                                snapshot.postUrl2Baidu(['http://html2pdf.cn/snapshots/' + url.JOB_GUID + '/' + url.SEQ],
                                    function(retData){
                                        console.log(retData);
                                    });
                            }
                            callback();
                        });
                    })
                },function(err){
                    console.log('PageEvaluateJob is finished at ' + timeUtil.getCurrentDateTime());
                    _this.generateSiteMap(false,function(err){});
                })
            })
        }

        function recurrentRun(){
            setInterval(run, 86400000);
        }
    },

    /**
     * Email sending schedular running periodically.
     * The schedular will check job table to see if there are jobs with email_status = 0.
     * If yes, send the notification.
     */
    kickEmailSendingJob:function(){
        var _this = this;
        _this.getUnsentNotifications(function(err,Jobs){
            if(err){
                debug("Error occurs in getting all the unsent notification jobs.\n" +
                    "Error info: %s ", err);
                return;
            }
            //Running the job one by one
            async.eachSeries(Jobs, function(job, callback){
                if(job['STATUS'] === 3){
                    _this.sendSuccessfulEmail(job['SUB_EMAIL'],job['JOB_GUID'],job['JOB_DESC'],function(err){
                        callback(err);
                    })
                }else if(job['STATUS'] === 4){
                    _this.sendFailedEmail(job['SUB_EMAIL'],job['JOB_GUID'],job['JOB_DESC'], job['PROCESS_MSG'],
                        function(err){
                          callback(err);
                    })
                }
            }, function done(err){
                if(err){
                    debug("Error occurs in running job sending jobs.\n" +
                        "Error info: %s ", err);
                    snapshot.sendSysErrorMail('zklee@hotmail.com', err);
                }
                setTimeout(_.bind(_this.kickEmailSendingJob,_this),2500);
            });
        });
    },

    /**
     * The start button which will start the schedular running periodically.
     * The schedular will check job table to see if there are new batch jobs submitted.
     * If yes, run this jobs one by one; if no, continue checking.
     * @param callback only if in unit test.
     */
    kickStartBatchJob:function(){
//        console.log("Batch job is kicked start at " + timeUtil.getCurrentDateTime());
        var _this = this;
//        tickTimes++;
//        console.log("Tick Times: " + tickTimes);
        _this.getUnfinishedBatchJobs(function(err,Jobs){
            if(err){
                debug("Error occurs in getting all the unfinished batch jobs.\n" +
                    "Error info: %s ", err);
                return;
            }

            //Running the job one by one
            async.eachSeries(Jobs, function(job, callback){
                var jobGuid = job['JOB_GUID'];
                var selectSQL2 = "SELECT * FROM MDB.SNAPSHOT_URL WHERE JOB_GUID = " + entityDB.pool.escape(jobGuid);

                _this.updateBatchJobStatus(jobGuid,2,null,function(msg){
                    if(msg.msgType === 'E')callback(msg);
                });

                entityDB.executeSQL(selectSQL2, function(err, urls){
                    if(err)return callback(err);
                    var snapUrls = _.map(urls,  function(url){return url.URL});
                    if(snapUrls.length === 1){
                        snapshot.createSnapshotsFromURL(jobGuid,snapUrls[0],job.OPTIONS,
                        function(retData, err){
                            if(err){
                                _this.updateBatchJobStatus(jobGuid,4,err,function(){
                                    callback(err);
                                });
                            }else{
                                _this.updateBatchJobStatus(jobGuid,3,retData,function(){
                                    callback(null);
                                });
                            }
                        })
                    }else{
                        snapshot.createSnapshotsFromURLs(jobGuid,snapUrls,job.OPTIONS,
                            function(zipStream, snapGuid){
                                snapshot.saveSnapStream2ALYOSS(zipStream, snapGuid,
                                    function(retData, err){
                                        if(err){
                                            _this.updateBatchJobStatus(jobGuid,4,err,function(){
                                                callback(err);
                                            });
                                        }else{
                                            _this.updateBatchJobStatus(jobGuid,3,retData,function(){
                                                callback(null);
                                            });
                                        }
                                    })
                            });
                    }
                })
            }, function done(err){
                if(err){
                    debug("Error occurs in running snapshot batch jobs.\n" +
                        "Error name: %s; Error description: %s", err.msgName, err.msgText);
                    snapshot.sendSysErrorMail('zklee@hotmail.com', err.msgName + ':' + err.msgText);
                }else{
//                    if (tickTimes < 5)
//                    setTimeout(_.bind(_this.kickStartBatchJob,_this,callback),1000);
//                    setTimeout(_.bind(_this.kickStartBatchJob,_this),1000);
//                    else
//                    callback();
                }
                setTimeout(_.bind(_this.kickStartBatchJob,_this),1000);
            })
        });
    }

};