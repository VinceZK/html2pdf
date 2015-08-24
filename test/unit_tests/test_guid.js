/**
 * Created by VinceZK on 10/12/14.
 */
var guid = require('../../server/util/guid.js');
describe('guid generator tests', function(){
    describe('#genTimeBased()', function(){
        it('should be a string of length 32', function(){
            var tmGuid = guid.genTimeBased();
            tmGuid.should.be.type('string').and.have.a.lengthOf(32);
        });

        it('should only contains [0-9][A-F]', function(){
            var tmGuid = guid.genTimeBased();
            tmGuid.should.match(/[0-9A-F]{32}/);
        })
    });

    describe('#genRandom()', function(){
        it('should be a string of length 32', function(){
            var rGuid = guid.genRandom();
            rGuid.should.be.type('string').and.have.a.lengthOf(32);
        });

        it('should only contains [0-9][A-F]', function(){
            var rGuid = guid.genRandom();
            rGuid.should.match(/[0-9A-F]{32}/);
        })
    })

});