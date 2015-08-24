/**
 * Created by VinceZK on 7/11/15.
 */
var snapshotBatch = require('../../server/models/server_snapshot_batch.js');

describe.only('snapshot batch job processing system test', function() {
    var currJobGuid;
    describe('Test batch job submit, get, search, and update', function () {
        it('should submit a batch job', function (done) {
            snapshotBatch.submitBatchJob(['http://wwww.baidu.com', 'http://www.pingwest.com/momo-live-about-music/'],
                   {format:'png', width:1920, height:1080},
                   function(msg,jobGuid){
                       msg.msgType.should.be.equal('S');
                       msg.msgName.should.be.equal('SUBMIT_BATCH_JOB_SUCCESS');
                       jobGuid.length.should.be.equal(32);
                       currJobGuid = jobGuid;
                       done();
                   })
        });

        it('should return 2 job details information', function (done) {
            snapshotBatch.getBatchJobByGuids(['CBABF4790F7B4E3F981F83787D03277D', currJobGuid],
                function(err, jobs){
                    (err === null).should.be.true;
                    jobs.length.should.be.equal(2);
                    done();
                })
        });

        it('should return EMPTY_GUID error', function (done) {
            snapshotBatch.getBatchJobByGuids([],
                function(err){
                    err.should.be.equal('EMPTY_GUID');
                    done();
                })
        });

        it('should return no job information', function (done) {
            snapshotBatch.getBatchJobByGuids(['SLKDJFKSADJFLK123081093421'],
                function(err,jobs){
                    (err === null).should.be.true;
                    jobs.length.should.be.equal(0);
                    done();
                })
        });

        it('should return a day long unfinished job list', function(done){
            snapshotBatch.getUnfinishedBatchJobs(function(err,jobs){
                (err === null).should.be.true;
                jobs.length.should.be.above(0);
                done();
            })
        });

        it('should return a page information of a snapshot job', function(done){
            snapshotBatch.getPageInfo('CBABF4790F7B4E3F981F83787D03277D',1,function(err,snapShot){
                (err === null).should.be.ok;
                snapShot.should.be.ok;
                snapShot.URLS.length.should.be.equal(1);
                snapShot.URLS[0].SEQ.should.be.equal(1);
                done();
            })
        });

        it('should return pages information of a snapshot job', function(done){
            snapshotBatch.getPageInfo('CBABF4790F7B4E3F981F83787D03277D',null,function(err,snapShot){
                (err === null).should.be.ok;
                snapShot.should.be.ok;
                snapShot.URLS.length.should.be.equal(2);
                snapShot.URLS[0].SEQ.should.be.equal(0);
                snapShot.URLS[1].SEQ.should.be.equal(1);
//                console.log(snapShot);
                done();
            })
        });

        it('should update the new submitted job status', function(done){
            snapshotBatch.updateBatchJobStatus(currJobGuid,2,'Success',
                function(msg){
                msg.msgName.should.be.equal('UPDATE_BATCH_JOB_SUCCESS');
                done();
            })
        });

        it('should add the email address to the jobs', function(done){
            snapshotBatch.addSubscribeEmail([currJobGuid,'CBABF4790F7B4E3F981F83787D03277D'],'zklee@hotmail.com',
                function(msg){
                    msg.msgName.should.be.equal('ADD_EMAIL_SUCCESS');
                    done();
                })
        });
    });

    describe('Test get snapshot page list',function(){
        it('should return 20 snapshots according to the page number',function(done){
            snapshotBatch.getPageList(1,20,function(err,retData){
                (err === null).should.be.ok;
                retData.should.be.ok;
                retData.TOTAL_NUM_ITEMS.should.above(20);
                retData.snapPages.length.should.be.equal(20);
                done();
            })
        });

        it('should throw err as the number of pages smaller than 1',function(done){
            snapshotBatch.getPageList(0,20,function(err,retData){
                err.should.be.ok;
                done();
            })
        });

        it('should get correct begin page number',function(done){
            snapshotBatch.getPageList(7,2,function(err,retData){
                (err === null).should.be.ok;
                retData.BEGIN_PAGE_NO.should.be.equal(2);
                console.log(retData);
                done();
            })
        });

        it('should generate a google sitemap file',function(done){
            snapshotBatch.generateSiteMap(true, function(err){
                (err === null).should.be.ok;
                done();
            })
        });

        it('should append today items to google sitemap file',function(done){
            snapshotBatch.generateSiteMap(false, function(err){
                console.log(err);
                (err === null).should.be.ok;
                done();
            })
        })

    });

    describe.skip('Test batch job schedular', function () {
        it('should trigger the batch job schedular, and run the snapshots', function (done) {
            snapshotBatch.kickStartBatchJob(function(){
                done();
            });
        });
    });

    describe('Test page evaluation background job',function(){
        it('should run the job immediately with only one item success',function(done){
            snapshotBatch.schedulePageEvaluateJob(true, function(errMsg){
                (errMsg === undefined).should.be.ok;
                done();
            })
        });
        it('should schedule the job correctly',function(){
            snapshotBatch.schedulePageEvaluateJob(false);
        })
    })
});