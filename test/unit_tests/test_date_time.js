/**
 * Created by VinceZK on 3/17/15.
 */
var timeUtil = require('../../server/util/date_time.js');

describe('Time utility tests', function(){
    describe('Date prototype functions', function(){
        var testDate;

        beforeEach('#Constructor()',function(){
            testDate = timeUtil.StringToDate("2010-01-01 08:30:00");
        });
        it('2004 should be a leap year!', function(){
            testDate.setFullYear('2004');
            testDate.isLeapYear().should.be.true;
        });
        it('2005 should not be a leap year!', function(){
            testDate.setFullYear('2005');
            (testDate.isLeapYear()).should.be.false;
        });
        it('should add time correctly!', function(){
            testDate = testDate.DateAdd('s',1);
            testDate.Format('HH:mm:ss').should.be.equal("08:30:01");
            testDate = testDate.DateAdd('n',1);
            testDate.Format('HH:mm:ss').should.be.equal("08:31:01");
            testDate = testDate.DateAdd('n',30);
            testDate.Format('HH:mm:ss').should.be.equal("09:01:01");
            testDate = testDate.DateAdd('h',1);
            testDate.Format('HH:mm:ss').should.be.equal("10:01:01");
            testDate = testDate.DateAdd('d',1);
            testDate.Format('YYYY.MM.DD').should.be.equal("2010.01.02");
            testDate = testDate.DateAdd('d',31);
            testDate.Format('YYYY.MM.DD').should.be.equal("2010.02.02");
            testDate = testDate.DateAdd('m',5);
            testDate.Format('YYYY.MM.DD').should.be.equal("2010.07.02");
            testDate = testDate.DateAdd('m',7);
            testDate.Format('YYYY.MM.DD').should.be.equal("2011.02.02");
            testDate = testDate.DateAdd('w',2);
            testDate.Format('YYYY.MM.DD').should.be.equal("2011.02.16");
            testDate = testDate.DateAdd('y',2);
            testDate.Format('YYYY.MM.DD').should.be.equal("2013.02.16");
            testDate = testDate.DateAdd('q',1);
            testDate.Format('YYYY.MM.DD').should.be.equal("2013.05.16");
        });
        it('should caculate the difference between 2 date', function(){
            var endDate = new timeUtil.StringToDate("2010-02-03 08:30:00");
            testDate.DateDiff('d', endDate).should.be.equal(33);
        });

    });

    describe('#getCurrentDateTime()', function(){

       it('should be current time in string format',function(){
           var now = timeUtil.getCurrentDateTime("YYYY/MM/DD hh:mm:ss");
           console.log(now);
           now.should.startWith('20');
       });

    });

    describe('#getFutureDateTime()', function(){
        it('should be current time in string format',function(){
            var future = timeUtil.getFutureDateTime(60);
            console.log("\n" + future);
            future.should.startWith('20');
        });
    });

    describe('#getPastDateTime()', function(){
        it('should be current time in string format',function(){
            var past = timeUtil.getPastDateTime(3600*24*7);
            console.log("\n" + past);
            past.should.startWith('20');
        });
    });
});