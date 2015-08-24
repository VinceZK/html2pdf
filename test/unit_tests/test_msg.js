/**
 * Created by VinceZK on 10/25/14.
 */
var msg = require('../../server/util/msg.js');
var testMsg;

describe('msg utility tests', function(){
    before('#Constructor()',function(){
        testMsg = new msg('user');
    });
    describe('#reportMsg()', function(){
        it('should report a USER_CREATION_FAIL msg', function(){
            var repMsg = testMsg.reportMsg('USER_CREATION_FAIL', 'E', 'test');
            repMsg.should.be.eql({msgName:'USER_CREATION_FAIL',
                                  msgType:'E',
                                  msgText:'Error: user: test failed to be created!'});
        });

        it('should return a general msg with ID_NOT_EXIST', function(){
            var repMsg = testMsg.reportMsg('ID_NOT_EXIST','E', 'USER_ID');
            repMsg.should.be.eql({msgName:'ID_NOT_EXIST',
                msgType:'E',
                msgText:'The unique attribute: USER_ID is invalid!'});
        });

        it('should return a general msg with KEY_NOT_EXIST', function(){
            var repMsg = testMsg.reportMsg('KEY_NOT_EXIST','E', 'test');
            repMsg.should.be.eql({msgName:'KEY_NOT_EXIST',
                msgType:'E',
                msgText:'The key: test is not exist!'});
        });

        it('should return a general msg', function(){
            var repMsg = testMsg.reportMsg('','A', 'report', 'a', 'general', 'message');
            repMsg.should.be.eql({msgName:'001',
                msgType:'U',
                msgText:'report a general message'});
        });
    });
});