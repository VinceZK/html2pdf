/**
 * Created by VinceZK on 7/11/15.
 */
var snapshot = require('../../server/models/server_snapshot.js');
var fs = require('fs');
var concat = require('concat-stream');
var guid = require('../../server/util/guid.js');

describe('page snapshot tests', function() {

    describe('#createSnapshotsFromURLs()', function () {
        it('should create a zip file with size of 3MB', function (done) {
            snapshot.createSnapshotsFromURLs(guid.genTimeBased(),
                                  ['http://www.baidu.com','http://www.pingwest.com/momo-live-about-music/'],
                                             {format:'png', width:1920, height:1080},
                function(zipStream, snapGuid){
                    zipStream.on('error', function(err){
                        //Should be no error
                    }).pipe(concat(function(data){
                        data.should.ok;
                        data.length.should.be.approximately(3000000,300000);
                        fs.unlink(snapGuid+'.zip');
                        done();
                    }));
                })
        });

        it('should report error for a non-exist URL', function(done){
            snapshot.createSnapshotsFromURLs(guid.genTimeBased(),['http://www.1234.com/'],null,
                function(zipStream,snapGuid){
                    zipStream.on('error',function(err){
                        err.should.ok;
                        console.log(err);
                        fs.unlink(snapGuid+'.zip');
                        done();
                    }).pipe(concat(function(data){
                        //Stream process
                    }));
                })
        });
    });

    describe('#createSnapshotsFromURL()',function(){
        it('should upload a pdf to aly oss',function(done){
            snapshot.createSnapshotsFromURL(guid.genTimeBased(),'http://tool.oschina.net/commons',
                {format:'pdf', width:1920, height:1080},
            function(retData,err){
                (err === null).should.ok;
                retData.should.ok;
                retData.size.should.be.greaterThan(0);
                done();
            })
        });

        it('should upload a png to aly oss',function(done){
            snapshot.createSnapshotsFromURL(guid.genTimeBased(),'http://tool.oschina.net/commons',
                {format:'png', width:1920, height:1080},
                function(retData,err){
                    (err === null).should.be.ok;
                    retData.should.ok;
                    retData.size.should.be.greaterThan(0);
                    done();
                })
        });

        it('should upload a jpeg to aly oss',function(done){
            snapshot.createSnapshotsFromURL(guid.genTimeBased(),'http://tool.oschina.net/commons',
                {format:'jpeg', width:1920, height:1080},
                function(retData,err){
                    (err === null).should.ok;
                    retData.should.ok;
                    retData.size.should.be.greaterThan(0);
                    done();
                })
        });

        it.only('should upload a gif to aly oss',function(done){
            snapshot.createSnapshotsFromURL(guid.genTimeBased(),'http://tool.oschina.net/commons',
                {format:'gif', width:1920, height:1080},
                function(retData,err){
                    (err === null).should.ok;
                    retData.should.ok;
//                    console.log(retData);
                    retData.size.should.be.greaterThan(0);
                    done();
                })
        });
    });

    describe('#createThumbnailFromURLs()',function(){
        it('should create a thumbnail and return information of the page', function (done) {
            snapshot.createThumbnailFromURLs('http://segmentfault.com/q/1010000000484993',{width:1230, height:1080},
                function(pRender){
                    pRender.pipe(concat(function(data){
                        pRender.pageInfo.should.ok;
                        console.log(pRender.pageInfo);
                        data.should.ok;
                        done();
//                        fs.writeFile('/Users/VinceZK/workspace/javascript/darkhouse/out.png',data,function(err){
//                            done();
//                        });
                    }));
                })
        });

        it('should upload the thumbnail to the ALY OSS',function(done){
            snapshot.createThumbnailFromURLs('http://segmentfault.com/q/1010000000484993',{width:1230, height:1080},
                function(pRender){
                    snapshot.saveThumbnail2ALYOSS(pRender, guid.genTimeBased(),0,
                        function(retData,errMsg){
                            (errMsg === undefined).should.be.ok;
                            retData.should.be.ok;
                            done();
                    });
                })
        });

        it('should report render error',function(done){
            snapshot.createThumbnailFromURLs('http://www.google.com',{width:1230, height:1080},
                function(pRender){
                    snapshot.saveThumbnail2ALYOSS(pRender, guid.genTimeBased(),0,
                        function(retData,errMsg){
                            errMsg.msgName.should.be.equal('PHANTOM_RENDER_ERROR');
                            done();
                        });
                })
        })
    });

    describe('#saveSnapStream2ALYOSS() and #deleteSnapshotOnOSS()', function () {
        var currSnapGuid;
        it('should upload the zip file to OSS', function (done) {
            var startTime = Date.now();
            snapshot.createSnapshotsFromURLs(guid.genTimeBased(),['http://www.baidu.com'],
                {format:'gif', width:1280, height:960, quality:100},
                function(zipStream, snapGuid){
                    snapshot.saveSnapStream2ALYOSS(zipStream, snapGuid,
                        function(retData, errMsg){
                            (errMsg === undefined).should.be.ok;
                            retData.should.be.ok;
                            currSnapGuid = snapGuid;
                            console.log(retData);
                            var endTime = Date.now();
                            console.log('Total Time Cost: ' + (endTime-startTime)/1000 + 'S.');
                            done();
                    })
                })
        });

        it('should delete the zip file on OSS', function(done){
            snapshot.deleteSnapshotOnOSS(currSnapGuid,function(retData, errMsg){
                (errMsg === undefined).should.be.ok;
                retData.should.be.ok;
                done();
            })
        });

        it('should report an error for the non-exist URL', function (done) {
            var startTime = Date.now();
            snapshot.createSnapshotsFromURLs(guid.genTimeBased(),['http://www.1234.com'],
                {format:'gif', width:1280, height:960, quality:100},
                function(zipStream, snapGuid){
                    snapshot.saveSnapStream2ALYOSS(zipStream, snapGuid,
                        function(retData, err){
                            err.should.be.ok;
                            err.msgName.should.be.equal('PHANTOM_RENDER_ERROR');
                            var endTime = Date.now();
                            console.log('Total Time Cost: ' + (endTime-startTime)/1000 + 'S.');
                            currSnapGuid = snapGuid;
                            done();
                        })
                })
        });

        it('should not delete the non-exist zip file on OSS', function(){
            snapshot.deleteSnapshotOnOSS(currSnapGuid,function(retData, errMsg){
                errMsg.should.be.ok;
                errMsg.msgName.should.be.equal('ALY_OSS_DELETE_OBJECT_ERROR');
                //done();
            })
        });
    });

    describe('#postUrl2Baidu()',function(){
        it('should post 2 URLs to the Baidu',function(done){
            snapshot.postUrl2Baidu(['http://html2pdf.cn','http://darkhouse.com.cn/blog'],function(retData){
                retData.success.should.be.equal(1);
                done();
            })
        })
    });

    describe('#sendDownloadLink()', function () {
        it('should send a successful mail', function(done){
            snapshot.sendDownloadLink('zklee@hotmail.com','04351B514587477B94A288FC21737961','http://www.baidu.com',
                function(error, info){
                (error === null).should.be.ok;
                info.response.should.match(/^250/);
                done();
            })
        });

        it('should send a fail mail', function(done){
            snapshot.sendFailedMail('zklee@hotmail.com','http://www.baidu.com','网页打开时发生错误！',
                function(error, info){
                (error === null).should.be.ok;
                info.response.should.match(/^250/);
                done();
            })
        });
    })

});