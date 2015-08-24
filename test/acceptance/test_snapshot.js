/**
 * Created by VinceZK on 7/12/15.
 */
var request = require('supertest');
request = request("http://localhost:3000");

describe('Snapshot acceptance tests',function() {

    var currJobGuid;

    describe('POST /pub/api/snapshot', function () {
        it('should submit a snapshot batch job!', function (done) {
            var urls = ['http://www.baidu.com','http://www.pingwest.com/momo-live-about-music/'];
            var opts = {format:'pdf', width:1920, height:1080};
            request
                .post('/pub/api/snapshot')
                .send({urls:urls, opts:opts})
                .expect(parseRetData)
                .expect(200,done);

            function parseRetData(res){
                if (res.body.errorMsg)
                    throw new Error(res.body.errorMsg);
                currJobGuid = res.body.jobGuid;
                if(currJobGuid.length !== 32)
                    throw new Error('No Job GUID is returned!');
            }
        });
    });

    describe('GET /pub/api/snapshot', function () {
        it('should return a job list!', function (done) {
            var jobGuids = [currJobGuid,'CBABF4790F7B4E3F981F83787D03277D'];
            request
                .get('/pub/api/snapshot')
                .query({jobGuids:jobGuids})
                .expect(parseRetData)
                .expect(200,done);

            function parseRetData(res){
                if (res.body.errorMsg)
                    throw new Error(res.body.errorMsg);
                if (res.body.jobList.length !== 2)
                    throw new Error('Job is not correctly returned!');
            }
        });
    });

    describe('PUT /pub/api/snapshot', function () {
        it('should add an email to the job', function (done) {
            request
                .put('/pub/api/snapshot')
                .send({jobGuids:[currJobGuid,'CBABF4790F7B4E3F981F83787D03277D'], email:'zklee1@hotmail.com'})
                .expect(parseRetData)
                .expect(200,done);

            function parseRetData(res){
                if (res.body.errorMsg)
                    throw new Error(res.body.errorMsg);
            }
        });
    });

    describe('PUT /pub/api/snapshot/list', function () {
        it('should a job list', function (done) {
            request
                .get('/pub/api/snapshot/list')
                .expect(parseRetData)
                .expect(200,done);

            function parseRetData(res){
                if (res.body.errorMsg)
                    throw new Error(res.body.errorMsg);
                if (res.body.numberOfItems <= 0)
                    throw new Error('Job list return incorrect!');
            }
        });
    });
});